import { Router } from "express";
import { Op, fn, col } from "sequelize";
import {
  DailyExpenseEntry,
  DailyFinanceReport,
  StaffPayrollEntry,
  Student,
  StudentFeePayment,
} from "../models/index.js";
import { dayRangeUtc, monthRangeUtc } from "../lib/dateBounds.js";

type StudentPaymentWithStudent = StudentFeePayment & {
  student?: {
    firstName?: string | null;
    lastName?: string | null;
  } | null;
};


function ymd(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function createMeFinanceDashboardRouter() {
  const r = Router();

 r.get("/finance/dashboard", async (req, res) => {
    try {
      const today = ymd();
      const ymRaw = typeof req.query.month === "string" ? req.query.month.trim() : "";
      const monthKey = /^\d{4}-\d{2}$/.test(ymRaw) ? ymRaw : today.slice(0, 7);
      const [y, m] = monthKey.split("-").map(Number);
      const monthStart = `${monthKey}-01`;
      const monthEnd = `${monthKey}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`;

      const todayBounds = dayRangeUtc(today);
      const monthBounds = monthRangeUtc(monthKey);

      const [
        todayPaymentsRaw,
        todayExpensesRaw,
        report,
        payrollRows,
        monthIncomeRaw,
        monthExpensesRaw,
        recentPayments,
        recentExpenses,
      ] = await Promise.all([
        StudentFeePayment.sum("amount_paid_ugx", {
          where: { createdAt: { [Op.between]: todayBounds } },
        }),
        DailyExpenseEntry.sum("amount_ugx", { where: { expenseDate: today } }),
        DailyFinanceReport.findOne({ where: { reportDate: today } }),
        StaffPayrollEntry.findAll({
          where: { monthKey },
          order: [["created_at", "DESC"]],
        }),
        StudentFeePayment.sum("amount_paid_ugx", {
          where: { createdAt: { [Op.between]: monthBounds } },
        }),
        DailyExpenseEntry.sum("amount_ugx", {
          where: { expenseDate: { [Op.between]: [monthStart, monthEnd] } },
        }),
        StudentFeePayment.findAll({
          include: [{ model: Student, as: "student", attributes: ["firstName", "lastName", "admissionNumber"] }],
          order: [["id", "DESC"]],
          limit: 5,
        }),
        DailyExpenseEntry.findAll({
          order: [["id", "DESC"]],
          limit: 5,
        }),
      ]);

      const methodBreakdownRaw = await StudentFeePayment.findAll({
        attributes: [
          "paymentMethod",
          [fn("SUM", col("amount_paid_ugx")), "total"],
        ],
        where: { createdAt: { [Op.between]: monthBounds } },
        group: ["paymentMethod"],
      });

      const totalPayroll = payrollRows.reduce((acc, r) => acc + (Number(r.grossAmountUgx) || 0), 0);
      const paidPayroll = payrollRows.reduce((acc, r) => acc + (Number(r.paidAmountUgx) || 0), 0);
      const payrollArrears = payrollRows.reduce((acc, r) => acc + (Number(r.arrearsUgx) || 0), 0);

      const recentTransactions = [
        ...recentPayments.map((payment) => {
          const p = payment as StudentPaymentWithStudent;
          const label = p.student
            ? `${p.student.firstName ?? ""} ${p.student.lastName ?? ""}`.trim() || "Student Payment"
            : "Student Payment";
          return {
          id: `p-${p.id}`,
          type: "income" as const,
          label,
          amount: Number(p.amountPaidUgx),
          method: p.paymentMethod,
          date: p.createdAt,
        };
      }),
        ...recentExpenses.map(e => ({
          id: `e-${e.id}`,
          type: "expense" as const,
          label: e.description || e.category,
          amount: Number(e.amountUgx),
          method: e.paymentMethod,
          date: e.createdAt,
        })),
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 10);

      return res.json({
        today: {
          date: today,
          feesReceived: Number(todayPaymentsRaw ?? 0) || 0,
          expenses: Number(todayExpensesRaw ?? 0) || 0,
          net: (Number(todayPaymentsRaw ?? 0) || 0) - (Number(todayExpensesRaw ?? 0) || 0),
          reportStatus: report?.status ?? "not_submitted",
          isReopened: report?.isReopened ?? false,
          reopenedReason: report?.reopenedReason ?? null,
        },
        month: {
          key: monthKey,
          totalIncome: Number(monthIncomeRaw ?? 0) || 0,
          totalExpenses: Number(monthExpensesRaw ?? 0) || 0,
          net: (Number(monthIncomeRaw ?? 0) || 0) - (Number(monthExpensesRaw ?? 0) || 0),
          methodBreakdown: methodBreakdownRaw.map((mb: any) => ({
            method: mb.paymentMethod,
            amount: Number(mb.get("total")),
          })),
        },
        payroll: {
          monthKey,
          totalPayroll,
          paidToDate: paidPayroll,
          arrears: payrollArrears,
        },
        recentTransactions,
      });
    } catch (err) {
      console.error(err);
      return res.status(503).json({ error: "Database unavailable" });
    }
  });

  return r;
}
