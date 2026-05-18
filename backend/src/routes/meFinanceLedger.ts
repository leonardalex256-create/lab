import { Router } from "express";
import { Op } from "sequelize";
import {
  ClassRoom,
  DailyExpenseEntry,
  DailyFinanceReport,
  RolePermission,
  Student,
  StudentFeePayment,
  StudentFeeReceipt,
  User,
  UserPermissionOverride,
} from "../models/index.js";
import { dayRangeUtc } from "../lib/dateBounds.js";

function ymd(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function trimStr(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t) return null;
  return t.length > max ? t.slice(0, max) : t;
}

function isAdminRole(role: string | null | undefined): boolean {
  const r = String(role ?? "").toLowerCase();
  return r === "admin" || r === "super_admin";
}

async function userHasPermission(
  userId: number,
  permissionKey: string,
): Promise<boolean> {
  const user = await User.findByPk(userId, { attributes: ["role"] });
  if (!user) return false;
  if (isAdminRole(user.role)) return true;

  const roleHit = await RolePermission.findOne({
    where: { role: user.role, permissionKey },
    attributes: ["id"],
  });
  let allowed = Boolean(roleHit);

  const override = await UserPermissionOverride.findOne({
    where: { userId, permissionKey },
    attributes: ["allowed"],
  });
  if (override) {
    allowed = Boolean(override.allowed);
  }
  return allowed;
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

export function createMeFinanceLedgerRouter() {
  const r = Router();

  r.get("/finance/ledger", async (req, res) => {
    try {
      const dateRaw = typeof req.query.date === "string" ? req.query.date.trim() : ymd();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateRaw)) {
        return res.status(400).json({ error: "Invalid date" });
      }
      const today = ymd();
      if (dateRaw < today) {
        if (!req.userId) {
          return res.status(401).json({ error: "Unauthorized" });
        }
        const canViewPastLedger = await userHasPermission(req.userId, "finance_past_ledger");
        if (!canViewPastLedger) {
          return res.status(403).json({
            error: "You are not allowed to view past daily ledger records.",
          });
        }
      }
      const [start, end] = dayRangeUtc(dateRaw);

      const [payments, expenses, report] = await Promise.all([
        StudentFeePayment.findAll({
          where: { createdAt: { [Op.between]: [start, end] } },
          include: [
            { model: Student, as: "student", include: [{ model: ClassRoom, as: "classRoom", required: false }], required: false },
            { model: StudentFeeReceipt, as: "receipt", required: false },
          ],
          order: [["created_at", "ASC"]],
        }),
        DailyExpenseEntry.findAll({
          where: { expenseDate: dateRaw },
          order: [["created_at", "ASC"]],
        }),
        DailyFinanceReport.findOne({ where: { reportDate: dateRaw } }),
      ]);

      const incomeRows = payments.map((p) => {
        const student = p.get("student") as Student | null;
        const receipt = p.get("receipt") as StudentFeeReceipt | null;
        return {
          id: `inc-${p.id}`,
          type: "income",
          category: "Student Fee",
          entity:
            student != null
              ? `${student.firstName} ${student.lastName}`.trim()
              : "Student",
          amountUgx: Number(p.amountPaidUgx) || 0,
          method: p.paymentMethod,
          status: "Received",
          receiptNo: receipt?.receiptNo ?? null,
          at:
            p.createdAt ??
            (p.get("created_at") as Date | string | undefined) ??
            new Date().toISOString(),
          term: p.term,
          paidBy: p.paidBy,
        };
      });

      const expenseRows = expenses.map((e) => ({
        id: `exp-${e.id}`,
        type: "expense",
        category: e.category,
        entity: e.description,
        amountUgx: Number(e.amountUgx) || 0,
        method: e.paymentMethod,
        status: "Spent",
        receiptNo: null,
        at:
          e.createdAt ??
          (e.get("created_at") as Date | string | undefined) ??
          new Date().toISOString(),
      }));

      const rows = [...incomeRows, ...expenseRows].sort((a, b) =>
        String(a.at).localeCompare(String(b.at)),
      );
      const totalIncome = incomeRows.reduce((acc, x) => acc + x.amountUgx, 0);
      const totalExpenses = expenseRows.reduce((acc, x) => acc + x.amountUgx, 0);

      return res.json({
        date: dateRaw,
        summary: {
          totalIncome,
          totalExpenses,
          netBalance: totalIncome - totalExpenses,
        },
        report: report
          ? {
              id: report.id,
              status: report.status,
              isReopened: report.isReopened,
              reopenedReason: report.reopenedReason ?? null,
              adminNotes: report.adminNotes ?? null,
            }
          : null,
        items: rows,
      });
    } catch (err) {
      console.error(err);
      return res.status(503).json({ error: "Database unavailable" });
    }
  });

  r.post("/finance/ledger/expenses", async (req, res) => {
    try {
      const body = req.body as Record<string, unknown>;
      const expenseDate =
        typeof body.expenseDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.expenseDate)
          ? body.expenseDate
          : ymd();
      const canWrite = await canWriteFinanceEntriesForDate(req.userId, expenseDate);
      if (!canWrite) {
        return res.status(403).json({
          error: "This daily report has already been submitted. Only admin can enter data now.",
        });
      }
      const category = trimStr(body.category, 80);
      const description = trimStr(body.description, 255);
      const paymentMethod = trimStr(body.paymentMethod, 40) ?? "Cash";
      const amount = Number(body.amountUgx);
      const changeReason = trimStr(body.changeReason, 255);

      if (!category) return res.status(400).json({ error: "category is required" });
      if (!description) return res.status(400).json({ error: "description is required" });
      if (!Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({ error: "amountUgx must be greater than zero" });
      }
      const row = await DailyExpenseEntry.create({
        expenseDate,
        category,
        description,
        amountUgx: Math.round(amount),
        paymentMethod,
        recordedByUserId: req.userId ?? null,
        changeReason,
      });

      return res.status(201).json({
        item: {
          id: row.id,
          expenseDate: row.expenseDate,
          category: row.category,
          description: row.description,
          amountUgx: Number(row.amountUgx),
          paymentMethod: row.paymentMethod,
        },
      });
    } catch (err) {
      console.error(err);
      return res.status(503).json({ error: "Database unavailable" });
    }
  });

  return r;
}
