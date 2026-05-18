import { Router } from "express";
import { Op, fn, col } from "sequelize";
import {
  ClassRoom,
  DailyExpenseEntry,
  DailyFinanceReport,
  DailyFinanceReportAudit,
  Student,
  StudentFeeAssignment,
  StudentFeePayment,
  StudentFeeStructure,
  User,
  UserNotification,
} from "../models/index.js";
import { resolveReadTermYearFromQuery } from "../lib/officialSchoolTermYear.js";
import { dayRangeUtc } from "../lib/dateBounds.js";

function ymd(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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
): "day_half" | "day_full" | "day_full_p7" | "boarding" | null {
  if (boardingStatus === "day_full" && isP7Class(className)) return "day_full_p7";
  return boardingStatus;
}

type ReportStatus = "not_submitted" | "submitted" | "admin_review" | "closed";

async function appendAudit(reportId: number, actorUserId: number | null, action: string, note?: string | null) {
  await DailyFinanceReportAudit.create({
    reportId,
    actorUserId,
    action,
    note: note ?? null,
  });
}

async function requestRole(userId: number | null | undefined): Promise<string> {
  if (!userId) return "";
  const user = await User.findByPk(userId, { attributes: ["id", "role"] });
  return (user?.role ?? "").trim().toLowerCase();
}

async function ensureAdmin(userId: number | null | undefined): Promise<boolean> {
  const role = await requestRole(userId);
  return role === "admin" || role === "super_admin";
}

function isAdminRoleString(role: string | null | undefined): boolean {
  const r = (role ?? "").trim().toLowerCase();
  return r === "admin" || r === "super_admin";
}

async function notifyAdminsReportSubmitted(reportDate: string, submittedByUserId: number | null) {
  const submitter = submittedByUserId
    ? await User.findByPk(submittedByUserId, { attributes: ["email"] })
    : null;
  const submitterLabel = submitter?.email?.trim() || "A finance user";

  const admins = await User.findAll({
    attributes: ["id"],
    where: { role: { [Op.in]: ["admin", "super_admin"] } },
  });
  if (admins.length === 0) return;

  await UserNotification.bulkCreate(
    admins.map((admin) => ({
      userId: admin.id,
      title: "Daily ledger submitted",
      body: `${submitterLabel} handed in the daily ledger for ${reportDate}.`,
    })),
  );
}

export function createMeFinanceReportsRouter() {
  const r = Router();

  r.get("/finance/reports/daily", async (req, res) => {
    try {
      const isAdmin = await ensureAdmin(req.userId ?? null);
      if (!isAdmin) {
        return res.status(403).json({ error: "Admin only" });
      }
      const lim = Number.parseInt(String(req.query.limit ?? "30"), 10);
      const limit = Number.isFinite(lim) ? Math.max(1, Math.min(90, lim)) : 30;
      const rows = await DailyFinanceReport.findAll({
        include: [
          { model: User, as: "submittedBy", required: false },
          { model: User, as: "reopenedFor", required: false },
        ],
        order: [["report_date", "DESC"]],
        limit,
      });
      const reportDates = rows.map((rpt) => rpt.reportDate);
      const earliest = reportDates[reportDates.length - 1];
      const latest = reportDates[0];
      const paymentsByDate = await StudentFeePayment.findAll({
        attributes: [[fn("DATE", col("created_at")), "d"], [fn("SUM", col("amount_paid_ugx")), "v"]],
        where:
          earliest && latest
            ? {
                createdAt: {
                  [Op.between]: [dayRangeUtc(earliest)[0], dayRangeUtc(latest)[1]],
                },
              }
            : undefined,
        group: [fn("DATE", col("created_at"))],
      });
      const expensesByDate = await DailyExpenseEntry.findAll({
        attributes: [["expense_date", "d"], [fn("SUM", col("amount_ugx")), "v"]],
        where: reportDates.length > 0 ? { expenseDate: { [Op.in]: reportDates } } : undefined,
        group: ["expense_date"],
      });

      const incomeMap = new Map<string, number>();
      for (const row of paymentsByDate) {
        const d = String(row.get("d"));
        incomeMap.set(d, Number(row.get("v") ?? 0) || 0);
      }
      const expenseMap = new Map<string, number>();
      for (const row of expensesByDate) {
        const d = String(row.get("d"));
        expenseMap.set(d, Number(row.get("v") ?? 0) || 0);
      }

      return res.json({
        items: rows.map((rpt) => {
          const inVal = incomeMap.get(rpt.reportDate) ?? 0;
          const outVal = expenseMap.get(rpt.reportDate) ?? 0;
          const sBy = rpt.get("submittedBy") as User | null;
          const reopenedFor = rpt.get("reopenedFor") as User | null;
          return {
            id: rpt.id,
            reportDate: rpt.reportDate,
            status: rpt.status,
            submittedBy: sBy?.email ?? null,
            isReopened: rpt.isReopened,
            reopenedReason: rpt.reopenedReason ?? null,
            reopenedForUserId: rpt.reopenedForUserId ?? null,
            reopenedForUserEmail: reopenedFor?.email ?? null,
            adminNotes: rpt.adminNotes ?? null,
            totalEarnings: inVal,
            totalExpenditure: outVal,
            netTotal: inVal - outVal,
          };
        }),
      });
    } catch (err) {
      console.error(err);
      return res.status(503).json({ error: "Database unavailable" });
    }
  });

  r.post("/finance/reports/daily/submit", async (req, res) => {
    try {
      const isAdmin = await ensureAdmin(req.userId ?? null);
      if (isAdmin) {
        return res.status(403).json({ error: "Admin cannot submit reports" });
      }
      const body = req.body as Record<string, unknown>;
      const reportDate =
        typeof body.reportDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.reportDate)
          ? body.reportDate
          : ymd();

      const sequelize = DailyFinanceReport.sequelize;
      if (!sequelize) return res.status(500).json({ error: "Database not initialized" });

      type SubmitOk = { kind: "ok"; id: number; status: string };
      type SubmitErr = { kind: "err"; status: number; body: { error: string } };
      const result = await sequelize.transaction(async (t): Promise<SubmitOk | SubmitErr> => {
        const existing = await DailyFinanceReport.findOne({
          where: { reportDate },
          transaction: t,
          lock: t.LOCK.UPDATE,
        });
        if (existing?.status === "closed") {
          return { kind: "err", status: 409, body: { error: "Report is sealed. Admin must reopen it first." } };
        }
        if (existing?.reopenedForUserId && existing.reopenedForUserId !== req.userId) {
          return { kind: "err", status: 403, body: { error: "This reopened report is assigned to a different user." } };
        }
        const finalValues = {
          status: "submitted",
          submittedByUserId: req.userId ?? null,
          submittedAt: new Date(),
          reopenedForUserId: null,
          isReopened: false,
          reopenedReason: null,
        };
        const [row, created] = await DailyFinanceReport.findOrCreate({
          where: { reportDate },
          defaults: finalValues,
          transaction: t,
        });
        if (!created) {
          await row.update(finalValues, { transaction: t });
        }
        return { kind: "ok", id: row.id, status: row.status };
      });

      if (result.kind === "err") {
        return res.status(result.status).json(result.body);
      }
      await appendAudit(result.id, req.userId ?? null, "submit_report");
      await notifyAdminsReportSubmitted(reportDate, req.userId ?? null);
      return res.json({ ok: true, id: result.id, status: result.status });
    } catch (err) {
      console.error(err);
      return res.status(503).json({ error: "Database unavailable" });
    }
  });

  r.post("/finance/reports/daily/request", async (req, res) => {
    try {
      if (!(await ensureAdmin(req.userId ?? null))) {
        return res.status(403).json({ error: "Admin only" });
      }
      const body = req.body as Record<string, unknown>;
      const reportDate =
        typeof body.reportDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.reportDate)
          ? body.reportDate
          : ymd();
      const reason =
        typeof body.reason === "string" ? body.reason.trim().slice(0, 255) : "";
      const requestForUserId = Number(body.requestForUserId);

      if (!reason) {
        return res.status(400).json({ error: "reason is required" });
      }
      if (!Number.isFinite(requestForUserId) || requestForUserId < 1) {
        return res.status(400).json({ error: "requestForUserId is required" });
      }

      const assignee = await User.findByPk(requestForUserId, {
        attributes: ["id", "email", "role"],
      });
      if (!assignee) return res.status(404).json({ error: "Assigned user not found" });
      if (isAdminRoleString(assignee.role)) {
        return res.status(400).json({ error: "Assigned user must be a non-admin authorized user" });
      }

      const sequelize = DailyFinanceReport.sequelize;
      if (!sequelize) return res.status(500).json({ error: "Database not initialized" });

      type RequestOk = { kind: "ok"; id: number; status: string };
      type RequestErr = { kind: "err"; status: number; body: { error: string } };
      const result = await sequelize.transaction(async (t): Promise<RequestOk | RequestErr> => {
        const existing = await DailyFinanceReport.findOne({
          where: { reportDate },
          transaction: t,
          lock: t.LOCK.UPDATE,
        });
        if (existing?.status === "closed") {
          return { kind: "err", status: 409, body: { error: "Report is sealed. Reopen it first before requesting." } };
        }
        const finalValues = {
          status: "not_submitted",
          submittedByUserId: null,
          submittedAt: null,
          reviewedByUserId: null,
          reviewedAt: null,
          isReopened: true,
          reopenedReason: reason,
          reopenedForUserId: requestForUserId,
          adminNotes: null,
        };
        const [row, created] = await DailyFinanceReport.findOrCreate({
          where: { reportDate },
          defaults: finalValues,
          transaction: t,
        });
        if (!created) {
          await row.update(finalValues, { transaction: t });
        }
        return { kind: "ok", id: row.id, status: row.status };
      });

      if (result.kind === "err") {
        return res.status(result.status).json(result.body);
      }

      await appendAudit(
        result.id,
        req.userId ?? null,
        "request_report_submission",
        `Requested from ${assignee.email}. Reason: ${reason}`,
      );

      await UserNotification.create({
        userId: assignee.id,
        title: "Daily report requested",
        body: `Admin requested daily ledger submission for ${reportDate}. Reason: ${reason}`,
      });

      return res.json({ ok: true, id: result.id, status: result.status });
    } catch (err) {
      console.error(err);
      return res.status(503).json({ error: "Database unavailable" });
    }
  });

  r.post("/finance/reports/daily/:id/take-review", async (req, res) => {
    try {
      if (!(await ensureAdmin(req.userId ?? null))) {
        return res.status(403).json({ error: "Admin only" });
      }
      const id = Number(req.params.id);
      if (!Number.isFinite(id) || id < 1) return res.status(400).json({ error: "Invalid id" });
      const row = await DailyFinanceReport.findByPk(id);
      if (!row) return res.status(404).json({ error: "Not found" });
      if (row.status !== "submitted") {
        return res.status(409).json({ error: "Only submitted reports can be reviewed" });
      }
      await row.update({
        status: "admin_review",
        reviewedByUserId: req.userId ?? null,
        reviewedAt: new Date(),
      });
      await appendAudit(id, req.userId ?? null, "take_review");
      return res.json({ ok: true, id, status: row.status });
    } catch (err) {
      console.error(err);
      return res.status(503).json({ error: "Database unavailable" });
    }
  });

  async function sealReport(id: number, actorUserId: number | null | undefined, adminNotes: string) {
    const row = await DailyFinanceReport.findByPk(id);
    if (!row) return { status: 404 as const, body: { error: "Not found" } };
    if (row.status !== "admin_review") {
      return { status: 409 as const, body: { error: "Only reports in admin review can be sealed" } };
    }
    await row.update({
      status: "closed",
      closedByUserId: actorUserId ?? null,
      closedAt: new Date(),
      adminNotes,
    });
    await appendAudit(id, actorUserId ?? null, "seal_report", adminNotes);
    return { status: 200 as const, body: { ok: true, id, status: row.status } };
  }

  r.post("/finance/reports/daily/:id/seal", async (req, res) => {
    try {
      if (!(await ensureAdmin(req.userId ?? null))) {
        return res.status(403).json({ error: "Admin only" });
      }
      const id = Number(req.params.id);
      const body = req.body as Record<string, unknown>;
      const adminNotes =
        typeof body.adminNotes === "string" ? body.adminNotes.trim().slice(0, 500) : "";
      if (!Number.isFinite(id) || id < 1) return res.status(400).json({ error: "Invalid id" });
      if (!adminNotes) return res.status(400).json({ error: "Admin comment is required before sealing" });
      const result = await sealReport(id, req.userId ?? null, adminNotes);
      return res.status(result.status).json(result.body);
    } catch (err) {
      console.error(err);
      return res.status(503).json({ error: "Database unavailable" });
    }
  });

  // Backward-compatible alias.
  r.post("/finance/reports/daily/:id/close", async (req, res) => {
    try {
      if (!(await ensureAdmin(req.userId ?? null))) {
        return res.status(403).json({ error: "Admin only" });
      }
      const id = Number(req.params.id);
      const body = req.body as Record<string, unknown>;
      const adminNotes =
        typeof body.adminNotes === "string" ? body.adminNotes.trim().slice(0, 500) : "";
      if (!Number.isFinite(id) || id < 1) return res.status(400).json({ error: "Invalid id" });
      if (!adminNotes) return res.status(400).json({ error: "Admin comment is required before sealing" });
      const result = await sealReport(id, req.userId ?? null, adminNotes);
      return res.status(result.status).json(result.body);
    } catch (err) {
      console.error(err);
      return res.status(503).json({ error: "Database unavailable" });
    }
  });

  r.post("/finance/reports/daily/:id/reopen", async (req, res) => {
    try {
      if (!(await ensureAdmin(req.userId ?? null))) {
        return res.status(403).json({ error: "Admin only" });
      }
      const id = Number(req.params.id);
      const body = req.body as Record<string, unknown>;
      const reason =
        typeof body.reason === "string" ? body.reason.trim().slice(0, 255) : "";
      const reopenForUserId = Number(body.reopenForUserId);
      if (!Number.isFinite(id) || id < 1) return res.status(400).json({ error: "Invalid id" });
      if (!reason) return res.status(400).json({ error: "reason is required" });
      if (!Number.isFinite(reopenForUserId) || reopenForUserId < 1) {
        return res.status(400).json({ error: "reopenForUserId is required" });
      }
      const reopenForUser = await User.findByPk(reopenForUserId, {
        attributes: ["id", "email", "role"],
      });
      if (!reopenForUser) return res.status(404).json({ error: "Assigned user not found" });
      if (isAdminRoleString(reopenForUser.role)) {
        return res.status(400).json({ error: "Assigned user must be a non-admin authorized user" });
      }
      const row = await DailyFinanceReport.findByPk(id);
      if (!row) return res.status(404).json({ error: "Not found" });
      await row.update({
        status: "not_submitted",
        isReopened: true,
        reopenedReason: reason,
        reopenedForUserId: reopenForUserId,
        adminNotes: null,
      });
      await appendAudit(
        id,
        req.userId ?? null,
        "reopen_report",
        `Reopened for ${reopenForUser.email}. Reason: ${reason}`,
      );
      return res.json({ ok: true, id, status: row.status });
    } catch (err) {
      console.error(err);
      return res.status(503).json({ error: "Database unavailable" });
    }
  });

  r.get("/finance/reports/authorized-users", async (req, res) => {
    try {
      if (!(await ensureAdmin(req.userId ?? null))) {
        return res.status(403).json({ error: "Admin only" });
      }
      const users = await User.findAll({
        attributes: ["id", "email", "role"],
        where: { role: { [Op.notIn]: ["admin", "super_admin"] } },
        order: [["email", "ASC"]],
      });
      return res.json({
        items: users.map((u) => ({ id: u.id, email: u.email, role: u.role })),
      });
    } catch (err) {
      console.error(err);
      return res.status(503).json({ error: "Database unavailable" });
    }
  });

  r.get("/finance/reports/debtors", async (req, res) => {
    try {
      const { term: requestedTerm, academicYear } = await resolveReadTermYearFromQuery(req.query);

      const students = await Student.findAll({
        include: [{ model: ClassRoom, as: "classRoom", required: false }],
        order: [["admission_number", "ASC"]],
      });

      const assignmentWhere = { term: requestedTerm, academicYear };
      const structureWhere = { term: requestedTerm };
      const paymentWhere = { term: requestedTerm, academicYear };

      const assignments = await StudentFeeAssignment.findAll({ where: assignmentWhere });
      const structures = await StudentFeeStructure.findAll({ where: structureWhere });
      const payments = await StudentFeePayment.findAll({
        attributes: ["studentId", "term", [fn("SUM", col("amount_paid_ugx")), "totalPaid"]],
        where: paymentWhere,
        group: ["student_id", "term"],
      });

      const assignmentMap = new Map<string, number>();
      for (const a of assignments) {
        assignmentMap.set(`${a.studentId}::${a.term}`, Number(a.amountDueUgx) || 0);
      }

      const structureMap = new Map<string, number>();
      for (const s of structures) {
        structureMap.set(`${s.term}::${s.boardingStatus}`, Number(s.amountDueUgx) || 0);
      }

      const paidMap = new Map<string, number>();
      for (const p of payments) {
        paidMap.set(`${p.studentId}::${p.term}`, Number(p.get("totalPaid")) || 0);
      }

      const terms = [requestedTerm];

      const debtors = students
        .map((s) => {
          const cr = s.get("classRoom") as ClassRoom | null;
          const className = cr?.name ?? null;
          const boarding = normalizeStudentBoardingStatus(s.boardingStatus);
          const status = toFeeStructureStatus(boarding, className);
          const bursaryPct = Math.max(0, Number(s.bursaryPercentage) || 0);

          let totalDue = 0;
          let totalPaid = 0;
          for (const term of terms) {
            const assignmentDue = assignmentMap.get(`${s.id}::${term}`);
            const defaultDue =
              status != null ? (structureMap.get(`${term}::${status}`) ?? 0) : 0;
            const dueForTerm =
              assignmentDue != null
                ? assignmentDue
                : Math.max(0, Math.round(defaultDue * (1 - bursaryPct / 100)));
            const paidForTerm = paidMap.get(`${s.id}::${term}`) ?? 0;
            totalDue += dueForTerm;
            totalPaid += paidForTerm;
          }
          const balance = totalDue - totalPaid;
          return {
            id: s.id,
            admissionNumber: s.admissionNumber,
            fullName: `${s.firstName} ${s.lastName}`.trim(),
            className: className ?? "—",
            totalFees: totalDue,
            totalPaid,
            balance,
          };
        })
        .filter((d) => d.balance > 0);

      const totalOutstanding = debtors.reduce((acc, d) => acc + d.balance, 0);

      return res.json({
        term: requestedTerm,
        academicYear,
        totalOutstanding,
        items: debtors,
      });
    } catch (err) {
      console.error(err);
      return res.status(503).json({ error: "Database unavailable" });
    }
  });

  return r;
}
