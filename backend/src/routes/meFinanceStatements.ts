import { Router } from "express";
import { Op } from "sequelize";
import { studentToApiRow } from "../formatting/studentRow.js";
import {
  ClassRoom,
  Student,
  StudentFeeAssignment,
  StudentFeePayment,
  StudentFeeReceipt,
  StudentFeeStructure,
} from "../models/index.js";
import { dayRangeUtc } from "../lib/dateBounds.js";
import {
  listNonCompliantStudentsForTerm,
  scheduleFeeComplianceCheckAndNotify,
} from "../services/feeAssignmentCompliance.js";
import { calculateStatementSummary } from "../services/pythonCalc.js";
import { loadOfficialSchoolTermYear, resolveReadTermYearFromQuery } from "../lib/officialSchoolTermYear.js";

function parseIsoDate(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : null;
}

/** Canonical statuses used to match students → fee rows (admin must add matching rows in Settings). */
const BOARDING_STATUSES = ["day_half", "day_full", "day_full_p7", "boarding"] as const;
type BoardingStatus = (typeof BOARDING_STATUSES)[number];

function normalizeBoardingStatus(v: unknown): BoardingStatus | null {
  if (typeof v !== "string") return null;
  return BOARDING_STATUSES.includes(v as BoardingStatus) ? (v as BoardingStatus) : null;
}

/** Accept any non-empty string as a valid status slug (for custom entities). */
function normalizeAnyStatus(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const trimmed = v.trim().slice(0, 60);
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeStudentBoardingStatus(v: unknown): "day_half" | "day_full" | "boarding" | null {
  if (v === "day_half" || v === "day_full" || v === "boarding") return v;
  return null;
}

function isP7Class(className: string | null | undefined): boolean {
  const s = (className ?? "").trim().toLowerCase();
  return s.includes("p7") || s.includes("primary seven");
}

function toFeeStructureStatus(
  boardingStatus: "day_half" | "day_full" | "boarding" | null,
  className: string | null | undefined,
): BoardingStatus | null {
  if (boardingStatus === "day_full" && isP7Class(className)) return "day_full_p7";
  return boardingStatus;
}

function studentClassName(student: Student): string | null {
  const assoc = student.get("classRoom") as { name?: string } | null | undefined;
  const fromAssoc = typeof assoc?.name === "string" ? assoc.name : null;
  const fromFlat = student.get("class_name") as string | null | undefined;
  return fromAssoc ?? fromFlat ?? null;
}

function parseAmountUgx(v: unknown): number | null {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n);
}

export function createMeFinanceStatementsRouter() {
  const r = Router();

  r.get("/finance/statements/:studentId", async (req, res) => {
    try {
      const studentId = Number(req.params.studentId);
      if (!Number.isFinite(studentId) || studentId < 1) {
        return res.status(400).json({ error: "Invalid studentId" });
      }
      const student = await Student.findByPk(studentId, {
        include: [{ model: ClassRoom, as: "classRoom", required: false }],
      });
      if (!student) return res.status(404).json({ error: "Student not found" });

      const { academicYear, term: defaultTermFromPicker } = await resolveReadTermYearFromQuery(req.query);
      let term =
        typeof req.query.term === "string" && req.query.term.trim() ? req.query.term.trim() : "";
      if (!term) {
        const latestReceipt = await StudentFeeReceipt.findOne({
          where: { studentId, academicYear },
          order: [["created_at", "DESC"]],
        });
        term = latestReceipt?.term ?? defaultTermFromPicker;
      }

      const assignment = await StudentFeeAssignment.findOne({
        where: { studentId, term, academicYear },
      });
      const boardingStatus = normalizeStudentBoardingStatus(student.boardingStatus);
      const className = studentClassName(student);
      const feeStatus = toFeeStructureStatus(boardingStatus, className);
      const structure =
        assignment == null && feeStatus != null
          ? await StudentFeeStructure.findOne({ where: { term, boardingStatus: feeStatus } })
          : null;
      const payments = await StudentFeePayment.findAll({
        where: { studentId, term, academicYear },
        order: [["created_at", "ASC"]],
      });
      const receipts = await StudentFeeReceipt.findAll({
        where: { studentId, term, academicYear },
        order: [["created_at", "ASC"]],
      });
      const receiptById = new Map<number, StudentFeeReceipt>();
      for (const rcp of receipts) receiptById.set(rcp.id, rcp);

      const percentage = Number(student.bursaryPercentage) || 0;
      const baseAssigned = Number(assignment?.amountDueUgx ?? structure?.amountDueUgx ?? 0) || 0;
      
      // If we are using the structure (no assignment exists), apply the percentage.
      // If assignment exists, we assume it already has the percentage applied (as per our update logic).
      const totalAssigned = assignment 
        ? baseAssigned 
        : Math.round(baseAssigned * (1 - percentage / 100));

      const paymentAmounts = payments.map((p) => Number(p.amountPaidUgx) || 0);
      const summary = await calculateStatementSummary({
        totalAssignedUgx: totalAssigned,
        paymentAmountsUgx: paymentAmounts,
      });

      const transactions = payments.map((p, idx) => {
        const amt = paymentAmounts[idx] ?? 0;
        const receipt =
          p.receiptId != null ? receiptById.get(p.receiptId) ?? null : null;
        return {
          id: p.id,
          date:
            p.createdAt ??
            (p.get("created_at") as Date | string | undefined) ??
            new Date().toISOString(),
          receiptNo: receipt?.receiptNo ?? "—",
          method: p.paymentMethod,
          paidBy: p.paidBy,
          amountPaid: amt,
          runningBalance: summary.runningBalancesUgx[idx] ?? 0,
        };
      });

      return res.json({
        item: {
          student: studentToApiRow(student),
          term,
          academicYear,
          assignedAmount: summary.normalizedAssignedUgx,
          totalPaid: summary.totalPaidUgx,
          outstandingAmount: summary.outstandingAmountUgx,
          creditAmount: summary.creditAmountUgx,
          transactions,
        },
      });
    } catch (err) {
      console.error(err);
      return res.status(503).json({ error: "Database unavailable" });
    }
  });

  r.post("/finance/fees/assign", async (req, res) => {
    try {
      const body = req.body as Record<string, unknown>;
      const studentId = Number(body.studentId);
      const term = typeof body.term === "string" ? body.term.trim() : "";
      const amountDue = Number(body.amountDueUgx);
      const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 255) : null;
      if (!Number.isFinite(studentId) || studentId < 1) {
        return res.status(400).json({ error: "Invalid studentId" });
      }
      if (!term) return res.status(400).json({ error: "term is required" });
      if (!Number.isFinite(amountDue) || amountDue <= 0) {
        return res
          .status(400)
          .json({ error: "amountDueUgx must be greater than zero (UGX)." });
      }
      const official = await loadOfficialSchoolTermYear();
      if (term !== official.term) {
        return res.status(400).json({
          error: `Assignments must use the school's current term (${official.term}).`,
        });
      }
      const student = await Student.findByPk(studentId);
      if (!student) return res.status(404).json({ error: "Student not found" });
      const finalValues = { amountDueUgx: Math.round(amountDue), notes };
      const [row, created] = await StudentFeeAssignment.findOrCreate({
        where: { studentId, term: official.term, academicYear: official.academicYear },
        defaults: finalValues,
      });
      if (!created) {
        await row.update(finalValues);
      }
      scheduleFeeComplianceCheckAndNotify();
      return res.status(201).json({
        item: {
          id: row.id,
          studentId: row.studentId,
          term: row.term,
          academicYear: row.academicYear,
          amountDueUgx: Number(row.amountDueUgx),
          notes: row.notes ?? null,
          createdAt:
            row.createdAt ??
            (row.get("created_at") as Date | string | undefined) ??
            new Date().toISOString(),
        },
      });
    } catch (err) {
      console.error(err);
      return res.status(503).json({ error: "Database unavailable" });
    }
  });

  r.get("/finance/fees/structure", async (req, res) => {
    try {
      const term = typeof req.query.term === "string" ? req.query.term.trim() : "";
      if (!term) return res.status(400).json({ error: "term is required" });
      const rows = await StudentFeeStructure.findAll({
        where: { term },
        order: [["boarding_status", "ASC"]],
      });
      const items = rows.map((row) => ({
        status: row.boardingStatus,
        label: ((row.get("label") as string | null) ?? "").trim() || row.boardingStatus,
        amountDueUgx: Number(row.amountDueUgx),
        notes: row.notes ?? null,
        isSystem: false,
      }));
      return res.json({ items });
    } catch (err) {
      console.error(err);
      return res.status(503).json({ error: "Database unavailable" });
    }
  });

  r.post("/finance/fees/structure/apply", async (req, res) => {
    try {
      const body = req.body as Record<string, unknown>;
      const term = typeof body.term === "string" ? body.term.trim() : "";
      if (!term) return res.status(400).json({ error: "term is required" });

      const rawItems = Array.isArray(body.items) ? body.items : [];
      if (rawItems.length === 0) {
        return res.status(400).json({ error: "items are required" });
      }

      const parsedItems: Array<{ status: string; label: string | null; amountDueUgx: number; notes: string | null }> = [];
      for (const raw of rawItems) {
        const item = raw as Record<string, unknown>;
        const status = normalizeAnyStatus(item.status);
        const amountDueUgx = parseAmountUgx(item.amountDueUgx);
        const notes = typeof item.notes === "string" ? item.notes.trim().slice(0, 255) : null;
        const label = typeof item.label === "string" ? item.label.trim().slice(0, 120) : null;
        if (!status) {
          return res.status(400).json({ error: "Invalid student status in items" });
        }
        if (amountDueUgx == null) {
          return res.status(400).json({ error: "Invalid amountDueUgx in items" });
        }
        parsedItems.push({ status, label, amountDueUgx, notes });
      }

      const uniqueByStatus = new Map<string, { label: string | null; amountDueUgx: number; notes: string | null }>();
      for (const item of parsedItems) {
        uniqueByStatus.set(item.status, { label: item.label, amountDueUgx: item.amountDueUgx, notes: item.notes });
      }

      // Remove custom entities from DB that are no longer in the payload
      const deleteStatuses = typeof body.deleteStatuses === "string" ? body.deleteStatuses.split(",").map((s: string) => s.trim()).filter(Boolean) : [];

      const txn = await StudentFeeStructure.sequelize!.transaction();
      let updatedAssignments = 0;
      const { academicYear } = await loadOfficialSchoolTermYear();
      try {
        for (const delStatus of deleteStatuses) {
          await StudentFeeStructure.destroy({
            where: { term, boardingStatus: delStatus },
            transaction: txn,
          });
        }

        // Load all students once instead of re-querying per status; without the
        // include we cannot compute the effective fee status from boarding+class.
        const allStudents = await Student.findAll({
          attributes: ["id", "boardingStatus"],
          include: [{ model: ClassRoom, as: "classRoom", required: false, attributes: ["name"] }],
          transaction: txn,
        });

        const studentsByEffectiveStatus = new Map<BoardingStatus, Array<{ id: number }>>();
        for (const stu of allStudents) {
          const stBoarding = normalizeStudentBoardingStatus(stu.boardingStatus);
          const stClassName = studentClassName(stu);
          const stStatus = toFeeStructureStatus(stBoarding, stClassName);
          if (!stStatus) continue;
          const list = studentsByEffectiveStatus.get(stStatus) ?? [];
          list.push({ id: stu.id });
          studentsByEffectiveStatus.set(stStatus, list);
        }

        for (const [status, item] of uniqueByStatus.entries()) {
          await StudentFeeStructure.upsert(
            {
              term,
              boardingStatus: status,
              amountDueUgx: item.amountDueUgx,
              notes: item.notes,
              label: item.label,
            } as any,
            { transaction: txn },
          );

          // Only auto-assign students for the 4 built-in boarding statuses
          const boardingStatus = normalizeBoardingStatus(status);
          if (!boardingStatus) continue;

          const targets = studentsByEffectiveStatus.get(boardingStatus) ?? [];
          if (targets.length === 0) continue;

          const rows = targets.map((stu) => ({
            studentId: stu.id,
            term,
            academicYear,
            amountDueUgx: item.amountDueUgx,
            notes: item.notes,
          }));
          await StudentFeeAssignment.bulkCreate(rows as any, {
            updateOnDuplicate: ["amountDueUgx", "notes"],
            transaction: txn,
          });
          updatedAssignments += targets.length;
        }
        await txn.commit();
      } catch (e) {
        await txn.rollback();
        throw e;
      }

      return res.status(201).json({
        ok: true,
        term,
        statusesApplied: uniqueByStatus.size,
        updatedAssignments,
      });
    } catch (err) {
      console.error(err);
      return res.status(503).json({ error: "Database unavailable" });
    }
  });

  r.get("/finance/fees/assignments", async (req, res) => {
    try {
      const studentIdRaw = Number(req.query.studentId);
      const { term, academicYear } = await resolveReadTermYearFromQuery(req.query);
      const where: Record<string, unknown> = { term, academicYear };
      if (Number.isFinite(studentIdRaw) && studentIdRaw > 0) where.studentId = studentIdRaw;
      const rows = await StudentFeeAssignment.findAll({
        where,
        order: [
          ["term", "ASC"],
          ["created_at", "DESC"],
        ],
      });
      return res.json({
        items: rows.map((x) => ({
          id: x.id,
          studentId: x.studentId,
          term: x.term,
          academicYear: x.academicYear,
          amountDueUgx: Number(x.amountDueUgx),
          notes: x.notes ?? null,
          createdAt:
            x.createdAt ??
            (x.get("created_at") as Date | string | undefined) ??
            new Date().toISOString(),
        })),
      });
    } catch (err) {
      console.error(err);
      return res.status(503).json({ error: "Database unavailable" });
    }
  });

  r.get("/finance/fees/compliance", async (req, res) => {
    try {
      const { term, academicYear } = await resolveReadTermYearFromQuery(req.query);
      const items = await listNonCompliantStudentsForTerm(term, academicYear);
      return res.json({ term, academicYear, count: items.length, items });
    } catch (err) {
      console.error(err);
      return res.status(503).json({ error: "Database unavailable" });
    }
  });

  r.get("/finance/statements", async (req, res) => {
    try {
      const studentIdRaw = Number(req.query.studentId);
      const onDate = parseIsoDate(req.query.date);
      const lim = Number.parseInt(String(req.query.limit ?? "20"), 10);
      const limit = Number.isFinite(lim) ? Math.max(1, Math.min(100, lim)) : 20;
      const where: Record<string, unknown> = {};
      if (Number.isFinite(studentIdRaw) && studentIdRaw > 0) where.studentId = studentIdRaw;
      if (onDate) {
        // Previously `createdAt = "${onDate}%"`, which Sequelize treated as a
        // literal equality check (never matched). Span the UTC calendar day.
        where.createdAt = { [Op.between]: dayRangeUtc(onDate) };
      }
      const rows = await StudentFeeReceipt.findAll({
        where,
        order: [["created_at", "DESC"]],
        limit,
      });
      return res.json({
        items: rows.map((x) => ({
          id: x.id,
          studentId: x.studentId,
          receiptNo: x.receiptNo,
          term: x.term,
          amountPaid: Number(x.amountPaidUgx),
          totalFeesDue: Number(x.totalFeesDueUgx),
          outstandingAfter: Number(x.outstandingAfterUgx),
          issuedAt:
            x.createdAt ??
            (x.get("created_at") as Date | string | undefined) ??
            new Date().toISOString(),
        })),
      });
    } catch (err) {
      console.error(err);
      return res.status(503).json({ error: "Database unavailable" });
    }
  });

  return r;
}
