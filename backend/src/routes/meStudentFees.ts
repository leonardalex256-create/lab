import { Router } from "express";
import { z } from "zod";
import { loadOfficialSchoolTermYear } from "../lib/officialSchoolTermYear.js";
import {
  FeeCategory,
  Student,
  StudentFeeLineItem,
} from "../models/index.js";
import {
  computeFeeLineItems,
  generateAndPersistLineItems,
} from "../services/feeRuleEngine.js";
import { syncAssignmentRollupFromLineItems } from "../services/feeLineItemSync.js";

export function createMeStudentFeesRouter() {
  const r = Router();

  r.get("/finance/student-fees/preview", async (req, res) => {
    const studentStatusId = Number(req.query.studentStatusId);
    const term = typeof req.query.term === "string" ? req.query.term.trim() : "";
    const academicYear =
      typeof req.query.academicYear === "string" ? req.query.academicYear.trim() : "";
    if (!Number.isFinite(studentStatusId) || !term || !academicYear) {
      return res.status(400).json({ error: "studentStatusId, term, academicYear required" });
    }
    try {
      const result = await computeFeeLineItems({
        studentStatusId,
        term,
        academicYear,
      });
      return res.json(result);
    } catch (err) {
      console.error(err);
      return res.status(400).json({
        error: err instanceof Error ? err.message : "Preview failed",
      });
    }
  });

  r.post("/finance/student-fees/generate-line-items", async (req, res) => {
    const parsed = z
      .object({
        studentId: z.number().int().positive(),
        term: z.string().min(1).optional(),
        academicYear: z.string().min(4).max(4).optional(),
      })
      .safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid body" });
    try {
      const official = await loadOfficialSchoolTermYear();
      const term = parsed.data.term ?? official.term;
      const academicYear = parsed.data.academicYear ?? official.academicYear;
      const student = await Student.findByPk(parsed.data.studentId);
      if (!student) return res.status(404).json({ error: "Student not found" });
      if (!student.studentStatusId) {
        return res.status(400).json({ error: "Student status must be set first" });
      }
      const result = await generateAndPersistLineItems({
        studentId: student.id,
        term,
        academicYear,
      });
      return res.json(result);
    } catch (err) {
      console.error(err);
      return res.status(400).json({
        error: err instanceof Error ? err.message : "Generation failed",
      });
    }
  });

  r.get("/finance/student-fees/:studentId/line-items", async (req, res) => {
    const studentId = Number(req.params.studentId);
    const term = typeof req.query.term === "string" ? req.query.term.trim() : "";
    const academicYear =
      typeof req.query.academicYear === "string" ? req.query.academicYear.trim() : "";
    if (!Number.isFinite(studentId)) return res.status(400).json({ error: "Invalid studentId" });
    try {
      const official = await loadOfficialSchoolTermYear();
      const t = term || official.term;
      const y = academicYear || official.academicYear;
      const rows = await StudentFeeLineItem.findAll({
        where: { studentId, term: t, academicYear: y },
        include: [{ model: FeeCategory, as: "feeCategory", attributes: ["id", "code", "name"] }],
        order: [["fee_category_id", "ASC"]],
      });
      const items = rows.map((row) => ({
        id: row.id,
        feeCategoryId: row.feeCategoryId,
        feeCategoryCode: (row.get("feeCategory") as FeeCategory | undefined)?.code ?? "",
        feeCategoryName: (row.get("feeCategory") as FeeCategory | undefined)?.name ?? "",
        amountUgx: Number(row.amountUgx),
        feeRuleId: row.feeRuleId,
        notes: row.notes,
      }));
      const totalUgx = items.reduce((s, i) => s + i.amountUgx, 0);
      return res.json({ items, totalUgx, term: t, academicYear: y });
    } catch (err) {
      console.error(err);
      return res.status(503).json({ error: "Database unavailable" });
    }
  });

  r.put("/finance/student-fees/:studentId/line-items", async (req, res) => {
    const studentId = Number(req.params.studentId);
    const parsed = z
      .object({
        term: z.string().min(1),
        academicYear: z.string().length(4),
        items: z.array(
          z.object({
            feeCategoryId: z.number().int().positive(),
            amountUgx: z.number().int().min(0),
            notes: z.string().max(255).nullable().optional(),
          }),
        ),
      })
      .safeParse(req.body);
    if (!Number.isFinite(studentId) || !parsed.success) {
      return res.status(400).json({ error: "Invalid request" });
    }
    try {
      const { term, academicYear, items } = parsed.data;
      for (const item of items) {
        const [row] = await StudentFeeLineItem.findOrCreate({
          where: { studentId, term, academicYear, feeCategoryId: item.feeCategoryId },
          defaults: {
            studentId,
            term,
            academicYear,
            feeCategoryId: item.feeCategoryId,
            amountUgx: item.amountUgx,
            feeRuleId: null,
            notes: item.notes ?? null,
          },
        });
        await row.update({
          amountUgx: item.amountUgx,
          notes: item.notes ?? null,
        });
      }
      await syncAssignmentRollupFromLineItems(studentId, term, academicYear);
      return res.json({ ok: true });
    } catch (err) {
      console.error(err);
      return res.status(503).json({ error: "Database unavailable" });
    }
  });

  return r;
}
