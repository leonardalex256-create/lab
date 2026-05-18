/**
 * Parents module API (Section A1).
 * GET    /api/me/parents              — paginated list
 * POST   /api/me/parents              — create parent
 * GET    /api/me/parents/:id          — detail
 * PATCH  /api/me/parents/:id          — update
 * POST   /api/me/parents/:id/link-student — link a student
 * POST   /api/me/parents/:id/contact-log  — add contact log note
 * GET    /api/me/parents/:id/contact-log  — get contact logs
 */
import { Router } from "express";
import { z } from "zod";
import { writeAuditLog } from "../utils/auditLogger.js";

const createParentSchema = z.object({
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  relationship: z.string().min(1),
  national_id: z.string().optional(),
  phone_primary: z.string().min(1),
  phone_secondary: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().optional(),
  occupation: z.string().optional(),
  status: z.enum(["active", "inactive"]).default("active"),
});

const contactLogSchema = z.object({
  note: z.string().min(1),
  contact_type: z.enum(["note", "call", "meeting"]).default("note"),
});

export function createMeParentsRouter() {
  const r = Router();

  // ── GET /parents/child-academic-summary ──────────────────────────────────
  // Used by ParentOverview. Validates the child belongs to this parent by email.
  r.get("/parents/child-academic-summary", async (req, res) => {
    try {
      const sequelize = (await import("../models/index.js")).User.sequelize;
      if (!sequelize) return res.status(500).json({ error: "DB not initialized" });

      const studentId = Number(req.query.studentId);
      const term = typeof req.query.term === "string" ? req.query.term.trim() : "";
      const academicYear =
        typeof req.query.academicYear === "string" ? req.query.academicYear.trim() : "";

      if (!Number.isFinite(studentId) || studentId <= 0) {
        return res.status(400).json({ error: "Invalid studentId" });
      }
      if (!term) return res.status(400).json({ error: "term is required" });
      if (!/^\d{4}$/.test(academicYear)) return res.status(400).json({ error: "academicYear is required" });

      const userId = req.userId ?? null;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const [[userRow]] = await sequelize.query(
        "SELECT email, role FROM users WHERE id = :id LIMIT 1",
        { replacements: { id: userId } },
      ) as [[{ email: string; role: string }]];
      const userEmail = userRow?.email ?? "";
      if (!userEmail) return res.status(403).json({ error: "Parent email missing" });

      const [[allowed]] = await sequelize.query(
        "SELECT id FROM students WHERE id = :studentId AND parent_email = :email LIMIT 1",
        { replacements: { studentId, email: userEmail } },
      ) as [[{ id: number }]];
      if (!allowed) return res.status(403).json({ error: "Access denied" });

      const [rows] = await sequelize.query(
        `SELECT subject, score, max_score
         FROM student_assessment_results
         WHERE student_id = :studentId AND term = :term AND academic_year = :academicYear
         ORDER BY subject`,
        { replacements: { studentId, term, academicYear } },
      );

      const items = (rows as any[]).map((r) => {
        const score = r.score == null ? null : Number(r.score);
        const maxScore = r.max_score == null ? 100 : Number(r.max_score);
        const grade = score == null ? null : (score / maxScore) * 100 >= 80 ? "A" : (score / maxScore) * 100 >= 65 ? "B" : (score / maxScore) * 100 >= 50 ? "C" : (score / maxScore) * 100 >= 35 ? "D" : "F";
        return {
          subject: String(r.subject),
          score: score == null ? null : (maxScore ? (score / maxScore) * 100 : score),
          grade,
        };
      });

      return res.json({ items });
    } catch (err) {
      console.error("[parents/child-academic-summary]", err);
      return res.status(500).json({ error: "Failed to load academic summary" });
    }
  });

  // ── GET /parents/child-finance-mini ──────────────────────────────────────
  // Used by ParentOverview. Only returns totals for a linked child.
  r.get("/parents/child-finance-mini", async (req, res) => {
    try {
      const sequelize = (await import("../models/index.js")).User.sequelize;
      if (!sequelize) return res.status(500).json({ error: "DB not initialized" });

      const studentId = Number(req.query.studentId);
      const term = typeof req.query.term === "string" ? req.query.term.trim() : "";
      const academicYear =
        typeof req.query.academicYear === "string" ? req.query.academicYear.trim() : "";

      if (!Number.isFinite(studentId) || studentId <= 0) {
        return res.status(400).json({ error: "Invalid studentId" });
      }
      if (!term) return res.status(400).json({ error: "term is required" });
      if (!/^\d{4}$/.test(academicYear)) return res.status(400).json({ error: "academicYear is required" });

      const userId = req.userId ?? null;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const [[userRow]] = await sequelize.query(
        "SELECT email FROM users WHERE id = :id LIMIT 1",
        { replacements: { id: userId } },
      ) as [[{ email: string }]];
      const userEmail = userRow?.email ?? "";
      if (!userEmail) return res.status(403).json({ error: "Parent email missing" });

      const [[allowed]] = await sequelize.query(
        "SELECT id FROM students WHERE id = :studentId AND parent_email = :email LIMIT 1",
        { replacements: { studentId, email: userEmail } },
      ) as [[{ id: number }]];
      if (!allowed) return res.status(403).json({ error: "Access denied" });

      const [[assignment]] = await sequelize.query(
        `SELECT id, amount_due_ugx AS due
         FROM student_fee_assignments
         WHERE student_id = :studentId AND term = :term AND academic_year = :academicYear
         ORDER BY id DESC
         LIMIT 1`,
        { replacements: { studentId, term, academicYear } },
      ) as [[{ id: number; due: number }]];

      const assignmentId = assignment?.id ?? null;
      const totalFees = Number(assignment?.due ?? 0) || 0;

      let amountPaid = 0;
      if (assignmentId) {
        const [[paidRow]] = await sequelize.query(
          `SELECT COALESCE(SUM(amount_ugx),0) AS paid
           FROM student_fee_payments
           WHERE student_id = :studentId AND fee_assignment_id = :assignmentId`,
          { replacements: { studentId, assignmentId } },
        ) as [[{ paid: number | string }]];
        amountPaid = Number(paidRow?.paid ?? 0) || 0;
      }

      const balanceDue = Math.max(0, totalFees - amountPaid);

      return res.json({
        item: {
          totalFees,
          amountPaid,
          balanceDue,
          termAverageScore: null,
          attendanceRate: null,
        },
      });
    } catch (err) {
      console.error("[parents/child-finance-mini]", err);
      return res.status(500).json({ error: "Failed to load fee status" });
    }
  });

  // ── GET /parents ─────────────────────────────────────────────────────────
  r.get("/parents", async (req, res) => {
    try {
      const sequelize = (await import("../models/index.js")).User.sequelize;
      if (!sequelize) return res.status(500).json({ error: "DB not initialized" });

      const page = Math.max(1, Number(req.query.page ?? 1));
      const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 25)));
      const offset = (page - 1) * limit;
      const search = (req.query.search as string | undefined)?.trim() ?? "";
      const status = (req.query.status as string | undefined)?.trim() ?? "";
      const classFilter = (req.query.class as string | undefined)?.trim() ?? "";

      // Parents are stored in students table via parent_full_name etc.
      // We also look for users with role 'parent'.
      // Build a unified view from students.parent_full_name + users with parent role.
      let where = "WHERE 1=1";
      const replacements: Record<string, unknown> = { limit, offset };

      if (search) {
        where += " AND (s.parent_full_name LIKE :search OR s.parent_phone LIKE :search)";
        replacements["search"] = `%${search}%`;
      }
      if (status === "active" || status === "inactive") {
        where += " AND s.status = :status";
        replacements["status"] = status;
      }
      if (classFilter) {
        where += " AND c.name LIKE :classFilter";
        replacements["classFilter"] = `%${classFilter}%`;
      }

      // Aggregate students by parent name+phone as a parent entity
      const [rows] = await sequelize.query(
        `SELECT
           s.parent_full_name AS name,
           s.parent_phone AS phone,
           '' AS relationship,
           COUNT(s.id) AS linked_students,
           GROUP_CONCAT(DISTINCT s.id ORDER BY s.id) AS student_ids,
           GROUP_CONCAT(DISTINCT COALESCE(c.name, s.section_name) ORDER BY s.id) AS classes,
           MIN(s.id) AS anchor_student_id
         FROM students s
         LEFT JOIN classrooms c ON c.id = s.class_room_id
         ${where}
         GROUP BY s.parent_full_name, s.parent_phone
         ORDER BY s.parent_full_name
         LIMIT :limit OFFSET :offset`,
        { replacements },
      );

      const [[{ total }]] = await sequelize.query(
        `SELECT COUNT(DISTINCT CONCAT(s.parent_full_name,'|',s.parent_phone)) AS total
         FROM students s
         LEFT JOIN classrooms c ON c.id = s.class_room_id
         ${where}`,
        { replacements: { ...replacements, limit: 999999, offset: 0 } },
      ) as [[{ total: number }]];

      return res.json({
        success: true,
        data: rows,
        meta: { page, limit, total: Number(total), pages: Math.ceil(Number(total) / limit) },
      });
    } catch (err) {
      console.error("[parents]", err);
      return res.status(500).json({ error: "Failed to load parents" });
    }
  });

  // ── GET /parents/:id (by anchor_student_id = parent key) ─────────────────
  r.get("/parents/:studentId", async (req, res) => {
    try {
      const sequelize = (await import("../models/index.js")).User.sequelize;
      if (!sequelize) return res.status(500).json({ error: "DB not initialized" });

      const studentId = Number(req.params.studentId);
      if (!studentId) return res.status(400).json({ error: "Invalid ID" });

      // Get the parent info from this student's parent fields
      const [[anchor]] = await sequelize.query(
        `SELECT parent_full_name AS name, parent_phone AS phone, parent_address AS address
         FROM students WHERE id = :studentId LIMIT 1`,
        { replacements: { studentId } },
      ) as [[{ name: string; phone: string; address: string }]];

      if (!anchor) return res.status(404).json({ error: "Parent not found" });

      // Fetch all linked children (same parent name + phone)
      const [children] = await sequelize.query(
        `SELECT s.id, s.first_name, s.last_name, s.passport_photo_filename,
                COALESCE(c.name, s.section_name) AS class_name,
                s.status,
                COALESCE(fa.amount_due_ugx, 0) - COALESCE(SUM(fp.amount_ugx), 0) AS fee_balance
         FROM students s
         LEFT JOIN classrooms c ON c.id = s.class_room_id
         LEFT JOIN student_fee_assignments fa ON fa.student_id = s.id
           AND fa.academic_year = (SELECT setting_value FROM school_settings WHERE setting_key='academic_year' LIMIT 1)
           AND fa.term = (SELECT setting_value FROM school_settings WHERE setting_key='current_term' LIMIT 1)
         LEFT JOIN student_fee_payments fp ON fp.student_id = s.id AND fp.fee_assignment_id = fa.id
         WHERE s.parent_full_name = :name AND s.parent_phone = :phone
         GROUP BY s.id`,
        { replacements: { name: anchor.name, phone: anchor.phone } },
      );

      // Contact logs
      const [contactLogs] = await sequelize.query(
        `SELECT pcl.*, u.email AS logged_by_email
         FROM parent_contact_logs pcl
         LEFT JOIN users u ON u.id = pcl.logged_by
         WHERE pcl.parent_id = :studentId
         ORDER BY pcl.logged_at DESC`,
        { replacements: { studentId } },
      );

      return res.json({
        success: true,
        data: {
          anchor_student_id: studentId,
          name: anchor.name,
          phone: anchor.phone,
          address: anchor.address,
          children,
          contact_logs: contactLogs,
        },
      });
    } catch (err) {
      console.error("[parents/:id]", err);
      return res.status(500).json({ error: "Failed to load parent detail" });
    }
  });

  // ── POST /parents/:studentId/contact-log ──────────────────────────────────
  r.post("/parents/:studentId/contact-log", async (req, res) => {
    const parsed = contactLogSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid body" });
    }

    try {
      const sequelize = (await import("../models/index.js")).User.sequelize;
      if (!sequelize) return res.status(500).json({ error: "DB not initialized" });

      const studentId = Number(req.params.studentId);
      await sequelize.query(
        `INSERT INTO parent_contact_logs (parent_id, logged_by, note, contact_type)
         VALUES (:parentId, :loggedBy, :note, :contactType)`,
        {
          replacements: {
            parentId: studentId,
            loggedBy: req.userId ?? null,
            note: parsed.data.note,
            contactType: parsed.data.contact_type,
          },
        },
      );

      await writeAuditLog({
        sequelize,
        userId: req.userId ?? null,
        action: "parent_contact_logged",
        entity: "students",
        entityId: studentId,
        severity: "info",
        channel: "web",
      });

      return res.json({ success: true, message: "Note saved" });
    } catch (err) {
      console.error("[parents/contact-log]", err);
      return res.status(500).json({ error: "Failed to save note" });
    }
  });

  return r;
}
