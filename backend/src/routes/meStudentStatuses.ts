import { Router } from "express";
import { Op } from "sequelize";
import { z } from "zod";
import { Student, StudentStatus } from "../models/index.js";

const upsertSchema = z.object({
  name: z.string().trim().min(1).max(120),
  code: z.string().trim().min(1).max(20),
  description: z.string().trim().max(2000).nullable().optional(),
  colorHex: z
    .string()
    .trim()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export function createMeStudentStatusesRouter() {
  const r = Router();

  r.get("/student-statuses/count", async (_req, res) => {
    try {
      const count = await StudentStatus.count({
        where: { archivedAt: { [Op.is]: null } },
      });
      return res.json({ count });
    } catch (err) {
      console.error(err);
      return res.status(503).json({ error: "Database unavailable" });
    }
  });

  r.get("/student-statuses", async (req, res) => {
    try {
      const includeArchived = req.query.includeArchived === "1";
      const rows = await StudentStatus.findAll({
        where: includeArchived ? {} : { archivedAt: { [Op.is]: null } },
        order: [
          ["sort_order", "ASC"],
          ["name", "ASC"],
        ],
      });
      const counts = (await Student.findAll({
        attributes: [
          "studentStatusId",
          [Student.sequelize!.fn("COUNT", Student.sequelize!.col("id")), "cnt"],
        ],
        where: { studentStatusId: { [Op.ne]: null } },
        group: ["student_status_id"],
        raw: true,
      })) as unknown as Array<{ student_status_id: number; cnt: string }>;
      const countMap = new Map<number, number>();
      for (const row of counts) {
        countMap.set(Number(row.student_status_id), Number(row.cnt) || 0);
      }
      return res.json({
        items: rows.map((row) => ({
          id: row.id,
          name: row.name,
          code: row.code,
          description: row.description,
          colorHex: row.colorHex,
          sortOrder: row.sortOrder,
          archivedAt: row.archivedAt?.toISOString() ?? null,
          studentCount: countMap.get(row.id) ?? 0,
        })),
      });
    } catch (err) {
      console.error(err);
      return res.status(503).json({ error: "Database unavailable" });
    }
  });

  r.post("/student-statuses", async (req, res) => {
    const parsed = upsertSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid body" });
    try {
      const existing = await StudentStatus.findOne({
        where: { code: parsed.data.code },
      });
      if (existing) return res.status(409).json({ error: "Status code already exists" });
      const row = await StudentStatus.create({
        name: parsed.data.name,
        code: parsed.data.code.toUpperCase(),
        description: parsed.data.description ?? null,
        colorHex: parsed.data.colorHex ?? "#f59e0b",
        sortOrder: parsed.data.sortOrder ?? 0,
        archivedAt: null,
      });
      return res.status(201).json({ item: row });
    } catch (err) {
      console.error(err);
      return res.status(503).json({ error: "Database unavailable" });
    }
  });

  r.patch("/student-statuses/:id", async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
    const parsed = upsertSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid body" });
    try {
      const row = await StudentStatus.findByPk(id);
      if (!row) return res.status(404).json({ error: "Not found" });
      if (parsed.data.code && parsed.data.code !== row.code) {
        const clash = await StudentStatus.findOne({ where: { code: parsed.data.code } });
        if (clash) return res.status(409).json({ error: "Status code already exists" });
      }
      await row.update({
        ...parsed.data,
        code: parsed.data.code ? parsed.data.code.toUpperCase() : undefined,
      });
      return res.json({ item: row });
    } catch (err) {
      console.error(err);
      return res.status(503).json({ error: "Database unavailable" });
    }
  });

  r.post("/student-statuses/:id/archive", async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
    try {
      const row = await StudentStatus.findByPk(id);
      if (!row) return res.status(404).json({ error: "Not found" });
      const studentCount = await Student.count({ where: { studentStatusId: id } });
      await row.update({ archivedAt: new Date() });
      return res.json({ item: row, studentCount });
    } catch (err) {
      console.error(err);
      return res.status(503).json({ error: "Database unavailable" });
    }
  });

  r.get("/students/missing-status/count", async (_req, res) => {
    try {
      const count = await Student.count({ where: { studentStatusId: { [Op.is]: null } } });
      return res.json({ count });
    } catch (err) {
      console.error(err);
      return res.status(503).json({ error: "Database unavailable" });
    }
  });

  r.get("/students/missing-status", async (req, res) => {
    try {
      const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
      const offset = Math.max(0, Number(req.query.offset) || 0);
      const { rows, count } = await Student.findAndCountAll({
        where: { studentStatusId: { [Op.is]: null } },
        attributes: ["id", "admissionNumber", "firstName", "lastName", "classRoomId"],
        order: [["id", "DESC"]],
        limit,
        offset,
      });
      return res.json({
        total: count,
        items: rows.map((s) => ({
          id: s.id,
          admissionNumber: s.admissionNumber,
          firstName: s.firstName,
          lastName: s.lastName,
          fullName: `${s.firstName} ${s.lastName}`.trim(),
          classRoomId: s.classRoomId,
        })),
      });
    } catch (err) {
      console.error(err);
      return res.status(503).json({ error: "Database unavailable" });
    }
  });

  r.post("/students/bulk-status", async (req, res) => {
    const body = z
      .object({
        updates: z.array(
          z.object({
            studentId: z.number().int().positive(),
            studentStatusId: z.number().int().positive(),
          }),
        ),
      })
      .safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: "Invalid body" });
    try {
      let updated = 0;
      for (const u of body.data.updates) {
        const status = await StudentStatus.findByPk(u.studentStatusId);
        if (!status || status.archivedAt) continue;
        const [n] = await Student.update(
          { studentStatusId: u.studentStatusId },
          { where: { id: u.studentId, studentStatusId: { [Op.is]: null } } },
        );
        updated += n;
      }
      return res.json({ updated });
    } catch (err) {
      console.error(err);
      return res.status(503).json({ error: "Database unavailable" });
    }
  });

  return r;
}
