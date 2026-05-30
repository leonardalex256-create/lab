import { Router } from "express";
import { Op } from "sequelize";
import { z } from "zod";
import { FeeCategory, FeeCategoryStatus, StudentStatus } from "../models/index.js";

const upsertSchema = z.object({
  name: z.string().trim().min(1).max(120),
  code: z.string().trim().min(1).max(20),
  billingFrequency: z.enum(["term", "monthly", "annual", "once", "custom"]).optional(),
  isMandatory: z.boolean().optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  isActive: z.boolean().optional(),
  applicableStatusIds: z.array(z.number().int().positive()).optional(),
});

export function createMeFeeCategoriesRouter() {
  const r = Router();

  r.get("/fee-categories/exists", async (_req, res) => {
    try {
      const count = await FeeCategory.count({ where: { isActive: true } });
      return res.json({ exists: count > 0, count });
    } catch (err) {
      console.error(err);
      return res.status(503).json({ error: "Database unavailable" });
    }
  });

  r.get("/fee-categories", async (req, res) => {
    try {
      const statusId =
        typeof req.query.studentStatusId === "string"
          ? Number(req.query.studentStatusId)
          : null;
      const rows = await FeeCategory.findAll({
        include: [
          {
            model: StudentStatus,
            as: "applicableStatuses",
            attributes: ["id", "code", "name", "colorHex"],
            through: { attributes: [] },
            ...(statusId && Number.isFinite(statusId)
              ? { where: { id: statusId }, required: true }
              : {}),
          },
        ],
        order: [["name", "ASC"]],
      });
      return res.json({
        items: rows.map((row) => ({
          id: row.id,
          name: row.name,
          code: row.code,
          billingFrequency: row.billingFrequency,
          isMandatory: row.isMandatory,
          description: row.description,
          isActive: row.isActive,
          applicableStatuses: (
            (row.get("applicableStatuses") as StudentStatus[] | undefined) ?? []
          ).map((s) => ({
            id: s.id,
            code: s.code,
            name: s.name,
            colorHex: s.colorHex,
          })),
        })),
      });
    } catch (err) {
      console.error(err);
      return res.status(503).json({ error: "Database unavailable" });
    }
  });

  r.post("/fee-categories", async (req, res) => {
    const parsed = upsertSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid body" });
    const sequelize = FeeCategory.sequelize;
    if (!sequelize) return res.status(500).json({ error: "Database not initialized" });
    try {
      const item = await sequelize.transaction(async (t) => {
        const row = await FeeCategory.create(
          {
            name: parsed.data.name,
            code: parsed.data.code.toUpperCase(),
            billingFrequency: parsed.data.billingFrequency ?? "term",
            isMandatory: parsed.data.isMandatory ?? true,
            description: parsed.data.description ?? null,
            isActive: parsed.data.isActive ?? true,
          },
          { transaction: t },
        );
        const statusIds = parsed.data.applicableStatusIds ?? [];
        for (const studentStatusId of statusIds) {
          await FeeCategoryStatus.findOrCreate({
            where: { feeCategoryId: row.id, studentStatusId },
            defaults: { feeCategoryId: row.id, studentStatusId },
            transaction: t,
          });
        }
        return row;
      });
      return res.status(201).json({ item });
    } catch (err) {
      console.error(err);
      return res.status(503).json({ error: "Database unavailable" });
    }
  });

  r.patch("/fee-categories/:id", async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
    const parsed = upsertSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid body" });
    const sequelize = FeeCategory.sequelize;
    if (!sequelize) return res.status(500).json({ error: "Database not initialized" });
    try {
      await sequelize.transaction(async (t) => {
        const row = await FeeCategory.findByPk(id, { transaction: t });
        if (!row) throw new Error("NOT_FOUND");
        await row.update(
          {
            ...parsed.data,
            code: parsed.data.code ? parsed.data.code.toUpperCase() : undefined,
          },
          { transaction: t },
        );
        if (parsed.data.applicableStatusIds) {
          await FeeCategoryStatus.destroy({
            where: { feeCategoryId: id },
            transaction: t,
          });
          for (const studentStatusId of parsed.data.applicableStatusIds) {
            await FeeCategoryStatus.create(
              { feeCategoryId: id, studentStatusId },
              { transaction: t },
            );
          }
        }
      });
      const row = await FeeCategory.findByPk(id, {
        include: [{ model: StudentStatus, as: "applicableStatuses", through: { attributes: [] } }],
      });
      if (!row) return res.status(404).json({ error: "Not found" });
      return res.json({ item: row });
    } catch (err) {
      if (err instanceof Error && err.message === "NOT_FOUND") {
        return res.status(404).json({ error: "Not found" });
      }
      console.error(err);
      return res.status(503).json({ error: "Database unavailable" });
    }
  });

  r.delete("/fee-categories/:id", async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
    try {
      const row = await FeeCategory.findByPk(id);
      if (!row) return res.status(404).json({ error: "Not found" });
      await row.update({ isActive: false });
      return res.json({ ok: true });
    } catch (err) {
      console.error(err);
      return res.status(503).json({ error: "Database unavailable" });
    }
  });

  return r;
}
