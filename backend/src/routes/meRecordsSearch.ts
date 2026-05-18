import { Router } from "express";
import { Op } from "sequelize";
import {
  ClassRoom,
  Student,
  StudentAssessmentResult,
  StudentFeeAssignment,
  StudentFeePayment,
  StudentFeeReceipt,
  User,
} from "../models/index.js";
import { resolveReadTermYearFromQuery } from "../lib/officialSchoolTermYear.js";

function trimStr(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t) return null;
  return t.length > max ? t.slice(0, max) : t;
}

async function isAdminUser(userId: number | null | undefined): Promise<boolean> {
  if (!userId) return false;
  const user = await User.findByPk(userId, { attributes: ["role"] });
  const r = String(user?.role ?? "").toLowerCase();
  return r === "admin" || r === "super_admin";
}

function studentLabel(s: Student | null | undefined): string {
  if (!s) return "—";
  return [s.firstName, s.lastName].filter(Boolean).join(" ").trim() || "—";
}

export function createMeRecordsSearchRouter() {
  const r = Router();

  r.get("/records/search", async (req, res) => {
    try {
      if (!(await isAdminUser(req.userId))) {
        return res.status(403).json({ error: "Admin only" });
      }
      const { term, academicYear } = await resolveReadTermYearFromQuery(req.query);
      const q = trimStr(req.query.q, 120);
      const lim = Number.parseInt(String(req.query.limit ?? "30"), 10);
      const limit = Number.isFinite(lim) ? Math.max(1, Math.min(100, lim)) : 30;

      const safeLike = q
        ? q.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_")
        : "";
      const studentWhere =
        q != null
          ? {
              [Op.or]: [
                { firstName: { [Op.like]: `%${safeLike}%` } },
                { lastName: { [Op.like]: `%${safeLike}%` } },
                { admissionNumber: { [Op.like]: `%${safeLike}%` } },
              ],
            }
          : undefined;

      const studentRows =
        q != null
          ? await Student.findAll({
              attributes: ["id"],
              where: studentWhere,
              limit: 400,
            })
          : null;
      const studentIds = studentRows?.map((s) => s.id) ?? null;

      const financeBase = { term, academicYear };
      const financeWhere =
        studentIds == null
          ? financeBase
          : studentIds.length > 0
            ? { ...financeBase, studentId: { [Op.in]: studentIds } }
            : { ...financeBase, studentId: -1 };

      const academicsWhere =
        studentIds == null
          ? { term, academicYear }
          : studentIds.length > 0
            ? { term, academicYear, studentId: { [Op.in]: studentIds } }
            : { term, academicYear, studentId: -1 };

      const [assignments, payments, receipts, assessmentRows] = await Promise.all([
        StudentFeeAssignment.findAll({
          where: financeWhere,
          include: [
            {
              model: Student,
              as: "student",
              attributes: ["id", "firstName", "lastName", "admissionNumber"],
              required: false,
            },
          ],
          order: [["created_at", "DESC"]],
          limit,
        }),
        StudentFeePayment.findAll({
          where: financeWhere,
          include: [
            {
              model: Student,
              as: "student",
              attributes: ["id", "firstName", "lastName", "admissionNumber"],
              required: false,
            },
          ],
          order: [["created_at", "DESC"]],
          limit,
        }),
        StudentFeeReceipt.findAll({
          where: financeWhere,
          include: [
            {
              model: Student,
              as: "student",
              attributes: ["id", "firstName", "lastName", "admissionNumber"],
              required: false,
            },
          ],
          order: [["created_at", "DESC"]],
          limit,
        }),
        StudentAssessmentResult.findAll({
          where: academicsWhere,
          include: [
            {
              model: Student,
              as: "student",
              attributes: ["id", "firstName", "lastName", "admissionNumber"],
              required: false,
            },
            {
              model: ClassRoom,
              as: "classRoom",
              attributes: ["id", "name"],
              required: false,
            },
          ],
          order: [["updated_at", "DESC"]],
          limit,
        }),
      ]);

      return res.json({
        term,
        academicYear,
        finance: {
          assignments: assignments.map((x) => ({
            id: x.id,
            studentId: x.studentId,
            studentName: studentLabel(x.get("student") as Student | null),
            admissionNumber: (x.get("student") as Student | null)?.admissionNumber ?? null,
            term: x.term,
            academicYear: x.academicYear,
            amountDueUgx: Number(x.amountDueUgx),
            notes: x.notes ?? null,
          })),
          payments: payments.map((x) => ({
            id: x.id,
            studentId: x.studentId,
            studentName: studentLabel(x.get("student") as Student | null),
            admissionNumber: (x.get("student") as Student | null)?.admissionNumber ?? null,
            term: x.term,
            academicYear: x.academicYear,
            amountPaidUgx: Number(x.amountPaidUgx),
            paymentMethod: x.paymentMethod,
            paidBy: x.paidBy,
            receiptId: x.receiptId,
          })),
          receipts: receipts.map((x) => ({
            id: x.id,
            studentId: x.studentId,
            studentName: studentLabel(x.get("student") as Student | null),
            admissionNumber: (x.get("student") as Student | null)?.admissionNumber ?? null,
            receiptNo: x.receiptNo,
            term: x.term,
            academicYear: x.academicYear,
            amountPaidUgx: Number(x.amountPaidUgx),
            paymentMethod: x.paymentMethod,
          })),
        },
        academics: {
          results: assessmentRows.map((x) => ({
            id: x.id,
            studentId: x.studentId,
            studentName: studentLabel(x.get("student") as Student | null),
            admissionNumber: (x.get("student") as Student | null)?.admissionNumber ?? null,
            classRoomId: x.classRoomId,
            className: (x.get("classRoom") as ClassRoom | null)?.name ?? null,
            term: x.term,
            academicYear: x.academicYear,
            examType: x.examType,
            subject: x.subject,
            score: Number(x.score),
          })),
        },
      });
    } catch (err) {
      console.error(err);
      return res.status(503).json({ error: "Database unavailable" });
    }
  });

  return r;
}
