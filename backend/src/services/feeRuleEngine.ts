import { Op } from "sequelize";
import type { Transaction } from "sequelize";
import {
  FeeCategory,
  FeeRule,
  Student,
  StudentFeeAssignment,
  StudentFeeLineItem,
  StudentStatus,
} from "../models/index.js";
import { loadOfficialSchoolTermYear } from "../lib/officialSchoolTermYear.js";
import { evaluateFeeFormula } from "./formulaEval.js";
import { syncAssignmentRollupFromLineItems } from "./feeLineItemSync.js";

export type FeeLineItemPreview = {
  feeCategoryId: number;
  feeCategoryCode: string;
  feeCategoryName: string;
  feeRuleId: number | null;
  amountUgx: number;
  notes: string | null;
};

export type FeeComputeResult = {
  lineItems: FeeLineItemPreview[];
  totalUgx: number;
};

function ruleAppliesOnDate(
  rule: FeeRule,
  asOf: string,
): boolean {
  const from = rule.effectiveFrom;
  const to = rule.effectiveTo;
  if (from && asOf < from) return false;
  if (to && asOf > to) return false;
  return rule.isActive;
}

async function loadStudentContext(
  studentId: number | null,
  studentStatusId: number | null,
): Promise<{
  statusId: number;
  statusCode: string;
  siblingCount: number;
  bursaryPercent: number;
}> {
  if (studentId != null) {
    const student = await Student.findByPk(studentId, {
      attributes: ["id", "studentStatusId", "parentEmail", "bursaryPercentage"],
    });
    if (!student) throw new Error("Student not found");
    const statusId = student.studentStatusId ?? studentStatusId;
    if (statusId == null) throw new Error("Student status is required");
    const status = await StudentStatus.findByPk(statusId);
    if (!status || status.archivedAt) throw new Error("Invalid student status");
    let siblingCount = 0;
    if (student.parentEmail?.trim()) {
      siblingCount = await Student.count({
        where: {
          parentEmail: student.parentEmail.trim(),
          id: { [Op.ne]: student.id },
        },
      });
    }
    return {
      statusId,
      statusCode: status.code,
      siblingCount,
      bursaryPercent: Number(student.bursaryPercentage ?? 0) || 0,
    };
  }
  if (studentStatusId == null) throw new Error("studentStatusId is required");
  const status = await StudentStatus.findByPk(studentStatusId);
  if (!status || status.archivedAt) throw new Error("Invalid student status");
  return {
    statusId: studentStatusId,
    statusCode: status.code,
    siblingCount: 0,
    bursaryPercent: 0,
  };
}

export async function computeFeeLineItems(input: {
  studentId?: number | null;
  studentStatusId?: number | null;
  term: string;
  academicYear: string;
  asOf?: string;
}): Promise<FeeComputeResult> {
  const asOf = input.asOf ?? new Date().toISOString().slice(0, 10);
  const ctx = await loadStudentContext(input.studentId ?? null, input.studentStatusId ?? null);

  const categories = await FeeCategory.findAll({
    where: { isActive: true },
    include: [
      {
        model: StudentStatus,
        as: "applicableStatuses",
        where: { id: ctx.statusId },
        required: true,
        attributes: [],
      },
    ],
    order: [["name", "ASC"]],
  });

  const rules = await FeeRule.findAll({
    where: {
      studentStatusId: ctx.statusId,
      isActive: true,
      feeCategoryId: { [Op.in]: categories.map((c) => c.id) },
    },
    include: [{ model: FeeCategory, as: "feeCategory", required: true }],
    order: [
      ["fee_category_id", "ASC"],
      ["priority", "ASC"],
      ["id", "ASC"],
    ],
  });

  const ruleByCategory = new Map<number, FeeRule>();
  for (const rule of rules) {
    if (!ruleAppliesOnDate(rule, asOf)) continue;
    if (!ruleByCategory.has(rule.feeCategoryId)) {
      ruleByCategory.set(rule.feeCategoryId, rule);
    }
  }

  const lineItems: FeeLineItemPreview[] = [];
  for (const category of categories) {
    const rule = ruleByCategory.get(category.id);
    const base = rule ? Number(rule.baseAmountUgx) : 0;
    let amount = base;
    if (rule) {
      if (rule.inputMode === "formula" && rule.formulaText?.trim()) {
        amount = evaluateFeeFormula(rule.formulaText, {
          baseAmount: base,
          statusCode: ctx.statusCode,
          categoryCode: category.code,
          siblingCount: ctx.siblingCount,
          bursaryPercent: ctx.bursaryPercent,
        }, base);
      } else if (rule.plainEnglishText?.trim() && rule.inputMode === "plain") {
        amount = base;
      }
    }
    if (amount <= 0 && !category.isMandatory) continue;
    lineItems.push({
      feeCategoryId: category.id,
      feeCategoryCode: category.code,
      feeCategoryName: category.name,
      feeRuleId: rule?.id ?? null,
      amountUgx: Math.max(0, Math.round(amount)),
      notes: rule?.notes ?? null,
    });
  }

  const totalUgx = lineItems.reduce((s, li) => s + li.amountUgx, 0);
  return { lineItems, totalUgx };
}

export async function generateAndPersistLineItems(input: {
  studentId: number;
  term: string;
  academicYear: string;
  transaction?: Transaction;
}): Promise<FeeComputeResult> {
  const preview = await computeFeeLineItems({
    studentId: input.studentId,
    term: input.term,
    academicYear: input.academicYear,
  });

  for (const item of preview.lineItems) {
    const [row] = await StudentFeeLineItem.findOrCreate({
      where: {
        studentId: input.studentId,
        term: input.term,
        academicYear: input.academicYear,
        feeCategoryId: item.feeCategoryId,
      },
      defaults: {
        studentId: input.studentId,
        term: input.term,
        academicYear: input.academicYear,
        feeCategoryId: item.feeCategoryId,
        feeRuleId: item.feeRuleId,
        amountUgx: item.amountUgx,
        notes: item.notes,
      },
      transaction: input.transaction,
    });
    await row.update(
      {
        amountUgx: item.amountUgx,
        feeRuleId: item.feeRuleId,
        notes: item.notes,
      },
      { transaction: input.transaction },
    );
  }

  await syncAssignmentRollupFromLineItems(
    input.studentId,
    input.term,
    input.academicYear,
    input.transaction,
  );

  return preview;
}

export type StatusFeeRecalcScope = "current_term" | "all_terms";

/** Regenerate fee line items after a student status change. */
export async function regenerateFeesAfterStatusChange(
  studentId: number,
  scope: StatusFeeRecalcScope,
): Promise<void> {
  const official = await loadOfficialSchoolTermYear();
  const periods = new Map<string, { term: string; academicYear: string }>();
  periods.set(`${official.term}|${official.academicYear}`, {
    term: official.term,
    academicYear: official.academicYear,
  });

  if (scope === "all_terms") {
    const [linePeriods, assignmentPeriods] = await Promise.all([
      StudentFeeLineItem.findAll({
        where: { studentId },
        attributes: ["term", "academicYear"],
        group: ["term", "academic_year"],
        raw: true,
      }),
      StudentFeeAssignment.findAll({
        where: { studentId },
        attributes: ["term", "academicYear"],
        group: ["term", "academic_year"],
        raw: true,
      }),
    ]);
    for (const row of [...linePeriods, ...assignmentPeriods] as Array<{
      term: string;
      academicYear: string;
    }>) {
      if (row.term && row.academicYear) {
        periods.set(`${row.term}|${row.academicYear}`, {
          term: row.term,
          academicYear: row.academicYear,
        });
      }
    }
  }

  for (const { term, academicYear } of periods.values()) {
    await generateAndPersistLineItems({ studentId, term, academicYear });
  }
}

export function parsePlainEnglishRule(text: string): {
  inputMode: "plain" | "formula";
  formulaText: string | null;
  plainEnglishText: string;
  interpretation: string;
} {
  const raw = text.trim();
  const lower = raw.toLowerCase();
  let formulaText: string | null = null;
  let interpretation = "Use base amount as configured.";

  if (lower.includes("10%") && (lower.includes("discount") || lower.includes("off"))) {
    formulaText = "IF({baseAmount}>0, ROUND({baseAmount}*0.9, 0), 0)";
    interpretation = "Apply 10% discount on base amount.";
  } else if (lower.includes("sibling") && lower.includes("5%")) {
    formulaText = "IF({siblingCount}>0, ROUND({baseAmount}*0.95, 0), {baseAmount})";
    interpretation = "5% sibling discount when sibling count > 0.";
  } else if (lower.includes("bursary")) {
    formulaText =
      "IF({bursaryPercent}>0, ROUND({baseAmount}*(100-{bursaryPercent})/100, 0), {baseAmount})";
    interpretation = "Reduce base amount by bursary percentage.";
  } else if (lower.includes("double") || lower.includes("twice")) {
    formulaText = "{baseAmount}*2";
    interpretation = "Double the base amount.";
  }

  return {
    inputMode: formulaText ? "formula" : "plain",
    formulaText,
    plainEnglishText: raw,
    interpretation,
  };
}

export async function simulateRule(input: {
  studentStatusId: number;
  feeCategoryId: number;
  baseAmountUgx: number;
  formulaText?: string | null;
  inputMode?: "plain" | "formula";
  plainEnglishText?: string | null;
}): Promise<{ amountUgx: number; formulaText: string | null }> {
  const category = await FeeCategory.findByPk(input.feeCategoryId);
  const status = await StudentStatus.findByPk(input.studentStatusId);
  if (!category || !status) throw new Error("Invalid category or status");

  let formula = input.formulaText ?? null;
  let mode = input.inputMode ?? "formula";
  if (input.plainEnglishText?.trim()) {
    const parsed = parsePlainEnglishRule(input.plainEnglishText);
    mode = parsed.inputMode;
    formula = parsed.formulaText ?? formula;
  }

  const base = Math.round(input.baseAmountUgx);
  if (mode === "plain" || !formula?.trim()) {
    return { amountUgx: base, formulaText: formula };
  }

  const amountUgx = evaluateFeeFormula(
    formula,
    {
      baseAmount: base,
      statusCode: status.code,
      categoryCode: category.code,
      siblingCount: 0,
      bursaryPercent: 0,
    },
    base,
  );
  return { amountUgx, formulaText: formula };
}
