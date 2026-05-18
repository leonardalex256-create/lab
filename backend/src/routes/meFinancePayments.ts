import { Router } from "express";
import { Op } from "sequelize";
import { studentToApiRow } from "../formatting/studentRow.js";
import {
  ClassRoom,
  DailyFinanceReport,
  Student,
  StudentFeeAssignment,
  StudentFeePayment,
  StudentFeeReceipt,
  StudentFeeStructure,
  User,
} from "../models/index.js";
import { calculatePaymentSummary } from "../services/pythonCalc.js";
import { loadOfficialSchoolTermYear, resolveReadTermYearFromQuery } from "../lib/officialSchoolTermYear.js";
import { dayRangeUtc } from "../lib/dateBounds.js";

function trimStr(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t) return null;
  return t.length > max ? t.slice(0, max) : t;
}

function parseMoneyUgx(v: unknown): number | null {
  if (typeof v !== "number" && typeof v !== "string") return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n);
}

function ymd(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function ymdFromValue(v: Date | string | null | undefined): string {
  if (!v) return ymd();
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) return ymd();
  return ymd(d);
}

function isAdminRole(role: string | null | undefined): boolean {
  const normalized = String(role ?? "").trim().toLowerCase();
  return normalized === "admin" || normalized === "super_admin";
}

async function canWriteFinanceEntriesForDate(
  userId: number | null | undefined,
  targetDate: string,
): Promise<boolean> {
  if (!userId) return false;
  const user = await User.findByPk(userId, { attributes: ["role"] });
  if (!user) return false;
  if (isAdminRole(user.role)) return true;
  const report = await DailyFinanceReport.findOne({
    where: { reportDate: targetDate },
    attributes: ["status"],
  });
  if (!report) return true;
  return report.status === "not_submitted";
}

type FeeStructureStatus = "day_half" | "day_full" | "day_full_p7" | "boarding";

function normalizeBoardingStatus(v: unknown): "day_half" | "day_full" | "boarding" | null {
  if (v === "day_half" || v === "day_full" || v === "boarding") return v;
  return null;
}

function isP7Class(className: string | null | undefined): boolean {
  const v = (className ?? "").trim().toLowerCase();
  return v.includes("p7") || v.includes("primary seven");
}

function toFeeStructureStatus(
  boardingStatus: "day_half" | "day_full" | "boarding" | null,
  className: string | null | undefined,
): FeeStructureStatus | null {
  if (boardingStatus === "day_full" && isP7Class(className)) return "day_full_p7";
  return boardingStatus;
}

function studentClassName(student: Student): string | null {
  const assoc = student.get("classRoom") as { name?: string } | null | undefined;
  const fromAssoc = typeof assoc?.name === "string" ? assoc.name : null;
  const fromFlat = student.get("class_name") as string | null | undefined;
  return fromAssoc ?? fromFlat ?? null;
}

export function createMeFinancePaymentsRouter() {
  const r = Router();

  r.post("/finance/payments", async (req, res) => {
    try {
      const canWrite = await canWriteFinanceEntriesForDate(req.userId, ymd());
      if (!canWrite) {
        return res.status(403).json({
          error: "This daily report has already been submitted. Only admin can enter data now.",
        });
      }
      const body = req.body as Record<string, unknown>;
      const studentId = Number(body.studentId);
      const term = trimStr(body.term, 20);
      const paymentMethod = trimStr(body.paymentMethod, 40);
      const paidBy = trimStr(body.paidBy, 120);
      const amountPaidUgx = parseMoneyUgx(body.amountPaid);
      const requestedDue = parseMoneyUgx(body.amountDueUgx);
      const changeReason = trimStr(body.changeReason, 255);
      const actor = req.userId ? await User.findByPk(req.userId, { attributes: ["fullName", "email"] }) : null;
      const generatedByName =
        actor?.fullName?.trim() || actor?.email?.split("@")[0] || "Account User";


      if (!Number.isFinite(studentId) || studentId < 1) {
        return res.status(400).json({ error: "Invalid studentId" });
      }
      if (!term) return res.status(400).json({ error: "term is required" });
      if (!paymentMethod) {
        return res.status(400).json({ error: "paymentMethod is required" });
      }
      if (!paidBy) return res.status(400).json({ error: "paidBy is required" });
      if (amountPaidUgx == null || amountPaidUgx <= 0) {
        return res.status(400).json({ error: "amountPaid must be greater than zero" });
      }

      const official = await loadOfficialSchoolTermYear();
      if (term !== official.term) {
        return res.status(400).json({
          error: `Fees must be recorded for the school's current term (${official.term}). Update Settings → Current term or switch the payment form to match.`,
        });
      }
      const academicYear = official.academicYear;

      const student = await Student.findByPk(studentId, {
        include: [{ model: ClassRoom, as: "classRoom", required: false }],
      });
      if (!student) return res.status(404).json({ error: "Student not found" });

      // All fee-assignment, receipt, and payment writes must commit together
      // so a partial failure can never leave a receipt without a matching
      // payment row (or vice versa) — critical for financial integrity.
      const sequelize = StudentFeeReceipt.sequelize;
      if (!sequelize) {
        return res.status(500).json({ error: "Database not initialized" });
      }

      const createdReceipt = await sequelize.transaction(async (t) => {
        if (requestedDue != null && requestedDue > 0) {
          const [assignment] = await StudentFeeAssignment.findOrCreate({
            where: { studentId, term, academicYear },
            defaults: { amountDueUgx: requestedDue, notes: null },
            transaction: t,
          });
          if (Number(assignment.amountDueUgx) !== requestedDue) {
            await assignment.update(
              { amountDueUgx: requestedDue },
              { transaction: t },
            );
          }
        }
        const assignment = await StudentFeeAssignment.findOne({
          where: { studentId, term, academicYear },
          transaction: t,
        });
        const boardingStatus = normalizeBoardingStatus(student.boardingStatus);
        const className = studentClassName(student);
        const feeStatus = toFeeStructureStatus(boardingStatus, className);
        const structure =
          assignment == null && feeStatus != null
            ? await StudentFeeStructure.findOne({
                where: { term, boardingStatus: feeStatus },
                transaction: t,
              })
            : null;
        if (assignment == null && structure != null) {
          const percentage = Number(student.bursaryPercentage) || 0;
          const baseAmount = Number(structure.amountDueUgx);
          const discountedAmount = Math.round(
            baseAmount * (1 - percentage / 100),
          );

          await StudentFeeAssignment.create(
            {
              studentId,
              term,
              academicYear,
              amountDueUgx: discountedAmount,
              notes:
                percentage > 0
                  ? `Bursery applied: ${percentage}%`
                  : (structure.notes ?? null),
            },
            { transaction: t },
          );
        }
        const sumRaw = await StudentFeePayment.sum("amount_paid_ugx", {
          where: { studentId, term, academicYear },
          transaction: t,
        });
        const previousPaidUgx = Math.max(Number(sumRaw ?? 0) || 0, 0);
        const targetDue =
          assignment != null
            ? Number(assignment.amountDueUgx)
            : structure != null
              ? Number(structure.amountDueUgx)
              : previousPaidUgx + amountPaidUgx;
        const summary = await calculatePaymentSummary({
          previousPaidUgx,
          amountPaidUgx,
          targetDueUgx: targetDue,
        });
        const totalFeesDueUgx = summary.totalFeesDueUgx;
        const outstandingAfterUgx = summary.outstandingAfterUgx;
        const creditAmountUgx = summary.creditAmountUgx;

        const receipt = await StudentFeeReceipt.create(
          {
            studentId,
            receiptNo: "PENDING",
            academicYear,
            term,
            paymentMethod,
            paidBy,
            amountPaidUgx,
            previousPaidUgx,
            totalFeesDueUgx,
            outstandingAfterUgx,
            creditAmountUgx,
          },
          { transaction: t },
        );
        await receipt.update(
          {
            receiptNo: `ST-${String(receipt.id).padStart(5, "0")}`,
          },
          { transaction: t },
        );

        await StudentFeePayment.create(
          {
            studentId,
            term,
            academicYear,
            amountPaidUgx,
            paymentMethod,
            paidBy,
            receiptId: receipt.id,
            changeReason,
          },
          { transaction: t },
        );

        return receipt;
      });


      return res.status(201).json({
        item: {
          id: createdReceipt.id,
          receiptNo: createdReceipt.receiptNo,
          issuedAt:
            createdReceipt.createdAt ??
            (createdReceipt.get("created_at") as Date | string | undefined) ??
            new Date().toISOString(),
          term: createdReceipt.term,
          academicYear: createdReceipt.academicYear,
          paymentMethod: createdReceipt.paymentMethod,
          paidBy: createdReceipt.paidBy,
          amountPaid: Number(createdReceipt.amountPaidUgx),
          previousPaid: Number(createdReceipt.previousPaidUgx),
          totalFeesDue: Number(createdReceipt.totalFeesDueUgx),
          outstandingAfter: Number(createdReceipt.outstandingAfterUgx),
          creditAmount: Number(createdReceipt.creditAmountUgx),
          generatedByName,
          student: studentToApiRow(student),
        },
      });
    } catch (err) {
      console.error(err);
      return res.status(503).json({ error: "Database unavailable" });
    }
  });

  r.get("/finance/receipts/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id) || id < 1) return res.status(400).json({ error: "Invalid id" });
      const receipt = await StudentFeeReceipt.findByPk(id);
      if (!receipt) return res.status(404).json({ error: "Not found" });
      const student = await Student.findByPk(receipt.studentId, {
        include: [{ model: ClassRoom, as: "classRoom", required: false }],
      });
      if (!student) return res.status(404).json({ error: "Student not found" });
      return res.json({
        item: {
          id: receipt.id,
          receiptNo: receipt.receiptNo,
          issuedAt:
            receipt.createdAt ??
            (receipt.get("created_at") as Date | string | undefined) ??
            new Date().toISOString(),
          term: receipt.term,
          academicYear: receipt.academicYear,
          paymentMethod: receipt.paymentMethod,
          paidBy: receipt.paidBy,
          amountPaid: Number(receipt.amountPaidUgx),
          previousPaid: Number(receipt.previousPaidUgx),
          totalFeesDue: Number(receipt.totalFeesDueUgx),
          outstandingAfter: Number(receipt.outstandingAfterUgx),
          creditAmount: Number(receipt.creditAmountUgx),
          student: studentToApiRow(student),
        },
      });
    } catch (err) {
      console.error(err);
      return res.status(503).json({ error: "Database unavailable" });
    }
  });

  r.get("/finance/receipts", async (req, res) => {
    try {
      const studentIdRaw = Number(req.query.studentId);
      const { term: termFilter, academicYear } = await resolveReadTermYearFromQuery(req.query);
      const lim = Number.parseInt(String(req.query.limit ?? "50"), 10);
      const limit = Number.isFinite(lim) ? Math.max(1, Math.min(200, lim)) : 50;
      const offRaw = Number.parseInt(String(req.query.offset ?? "0"), 10);
      const offset = Number.isFinite(offRaw) ? Math.max(0, offRaw) : 0;
      const where: Record<string, unknown> = { academicYear, term: termFilter };
      if (Number.isFinite(studentIdRaw) && studentIdRaw > 0) where.studentId = studentIdRaw;
      const total = await StudentFeeReceipt.count({ where });
      const rows = await StudentFeeReceipt.findAll({
        where,
        include: [
          {
            model: Student,
            as: "student",
            required: false,
            include: [{ model: ClassRoom, as: "classRoom", required: false }],
          },
        ],
        order: [["created_at", "DESC"]],
        limit,
        offset,
      });
      return res.json({
        total,
        items: rows.map((x) => {
          const student = x.get("student") as Student | null | undefined;
          const studentRow = student ? studentToApiRow(student) : null;
          return {
            id: x.id,
            receiptNo: x.receiptNo,
            issuedAt:
              x.createdAt ??
              (x.get("created_at") as Date | string | undefined) ??
              new Date().toISOString(),
            studentId: x.studentId,
            term: x.term,
            academicYear: x.academicYear,
            amountPaid: Number(x.amountPaidUgx),
            paymentMethod: x.paymentMethod,
            paidBy: x.paidBy,
            studentName: studentRow?.fullName ?? "Unknown student",
            className: studentRow?.className ?? "—",
            isVoided: false,
          };
        }),
      });
    } catch (err) {
      console.error(err);
      return res.status(503).json({ error: "Database unavailable" });
    }
  });

  r.get("/finance/receipts/by-date", async (req, res) => {
    try {
      const dateRaw = typeof req.query.date === "string" ? req.query.date.trim() : ymd();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateRaw)) {
        return res.status(400).json({ error: "Invalid date" });
      }
      const rows = await StudentFeeReceipt.findAll({
        where: {
          createdAt: { [Op.between]: dayRangeUtc(dateRaw) },
        },
        order: [["created_at", "ASC"]],
      });
      return res.json({
        items: rows.map((x) => ({
          id: x.id,
          receiptNo: x.receiptNo,
          term: x.term,
          amountPaid: Number(x.amountPaidUgx),
          paymentMethod: x.paymentMethod,
          paidBy: x.paidBy,
          studentId: x.studentId,
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

  r.delete("/finance/receipts/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id) || id < 1) {
        return res.status(400).json({ error: "Invalid id" });
      }

      const receipt = await StudentFeeReceipt.findByPk(id);
      if (!receipt) return res.status(404).json({ error: "Not found" });

      const receiptDate = ymdFromValue(
        receipt.createdAt ??
          (receipt.get("created_at") as Date | string | undefined) ??
          null,
      );
      const canWrite = await canWriteFinanceEntriesForDate(req.userId, receiptDate);
      if (!canWrite) {
        return res.status(403).json({
          error:
            "This daily report has already been submitted. Only admin can edit or delete entries now.",
        });
      }

      const sequelize = StudentFeeReceipt.sequelize;
      if (!sequelize) {
        return res.status(500).json({ error: "Database not initialized" });
      }

      await sequelize.transaction(async (t) => {
        await StudentFeePayment.destroy({ where: { receiptId: id }, transaction: t });
        await StudentFeeReceipt.destroy({ where: { id }, transaction: t });
      });

      return res.status(204).send();
    } catch (err) {
      console.error(err);
      return res.status(503).json({ error: "Database unavailable" });
    }
  });

  return r;
}
