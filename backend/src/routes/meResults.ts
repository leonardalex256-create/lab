/**
 * Results module API (Section A4).
 * GET    /api/me/results                        — filtered results table
 * GET    /api/me/results/entry/:classId          — load results for entry grid
 * POST   /api/me/results/entry/:classId          — save draft or submit final
 * GET    /api/me/results/transcript/:studentId   — full transcript
 * POST   /api/me/results/lock/:classId           — lock a class result set
 * POST   /api/me/results/unlock/:classId         — unlock (ADMIN only)
 * POST   /api/me/results/publish/:classId        — publish results
 * GET    /api/me/results/report-cards/:classId   — batch report card data
 */
import { Router } from "express";
import { z } from "zod";
import { writeAuditLog } from "../utils/auditLogger.js";

const resultEntrySchema = z.object({
  academic_year: z.string(),
  term: z.string(),
  exam_type: z.string(),
  is_final: z.boolean().default(false),
  entries: z.array(z.object({
    student_id: z.number().int().positive(),
    subject: z.string().min(1),
    score: z.number().min(0).max(1000),
    max_score: z.number().min(1).max(1000).default(100),
    remarks: z.string().optional(),
  })).min(1),
});

/** Convert numeric score to grade letter using a simple default scale */
function scoreToGrade(score: number, maxScore: number): string {
  const pct = (score / maxScore) * 100;
  if (pct >= 80) return "A";
  if (pct >= 65) return "B";
  if (pct >= 50) return "C";
  if (pct >= 35) return "D";
  return "F";
}

export function createMeResultsRouter() {
  const r = Router();

  // ── GET /results/student-summary ─────────────────────────────────────────
  // Used by StudentOverview. This endpoint is expected to be role-scoped by the caller.
  r.get("/results/student-summary", async (req, res) => {
    try {
      const sequelize = (await import("../models/index.js")).User.sequelize;
      if (!sequelize) return res.status(500).json({ error: "DB not initialized" });

      const studentId = Number(req.query.studentId);
      if (!Number.isFinite(studentId) || studentId <= 0) {
        return res.status(400).json({ error: "Invalid studentId" });
      }

      const [rows] = await sequelize.query(
        `SELECT subject, score, max_score
         FROM student_assessment_results
         WHERE student_id = :studentId
         ORDER BY id DESC
         LIMIT 50`,
        { replacements: { studentId } },
      );

      const items = (rows as Array<{ subject: string; score: number | null; max_score: number | null }>).map((r: any) => {
        const score = r.score == null ? null : Number(r.score);
        const maxScore = r.max_score == null ? 100 : Number(r.max_score);
        const grade = score == null ? null : scoreToGrade(score, maxScore);
        return {
          subject: String(r.subject),
          score: score == null ? null : (maxScore ? (score / maxScore) * 100 : score),
          grade,
          status: "Recorded",
        };
      });

      return res.json({ items });
    } catch (err) {
      console.error("[results/student-summary]", err);
      return res.status(500).json({ error: "Failed to load student summary" });
    }
  });

  // ── GET /results ─────────────────────────────────────────────────────────
  r.get("/results", async (req, res) => {
    try {
      const sequelize = (await import("../models/index.js")).User.sequelize;
      if (!sequelize) return res.status(500).json({ error: "DB not initialized" });

      const classId = req.query.class ? Number(req.query.class) : null;
      const term = (req.query.term as string) ?? "";
      const academicYear = (req.query.academic_year as string) ?? "";
      const examType = (req.query.exam_type as string) ?? "";
      const subject = (req.query.subject as string) ?? "";
      const page = Math.max(1, Number(req.query.page ?? 1));
      const limit = Math.min(200, Math.max(1, Number(req.query.limit ?? 50)));
      const offset = (page - 1) * limit;

      let where = "WHERE 1=1";
      const replacements: Record<string, unknown> = { limit, offset };

      if (classId) { where += " AND sar.class_room_id = :classId"; replacements["classId"] = classId; }
      if (term) { where += " AND sar.term = :term"; replacements["term"] = term; }
      if (academicYear) { where += " AND sar.academic_year = :academicYear"; replacements["academicYear"] = academicYear; }
      if (examType) { where += " AND sar.exam_type = :examType"; replacements["examType"] = examType; }
      if (subject) { where += " AND sar.subject = :subject"; replacements["subject"] = subject; }

      const [rows] = await sequelize.query(
        `SELECT
           sar.id, sar.student_id, sar.subject, sar.score, sar.max_score,
           sar.remarks, sar.is_draft, sar.is_locked, sar.term, sar.exam_type, sar.academic_year,
           s.first_name, s.last_name,
           COALESCE(c.name, s.section_name) AS class_name
         FROM student_assessment_results sar
         JOIN students s ON s.id = sar.student_id
         LEFT JOIN classrooms c ON c.id = sar.class_room_id
         ${where}
         ORDER BY s.last_name, s.first_name, sar.subject
         LIMIT :limit OFFSET :offset`,
        { replacements },
      );

      return res.json({ success: true, data: rows, meta: { page, limit } });
    } catch (err) {
      console.error("[results]", err);
      return res.status(500).json({ error: "Failed to load results" });
    }
  });

  // ── GET /results/entry/:classId ─────────────────────────────────────────
  r.get("/results/entry/:classId", async (req, res) => {
    try {
      const sequelize = (await import("../models/index.js")).User.sequelize;
      if (!sequelize) return res.status(500).json({ error: "DB not initialized" });

      const classId = Number(req.params.classId);
      const academicYear = (req.query.academic_year as string) ?? "";
      const term = (req.query.term as string) ?? "";
      const examType = (req.query.exam_type as string) ?? "";

      // Roster
      const [students] = await sequelize.query(
        `SELECT id, first_name, last_name, passport_photo_filename FROM students
         WHERE class_room_id = :classId AND status = 'active'
         ORDER BY last_name, first_name`,
        { replacements: { classId } },
      );

      // Existing entries
      const [entries] = await sequelize.query(
        `SELECT student_id, subject, score, max_score, remarks, is_draft, is_locked
         FROM student_assessment_results
         WHERE class_room_id = :classId AND academic_year = :academicYear AND term = :term AND exam_type = :examType`,
        { replacements: { classId, academicYear, term, examType } },
      );

      // Subjects for this class
      const [subjects] = await sequelize.query(
        `SELECT DISTINCT subject_name AS subject FROM academic_subject_assignments
         WHERE class_category_id = (SELECT category_id FROM classrooms WHERE id = :classId LIMIT 1)
         ORDER BY subject_name`,
        { replacements: { classId } },
      );

      return res.json({ success: true, data: { students, entries, subjects } });
    } catch (err) {
      console.error("[results/entry]", err);
      return res.status(500).json({ error: "Failed to load entry grid" });
    }
  });

  // ── POST /results/entry/:classId ────────────────────────────────────────
  r.post("/results/entry/:classId", async (req, res) => {
    const parsed = resultEntrySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid body" });
    }

    try {
      const sequelize = (await import("../models/index.js")).User.sequelize;
      if (!sequelize) return res.status(500).json({ error: "DB not initialized" });

      const classId = Number(req.params.classId);
      const { academic_year, term, exam_type, is_final, entries } = parsed.data;
      const isDraft = is_final ? 0 : 1;

      await sequelize.transaction(async (t) => {
        for (const entry of entries) {
          const { student_id, subject, score, max_score, remarks } = entry;

          const [existing] = await sequelize.query(
            `SELECT id, is_locked FROM student_assessment_results
             WHERE student_id = :sid AND class_room_id = :cid AND academic_year = :yr AND term = :term AND exam_type = :exam AND subject = :subj LIMIT 1`,
            { replacements: { sid: student_id, cid: classId, yr: academic_year, term, exam: exam_type, subj: subject }, transaction: t },
          ) as [Array<{ id: number; is_locked: number }>];

          if (existing.length > 0 && existing[0]!.is_locked) {
            // Skip locked entries — only ADMIN can unlock
            continue;
          }

          const upsertReplacements = { sid: student_id, cid: classId, yr: academic_year, term, exam: exam_type, subj: subject, score, maxScore: max_score, remarks: remarks ?? null, isDraft, enteredBy: req.userId ?? null };

          if (existing.length > 0) {
            await sequelize.query(
              `UPDATE student_assessment_results SET score=:score, max_score=:maxScore, remarks=:remarks, is_draft=:isDraft, entered_by_user_id=:enteredBy WHERE id = :id`,
              { replacements: { ...upsertReplacements, id: existing[0]!.id }, transaction: t },
            );
          } else {
            await sequelize.query(
              `INSERT INTO student_assessment_results (student_id, class_room_id, academic_year, term, exam_type, subject, score, max_score, remarks, is_draft, entered_by_user_id)
               VALUES (:sid, :cid, :yr, :term, :exam, :subj, :score, :maxScore, :remarks, :isDraft, :enteredBy)`,
              { replacements: upsertReplacements, transaction: t },
            );
          }
        }
      });

      await writeAuditLog({
        sequelize,
        userId: req.userId ?? null,
        action: is_final ? "results_entry_submitted" : "results_entry_saved",
        entity: "student_assessment_results",
        entityLabel: `Class ${classId} · ${term} · ${exam_type}`,
        severity: "info",
        channel: "web",
        metadata: { classId, academic_year, term, exam_type, count: entries.length },
      });

      return res.json({ success: true, message: is_final ? "Results submitted" : "Draft saved" });
    } catch (err) {
      console.error("[results/entry POST]", err);
      return res.status(500).json({ error: "Failed to save results" });
    }
  });

  // ── GET /results/transcript/:studentId ──────────────────────────────────
  r.get("/results/transcript/:studentId", async (req, res) => {
    try {
      const sequelize = (await import("../models/index.js")).User.sequelize;
      if (!sequelize) return res.status(500).json({ error: "DB not initialized" });

      const studentId = Number(req.params.studentId);

      const [[student]] = await sequelize.query(
        `SELECT s.id, s.first_name, s.last_name, s.passport_photo_filename,
                COALESCE(c.name, s.section_name) AS class_name
         FROM students s LEFT JOIN classrooms c ON c.id = s.class_room_id
         WHERE s.id = :studentId LIMIT 1`,
        { replacements: { studentId } },
      ) as [[{ id: number; first_name: string; last_name: string; passport_photo_filename: string; class_name: string }]];

      if (!student) return res.status(404).json({ error: "Student not found" });

      const [results] = await sequelize.query(
        `SELECT academic_year, term, exam_type, subject, score, max_score, remarks
         FROM student_assessment_results
         WHERE student_id = :studentId AND is_draft = 0
         ORDER BY academic_year, term, subject`,
        { replacements: { studentId } },
      );

      // Group by academic_year → term
      const grouped: Record<string, Record<string, unknown[]>> = {};
      for (const row of results as Array<{academic_year: string; term: string; [key: string]: unknown}>) {
        if (!grouped[row.academic_year]) grouped[row.academic_year] = {};
        if (!grouped[row.academic_year]![row.term]) grouped[row.academic_year]![row.term] = [];
        grouped[row.academic_year]![row.term]!.push(row);
      }

      return res.json({ success: true, data: { student, transcript: grouped } });
    } catch (err) {
      console.error("[results/transcript]", err);
      return res.status(500).json({ error: "Failed to load transcript" });
    }
  });

  // ── POST /results/lock/:classId ─────────────────────────────────────────
  r.post("/results/lock/:classId", async (req, res) => {
    try {
      const sequelize = (await import("../models/index.js")).User.sequelize;
      if (!sequelize) return res.status(500).json({ error: "DB not initialized" });

      const classId = Number(req.params.classId);
      const { academic_year, term, exam_type } = req.body;

      await sequelize.query(
        `UPDATE student_assessment_results
         SET is_locked = 1, is_draft = 0, locked_by = :by, locked_at = NOW()
         WHERE class_room_id = :classId AND academic_year = :yr AND term = :term AND exam_type = :exam`,
        { replacements: { classId, yr: academic_year, term, exam: exam_type, by: req.userId ?? null } },
      );

      await writeAuditLog({
        sequelize,
        userId: req.userId ?? null,
        action: "results_locked",
        entity: "student_assessment_results",
        entityLabel: `Class ${classId} · ${term}`,
        severity: "warning",
        channel: "web",
      });

      return res.json({ success: true, message: "Results locked" });
    } catch (err) {
      console.error("[results/lock]", err);
      return res.status(500).json({ error: "Failed to lock results" });
    }
  });

  // ── POST /results/publish/:classId ──────────────────────────────────────
  r.post("/results/publish/:classId", async (req, res) => {
    try {
      const sequelize = (await import("../models/index.js")).User.sequelize;
      if (!sequelize) return res.status(500).json({ error: "DB not initialized" });

      const classId = Number(req.params.classId);
      const { academic_year, term, exam_type } = req.body;

      await sequelize.query(
        `INSERT INTO results_publish_status (class_room_id, academic_year, term, exam_type, is_published, published_by, published_at)
         VALUES (:classId, :yr, :term, :exam, 1, :by, NOW())
         ON DUPLICATE KEY UPDATE is_published = 1, published_by = :by, published_at = NOW()`,
        { replacements: { classId, yr: academic_year, term, exam: exam_type, by: req.userId ?? null } },
      );

      await writeAuditLog({
        sequelize,
        userId: req.userId ?? null,
        action: "results_published",
        entity: "results_publish_status",
        entityLabel: `Class ${classId} · ${term}`,
        severity: "info",
        channel: "web",
      });

      return res.json({ success: true, message: "Results published" });
    } catch (err) {
      console.error("[results/publish]", err);
      return res.status(500).json({ error: "Failed to publish results" });
    }
  });

  // ── GET /results/report-cards/:classId ──────────────────────────────────
  r.get("/results/report-cards/:classId", async (req, res) => {
    try {
      const sequelize = (await import("../models/index.js")).User.sequelize;
      if (!sequelize) return res.status(500).json({ error: "DB not initialized" });

      const classId = Number(req.params.classId);
      const { academic_year, term, exam_type } = req.query as Record<string, string>;

      const [students] = await sequelize.query(
        `SELECT s.id, s.first_name, s.last_name, s.passport_photo_filename,
                COALESCE(c.name, s.section_name) AS class_name
         FROM students s
         LEFT JOIN classrooms c ON c.id = s.class_room_id
         WHERE s.class_room_id = :classId AND s.status = 'active'
         ORDER BY s.last_name, s.first_name`,
        { replacements: { classId } },
      ) as [Array<{ id: number; first_name: string; last_name: string; passport_photo_filename: string; class_name: string }>];

      const [results] = await sequelize.query(
        `SELECT student_id, subject, score, max_score, remarks
         FROM student_assessment_results
         WHERE class_room_id = :classId AND academic_year = :yr AND term = :term AND exam_type = :exam
         ORDER BY student_id, subject`,
        { replacements: { classId, yr: academic_year, term, exam: exam_type } },
      ) as [Array<{ student_id: number; subject: string; score: number; max_score: number; remarks: string }>];

      // Group results by student and compute rank
      const resultsByStudent: Record<number, { subjects: unknown[]; total: number; avg: number }> = {};
      for (const row of results) {
        if (!resultsByStudent[row.student_id]) resultsByStudent[row.student_id] = { subjects: [], total: 0, avg: 0 };
        const g = resultsByStudent[row.student_id]!;
        g.subjects.push({ ...row, grade: scoreToGrade(row.score, row.max_score) });
        g.total += row.score;
      }

      for (const g of Object.values(resultsByStudent)) {
        g.avg = g.subjects.length > 0 ? Math.round((g.total / g.subjects.length) * 10) / 10 : 0;
      }

      // Compute ranks
      const ranked = Object.entries(resultsByStudent)
        .sort(([, a], [, b]) => b.avg - a.avg)
        .map(([sid], idx) => ({ student_id: Number(sid), rank: idx + 1 }));

      const reportCards = students.map((s) => ({
        ...s,
        results: resultsByStudent[s.id] ?? { subjects: [], total: 0, avg: 0 },
        rank: ranked.find((r) => r.student_id === s.id)?.rank ?? null,
        total_students: students.length,
      }));

      return res.json({ success: true, data: reportCards, meta: { academic_year, term, exam_type } });
    } catch (err) {
      console.error("[results/report-cards]", err);
      return res.status(500).json({ error: "Failed to load report cards" });
    }
  });

  return r;
}
