import { Router } from "express";
import { z } from "zod";
import { FeeCategory, FeeRule, StudentStatus } from "../models/index.js";
import { parsePlainEnglishRule, simulateRule } from "../services/feeRuleEngine.js";
import { evaluateFormulaExpression, substituteFormulaVars } from "../services/formulaEval.js";

const upsertSchema = z.object({
  name: z.string().trim().min(1).max(120),
  feeCategoryId: z.number().int().positive(),
  studentStatusId: z.number().int().positive(),
  baseAmountUgx: z.number().int().min(0),
  plainEnglishText: z.string().nullable().optional(),
  formulaText: z.string().nullable().optional(),
  inputMode: z.enum(["plain", "formula"]).optional(),
  priority: z.number().int().min(0).optional(),
  effectiveFrom: z.string().nullable().optional(),
  effectiveTo: z.string().nullable().optional(),
  notes: z.string().max(255).nullable().optional(),
  isActive: z.boolean().optional(),
});

export function createMeFeeRulesRouter() {
  const r = Router();

  r.get("/finance/fee-rules", async (req, res) => {
    try {
      const statusId =
        typeof req.query.studentStatusId === "string"
          ? Number(req.query.studentStatusId)
          : undefined;
      const categoryId =
        typeof req.query.feeCategoryId === "string"
          ? Number(req.query.feeCategoryId)
          : undefined;
      const where: Record<string, unknown> = {};
      if (statusId && Number.isFinite(statusId)) where.studentStatusId = statusId;
      if (categoryId && Number.isFinite(categoryId)) where.feeCategoryId = categoryId;
      const rows = await FeeRule.findAll({
        where,
        include: [
          { model: FeeCategory, as: "feeCategory", attributes: ["id", "code", "name"] },
          { model: StudentStatus, as: "studentStatus", attributes: ["id", "code", "name"] },
        ],
        order: [
          ["student_status_id", "ASC"],
          ["fee_category_id", "ASC"],
          ["priority", "ASC"],
        ],
      });
      return res.json({ items: rows });
    } catch (err) {
      console.error(err);
      return res.status(503).json({ error: "Database unavailable" });
    }
  });

  r.post("/finance/fee-rules", async (req, res) => {
    const parsed = upsertSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid body" });
    try {
      const row = await FeeRule.create({
        ...parsed.data,
        inputMode: parsed.data.inputMode ?? "formula",
        priority: parsed.data.priority ?? 100,
        isActive: parsed.data.isActive ?? true,
      });
      return res.status(201).json({ item: row });
    } catch (err) {
      console.error(err);
      return res.status(503).json({ error: "Database unavailable" });
    }
  });

  r.patch("/finance/fee-rules/:id", async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
    const parsed = upsertSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid body" });
    try {
      const row = await FeeRule.findByPk(id);
      if (!row) return res.status(404).json({ error: "Not found" });
      await row.update(parsed.data);
      return res.json({ item: row });
    } catch (err) {
      console.error(err);
      return res.status(503).json({ error: "Database unavailable" });
    }
  });

  r.delete("/finance/fee-rules/:id", async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
    try {
      const row = await FeeRule.findByPk(id);
      if (!row) return res.status(404).json({ error: "Not found" });
      await row.update({ isActive: false });
      return res.json({ ok: true });
    } catch (err) {
      console.error(err);
      return res.status(503).json({ error: "Database unavailable" });
    }
  });

  r.post("/finance/rules/parse", async (req, res) => {
    const parsed = z.object({ text: z.string().min(1) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid body" });
    try {
      const result = parsePlainEnglishRule(parsed.data.text);
      return res.json(result);
    } catch (err) {
      console.error(err);
      return res.status(400).json({
        error: err instanceof Error ? err.message : "Could not parse rule",
      });
    }
  });

  r.post("/finance/rules/validate-formula", async (req, res) => {
    const parsed = z
      .object({
        formulaText: z.string().min(1),
        sampleContext: z.record(z.union([z.number(), z.string()])).optional(),
      })
      .safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid body" });
    try {
      const ctx = {
        baseAmount: 500_000,
        statusCode: "DS",
        categoryCode: "TUITION",
        siblingCount: 1,
        bursaryPercent: 10,
        ...parsed.data.sampleContext,
      };
      const substituted = substituteFormulaVars(parsed.data.formulaText, ctx);
      const amountUgx = evaluateFormulaExpression(substituted);
      return res.json({ valid: true, substituted, amountUgx });
    } catch (err) {
      return res.json({
        valid: false,
        error: err instanceof Error ? err.message : "Invalid formula",
      });
    }
  });

  r.post("/finance/rules/simulate", async (req, res) => {
    const parsed = z
      .object({
        studentStatusId: z.number().int().positive(),
        feeCategoryId: z.number().int().positive(),
        baseAmountUgx: z.number().int().min(0),
        formulaText: z.string().nullable().optional(),
        plainEnglishText: z.string().nullable().optional(),
        inputMode: z.enum(["plain", "formula"]).optional(),
      })
      .safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid body" });
    try {
      const result = await simulateRule(parsed.data);
      return res.json(result);
    } catch (err) {
      console.error(err);
      return res.status(400).json({
        error: err instanceof Error ? err.message : "Simulation failed",
      });
    }
  });

  return r;
}
