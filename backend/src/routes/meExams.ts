import { Router } from "express";
import { Op, fn, col } from "sequelize";
import {
  Exam,
  AcademicExamType,
  StudentAssessmentResult,
  Student,
  ClassRoom,
  User,
  UserClassAuthorization,
} from "../models/index.js";
import { resolveReadTermYearFromQuery } from "../lib/officialSchoolTermYear.js";

function trimStr(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t) return null;
  return t.length > max ? t.slice(0, max) : t;
}

async function getUserRole(userId: number): Promise<string> {
  const user = await User.findByPk(userId, { attributes: ["id", "role"] });
  return user?.role?.toLowerCase() ?? "";
}

async function getAccessibleClassrooms(userId: number): Promise<Array<{ id: number; name: string }>> {
  const role = await getUserRole(userId);
  if (role === "admin") {
    const rows = await ClassRoom.findAll({
      attributes: ["id", "name"],
      order: [["name", "ASC"]],
    });
    return rows.map((x) => ({ id: x.id, name: x.name }));
  }

  const rows = await UserClassAuthorization.findAll({
    where: { userId },
    include: [{ model: ClassRoom, as: "classRoom", attributes: ["id", "name"], required: true }],
  });
  return rows
    .map((x) => {
      const cls = x.get("classRoom") as ClassRoom | undefined;
      if (!cls) return null;
      return { id: cls.id, name: cls.name };
    })
    .filter((x): x is { id: number; name: string } => x != null);
}

export function createMeExamsRouter() {
  const r = Router();

  r.get("/exams/upcoming", async (req, res) => {
    try {
      const userId = req.userId!;
      const classes = await getAccessibleClassrooms(userId);
      const classIds = classes.map((x) => x.id);

      const rows = await Exam.findAll({
        where: {
          classRoomId: { [Op.in]: classIds },
          examDate: { [Op.gte]: new Date().toISOString().split("T")[0] },
        },
        include: [{ model: ClassRoom, as: "classRoom", attributes: ["name"] }],
        order: [["examDate", "ASC"]],
        limit: 10,
      });

      return res.json({
        items: rows.map((x) => ({
          id: x.id,
          examKey: x.examKey,
          className: (x.get("classRoom") as ClassRoom)?.name ?? "Unknown",
          subject: x.subject,
          examDate: x.examDate,
        })),
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  r.get("/exams/types", async (_req, res) => {
    try {
      const rows = await AcademicExamType.findAll({
        where: { isActive: true },
        order: [["displayName", "ASC"]],
      });
      return res.json({
        items: rows.map((x) => ({
          id: x.id,
          examKey: x.examKey,
          displayName: x.displayName,
        })),
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  r.get("/exams/performance-summary", async (req, res) => {
    try {
      const userId = req.userId!;
      const { term, academicYear } = await resolveReadTermYearFromQuery(req.query);
      const classes = await getAccessibleClassrooms(userId);
      const classIds = classes.map((x) => x.id);

      if (classIds.length === 0) return res.json({ items: [] });

      // Aggregate average scores per class for the term
      const results = await StudentAssessmentResult.findAll({
        where: { term, academicYear, classRoomId: { [Op.in]: classIds } },
        attributes: ["classRoomId", [fn("AVG", col("score")), "avgScore"]],
        group: ["classRoomId"],
        include: [{ model: ClassRoom, as: "classRoom", attributes: ["name"] }],
      });

      return res.json({
        items: results.map((x: any) => ({
          classRoomId: x.classRoomId,
          className: x.classRoom?.name ?? "Unknown",
          avgScore: parseFloat(x.get("avgScore") || "0").toFixed(2),
        })),
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  r.get("/exams/results", async (req, res) => {
    try {
      const userId = req.userId!;
      const { term, academicYear } = await resolveReadTermYearFromQuery(req.query);
      const examType = trimStr(req.query.examType, 40);
      const classRoomId = Number(req.query.classRoomId);

      if (!examType || isNaN(classRoomId)) {
        return res.status(400).json({ error: "examType and classRoomId are required" });
      }

      const classes = await getAccessibleClassrooms(userId);
      if (!classes.some((x) => x.id === classRoomId)) {
        return res.status(403).json({ error: "Access denied" });
      }

      const results = await StudentAssessmentResult.findAll({
        where: { term, academicYear, examType, classRoomId },
        include: [{ model: Student, as: "student", attributes: ["firstName", "lastName", "admissionNumber"] }],
        order: [[{ model: Student, as: "student" }, "firstName", "ASC"]],
      });

      return res.json({
        items: results.map((x) => {
          const student = x.get("student") as Student | undefined;
          return {
            id: x.id,
            studentName: `${student?.firstName ?? ""} ${student?.lastName ?? ""}`.trim(),
            admissionNumber: student?.admissionNumber,
            subject: x.subject,
            score: x.score,
            remarks: x.remarks,
          };
        }),
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  return r;
}
