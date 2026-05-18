/**
 * Attendance module API (Section A3).
 * GET  /api/me/attendance                  — today's list, filterable
 * POST /api/me/attendance/bulk             — bulk mark for a class
 * GET  /api/me/attendance/class/:classId   — class roster with today's status
 * GET  /api/me/attendance/reports          — monthly summary
 */
import { Router } from "express";
import { z } from "zod";
import { writeAuditLog } from "../utils/auditLogger.js";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-\d{2}$/;

function todayYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

function thisMonthYm(): string {
  return new Date().toISOString().slice(0, 7);
}

function parseIsoDate(value: unknown): { ok: true; value: string } | { ok: false; error: string } {
  if (value === undefined || value === null || value === "") return { ok: true, value: todayYmd() };
  if (typeof value !== "string" || !DATE_RE.test(value)) {
    return { ok: false, error: "date must be YYYY-MM-DD" };
  }
  const parsed = Date.parse(`${value}T12:00:00.000Z`);
  if (!Number.isFinite(parsed)) return { ok: false, error: "date must be a valid calendar date" };
  return { ok: true, value };
}

function parseIsoMonth(value: unknown): { ok: true; value: string } | { ok: false; error: string } {
  if (value === undefined || value === null || value === "") return { ok: true, value: thisMonthYm() };
  if (typeof value !== "string" || !MONTH_RE.test(value)) {
    return { ok: false, error: "month must be YYYY-MM" };
  }
  const parsed = Date.parse(`${value}-01T12:00:00.000Z`);
  if (!Number.isFinite(parsed)) return { ok: false, error: "month must be a valid calendar month" };
  return { ok: true, value };
}

const bulkAttendanceSchema = z.object({
  class_room_id: z.number().int().positive(),
  record_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  records: z.array(
    z.object({
      student_id: z.number().int().positive(),
      status: z.enum(["present", "absent", "late", "excused"]),
    }),
  ).min(1),
});

export function createMeAttendanceRouter() {
  const r = Router();

  // ── GET /attendance ──────────────────────────────────────────────────────
  r.get("/attendance", async (req, res) => {
    try {
      const sequelize = (await import("../models/index.js")).User.sequelize;
      if (!sequelize) return res.status(500).json({ error: "DB not initialized" });

      const dateParse = parseIsoDate(req.query.date);
      if (!dateParse.ok) return res.status(400).json({ error: dateParse.error });
      const date = dateParse.value;
      const classId = req.query.class ? Number(req.query.class) : null;
      const status = (req.query.status as string | undefined) ?? "";
      const page = Math.max(1, Number(req.query.page ?? 1));
      const limit = Math.min(200, Math.max(1, Number(req.query.limit ?? 50)));
      const offset = (page - 1) * limit;

      let where = "WHERE ar.record_date = :date";
      const replacements: Record<string, unknown> = { date, limit, offset };

      if (classId) {
        where += " AND ar.class_room_id = :classId";
        replacements["classId"] = classId;
      }
      if (status) {
        where += " AND ar.status = :status";
        replacements["status"] = status;
      }

      const [rows] = await sequelize.query(
        `SELECT
           ar.id, ar.student_id, ar.record_date, ar.status, ar.recorded_at,
           s.first_name, s.last_name, s.passport_photo_filename,
           COALESCE(c.name, s.section_name) AS class_name,
           u.email AS recorded_by_email
         FROM attendance_records ar
         JOIN students s ON s.id = ar.student_id
         LEFT JOIN classrooms c ON c.id = ar.class_room_id
         LEFT JOIN users u ON u.id = ar.recorded_by
         ${where}
         ORDER BY s.last_name, s.first_name
         LIMIT :limit OFFSET :offset`,
        { replacements },
      );

      // Summary counts
      const [[summary]] = await sequelize.query(
        `SELECT
           COUNT(*) AS total,
           SUM(ar.status = 'present') AS present_count,
           SUM(ar.status = 'absent') AS absent_count,
           SUM(ar.status = 'late') AS late_count,
           SUM(ar.status = 'excused') AS excused_count
         FROM attendance_records ar
         LEFT JOIN classrooms c ON c.id = ar.class_room_id
         ${where}`,
        { replacements: { ...replacements, limit: 999999, offset: 0 } },
      ) as [[{ total: number; present_count: number; absent_count: number; late_count: number; excused_count: number }]];

      return res.json({
        success: true,
        data: rows,
        summary: {
          total: Number(summary.total),
          present: Number(summary.present_count),
          absent: Number(summary.absent_count),
          late: Number(summary.late_count),
          excused: Number(summary.excused_count),
        },
        meta: { page, limit, date },
      });
    } catch (err) {
      console.error("[attendance]", err);
      return res.status(500).json({ error: "Failed to load attendance" });
    }
  });

  // ── GET /attendance/class/:classId — roster with today's marks ─────────
  r.get("/attendance/class/:classId", async (req, res) => {
    try {
      const sequelize = (await import("../models/index.js")).User.sequelize;
      if (!sequelize) return res.status(500).json({ error: "DB not initialized" });

      const classId = Number(req.params.classId);
      if (!Number.isFinite(classId) || classId < 1) {
        return res.status(400).json({ error: "Invalid classId" });
      }
      const dateParse = parseIsoDate(req.query.date);
      if (!dateParse.ok) return res.status(400).json({ error: dateParse.error });
      const date = dateParse.value;

      const [students] = await sequelize.query(
        `SELECT
           s.id AS student_id,
           s.first_name, s.last_name, s.passport_photo_filename,
           ar.id AS attendance_id,
           COALESCE(ar.status, '') AS status
         FROM students s
         LEFT JOIN attendance_records ar ON ar.student_id = s.id
           AND ar.class_room_id = :classId
           AND ar.record_date = :date
         WHERE s.class_room_id = :classId AND s.status = 'active'
         ORDER BY s.last_name, s.first_name`,
        { replacements: { classId, date } },
      );

      return res.json({ success: true, data: students, date, class_room_id: classId });
    } catch (err) {
      console.error("[attendance/class]", err);
      return res.status(500).json({ error: "Failed to load class roster" });
    }
  });

  // ── POST /attendance/bulk ────────────────────────────────────────────────
  r.post("/attendance/bulk", async (req, res) => {
    const parsed = bulkAttendanceSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid body" });
    }

    try {
      const sequelize = (await import("../models/index.js")).User.sequelize;
      if (!sequelize) return res.status(500).json({ error: "DB not initialized" });

      const { class_room_id, record_date, records } = parsed.data;
      const recordedAt = new Date().toISOString().slice(0, 19).replace("T", " ");

      await sequelize.transaction(async (t) => {
        for (const rec of records) {
          // Upsert: update if exists, insert if not
          const [existing] = await sequelize.query(
            `SELECT id FROM attendance_records WHERE student_id = :sid AND class_room_id = :cid AND record_date = :date LIMIT 1`,
            { replacements: { sid: rec.student_id, cid: class_room_id, date: record_date }, transaction: t },
          );

          if ((existing as unknown[]).length > 0) {
            const row = (existing as Array<{id: number}>)[0]!;
            await sequelize.query(
              `UPDATE attendance_records SET status = :status, recorded_by = :by, recorded_at = :at, present = :present WHERE id = :id`,
              {
                replacements: {
                  status: rec.status,
                  by: req.userId ?? null,
                  at: recordedAt,
                  present: rec.status === "present" ? 1 : 0,
                  id: row.id,
                },
                transaction: t,
              },
            );
          } else {
            await sequelize.query(
              `INSERT INTO attendance_records (student_id, class_room_id, record_date, status, recorded_by, recorded_at, present)
               VALUES (:sid, :cid, :date, :status, :by, :at, :present)`,
              {
                replacements: {
                  sid: rec.student_id,
                  cid: class_room_id,
                  date: record_date,
                  status: rec.status,
                  by: req.userId ?? null,
                  at: recordedAt,
                  present: rec.status === "present" ? 1 : 0,
                },
                transaction: t,
              },
            );
          }
        }
      });

      await writeAuditLog({
        sequelize,
        userId: req.userId ?? null,
        action: "attendance_marked",
        entity: "attendance_records",
        entityLabel: `Class ${class_room_id} · ${record_date}`,
        severity: "info",
        channel: "web",
        metadata: { class_room_id, record_date, count: records.length },
      });

      return res.json({ success: true, message: `Saved attendance for ${records.length} students` });
    } catch (err) {
      console.error("[attendance/bulk]", err);
      return res.status(500).json({ error: "Failed to save attendance" });
    }
  });

  // ── GET /attendance/reports ──────────────────────────────────────────────
  r.get("/attendance/reports", async (req, res) => {
    try {
      const sequelize = (await import("../models/index.js")).User.sequelize;
      if (!sequelize) return res.status(500).json({ error: "DB not initialized" });

      const classId = req.query.class ? Number(req.query.class) : null;
      const monthParse = parseIsoMonth(req.query.month);
      if (!monthParse.ok) return res.status(400).json({ error: monthParse.error });
      const month = monthParse.value;
      const [year, mon] = month.split("-");

      let classWhere = classId ? "AND s.class_room_id = :classId" : "";
      const replacements: Record<string, unknown> = {
        year: year!,
        mon: mon!,
        classId: classId ?? null,
      };

      // Monthly summary per student
      const [studentSummary] = await sequelize.query(
        `SELECT
           s.id, s.first_name, s.last_name,
           COALESCE(c.name, s.section_name) AS class_name,
           COUNT(ar.id) AS total_days,
           SUM(ar.status = 'present') AS present_days,
           SUM(ar.status = 'absent') AS absent_days,
           ROUND(100.0 * SUM(ar.status = 'present') / NULLIF(COUNT(ar.id), 0), 1) AS attendance_pct
         FROM students s
         JOIN attendance_records ar ON ar.student_id = s.id
           AND YEAR(ar.record_date) = :year
           AND MONTH(ar.record_date) = :mon
         LEFT JOIN classrooms c ON c.id = s.class_room_id
         WHERE s.status = 'active' ${classWhere}
         GROUP BY s.id
         ORDER BY attendance_pct ASC`,
        { replacements },
      );

      // Daily rates for chart
      const [dailyRates] = await sequelize.query(
        `SELECT
           ar.record_date,
           COUNT(*) AS total,
           SUM(ar.status = 'present') AS present_count,
           ROUND(100.0 * SUM(ar.status = 'present') / NULLIF(COUNT(*), 0), 1) AS rate
         FROM attendance_records ar
         JOIN students s ON s.id = ar.student_id
         WHERE YEAR(ar.record_date) = :year AND MONTH(ar.record_date) = :mon ${classWhere}
         GROUP BY ar.record_date
         ORDER BY ar.record_date`,
        { replacements },
      );

      return res.json({ success: true, data: { students: studentSummary, daily: dailyRates }, month });
    } catch (err) {
      console.error("[attendance/reports]", err);
      return res.status(500).json({ error: "Failed to load report" });
    }
  });

  return r;
}
