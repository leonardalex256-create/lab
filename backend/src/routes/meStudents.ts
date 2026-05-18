import { randomUUID } from "node:crypto";
import fsSync from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { Router } from "express";
import multer from "multer";
import { Op, Sequelize, fn, col, type Transaction, type WhereOptions } from "sequelize";
import {
  studentCreateBodySchema,
  studentListQuerySchema,
  studentUpdateBodySchema,
} from "../../../shared/dist/schemas/students.js";
import {
  districtAllowedForCountry,
  isKnownCountryCode,
} from "../data/geoReference.js";
import { parseQueryToIsoDate } from "../formatting/localeDate.js";
import { studentToApiRow } from "../formatting/studentRow.js";
import { validateWithSchema } from "../lib/validateBody.js";
import { scheduleFeeComplianceCheckAndNotify } from "../services/feeAssignmentCompliance.js";
import { loadOfficialSchoolTermYear } from "../lib/officialSchoolTermYear.js";
import {
  ClassCategory,
  ClassRoom,
  ClassSection,
  StaffMember,
  Student,
  StudentFeeAssignment,
  StudentFeeReceipt,
  StudentFeeStructure,
  StudentFeePayment,
  StudentAssessmentResult,
  AttendanceRecord,
} from "../models/index.js";

function studentUploadDir(): string {
  return path.join(process.cwd(), "uploads", "students");
}

function transferReportUploadDir(): string {
  return path.join(process.cwd(), "uploads", "student-transfer-reports");
}

/** Express types use a literal key when the path segment is `:id(\\d+)` */
function paramId(req: { params: Record<string, string | string[] | undefined> }): number {
  const p = req.params;
  const pick = (v: string | string[] | undefined): string | undefined =>
    Array.isArray(v) ? v[0] : v;
  const raw =
    pick(p["id"]) ??
    pick(p["id(\\d+)"]) ??
    Object.values(p)
      .map(pick)
      .find((v) => v && /^\d+$/.test(v));
  return Number.parseInt(String(raw ?? ""), 10);
}

function sanitizeLikeFragment(s: string): string {
  return s.replace(/\\/g, "").replace(/%/g, "").replace(/_/g, "");
}

function trimStr(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t) return null;
  return t.length > max ? t.slice(0, max) : t;
}

const PREVIOUS_GRADES_MAX_LEN = 8000;

function parsePercentageOutOf100(raw: string): number | null {
  const t = raw.replace(/%$/u, "").replace(/,/g, ".").trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** JSON shape: { "v": 1, "marks": [...], "aggregates": "..." } — marks are 0–100%. */
function validateNewAdmissionMarksJson(
  raw: string | null,
): { ok: true; stored: string } | { ok: false; error: string } {
  if (!raw) return { ok: false, error: "Subject marks are required for new admissions" };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return { ok: false, error: "Subject marks must be valid JSON" };
  }
  if (!parsed || typeof parsed !== "object") {
    return { ok: false, error: "Invalid subject marks structure" };
  }
  const marks = (parsed as { marks?: unknown }).marks;
  if (!Array.isArray(marks) || marks.length === 0) {
    return { ok: false, error: "At least one subject mark is required" };
  }
  const normalizedMarks: { subject: string; mark: string }[] = [];
  for (const m of marks) {
    if (!m || typeof m !== "object") {
      return { ok: false, error: "Invalid subject mark entry" };
    }
    const subject = trimStr((m as { subject?: unknown }).subject, 120);
    const mark = trimStr((m as { mark?: unknown }).mark, 40);
    if (!subject || !mark) {
      return { ok: false, error: "Each subject must include a mark" };
    }
    const pct = parsePercentageOutOf100(mark);
    if (pct === null) {
      return { ok: false, error: "Each mark must be a valid number (percentage out of 100)" };
    }
    if (pct < 0 || pct > 100) {
      return { ok: false, error: "Each mark must be between 0 and 100 (percent)" };
    }
    const r = Math.round(pct * 100) / 100;
    normalizedMarks.push({ subject, mark: String(r) });
  }
  const aggregates = trimStr((parsed as { aggregates?: unknown }).aggregates, 500);
  if (!aggregates) {
    return {
      ok: false,
      error: "Previous grades / aggregates summary is required for new admissions",
    };
  }
  const stored = JSON.stringify({
    v: 1,
    marks: normalizedMarks,
    aggregates,
  });
  return { ok: true, stored };
}

function toNameCase(v: string | null | undefined): string | null {
  if (!v) return null;
  return v
    .toLowerCase()
    .replace(/\b([a-z])/g, (m) => m.toUpperCase())
    .trim();
}

function parseOptionalId(v: unknown): number | null | undefined {
  if (v === null) return null;
  if (v === undefined || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : undefined;
}

function normalizeCountryCode(v: unknown): string | null | undefined {
  if (v === null) return null;
  if (v === undefined || v === "") return undefined;
  const t = String(v).trim().toUpperCase();
  if (t.length < 2 || t.length > 10) return undefined;
  return t;
}

function parseRegistrationType(v: unknown): "first" | "continuing" | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  const s = String(v).toLowerCase();
  if (s === "continuing" || s === "transfer" || s === "transfer_in" || s === "transfer-in") {
    return "continuing";
  }
  if (s === "first" || s === "first_registration" || s === "new" || s === "new_admission") {
    return "first";
  }
  return undefined;
}

function parseMoneyUgx(v: unknown): number | null {
  if (typeof v !== "number" && typeof v !== "string") return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n);
}

async function unlinkStudentPhoto(
  uploadDir: string,
  filename: string | null | undefined,
): Promise<void> {
  if (!filename || /[/\\]|\.\./.test(filename)) return;
  try {
    await fs.unlink(path.join(uploadDir, filename));
  } catch {
    /* ignore */
  }
}

async function unlinkUploadedFile(
  dir: string,
  filename: string | null | undefined,
): Promise<void> {
  if (!filename || /[/\\]|\.\./.test(filename)) return;
  try {
    await fs.unlink(path.join(dir, filename));
  } catch {
    /* ignore */
  }
}

function tempAdmissionKey(): string {
  const hex = randomUUID().replace(/-/g, "");
  return `T${hex}`.slice(0, 50);
}

function parseAdmissionSequence(admissionNumber: string, year: number): number | null {
  const m = new RegExp(`^QPS-${year}-(\\d{4})$`).exec(admissionNumber);
  if (!m) return null;
  const n = Number.parseInt(m[1], 10);
  return Number.isFinite(n) ? n : null;
}

async function nextAdmissionNumber(tx: Transaction): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `QPS-${year}-`;
  const lastRow = await Student.findOne({
    where: {
      admissionNumber: {
        [Op.like]: `${prefix}%`,
      },
    },
    attributes: ["admissionNumber"],
    order: [["admission_number", "DESC"]],
    transaction: tx,
  });
  const current = parseAdmissionSequence(lastRow?.admissionNumber ?? "", year) ?? 0;
  const next = current + 1;
  if (next > 9999) {
    throw new Error(`Admission sequence exhausted for ${year}`);
  }
  return `${prefix}${String(next).padStart(4, "0")}`;
}

function hasP7Class(name: string | null | undefined): boolean {
  return /\bP7\b/i.test(String(name ?? ""));
}

function feeStatusForStudent(
  boardingStatus: "boarding" | "day_half" | "day_full" | null,
  className: string | null | undefined,
): "boarding" | "day_half" | "day_full" | "day_full_p7" {
  if (boardingStatus === "boarding") return "boarding";
  if (boardingStatus === "day_full" && hasP7Class(className)) return "day_full_p7";
  if (boardingStatus === "day_full") return "day_full";
  return "day_half";
}

async function createStudentRecord(fields: {
  firstName: string;
  middleName: string | null;
  lastName: string;
  dateOfBirth: string | null;
  parentEmail: string | null;
  gender: string | null;
  sectionName: string | null;
  classRoomId: number | null;
  nationality: string | null;
  countryCode: string | null;
  district: string | null;
  registrationType: "first" | "continuing";
  lastClassAttended: string | null;
  lastTermYear: string | null;
  previousReportCardFilename: string | null;
  previousGrades: string | null;
  transferReason: string | null;
  parentAliveStatus: "both" | "one" | "none" | null;
  parentFullName: string | null;
  parentPhone: string | null;
  parentAddress: string | null;
  religion: string | null;
  specialNeeds: string | null;
  boardingStatus: "boarding" | "day_half" | "day_full" | null;
  residenceAddress: string | null;
  medicalInfo: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
}): Promise<Student> {
  const firstName = toNameCase(fields.firstName) ?? fields.firstName;
  const middleName = toNameCase(fields.middleName);
  const lastName = toNameCase(fields.lastName) ?? fields.lastName;
  const parentFullName = toNameCase(fields.parentFullName);
  const emergencyContactName = toNameCase(fields.emergencyContactName);
  const guardianName = toNameCase(fields.guardianName);

  const sequelize = Student.sequelize;
  if (!sequelize) {
    throw new Error("Student model is not attached to a Sequelize instance");
  }

  const { academicYear: assignYear } = await loadOfficialSchoolTermYear();
  const created = await sequelize.transaction(async (t) => {
    const createdInner = await Student.create(
      {
        admissionNumber: tempAdmissionKey(),
        firstName,
        middleName,
        lastName,
        dateOfBirth: fields.dateOfBirth,
        parentEmail: fields.parentEmail,
        classRoomId: fields.classRoomId,
        gender: fields.gender,
        sectionName: fields.sectionName,
        nationality: fields.nationality,
        countryCode: fields.countryCode,
        district: fields.district,
        registrationType: fields.registrationType,
        lastClassAttended: fields.lastClassAttended,
        lastTermYear: fields.lastTermYear,
        previousReportCardFilename: fields.previousReportCardFilename,
        previousGrades: fields.previousGrades,
        transferReason: fields.transferReason,
        parentAliveStatus: fields.parentAliveStatus,
        parentFullName,
        parentPhone: fields.parentPhone,
        parentAddress: fields.parentAddress,
        religion: fields.religion,
        specialNeeds: fields.specialNeeds,
        boardingStatus: fields.boardingStatus,
        residenceAddress: fields.residenceAddress,
        medicalInfo: fields.medicalInfo,
        emergencyContactName,
        emergencyContactPhone: fields.emergencyContactPhone,
        guardianName,
        guardianPhone: fields.guardianPhone,
      },
      { transaction: t },
    );
    const admissionNumber = await nextAdmissionNumber(t);
    let className: string | null = null;
    if (fields.classRoomId != null) {
      const cls = await ClassRoom.findByPk(fields.classRoomId, {
        transaction: t,
      });
      className = cls?.name ?? null;
    }
    await createdInner.update(
      {
        admissionNumber,
      },
      { transaction: t },
    );

    const feeStatus = feeStatusForStudent(fields.boardingStatus, className);
    const allStructures = await StudentFeeStructure.findAll({
      order: [
        ["term", "ASC"],
        ["created_at", "DESC"],
      ],
      transaction: t,
    });
    const structuresByTerm = new Map<string, StudentFeeStructure[]>();
    for (const row of allStructures) {
      const list = structuresByTerm.get(row.term) ?? [];
      list.push(row);
      structuresByTerm.set(row.term, list);
    }

    if (structuresByTerm.size > 0) {
      for (const [assignmentTerm, termStructures] of structuresByTerm.entries()) {
        const matchedStructure =
          termStructures.find((row) => row.boardingStatus === feeStatus) ?? termStructures[0] ?? null;
        const autoAmount = matchedStructure ? Number(matchedStructure.amountDueUgx) || 0 : 0;
        if (autoAmount <= 0) continue;
        const autoNotes = matchedStructure
          ? `Auto-assigned on student creation (${matchedStructure.boardingStatus}).`
          : "Auto-assigned on student creation.";
        await StudentFeeAssignment.findOrCreate({
          where: { studentId: createdInner.id, term: assignmentTerm, academicYear: assignYear },
          defaults: {
            amountDueUgx: autoAmount,
            notes: autoNotes,
          },
          transaction: t,
        });
      }
    }

    return createdInner;
  });
  scheduleFeeComplianceCheckAndNotify();
  return created;
}

function normalizeCsvHeader(h: string): string {
  return h.replace(/^\uFEFF/, "").trim().toLowerCase().replace(/\s+/g, "");
}

function parseCsvRecords(buf: Buffer): Record<string, string>[] {
  const text = buf.toString("utf8");
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(normalizeCsvHeader);
  const out: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    const row: Record<string, string> = {};
    headers.forEach((h, j) => {
      row[h] = cols[j] ?? "";
    });
    out.push(row);
  }
  return out;
}

function csvVal(row: Record<string, string>, ...aliases: string[]): string {
  for (const a of aliases) {
    const v = row[a]?.trim();
    if (v) return v;
  }
  return "";
}

function parseParentAliveStatus(v: unknown): "both" | "one" | "none" | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  const s = String(v).trim().toLowerCase();
  if (s === "both" || s === "alive") return "both";
  if (s === "one" || s === "single") return "one";
  if (s === "none" || s === "deceased" || s === "guardian") return "none";
  return undefined;
}

function parseBoardingStatus(v: unknown): "boarding" | "day_half" | "day_full" | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  const s = String(v).trim().toLowerCase();
  if (s === "boarding") return "boarding";
  if (s === "day" || s === "day_scholar") return "day_full";
  if (s === "day_half" || s === "dayhalf" || s === "half_day" || s === "halfday") {
    return "day_half";
  }
  if (s === "day_full" || s === "dayfull" || s === "full_day" || s === "fullday") {
    return "day_full";
  }
  return undefined;
}

function parseTransferReason(v: unknown): "relocation" | "discipline" | "better_education" | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  const s = String(v).trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (s === "relocation") return "relocation";
  if (s === "discipline") return "discipline";
  if (s === "better_education" || s === "bettereducation") return "better_education";
  return undefined;
}

export function createMeStudentsRouter() {
  const r = Router();

  // ── GET /students/recent-admissions ──────────────────────────────────────
  // Used by RegistrarOverview. Term/year are accepted for future filtering.
  r.get("/students/recent-admissions", async (req, res) => {
    try {
      const sequelize = (await import("../models/index.js")).User.sequelize;
      if (!sequelize) return res.status(500).json({ error: "DB not initialized" });

      const limit = Math.min(25, Math.max(1, Number(req.query.limit ?? 10)));

      const [rows] = await sequelize.query(
        `SELECT
           s.id AS studentId,
           s.admission_number AS admissionNumber,
           CONCAT(s.first_name, ' ', s.last_name) AS studentName,
           COALESCE(c.name, s.section_name) AS className,
           s.section_name AS sectionName,
           DATE_FORMAT(COALESCE(s.created_at, NOW()), '%d/%m/%Y') AS admittedAtLabel,
           CASE WHEN LOWER(COALESCE(s.status,'active'))='active' THEN 'Active' ELSE 'Pending' END AS status
         FROM students s
         LEFT JOIN classrooms c ON c.id = s.class_room_id
         ORDER BY s.created_at DESC
         LIMIT :limit`,
        { replacements: { limit } },
      );

      return res.json({ items: rows });
    } catch (err) {
      console.error("[students/recent-admissions]", err);
      return res.status(500).json({ error: "Failed to load recent admissions" });
    }
  });
  const uploadDir = studentUploadDir();
  const reportUploadDir = transferReportUploadDir();

  function currentAcademicYear(): string {
    const now = new Date();
    const y = now.getFullYear();
    return `${y}/${y + 1}`;
  }

  const bulkParser = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const ok =
        file.mimetype === "text/csv" ||
        file.mimetype === "application/vnd.ms-excel" ||
        /\.csv$/i.test(file.originalname);
      cb(null, Boolean(ok));
    },
  });

  const photoUpload = multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => {
        fsSync.mkdirSync(uploadDir, { recursive: true });
        cb(null, uploadDir);
      },
      filename: (req, file, cb) => {
        const id = String(paramId(req));
        const raw = path.extname(file.originalname).slice(0, 8) || ".jpg";
        const ext = /^\.[a-z0-9]+$/i.test(raw) ? raw.toLowerCase() : ".jpg";
        cb(null, `${id}-${Date.now()}${ext}`);
      },
    }),
    limits: { fileSize: 4 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const ok = /^image\/(jpeg|png|webp|gif)$/i.test(file.mimetype);
      cb(null, ok);
    },
  });

  const transferReportUpload = multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => {
        fsSync.mkdirSync(reportUploadDir, { recursive: true });
        cb(null, reportUploadDir);
      },
      filename: (req, file, cb) => {
        const id = String(paramId(req));
        const raw = path.extname(file.originalname).slice(0, 8) || ".pdf";
        const ext = /^\.[a-z0-9]+$/i.test(raw) ? raw.toLowerCase() : ".pdf";
        cb(null, `${id}-${Date.now()}${ext}`);
      },
    }),
    limits: { fileSize: 8 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const ok =
        /^application\/pdf$/i.test(file.mimetype) ||
        /^image\/(jpeg|png|webp)$/i.test(file.mimetype);
      cb(null, ok);
    },
  });

  r.get("/classrooms", async (_req, res) => {
    try {
      const rows = await ClassRoom.findAll({
        include: [{ model: ClassCategory, as: "category", required: false }],
        order: [
          ["academicYear", "DESC"],
          ["name", "ASC"],
        ],
      });
      return res.json({
        items: rows.map((c) => ({
          id: c.id,
          name: c.name,
          categoryId: (c.get("category_id") as number | null) ?? null,
          categoryName:
            ((c as unknown as { category?: { name?: string } | null }).category?.name as
              | string
              | undefined) ?? null,
          description: (c.get("description") as string | null) ?? null,
          isActive: ((c.get("is_active") as number | boolean | null) ?? 1) === 1 || c.get("is_active") === true,
          academicYear: c.academicYear,
        })),
      });
    } catch (err) {
      console.error(err);
      return res.status(503).json({ error: "Database unavailable" });
    }
  });

  r.post("/classrooms", async (req, res) => {
    try {
      const body = req.body as Record<string, unknown>;
      const name = trimStr(body.name, 120);
      if (!name) return res.status(400).json({ error: "name is required" });
      const description = trimStr(body.description, 255);
      const categoryId = parseOptionalId(body.categoryId);
      if (!categoryId) return res.status(400).json({ error: "categoryId is required" });
      const category = await ClassCategory.findByPk(categoryId);
      if (!category) return res.status(400).json({ error: "Invalid categoryId" });
      const yearRaw = trimStr(body.academicYear, 20);
      const academicYear = yearRaw ?? String(new Date().getFullYear());
      const row = await ClassRoom.create({
        name,
        categoryId,
        ...(description !== null ? { description } : {}),
        isActive: true,
        academicYear,
      });
      return res.status(201).json({
        item: {
          id: row.id,
          name: row.name,
          categoryId: (row.get("category_id") as number | null) ?? null,
          categoryName: category.name,
          description: (row.get("description") as string | null) ?? null,
          isActive: ((row.get("is_active") as number | boolean | null) ?? 1) === 1 || row.get("is_active") === true,
          academicYear: row.academicYear,
        },
      });
    } catch (err) {
      console.error(err);
      return res.status(503).json({ error: "Database unavailable" });
    }
  });

  r.patch("/classrooms/:id(\\d+)", async (req, res) => {
    try {
      const id = paramId(req);
      if (!Number.isFinite(id) || id < 1) return res.status(400).json({ error: "Invalid id" });
      const row = await ClassRoom.findByPk(id);
      if (!row) return res.status(404).json({ error: "Not found" });
      const body = req.body as Record<string, unknown>;
      const name = trimStr(body.name, 80);
      const description = trimStr(body.description, 255);
      const categoryId = parseOptionalId(body.categoryId);
      if (body.categoryId !== undefined) {
        if (!categoryId) return res.status(400).json({ error: "categoryId is required" });
        const category = await ClassCategory.findByPk(categoryId);
        if (!category) return res.status(400).json({ error: "Invalid categoryId" });
      }
      await row.update({
        ...(name ? { name } : {}),
        ...(description !== null ? { description } : {}),
        ...(categoryId ? { categoryId } : {}),
      });
      return res.json({
        item: {
          id: row.id,
          name: row.name,
          categoryId: (row.get("category_id") as number | null) ?? null,
          description: (row.get("description") as string | null) ?? null,
          isActive: ((row.get("is_active") as number | boolean | null) ?? 1) === 1 || row.get("is_active") === true,
          academicYear: row.academicYear,
        },
      });
    } catch (err) {
      console.error(err);
      return res.status(503).json({ error: "Database unavailable" });
    }
  });

  r.delete("/classrooms/:id(\\d+)", async (req, res) => {
    try {
      const id = paramId(req);
      if (!Number.isFinite(id) || id < 1) return res.status(400).json({ error: "Invalid id" });
      const row = await ClassRoom.findByPk(id);
      if (!row) return res.status(404).json({ error: "Not found" });
      const allocated = await Student.count({ where: { classRoomId: id } });
      if (allocated > 0) {
        return res.status(409).json({
          error:
            "This class has students allocated. It cannot be deleted. Disable it instead.",
          action: "disable_allowed",
        });
      }
      await row.destroy();
      return res.status(204).end();
    } catch (err) {
      console.error(err);
      return res.status(503).json({ error: "Database unavailable" });
    }
  });

  r.patch("/classrooms/:id(\\d+)/disable", async (req, res) => {
    try {
      const id = paramId(req);
      if (!Number.isFinite(id) || id < 1) return res.status(400).json({ error: "Invalid id" });
      const row = await ClassRoom.findByPk(id);
      if (!row) return res.status(404).json({ error: "Not found" });
      await row.update({ isActive: false });
      return res.json({ ok: true });
    } catch (err) {
      console.error(err);
      return res.status(503).json({ error: "Database unavailable" });
    }
  });

  r.get("/class-categories", async (_req, res) => {
    try {
      const rows = await ClassCategory.findAll({
        attributes: [
          "id",
          "name",
          "description",
          [fn("COUNT", col("classes.id")), "classesCount"],
        ],
        include: [{ model: ClassRoom, as: "classes", attributes: [], required: false }],
        group: ["ClassCategory.id"],
        order: [["name", "ASC"]],
      });
      return res.json({
        items: rows.map((x) => ({
          id: x.id,
          name: x.name,
          description: (x.get("description") as string | null) ?? null,
          classesCount: Number(x.get("classesCount") ?? 0),
        })),
      });
    } catch (err) {
      console.error(err);
      return res.status(503).json({ error: "Database unavailable" });
    }
  });

  r.post("/class-categories", async (req, res) => {
    try {
      const body = req.body as Record<string, unknown>;
      const name = trimStr(body.name, 80);
      const description = trimStr(body.description, 255);
      if (!name) return res.status(400).json({ error: "Category name cannot be empty" });
      const [row] = await ClassCategory.findOrCreate({
        where: { name },
        defaults: { description },
      });
      if (description !== null) await row.update({ description });
      return res.status(201).json({ item: { id: row.id, name: row.name, description: row.description } });
    } catch (err) {
      console.error(err);
      return res.status(503).json({ error: "Database unavailable" });
    }
  });

  r.patch("/class-categories/:id(\\d+)", async (req, res) => {
    try {
      const id = paramId(req);
      if (!Number.isFinite(id) || id < 1) return res.status(400).json({ error: "Invalid id" });
      const row = await ClassCategory.findByPk(id);
      if (!row) return res.status(404).json({ error: "Not found" });
      const body = req.body as Record<string, unknown>;
      const name = trimStr(body.name, 80);
      const description = trimStr(body.description, 255);
      await row.update({
        ...(name ? { name } : {}),
        ...(description !== null ? { description } : {}),
      });
      return res.json({ item: { id: row.id, name: row.name, description: row.description } });
    } catch (err) {
      console.error(err);
      return res.status(503).json({ error: "Database unavailable" });
    }
  });

  r.delete("/class-categories/:id(\\d+)", async (req, res) => {
    try {
      const id = paramId(req);
      if (!Number.isFinite(id) || id < 1) return res.status(400).json({ error: "Invalid id" });
      const used = await ClassRoom.count({ where: { categoryId: id } });
      if (used > 0) {
        return res.status(409).json({ error: "Cannot delete category with assigned classes" });
      }
      const row = await ClassCategory.findByPk(id);
      if (!row) return res.status(404).json({ error: "Not found" });
      await row.destroy();
      return res.status(204).end();
    } catch (err) {
      console.error(err);
      return res.status(503).json({ error: "Database unavailable" });
    }
  });

  r.get("/class-sections", async (req, res) => {
    try {
      const classRoomId = parseOptionalId(req.query.classRoomId);
      if (classRoomId === undefined && req.query.classRoomId !== undefined) {
        return res.status(400).json({ error: "Invalid classRoomId" });
      }
      const rows = await ClassSection.findAll({
        where: classRoomId ? { classRoomId } : undefined,
        order: [
          ["academicYear", "DESC"],
          ["name", "ASC"],
        ],
      });
      return res.json({
        items: rows.map((s) => ({
          id: s.id,
          classRoomId: s.classRoomId,
          name: s.name,
          classTeacherName: (s.get("class_teacher_name") as string | null) ?? null,
          academicYear: s.academicYear,
        })),
      });
    } catch (err) {
      console.error(err);
      return res.status(503).json({ error: "Database unavailable" });
    }
  });

  r.get("/teachers", async (_req, res) => {
    try {
      const rows = await StaffMember.findAll({
        where: {
          [Op.or]: [
            { staffRole: "teaching" },
            { staffRole: "teacher" },
            { staffRole: "class_teacher" },
            Sequelize.where(fn("LOWER", col("staff_role")), {
              [Op.like]: "%teach%",
            }),
          ],
        },
        order: [["displayName", "ASC"]],
      });
      return res.json({
        items: rows.map((x) => ({
          id: x.id,
          displayName: x.displayName,
        })),
      });
    } catch (err) {
      console.error(err);
      return res.status(503).json({ error: "Database unavailable" });
    }
  });

  r.post("/class-sections", async (req, res) => {
    try {
      const body = req.body as Record<string, unknown>;
      const classRoomId = parseOptionalId(body.classRoomId);
      const name = trimStr(body.name, 80);
      const classTeacherName = trimStr(body.classTeacherName, 120);
      const academicYear = trimStr(body.academicYear, 20) ?? currentAcademicYear();
      if (!classRoomId) return res.status(400).json({ error: "Class is required for section" });
      if (!name) return res.status(400).json({ error: "Section name cannot be empty" });
      const room = await ClassRoom.findByPk(classRoomId);
      if (!room) return res.status(400).json({ error: "Invalid classRoomId" });
      const [row] = await ClassSection.findOrCreate({
        where: { classRoomId, name, academicYear },
        defaults: { classTeacherName },
      });
      if (classTeacherName !== null) await row.update({ classTeacherName });
      return res.status(201).json({
        item: {
          id: row.id,
          classRoomId: row.classRoomId,
          name: row.name,
          classTeacherName: (row.get("class_teacher_name") as string | null) ?? null,
          academicYear: row.academicYear,
        },
      });
    } catch (err) {
      console.error(err);
      return res.status(503).json({ error: "Database unavailable" });
    }
  });

  r.patch("/class-sections/:id(\\d+)", async (req, res) => {
    try {
      const id = paramId(req);
      if (!Number.isFinite(id) || id < 1) return res.status(400).json({ error: "Invalid id" });
      const row = await ClassSection.findByPk(id);
      if (!row) return res.status(404).json({ error: "Not found" });
      const body = req.body as Record<string, unknown>;
      const classRoomId = parseOptionalId(body.classRoomId);
      const name = trimStr(body.name, 80);
      const classTeacherName = trimStr(body.classTeacherName, 120);
      if (classRoomId) {
        const room = await ClassRoom.findByPk(classRoomId);
        if (!room) return res.status(400).json({ error: "Invalid classRoomId" });
      }
      await row.update({
        ...(classRoomId ? { classRoomId } : {}),
        ...(name ? { name } : {}),
        ...(classTeacherName !== null ? { classTeacherName } : {}),
      });
      return res.json({
        item: {
          id: row.id,
          classRoomId: row.classRoomId,
          name: row.name,
          classTeacherName: (row.get("class_teacher_name") as string | null) ?? null,
          academicYear: row.academicYear,
        },
      });
    } catch (err) {
      console.error(err);
      return res.status(503).json({ error: "Database unavailable" });
    }
  });

  r.delete("/class-sections/:id(\\d+)", async (req, res) => {
    try {
      const id = paramId(req);
      if (!Number.isFinite(id) || id < 1) return res.status(400).json({ error: "Invalid id" });
      const row = await ClassSection.findByPk(id);
      if (!row) return res.status(404).json({ error: "Not found" });
      await row.destroy();
      return res.status(204).end();
    } catch (err) {
      console.error(err);
      return res.status(503).json({ error: "Database unavailable" });
    }
  });

  r.post("/students/bulk", bulkParser.single("file"), async (req, res) => {
    try {
      if (!req.file?.buffer) {
        return res.status(400).json({ error: "CSV file required (field: file)" });
      }
      const records = parseCsvRecords(req.file.buffer);
      if (records.length === 0) {
        return res.status(400).json({ error: "CSV has no data rows" });
      }
      const errors: { line: number; error: string }[] = [];
      let created = 0;
      let lineNo = 1;
      for (const row of records) {
        lineNo += 1;
        const firstName = csvVal(row, "firstname", "first_name", "first");
        const middleName = csvVal(row, "middlename", "middle_name", "middle") || null;
        const lastName = csvVal(row, "lastname", "last_name", "last");
        if (!firstName || !lastName) {
          errors.push({ line: lineNo, error: "firstName and lastName required" });
          continue;
        }
        const dobRaw = csvVal(row, "dateofbirth", "date_of_birth", "dob", "birthdate");
        let dob: string | null = null;
        if (dobRaw) {
          const iso = parseQueryToIsoDate(dobRaw) ?? dobRaw;
          if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
            errors.push({ line: lineNo, error: "Invalid dateOfBirth" });
            continue;
          }
          dob = iso;
        }
        const parentEmail = csvVal(row, "parentemail", "parent_email", "email") || null;
        const gender = csvVal(row, "gender") || null;
        const sectionName = csvVal(row, "sectionname", "section_name", "section") || null;
        const classIdStr = csvVal(row, "classroomid", "class_room_id", "classid", "class_id");
        let classRoomId: number | null = null;
        if (classIdStr) {
          const n = Number.parseInt(classIdStr, 10);
          if (!Number.isFinite(n) || n < 1) {
            errors.push({ line: lineNo, error: "Invalid classRoomId" });
            continue;
          }
          const cr = await ClassRoom.findByPk(n);
          if (!cr) {
            errors.push({ line: lineNo, error: "classRoomId not found" });
            continue;
          }
          classRoomId = n;
        }
        const nationality = csvVal(row, "nationality") || null;
        const ccRaw = csvVal(row, "countrycode", "country_code");
        let countryCode: string | null = null;
        if (ccRaw) {
          const n = normalizeCountryCode(ccRaw);
          if (!n || !isKnownCountryCode(n)) {
            errors.push({ line: lineNo, error: "Invalid countryCode" });
            continue;
          }
          countryCode = n;
        }
        const district = csvVal(row, "district") || null;
        const regType = parseRegistrationType(csvVal(row, "registrationtype", "registration_type")) ?? "first";
        const previousGrades = csvVal(row, "previousgrades", "previous_grades", "aggregates") || null;
        const transferReasonParsed = parseTransferReason(
          csvVal(row, "transferreason", "transfer_reason"),
        );
        const transferReason = transferReasonParsed ?? null;
        const parentAliveStatus =
          parseParentAliveStatus(
            csvVal(row, "parentalivestatus", "parent_alive_status", "parentstatus"),
          ) ?? null;
        const parentFullName =
          csvVal(row, "parentfullname", "parent_full_name", "parentname") || null;
        const parentPhone =
          csvVal(row, "parentphone", "parent_phone", "parentphonenumber") || null;
        const parentAddress =
          csvVal(row, "parentaddress", "parent_address") || null;
        const religion = csvVal(row, "religion") || null;
        const specialNeeds =
          csvVal(row, "specialneeds", "special_needs", "disability") || null;
        const boardingStatus =
          parseBoardingStatus(csvVal(row, "boardingstatus", "boarding_status", "status")) ??
          null;
        const residenceAddress =
          csvVal(row, "residenceaddress", "residence_address", "homeaddress") || null;
        const medicalInfo =
          csvVal(row, "medicalinformation", "medical_info", "allergies") || null;
        const emergencyContactName =
          csvVal(row, "emergencycontactname", "emergency_contact_name") || null;
        const emergencyContactPhone =
          csvVal(row, "emergencycontactphone", "emergency_contact_phone") || null;
        const guardianName = csvVal(row, "guardianname", "guardian_name") || null;
        const guardianPhone = csvVal(row, "guardianphone", "guardian_phone") || null;
        if (district && countryCode && countryCode !== "OTHER") {
          if (!districtAllowedForCountry(countryCode, district)) {
            errors.push({ line: lineNo, error: "District does not match country" });
            continue;
          }
        }
        if (district && !countryCode) {
          errors.push({ line: lineNo, error: "countryCode required when district is set" });
          continue;
        }
        if (regType === "continuing") {
          if (previousGrades) {
            errors.push({
              line: lineNo,
              error:
                "Previous school / grades columns apply only to new admissions (use registrationType first)",
            });
            continue;
          }
        }
        let csvPreviousGradesStored: string | null = null;
        try {
          await createStudentRecord({
            firstName: firstName.slice(0, 100),
            middleName: middleName ? middleName.slice(0, 100) : null,
            lastName: lastName.slice(0, 100),
            dateOfBirth: dob,
            parentEmail: parentEmail ? parentEmail.slice(0, 255) : null,
            gender: gender ? gender.slice(0, 20) : null,
            sectionName: sectionName ? sectionName.slice(0, 80) : null,
            classRoomId,
            nationality: nationality ? nationality.slice(0, 100) : null,
            countryCode,
            district: district ? district.slice(0, 120) : null,
            registrationType: regType,
            lastClassAttended: null,
            lastTermYear: null,
            previousReportCardFilename: null,
            previousGrades: csvPreviousGradesStored,
            transferReason,
            parentAliveStatus,
            parentFullName: parentFullName ? parentFullName.slice(0, 120) : null,
            parentPhone: parentPhone ? parentPhone.slice(0, 32) : null,
            parentAddress: parentAddress ? parentAddress.slice(0, 255) : null,
            religion: religion ? religion.slice(0, 80) : null,
            specialNeeds: specialNeeds ? specialNeeds.slice(0, 255) : null,
            boardingStatus,
            residenceAddress: residenceAddress ? residenceAddress.slice(0, 255) : null,
            medicalInfo: medicalInfo ? medicalInfo.slice(0, 2000) : null,
            emergencyContactName: emergencyContactName
              ? emergencyContactName.slice(0, 120)
              : null,
            emergencyContactPhone: emergencyContactPhone
              ? emergencyContactPhone.slice(0, 32)
              : null,
            guardianName: guardianName ? guardianName.slice(0, 120) : null,
            guardianPhone: guardianPhone ? guardianPhone.slice(0, 32) : null,
          });
          created += 1;
        } catch (e) {
          errors.push({
            line: lineNo,
            error: (e as Error)?.message ?? "Create failed",
          });
        }
      }
      return res.status(201).json({ created, errors });
    } catch (err) {
      console.error(err);
      return res.status(503).json({ error: "Database unavailable" });
    }
  });

  r.post("/students/bulk-json", async (req, res) => {
    try {
      const { items } = req.body as { items: any[] };
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "items array is required" });
      }

      const results: { admissionNumber?: string; error?: string }[] = [];
      let createdCount = 0;

      // We process them one by one to use the existing createStudentRecord logic (which handles fee assignments etc)
      // but we do it in one request to save network roundtrips.
      for (const body of items) {
        try {
          const firstName = String(body.firstName || "").trim();
          const lastName = String(body.lastName || "").trim();
          const dob = body.dateOfBirth || null;

          // Duplicate check
          const existing = await Student.findOne({
            where: {
              firstName: { [Op.like]: firstName },
              lastName: { [Op.like]: lastName },
              ...(dob ? { dateOfBirth: dob } : {}),
            },
          });

          if (existing) {
            results.push({ error: `Student ${firstName} ${lastName} already exists (Admission: ${existing.admissionNumber})` });
            continue;
          }

          const student = await createStudentRecord({
            firstName: firstName.slice(0, 100),
            middleName: body.middleName ? String(body.middleName).trim().slice(0, 100) : null,
            lastName: lastName.slice(0, 100),
            dateOfBirth: dob,
            parentEmail: body.parentEmail || null,
            gender: body.gender || null,
            sectionName: body.sectionName || null,
            classRoomId: parseOptionalId(body.classRoomId) ?? null,
            nationality: body.nationality || null,
            countryCode: normalizeCountryCode(body.countryCode) ?? null,
            district: body.district || null,
            registrationType: parseRegistrationType(body.registrationType) ?? "first",
            lastClassAttended: null,
            lastTermYear: null,
            previousReportCardFilename: null,
            previousGrades: null,
            transferReason: parseTransferReason(body.transferReason) ?? null,
            parentAliveStatus: parseParentAliveStatus(body.parentAliveStatus) ?? null,
            parentFullName: body.parentFullName || null,
            parentPhone: body.parentPhone || null,
            parentAddress: body.parentAddress || null,
            religion: body.religion || null,
            specialNeeds: body.specialNeeds || null,
            boardingStatus: parseBoardingStatus(body.boardingStatus) ?? null,
            residenceAddress: body.residenceAddress || null,
            medicalInfo: body.medicalInfo || null,
            emergencyContactName: body.emergencyContactName || null,
            emergencyContactPhone: body.emergencyContactPhone || null,
            guardianName: body.guardianName || null,
            guardianPhone: body.guardianPhone || null,
          });
          results.push({ admissionNumber: student.admissionNumber });
          createdCount++;
        } catch (e) {
          results.push({ error: (e as Error)?.message || "Failed to create student" });
        }
      }


      return res.status(201).json({ created: createdCount, results });
    } catch (err) {
      console.error(err);
      return res.status(503).json({ error: "Database unavailable" });
    }
  });

  r.get("/students", async (req, res) => {
    try {
      const parsedQuery = validateWithSchema(studentListQuerySchema, req.query);
      if (!parsedQuery.ok) {
        return res.status(400).json({ error: parsedQuery.error });
      }
      const qRaw = parsedQuery.data.q ?? "";
      const sortKey = parsedQuery.data.sortBy;
      const sortDir = parsedQuery.data.sortDir === "asc" ? "ASC" : "DESC";
      const offset = parsedQuery.data.offset;
      const limit = parsedQuery.data.limit;

      let order: unknown[];
      if (sortKey === "id") {
        order = [["id", sortDir]];
      } else if (sortKey === "name") {
        order = [
          ["last_name", sortDir],
          ["first_name", sortDir],
        ];
      } else if (sortKey === "class") {
        order = [
          [{ model: ClassRoom, as: "classRoom" }, "name", sortDir],
          ["last_name", "ASC"],
          ["first_name", "ASC"],
        ];
      } else if (sortKey === "boarding") {
        order = [
          ["boarding_status", sortDir],
          ["last_name", "ASC"],
          ["first_name", "ASC"],
        ];
      } else {
        order = [["created_at", sortDir]];
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const andParts: any[] = [];
      if (qRaw.length > 0) {
        const simple = sanitizeLikeFragment(qRaw);
        const isoDob = parseQueryToIsoDate(qRaw);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const or: any[] = [];
        if (simple.length > 0) {
          const pattern = { [Op.like]: `%${simple}%` };
          const prefixPattern = { [Op.like]: `${simple}%` };
          const exactPattern = { [Op.eq]: simple };
          or.push(
            { admission_number: exactPattern },
            { admission_number: prefixPattern },
            { first_name: pattern },
            { middle_name: pattern },
            { last_name: pattern },
            { parent_email: pattern },
            { section_name: pattern },
            Sequelize.where(
              Sequelize.fn(
                "CONCAT",
                Sequelize.col("first_name"),
                " ",
                Sequelize.col("last_name"),
              ),
              Op.like,
              `%${simple}%`,
            ),
          );
        }
        if (isoDob) {
          or.push({ date_of_birth: isoDob });
        }
        if (or.length === 0) {
          return res.json({ items: [], total: 0 });
        }
        andParts.push({ [Op.or]: or });
      }

      const classRoomFilter = parsedQuery.data.classRoomId;
      if (classRoomFilter != null) {
        andParts.push({ classRoomId: classRoomFilter });
      }
      const boardingFilter = parsedQuery.data.boardingStatus;
      if (boardingFilter) {
        andParts.push({ boardingStatus: boardingFilter });
      }

      let where: WhereOptions<Student> =
        andParts.length === 0 ? {} : andParts.length === 1 ? andParts[0]! : { [Op.and]: andParts };

      const [rows, total] = await Promise.all([
        Student.findAll({
          where,
          include: [{ model: ClassRoom, as: "classRoom", required: false }],
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          order: order as any,
          limit,
          offset,
        }),
        Student.count({ where }),
      ]);
      return res.json({ items: rows.map(studentToApiRow), total });
    } catch (err) {
      console.error(err);
      return res.status(503).json({ error: "Database unavailable" });
    }
  });

  r.get("/students/:id(\\d+)", async (req, res) => {
    try {
      const id = paramId(req);
      if (!Number.isFinite(id) || id < 1) return res.status(400).json({ error: "Invalid id" });
      const row = await Student.findByPk(id, {
        include: [{ model: ClassRoom, as: "classRoom", required: false }],
      });
      if (!row) return res.status(404).json({ error: "Not found" });
      return res.json({ item: studentToApiRow(row) });
    } catch (err) {
      console.error(err);
      return res.status(503).json({ error: "Database unavailable" });
    }
  });

  r.post("/students/:id(\\d+)/fee-receipts", async (req, res) => {
    try {
      const studentId = paramId(req);
      if (!Number.isFinite(studentId) || studentId < 1) {
        return res.status(400).json({ error: "Invalid student id" });
      }
      const student = await Student.findByPk(studentId, {
        include: [{ model: ClassRoom, as: "classRoom", required: false }],
      });
      if (!student) return res.status(404).json({ error: "Student not found" });

      const body = req.body as Record<string, unknown>;
      const term = trimStr(body.term, 20);
      const paymentMethod = trimStr(body.paymentMethod, 40);
      const paidBy = trimStr(body.paidBy, 120);
      const amountPaidUgx = parseMoneyUgx(body.amountPaid);

      if (!term) return res.status(400).json({ error: "term is required" });
      if (!paymentMethod) {
        return res.status(400).json({ error: "paymentMethod is required" });
      }
      if (!paidBy) return res.status(400).json({ error: "paidBy is required" });
      if (amountPaidUgx == null || amountPaidUgx <= 0) {
        return res.status(400).json({ error: "amountPaid must be greater than zero" });
      }

      const official = await loadOfficialSchoolTermYear();
      if (term !== official.term) {
        return res.status(400).json({
          error: `Receipts must use the school's current term (${official.term}).`,
        });
      }
      const academicYear = official.academicYear;

      const sumRaw = await StudentFeeReceipt.sum("amount_paid_ugx", {
        where: { studentId, term, academicYear },
      });
      const previousPaidUgx = Math.max(Number(sumRaw ?? 0) || 0, 0);
      const totalFeesDueUgx = previousPaidUgx + amountPaidUgx;
      const outstandingAfterUgx = 0;
      const creditAmountUgx = 0;

      const sequelize = StudentFeeReceipt.sequelize;
      if (!sequelize) {
        return res.status(500).json({ error: "Database not initialized" });
      }
      const created = await sequelize.transaction(async (t) => {
        const receipt = await StudentFeeReceipt.create(
          {
            studentId,
            receiptNo: "PENDING",
            academicYear,
            term,
            paymentMethod,
            paidBy,
            amountPaidUgx,
            previousPaidUgx,
            totalFeesDueUgx,
            outstandingAfterUgx,
            creditAmountUgx,
          },
          { transaction: t },
        );
        const receiptNo = `ST-${String(receipt.id).padStart(5, "0")}`;
        await receipt.update({ receiptNo }, { transaction: t });
        return receipt;
      });
      const receiptNo = created.receiptNo;

      return res.status(201).json({
        item: {
          id: created.id,
          receiptNo,
          issuedAt:
            created.createdAt ??
            (created.get("created_at") as Date | string | undefined) ??
            new Date().toISOString(),
          term: created.term,
          paymentMethod: created.paymentMethod,
          paidBy: created.paidBy,
          amountPaid: Number(created.amountPaidUgx),
          previousPaid: Number(created.previousPaidUgx),
          totalFeesDue: Number(created.totalFeesDueUgx),
          outstandingAfter: Number(created.outstandingAfterUgx),
          creditAmount: Number(created.creditAmountUgx),
          student: studentToApiRow(student),
        },
      });
    } catch (err) {
      console.error(err);
      return res.status(503).json({ error: "Database unavailable" });
    }
  });

  r.get("/students/:id(\\d+)/photo", async (req, res) => {
    try {
      const id = paramId(req);
      if (!Number.isFinite(id) || id < 1) return res.status(400).end();
      const row = await Student.findByPk(id);
      if (!row) return res.status(404).end();
      const fn =
        row.passportPhotoFilename ??
        (row.get("passport_photo_filename") as string | null);
      if (!fn || /[/\\]|\.\./.test(fn)) return res.status(404).end();
      const abs = path.join(uploadDir, fn);
      res.sendFile(abs, (err) => {
        if (err && !res.headersSent) res.status(404).end();
      });
    } catch (err) {
      console.error(err);
      res.status(503).end();
    }
  });

  r.post("/students", async (req, res) => {
    try {
      const parsedBody = validateWithSchema(studentCreateBodySchema, req.body);
      if (!parsedBody.ok) {
        return res.status(400).json({ error: parsedBody.error });
      }
      const body = parsedBody.data;
      const firstName = body.firstName;
      const middleName = body.middleName ?? null;
      const lastName = body.lastName;

      const dateOfBirth = body.dateOfBirth ?? null;
      const parentEmail = body.parentEmail ?? null;
      const gender = body.gender ?? null;
      const sectionName = body.sectionName ?? null;
      const classRoomId = body.classRoomId ?? undefined;
      const nationality = body.nationality ?? null;
      const district = body.district ?? null;
      const previousGradesRaw = body.previousGrades ?? null;
      const transferReason = body.transferReason ?? null;
      const parentAliveStatus = body.parentAliveStatus;
      const parentFullName = toNameCase(body.parentFullName ?? null);
      const parentPhone = body.parentPhone ?? null;
      const parentAddress = body.parentAddress ?? null;
      const religion = body.religion ?? null;
      const specialNeeds = body.specialNeeds ?? null;
      const residenceAddress = body.residenceAddress ?? null;
      const medicalInfo = body.medicalInfo ?? null;
      const boardingStatus = body.boardingStatus;
      const emergencyContactName = toNameCase(body.emergencyContactName ?? null);
      const emergencyContactPhone = body.emergencyContactPhone ?? null;
      const guardianName = toNameCase(body.guardianName ?? null);
      const guardianPhone = body.guardianPhone ?? null;
      const countryCodeNorm = body.countryCode ?? undefined;
      const regType = body.registrationType ?? "first";

      if (countryCodeNorm !== undefined && countryCodeNorm !== null) {
        if (!isKnownCountryCode(countryCodeNorm)) {
          return res.status(400).json({ error: "Invalid countryCode" });
        }
      }
      if (district && !countryCodeNorm) {
        return res.status(400).json({ error: "countryCode is required when district is set" });
      }
      if (
        district &&
        countryCodeNorm &&
        countryCodeNorm !== "OTHER" &&
        !districtAllowedForCountry(countryCodeNorm, district)
      ) {
        return res.status(400).json({ error: "District does not match selected country" });
      }
      if (!classRoomId) {
        return res.status(400).json({ error: "classRoomId is required" });
      }
      if (!gender) {
        return res.status(400).json({ error: "gender is required" });
      }
      if (!nationality) {
        return res.status(400).json({ error: "nationality is required" });
      }
      if (!countryCodeNorm) {
        return res.status(400).json({ error: "countryCode is required" });
      }
      if (!religion) {
        return res.status(400).json({ error: "religion is required" });
      }
      if (!parentAliveStatus) {
        return res.status(400).json({ error: "parentAliveStatus is required" });
      }
      if (!boardingStatus) {
        return res.status(400).json({ error: "boardingStatus is required" });
      }
      let previousGradesStored: string | null = null;
      if (
        (parentAliveStatus === "both" || parentAliveStatus === "one") &&
        (!parentFullName || !parentPhone || !parentAddress)
      ) {
        return res.status(400).json({
          error:
            "parentFullName, parentPhone, and parentAddress are required when a parent is available",
        });
      }
      if (parentAliveStatus === "none" && (!guardianName || !guardianPhone)) {
        return res.status(400).json({
          error: "guardianName and guardianPhone are required when both parents are deceased",
        });
      }
      if (!emergencyContactName || !emergencyContactPhone) {
        return res.status(400).json({
          error:
            "emergencyContactName and emergencyContactPhone are required",
        });
      }

      if (classRoomId !== undefined && classRoomId !== null) {
        const cr = await ClassRoom.findByPk(classRoomId);
        if (!cr) {
          return res.status(400).json({ error: "Invalid classRoomId" });
        }
      }

      let dob: string | null = null;
      if (dateOfBirth) {
        const iso = parseQueryToIsoDate(dateOfBirth) ?? dateOfBirth;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
          return res.status(400).json({ error: "Invalid dateOfBirth" });
        }
        dob = iso;
      }
      if (!dob) {
        return res.status(400).json({ error: "dateOfBirth is required" });
      }

      const created = await createStudentRecord({
        firstName: toNameCase(firstName) ?? firstName,
        middleName: toNameCase(middleName),
        lastName: toNameCase(lastName) ?? lastName,
        dateOfBirth: dob,
        parentEmail: parentAliveStatus === "none" ? null : parentEmail,
        classRoomId,
        gender,
        sectionName,
        nationality,
        countryCode: countryCodeNorm,
        district,
        registrationType: regType,
        lastClassAttended: null,
        lastTermYear: null,
        previousReportCardFilename: null,
        previousGrades: previousGradesStored,
        transferReason: regType === "continuing" ? transferReason : null,
        parentAliveStatus,
        parentFullName: parentAliveStatus === "none" ? null : parentFullName,
        parentPhone: parentAliveStatus === "none" ? null : parentPhone,
        parentAddress: parentAliveStatus === "none" ? null : parentAddress,
        religion,
        specialNeeds,
        boardingStatus,
        residenceAddress,
        medicalInfo,
        emergencyContactName,
        emergencyContactPhone,
        guardianName,
        guardianPhone,
      });

      const withRoom = await Student.findByPk(created.id, {
        include: [{ model: ClassRoom, as: "classRoom", required: false }],
      });

      return res.status(201).json({
        item: withRoom ? studentToApiRow(withRoom) : studentToApiRow(created),
      });
    } catch (err) {
      console.error(err);
      return res.status(503).json({ error: "Database unavailable" });
    }
  });

  r.patch("/students/:id(\\d+)", async (req, res) => {
    try {
      const id = paramId(req);
      if (!Number.isFinite(id) || id < 1) return res.status(400).json({ error: "Invalid id" });
      const row = await Student.findByPk(id);
      if (!row) return res.status(404).json({ error: "Not found" });

      const parsedBody = validateWithSchema(studentUpdateBodySchema, req.body);
      if (!parsedBody.ok) {
        return res.status(400).json({ error: parsedBody.error });
      }
      const body = parsedBody.data;
      const firstName = body.firstName !== undefined ? toNameCase(body.firstName) : undefined;
      const middleName =
        body.middleName === null
          ? null
          : body.middleName !== undefined
            ? toNameCase(body.middleName)
            : undefined;
      const lastName = body.lastName !== undefined ? toNameCase(body.lastName) : undefined;

      const dateOfBirth = body.dateOfBirth === undefined ? undefined : body.dateOfBirth;
      const parentEmail = body.parentEmail === undefined ? undefined : body.parentEmail;
      const gender = body.gender === undefined ? undefined : body.gender;
      const sectionName = body.sectionName === undefined ? undefined : body.sectionName;
      const nationality = body.nationality === undefined ? undefined : body.nationality;
      const district = body.district === undefined ? undefined : body.district;
      const lastClassAttendedPatch =
        body.lastClassAttended === undefined ? undefined : body.lastClassAttended;
      const lastTermYearPatch = body.lastTermYear === undefined ? undefined : body.lastTermYear;
      const previousGradesPatch = body.previousGrades === undefined ? undefined : body.previousGrades;
      const transferReasonPatch = body.transferReason === undefined ? undefined : body.transferReason;
      const parentAliveStatusPatch =
        body.parentAliveStatus === undefined ? undefined : body.parentAliveStatus;
      const parentFullNamePatch =
        body.parentFullName === null
          ? null
          : body.parentFullName !== undefined
            ? toNameCase(body.parentFullName)
            : undefined;
      const parentPhonePatch = body.parentPhone === undefined ? undefined : body.parentPhone;
      const parentAddressPatch = body.parentAddress === undefined ? undefined : body.parentAddress;
      const religionPatch = body.religion === undefined ? undefined : body.religion;
      const specialNeedsPatch = body.specialNeeds === undefined ? undefined : body.specialNeeds;
      const boardingStatusPatch = body.boardingStatus === undefined ? undefined : body.boardingStatus;
      const residenceAddressPatch =
        body.residenceAddress === undefined ? undefined : body.residenceAddress;
      const medicalInfoPatch = body.medicalInfo === undefined ? undefined : body.medicalInfo;
      const emergencyContactNamePatch =
        body.emergencyContactName === null
          ? null
          : body.emergencyContactName !== undefined
            ? toNameCase(body.emergencyContactName)
            : undefined;
      const emergencyContactPhonePatch =
        body.emergencyContactPhone === undefined ? undefined : body.emergencyContactPhone;
      const guardianNamePatch =
        body.guardianName === null
          ? null
          : body.guardianName !== undefined
            ? toNameCase(body.guardianName)
            : undefined;
      const guardianPhonePatch = body.guardianPhone === undefined ? undefined : body.guardianPhone;

      let countryPatch: string | null | undefined;
      if (body.countryCode === null) {
        countryPatch = null;
      } else if (body.countryCode !== undefined) {
        if (!isKnownCountryCode(body.countryCode)) {
          return res.status(400).json({ error: "Invalid countryCode" });
        }
        countryPatch = body.countryCode;
      }

      const regPatch = body.registrationType ?? undefined;
      const classParsed = body.classRoomId;
      if (classParsed !== undefined && classParsed !== null) {
        const cr = await ClassRoom.findByPk(classParsed);
        if (!cr) return res.status(400).json({ error: "Invalid classRoomId" });
      }

      let dobUpdate: string | null | undefined;
      if (body.dateOfBirth === null) dobUpdate = null;
      else if (dateOfBirth) {
        const iso = parseQueryToIsoDate(dateOfBirth) ?? dateOfBirth;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
          return res.status(400).json({ error: "Invalid dateOfBirth" });
        }
        dobUpdate = iso;
      } else if (body.dateOfBirth !== undefined) {
        dobUpdate = null;
      }

      const nextReg: "first" | "continuing" =
        regPatch ?? (row.registrationType === "continuing" ? "continuing" : "first");
      const nextCountry =
        countryPatch !== undefined ? countryPatch : row.countryCode ?? null;
      const nextDistrict =
        district !== undefined ? district : row.district ?? null;
      const nextLastClass =
        nextReg === "continuing"
          ? null
          : lastClassAttendedPatch !== undefined
            ? lastClassAttendedPatch
            : ((row.get("last_class_attended") as string | null) ?? null);
      const nextLastTermYear =
        nextReg === "continuing"
          ? null
          : lastTermYearPatch !== undefined
            ? lastTermYearPatch
            : ((row.get("last_term_year") as string | null) ?? null);
      const nextPrevGrades =
        nextReg === "continuing"
          ? null
          : previousGradesPatch !== undefined
            ? previousGradesPatch
            : ((row.get("previous_grades") as string | null) ?? null);
      const nextParentStatus =
        parentAliveStatusPatch !== undefined
          ? parentAliveStatusPatch
          : (row.get("parent_alive_status") as "both" | "one" | "none" | null) ?? null;
      const nextParentFullName =
        parentFullNamePatch !== undefined
          ? parentFullNamePatch
          : ((row.get("parent_full_name") as string | null) ?? null);
      const nextParentPhone =
        parentPhonePatch !== undefined
          ? parentPhonePatch
          : ((row.get("parent_phone") as string | null) ?? null);
      const nextGuardianName =
        guardianNamePatch !== undefined
          ? guardianNamePatch
          : ((row.get("guardian_name") as string | null) ?? null);
      const nextGuardianPhone =
        guardianPhonePatch !== undefined
          ? guardianPhonePatch
          : ((row.get("guardian_phone") as string | null) ?? null);
      const nextEmergencyContactName =
        emergencyContactNamePatch !== undefined
          ? emergencyContactNamePatch
          : ((row.get("emergency_contact_name") as string | null) ?? null);
      const nextEmergencyContactPhone =
        emergencyContactPhonePatch !== undefined
          ? emergencyContactPhonePatch
          : ((row.get("emergency_contact_phone") as string | null) ?? null);

      if (nextDistrict && !nextCountry) {
        return res.status(400).json({ error: "countryCode is required when district is set" });
      }
      if (
        nextDistrict &&
        nextCountry &&
        nextCountry !== "OTHER" &&
        !districtAllowedForCountry(nextCountry, nextDistrict)
      ) {
        return res.status(400).json({ error: "District does not match selected country" });
      }
      if (
        (nextParentStatus === "both" || nextParentStatus === "one") &&
        !(nextParentFullName && nextParentPhone)
      ) {
        return res.status(400).json({
          error: "parentFullName and parentPhone are required when a parent is available",
        });
      }
      if (nextParentStatus === "none" && !(nextGuardianName && nextGuardianPhone)) {
        return res.status(400).json({
          error: "guardianName and guardianPhone are required when both parents are deceased",
        });
      }
      if (!(nextEmergencyContactName && nextEmergencyContactPhone)) {
        return res.status(400).json({
          error: "emergencyContactName and emergencyContactPhone are required",
        });
      }

      await row.update({
        ...(firstName ? { firstName } : {}),
        ...(middleName !== undefined ? { middleName } : {}),
        ...(lastName ? { lastName } : {}),
        ...(dobUpdate !== undefined ? { dateOfBirth: dobUpdate } : {}),
        ...(parentEmail !== undefined ? { parentEmail } : {}),
        ...(gender !== undefined ? { gender } : {}),
        ...(sectionName !== undefined ? { sectionName } : {}),
        ...(classParsed !== undefined ? { classRoomId: classParsed } : {}),
        ...(nationality !== undefined ? { nationality } : {}),
        ...(countryPatch !== undefined ? { countryCode: countryPatch } : {}),
        ...(district !== undefined ? { district } : {}),
        ...(regPatch !== undefined ? { registrationType: regPatch } : {}),
        ...(regPatch !== undefined || lastClassAttendedPatch !== undefined
          ? { lastClassAttended: nextLastClass }
          : {}),
        ...(regPatch !== undefined || lastTermYearPatch !== undefined
          ? { lastTermYear: nextLastTermYear }
          : {}),
        ...(regPatch !== undefined || previousGradesPatch !== undefined
          ? { previousGrades: nextPrevGrades }
          : {}),
        ...(transferReasonPatch !== undefined ? { transferReason: transferReasonPatch } : {}),
        ...(parentAliveStatusPatch !== undefined
          ? { parentAliveStatus: parentAliveStatusPatch }
          : {}),
        ...(parentAliveStatusPatch === "none"
          ? { parentFullName: null, parentPhone: null, parentAddress: null, parentEmail: null }
          : {}),
        ...(parentFullNamePatch !== undefined ? { parentFullName: parentFullNamePatch } : {}),
        ...(parentPhonePatch !== undefined ? { parentPhone: parentPhonePatch } : {}),
        ...(parentAddressPatch !== undefined ? { parentAddress: parentAddressPatch } : {}),
        ...(religionPatch !== undefined ? { religion: religionPatch } : {}),
        ...(specialNeedsPatch !== undefined ? { specialNeeds: specialNeedsPatch } : {}),
        ...(boardingStatusPatch !== undefined ? { boardingStatus: boardingStatusPatch } : {}),
        ...(residenceAddressPatch !== undefined ? { residenceAddress: residenceAddressPatch } : {}),
        ...(medicalInfoPatch !== undefined ? { medicalInfo: medicalInfoPatch } : {}),
        ...(emergencyContactNamePatch !== undefined
          ? { emergencyContactName: emergencyContactNamePatch }
          : {}),
        ...(emergencyContactPhonePatch !== undefined
          ? { emergencyContactPhone: emergencyContactPhonePatch }
          : {}),
        ...(guardianNamePatch !== undefined ? { guardianName: guardianNamePatch } : {}),
        ...(guardianPhonePatch !== undefined ? { guardianPhone: guardianPhonePatch } : {}),
      });

      const withRoom = await Student.findByPk(id, {
        include: [{ model: ClassRoom, as: "classRoom", required: false }],
      });
      return res.json({ item: studentToApiRow(withRoom!) });
    } catch (err) {
      console.error(err);
      return res.status(503).json({ error: "Database unavailable" });
    }
  });

  r.delete("/students/:id(\\d+)", async (req, res) => {
    try {
      const id = paramId(req);
      if (!Number.isFinite(id) || id < 1) return res.status(400).json({ error: "Invalid id" });
      const row = await Student.findByPk(id);
      if (!row) return res.status(404).json({ error: "Not found" });
      const fn =
        row.passportPhotoFilename ??
        (row.get("passport_photo_filename") as string | null);
      await unlinkStudentPhoto(uploadDir, fn);
      const prevReport =
        (row.get("previous_report_card_filename") as string | null | undefined) ??
        (row as unknown as { previousReportCardFilename?: string | null }).previousReportCardFilename ??
        null;
      await unlinkUploadedFile(reportUploadDir, prevReport);
      
      // Cascading deletes for related records
      await StudentFeePayment.destroy({ where: { studentId: id } });
      await StudentFeeReceipt.destroy({ where: { studentId: id } });
      await StudentFeeAssignment.destroy({ where: { studentId: id } });
      await StudentAssessmentResult.destroy({ where: { studentId: id } });
      await AttendanceRecord.destroy({ where: { studentId: id } });

      await row.destroy();
      return res.status(204).end();
    } catch (err) {
      console.error(err);
      return res.status(503).json({ error: "Database unavailable" });
    }
  });

  r.post(
    "/students/:id(\\d+)/transfer-report",
    (req, res, next) => {
      fsSync.mkdirSync(reportUploadDir, { recursive: true });
      next();
    },
    transferReportUpload.single("report"),
    async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: "Report file required (field: report)" });
        }
        const id = paramId(req);
        if (!Number.isFinite(id) || id < 1) {
          await fs.unlink(req.file.path).catch(() => {});
          return res.status(400).json({ error: "Invalid id" });
        }
        const row = await Student.findByPk(id);
        if (!row) {
          await fs.unlink(req.file.path).catch(() => {});
          return res.status(404).json({ error: "Not found" });
        }
        const currentReg =
          row.registrationType ?? (row.get("registration_type") as string | undefined) ?? "first";
        if (currentReg !== "first") {
          await fs.unlink(req.file.path).catch(() => {});
          return res.status(400).json({
            error: "Previous report card upload is only for new admissions",
          });
        }
        const prev =
          (row.get("previous_report_card_filename") as string | null | undefined) ??
          (row as unknown as { previousReportCardFilename?: string | null }).previousReportCardFilename ??
          null;
        await unlinkUploadedFile(reportUploadDir, prev);
        const savedName = req.file.filename;
        if (!savedName) {
          return res.status(500).json({ error: "Upload failed" });
        }
        await row.update({ previousReportCardFilename: savedName });
        const withRoom = await Student.findByPk(id, {
          include: [{ model: ClassRoom, as: "classRoom", required: false }],
        });
        return res.json({ item: studentToApiRow(withRoom!) });
      } catch (err) {
        console.error(err);
        return res.status(503).json({ error: "Database unavailable" });
      }
    },
  );

  r.post(
    "/students/:id(\\d+)/photo",
    (req, res, next) => {
      fsSync.mkdirSync(uploadDir, { recursive: true });
      next();
    },
    photoUpload.single("photo"),
    async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: "Image file required (field: photo)" });
        }
        const id = paramId(req);
        if (!Number.isFinite(id) || id < 1) {
          await fs.unlink(req.file.path).catch(() => {});
          return res.status(400).json({ error: "Invalid id" });
        }
        const row = await Student.findByPk(id);
        if (!row) {
          await fs.unlink(req.file.path).catch(() => {});
          return res.status(404).json({ error: "Not found" });
        }
        const prev =
          row.passportPhotoFilename ??
          (row.get("passport_photo_filename") as string | null);
        await unlinkStudentPhoto(uploadDir, prev);
        const savedName = req.file.filename;
        if (!savedName) {
          return res.status(500).json({ error: "Upload failed" });
        }
        await row.update({ passportPhotoFilename: savedName });
        const withRoom = await Student.findByPk(id, {
          include: [{ model: ClassRoom, as: "classRoom", required: false }],
        });
        return res.json({ item: studentToApiRow(withRoom!) });
      } catch (err) {
        console.error(err);
        return res.status(503).json({ error: "Database unavailable" });
      }
    },
  );

  return r;
}
