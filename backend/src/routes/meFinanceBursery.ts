import { Router } from "express";
import {
  Student,
  StudentFeeAssignment,
  StudentFeeStructure,
  ClassRoom,
} from "../models/index.js";
import { loadOfficialSchoolTermYear } from "../lib/officialSchoolTermYear.js";

function studentClassName(student: Student): string | null {
  const assoc = student.get("classRoom") as { name?: string } | null | undefined;
  const fromAssoc = typeof assoc?.name === "string" ? assoc.name : null;
  const fromFlat = student.get("class_name") as string | null | undefined;
  return fromAssoc ?? fromFlat ?? null;
}

function isP7Class(className: string | null | undefined): boolean {
  const s = (className ?? "").trim().toLowerCase();
  return s.includes("p7") || s.includes("primary seven");
}

function normalizeStudentBoardingStatus(v: unknown): "day_half" | "day_full" | "boarding" | null {
  if (v === "day_half" || v === "day_full" || v === "boarding") return v;
  return null;
}

function toFeeStructureStatus(
  boardingStatus: "day_half" | "day_full" | "boarding" | null,
  className: string | null | undefined,
): string | null {
  if (boardingStatus === "day_full" && isP7Class(className)) return "day_full_p7";
  return boardingStatus;
}

export function createMeFinanceBurseryRouter() {
  const r = Router();

  /** Assign or update a bursary (percentage discount) for a student. */
  r.post("/finance/bursery", async (req, res) => {
    try {
      const { studentId, percentage, term, startsAt, endsAt } = req.body;
      const parsedStudentId = Number(studentId);
      const parsedPercentage = Number(percentage);
      const parsedStartsAt =
        typeof startsAt === "string" && startsAt.trim()
          ? new Date(startsAt)
          : null;
      const parsedEndsAt =
        typeof endsAt === "string" && endsAt.trim()
          ? new Date(endsAt)
          : null;

      if (!Number.isFinite(parsedStudentId) || parsedStudentId < 1) {
        return res.status(400).json({ error: "Invalid studentId" });
      }
      if (!Number.isFinite(parsedPercentage) || parsedPercentage <= 0 || parsedPercentage > 100) {
        return res.status(400).json({ error: "Percentage must be greater than 0 and at most 100" });
      }
      if (!term || typeof term !== "string") {
        return res.status(400).json({ error: "Term is required to apply the discount" });
      }
      const official = await loadOfficialSchoolTermYear();
      const termTrim = term.trim();
      if (termTrim !== official.term) {
        return res.status(400).json({
          error: `Bursary fee updates apply only to the school's current term (${official.term}).`,
        });
      }
      const academicYear = official.academicYear;
      if (!parsedStartsAt || !parsedEndsAt) {
        return res.status(400).json({ error: "Bursary start and end dates are required" });
      }
      if (parsedStartsAt && Number.isNaN(parsedStartsAt.getTime())) {
        return res.status(400).json({ error: "Invalid bursary start time" });
      }
      if (parsedEndsAt && Number.isNaN(parsedEndsAt.getTime())) {
        return res.status(400).json({ error: "Invalid bursary end time" });
      }
      if (parsedStartsAt && parsedEndsAt && parsedEndsAt.getTime() <= parsedStartsAt.getTime()) {
        return res.status(400).json({ error: "Bursary end time must be after start time" });
      }

      const student = await Student.findByPk(parsedStudentId, {
        include: [{ model: ClassRoom, as: "classRoom", required: false }],
      });
      if (!student) return res.status(404).json({ error: "Student not found" });

      // Wrap student + assignment updates in a transaction so the bursary
      // percentage and the fee assignment never drift out of sync on failure.
      const sequelize = Student.sequelize;
      if (!sequelize) {
        return res.status(500).json({ error: "Database not initialized" });
      }
      const boardingStatus = normalizeStudentBoardingStatus(student.boardingStatus);
      const className = studentClassName(student);
      const feeStatus = toFeeStructureStatus(boardingStatus, className);

      await sequelize.transaction(async (t) => {
        await student.update(
          {
            bursaryPercentage: parsedPercentage,
            bursaryStartsAt: parsedStartsAt,
            bursaryEndsAt: parsedEndsAt,
          },
          { transaction: t },
        );

        const structure = feeStatus
          ? await StudentFeeStructure.findOne({
              where: { term: termTrim, boardingStatus: feeStatus },
              transaction: t,
            })
          : null;

        const baseAmount = structure ? Number(structure.amountDueUgx) : 0;

        if (baseAmount > 0) {
          const discountedAmount = Math.round(
            baseAmount * (1 - parsedPercentage / 100),
          );

          const finalNotes =
            parsedPercentage > 0 ? `Bursery applied: ${parsedPercentage}%` : null;
          const [assignment, created] = await StudentFeeAssignment.findOrCreate({
            where: { studentId: parsedStudentId, term: termTrim, academicYear },
            defaults: {
              amountDueUgx: discountedAmount,
              notes: finalNotes ?? `Bursery applied: ${parsedPercentage}%`,
            },
            transaction: t,
          });
          if (!created) {
            await assignment.update(
              { amountDueUgx: discountedAmount, notes: finalNotes },
              { transaction: t },
            );
          }
        }
      });

      return res.json({
        ok: true,
        studentId: parsedStudentId,
        bursaryPercentage: parsedPercentage,
        bursaryStartsAt: parsedStartsAt,
        bursaryEndsAt: parsedEndsAt,
        appliedToTerm: termTrim,
        academicYear,
      });
    } catch (err) {
      console.error(err);
      return res.status(503).json({ error: "Database unavailable" });
    }
  });

  /**
   * Revoke bursary (reset to 0).
   * BREAKING CHANGE: `term` is now read from the query string (`?term=Term%201`).
   * Some HTTP clients and proxies strip request bodies on DELETE, so passing
   * `term` via `req.body` was unreliable. Frontend callers must use a query param.
   */
  r.delete("/finance/bursery/:studentId", async (req, res) => {
    try {
      const studentId = Number(req.params.studentId);
      const term = typeof req.query.term === "string" ? req.query.term : undefined;

      if (!Number.isFinite(studentId) || studentId < 1) {
        return res.status(400).json({ error: "Invalid studentId" });
      }
      if (!term || typeof term !== "string") {
        return res.status(400).json({ error: "Term is required (pass ?term=Term%201) to restore default fees" });
      }
      const official = await loadOfficialSchoolTermYear();
      const termTrim = term.trim();
      if (termTrim !== official.term) {
        return res.status(400).json({
          error: `Use the school's current term (${official.term}) to restore fees after revoking bursary.`,
        });
      }
      const academicYear = official.academicYear;

      const student = await Student.findByPk(studentId, {
        include: [{ model: ClassRoom, as: "classRoom", required: false }],
      });
      if (!student) return res.status(404).json({ error: "Student not found" });

      const sequelize = Student.sequelize;
      if (!sequelize) {
        return res.status(500).json({ error: "Database not initialized" });
      }
      const boardingStatus = normalizeStudentBoardingStatus(student.boardingStatus);
      const className = studentClassName(student);
      const feeStatus = toFeeStructureStatus(boardingStatus, className);

      await sequelize.transaction(async (t) => {
        await student.update(
          { bursaryPercentage: 0, bursaryStartsAt: null, bursaryEndsAt: null },
          { transaction: t },
        );

        const structure = feeStatus
          ? await StudentFeeStructure.findOne({
              where: { term: termTrim, boardingStatus: feeStatus },
              transaction: t,
            })
          : null;

        const baseAmount = structure ? Number(structure.amountDueUgx) : 0;

        if (baseAmount > 0) {
          const assignment = await StudentFeeAssignment.findOne({
            where: { studentId, term: termTrim, academicYear },
            transaction: t,
          });
          if (assignment) {
            await assignment.update(
              {
                amountDueUgx: baseAmount,
                notes: "Bursery revoked",
              },
              { transaction: t },
            );
          }
        }
      });

      return res.json({
        ok: true,
        studentId,
        bursaryPercentage: 0,
        bursaryStartsAt: null,
        bursaryEndsAt: null,
        restoredTerm: termTrim,
        academicYear,
      });
    } catch (err) {
      console.error(err);
      return res.status(503).json({ error: "Database unavailable" });
    }
  });

  return r;
}
