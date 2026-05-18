import { Router } from "express";
import { Op, fn, col } from "sequelize";
import {
  ClassRoom,
  Student,
  StudentFeeAssignment,
  StudentFeePayment,
  StudentFeeReceipt,
  StudentFeeStructure,
  User,
} from "../models/index.js";
import { studentToApiRow } from "../formatting/studentRow.js";
import { resolveReadTermYearFromQuery } from "../lib/officialSchoolTermYear.js";
import { calculatePaymentSummary } from "../services/pythonCalc.js";

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
): "day_half" | "day_full" | "day_full_p7" | "boarding" | null {
  if (boardingStatus === "day_full" && isP7Class(className)) return "day_full_p7";
  return boardingStatus;
}

function studentClassName(student: Student): string | null {
  const assoc = student.get("classRoom") as { name?: string } | null | undefined;
  const fromAssoc = typeof assoc?.name === "string" ? assoc.name : null;
  const fromFlat = student.get("class_name") as string | null | undefined;
  return fromAssoc ?? fromFlat ?? null;
}

function termIndex(term: string): number {
  const idx = ["Term 1", "Term 2", "Term 3"].indexOf(term);
  return idx >= 0 ? idx : 99;
}

function buildPeriodPairsUpTo(params: { term: string; academicYear: string }): Array<{ term: string; academicYear: string }> {
  const year = Number(params.academicYear);
  if (!Number.isFinite(year) || year < 2000) return [{ term: params.term, academicYear: params.academicYear }];
  const terms = ["Term 1", "Term 2", "Term 3"];
  const pairs: Array<{ term: string; academicYear: string }> = [];
  // Avoid enumerating every year since 2000 (unbounded growth). Ten years back
  // is enough for fee rows the DB actually holds; older debt without rows is 0 anyway.
  const startYear = Math.max(2000, year - 10);
  for (let y = startYear; y <= year; y++) {
    for (const t of terms) {
      pairs.push({ term: t, academicYear: String(y) });
    }
  }
  return pairs;
}

async function isAdminRoleForUserId(userId: number | null | undefined): Promise<boolean> {
  if (!userId) return false;
  const user = await User.findByPk(userId, { attributes: ["role"] });
  const role = String(user?.role ?? "").trim().toLowerCase();
  return role === "admin" || role === "super_admin";
}

export function createMeFinanceHistoricalRouter() {
  const r = Router();

  r.get("/finance/historical/student-records", async (req, res) => {
    try {
      const { term: requestedTerm, academicYear } = await resolveReadTermYearFromQuery(req.query);

      const yearNum = Number(academicYear);
      const currentYear = new Date().getFullYear();
      if (!Number.isFinite(yearNum) || yearNum < 2000 || yearNum > currentYear + 1) {
        return res.status(400).json({ error: "academicYear is out of range" });
      }

      const students = await Student.findAll({
        include: [{ model: ClassRoom, as: "classRoom", required: false }],
        order: [["admission_number", "ASC"]],
      });

      const allPairs = buildPeriodPairsUpTo({ term: requestedTerm, academicYear });
      const cutoff = allPairs.findIndex((x) => x.academicYear === academicYear && x.term === requestedTerm);
      const priorPairs = cutoff > 0 ? allPairs.slice(0, cutoff) : [];

      // Pull assignments and payments for every (year) referenced by either the
      // requested period or any prior period the loop will inspect. Without
      // this, the prior-period loop below either reads 0 or collides with the
      // current year's same-term row because the maps were keyed without year.
      const yearsToLoad = Array.from(
        new Set<string>([academicYear, ...priorPairs.map((p) => p.academicYear)]),
      );

      const assignments = await StudentFeeAssignment.findAll({
        where: { academicYear: { [Op.in]: yearsToLoad } },
      });
      const structures = await StudentFeeStructure.findAll({ where: { term: requestedTerm } });
      const payments = await StudentFeePayment.findAll({
        where: { academicYear: { [Op.in]: yearsToLoad } },
        order: [["created_at", "ASC"]],
      });

      const assignmentMap = new Map<string, number>();
      for (const a of assignments) {
        assignmentMap.set(
          `${a.studentId}::${a.term}::${a.academicYear}`,
          Number(a.amountDueUgx) || 0,
        );
      }

      const structureMap = new Map<string, number>();
      for (const s of structures) {
        structureMap.set(`${s.term}::${s.boardingStatus}`, Number(s.amountDueUgx) || 0);
      }

      const paymentsByStudentPeriod = new Map<string, StudentFeePayment[]>();
      for (const p of payments) {
        if (p.term !== requestedTerm || p.academicYear !== academicYear) continue;
        const k = `${p.studentId}::${p.term}::${p.academicYear}`;
        const list = paymentsByStudentPeriod.get(k) ?? [];
        list.push(p);
        paymentsByStudentPeriod.set(k, list);
      }

      const paidMap = new Map<string, number>();
      for (const p of payments) {
        const k = `${p.studentId}::${p.term}::${p.academicYear}`;
        paidMap.set(k, (paidMap.get(k) ?? 0) + (Number(p.amountPaidUgx) || 0));
      }

      const items = students.map((s) => {
        const cr = s.get("classRoom") as ClassRoom | null;
        const className = cr?.name ?? null;
        const boarding = normalizeBoardingStatus((s as any).boardingStatus);
        const status = toFeeStructureStatus(boarding, className);
        const bursaryPct = Math.max(0, Number((s as any).bursaryPercentage) || 0);

        const currentKey = `${s.id}::${requestedTerm}::${academicYear}`;
        const assignmentDue = assignmentMap.get(currentKey);
        const defaultDue = status != null ? (structureMap.get(`${requestedTerm}::${status}`) ?? 0) : 0;
        const totalFees =
          assignmentDue != null ? assignmentDue : Math.max(0, Math.round(defaultDue * (1 - bursaryPct / 100)));

        const totalPaid = paidMap.get(currentKey) ?? 0;
        const currentBalance = totalFees - totalPaid;

        let oldBalance = 0;
        for (const p of priorPairs) {
          const k = `${s.id}::${p.term}::${p.academicYear}`;
          const due = assignmentMap.get(k) ?? 0;
          const paid = paidMap.get(k) ?? 0;
          const bal = Math.max(0, due - paid);
          oldBalance += bal;
        }

        const paymentList = (paymentsByStudentPeriod.get(currentKey) ?? []).map((p) => ({
          paymentId: p.id,
          amount: Number(p.amountPaidUgx) || 0,
          date: (p.paymentDate ?? (p.createdAt ? new Date(p.createdAt).toISOString().slice(0, 10) : null)) ?? "",
          method: p.paymentMethod,
          note: (p.note ?? (p as any).changeReason ?? "") || "",
          appliedToOldBalance: Boolean((p as any).allocatesPriorTerms),
        }));

        return {
          studentId: s.id,
          fullName: `${(s as any).firstName ?? ""} ${(s as any).lastName ?? ""}`.trim(),
          admissionNumber: (s as any).admissionNumber ?? "",
          className: className ?? "—",
          totalFees,
          totalPaid,
          oldBalance,
          currentBalance,
          currency: "UGX",
          payments: paymentList,
        };
      });

      return res.json({ term: requestedTerm, academicYear, items });
    } catch (err) {
      console.error(err);
      return res.status(503).json({ error: "Database unavailable" });
    }
  });

  r.post("/finance/historical/payments", async (req, res) => {
    try {
      const canWrite = await isAdminRoleForUserId(req.userId);
      if (!canWrite) {
        return res.status(403).json({ error: "Only admin can record historical payments." });
      }

      const body = req.body as Record<string, unknown>;
      const studentId = Number(body.studentId);
      const term = trimStr(body.term, 20);
      const academicYear = trimStr(body.academicYear, 4);
      const paymentMethod = trimStr(body.paymentMethod, 40);
      const paidBy = trimStr(body.paidBy, 120) ?? "Historical payment";
      const currentTermAmount = parseMoneyUgx(body.currentTermAmount);
      const oldBalanceAmount = parseMoneyUgx(body.oldBalanceAmount) ?? 0;
      const paymentDate = trimStr(body.paymentDate, 10);
      const note = trimStr(body.note, 200);

      if (!Number.isFinite(studentId) || studentId < 1) return res.status(400).json({ error: "Invalid studentId" });
      if (!term) return res.status(400).json({ error: "term is required" });
      if (!academicYear || !/^\d{4}$/.test(academicYear)) {
        return res.status(400).json({ error: "academicYear is required" });
      }
      if (!paymentMethod) return res.status(400).json({ error: "paymentMethod is required" });
      if (currentTermAmount == null || currentTermAmount <= 0) {
        return res.status(400).json({ error: "currentTermAmount must be greater than zero" });
      }
      if (oldBalanceAmount < 0) return res.status(400).json({ error: "oldBalanceAmount must be >= 0" });
      if (paymentDate && !/^\d{4}-\d{2}-\d{2}$/.test(paymentDate)) {
        return res.status(400).json({ error: "paymentDate must be YYYY-MM-DD" });
      }

      const student = await Student.findByPk(studentId, {
        include: [{ model: ClassRoom, as: "classRoom", required: false }],
      });
      if (!student) return res.status(404).json({ error: "Student not found" });

      const sequelize = StudentFeeReceipt.sequelize;
      if (!sequelize) return res.status(500).json({ error: "Database not initialized" });

      const createdReceipt = await sequelize.transaction(async (t) => {
        const sumRaw = await StudentFeePayment.sum("amount_paid_ugx", {
          where: { studentId, term, academicYear },
          transaction: t,
        });
        const previousPaidUgx = Math.max(Number(sumRaw ?? 0) || 0, 0);
        const assignment = await StudentFeeAssignment.findOne({
          where: { studentId, term, academicYear },
          transaction: t,
        });
        const targetDueUgx = assignment ? Number(assignment.amountDueUgx) : previousPaidUgx + currentTermAmount;
        const summary = await calculatePaymentSummary({
          previousPaidUgx,
          amountPaidUgx: currentTermAmount,
          targetDueUgx,
        });

        const receipt = await StudentFeeReceipt.create(
          {
            studentId,
            receiptNo: "PENDING",
            academicYear,
            term,
            paymentMethod,
            paidBy,
            amountPaidUgx: currentTermAmount + oldBalanceAmount,
            previousPaidUgx,
            totalFeesDueUgx: summary.totalFeesDueUgx,
            outstandingAfterUgx: summary.outstandingAfterUgx,
            creditAmountUgx: summary.creditAmountUgx,
            createdAt: paymentDate ? new Date(`${paymentDate}T12:00:00.000Z`) : new Date(),
          } as any,
          { transaction: t },
        );
        await receipt.update(
          { receiptNo: `ST-${String(receipt.id).padStart(5, "0")}` },
          { transaction: t },
        );

        await StudentFeePayment.create(
          {
            studentId,
            term,
            academicYear,
            amountPaidUgx: currentTermAmount,
            paymentMethod,
            paidBy,
            receiptId: receipt.id,
            changeReason: null,
            allocatesPriorTerms: false,
            note,
            paymentDate: paymentDate ?? null,
            createdAt: paymentDate ? new Date(`${paymentDate}T12:00:00.000Z`) : new Date(),
          } as any,
          { transaction: t },
        );

        if (oldBalanceAmount > 0) {
          await StudentFeePayment.create(
            {
              studentId,
              term,
              academicYear,
              amountPaidUgx: oldBalanceAmount,
              paymentMethod,
              paidBy,
              receiptId: receipt.id,
              changeReason: null,
              allocatesPriorTerms: true,
              note,
              paymentDate: paymentDate ?? null,
              createdAt: paymentDate ? new Date(`${paymentDate}T12:00:00.000Z`) : new Date(),
            } as any,
            { transaction: t },
          );
        }

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
          student: studentToApiRow(student),
        },
      });
    } catch (err) {
      console.error(err);
      return res.status(503).json({ error: "Database unavailable" });
    }
  });

  return r;
}

