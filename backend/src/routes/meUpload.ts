/**
 * File Upload API (Section H2).
 * POST /api/me/upload/student-photo
 * POST /api/me/upload/document
 * POST /api/me/upload/school-logo
 * DELETE /api/me/upload/:publicId
 *
 * Uses local storage via multer (UPLOAD_PROVIDER=local, default).
 * Cloudinary path is prepared via env but not active unless UPLOAD_PROVIDER=cloudinary.
 */
import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { writeAuditLog } from "../utils/auditLogger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_BASE = process.env.UPLOAD_LOCAL_PATH
  ? path.resolve(process.env.UPLOAD_LOCAL_PATH)
  : path.resolve(__dirname, "../../uploads");

/** Ensure upload directory exists */
function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

/** Allowed MIME types per upload type */
const ALLOWED_MIMES: Record<string, string[]> = {
  photo: ["image/jpeg", "image/png", "image/webp"],
  document: ["application/pdf", "image/jpeg", "image/png"],
  logo: ["image/jpeg", "image/png", "image/svg+xml"],
};

/** Max sizes in bytes */
const MAX_SIZES: Record<string, number> = {
  photo: 2 * 1024 * 1024,     // 2 MB
  document: 10 * 1024 * 1024, // 10 MB
  logo: 1 * 1024 * 1024,       // 1 MB
};

function makeStorage(subdir: string) {
  const dest = path.join(UPLOAD_BASE, subdir);
  ensureDir(dest);
  return multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, dest),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const safeName = `${subdir}_${Date.now()}${ext}`;
      cb(null, safeName);
    },
  });
}

function mimeFilter(allowed: string[]) {
  return (_req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed. Accepted: ${allowed.join(", ")}`));
    }
  };
}

const photoUpload = multer({
  storage: makeStorage("photos"),
  limits: { fileSize: MAX_SIZES.photo! },
  fileFilter: mimeFilter(ALLOWED_MIMES.photo!),
});

const documentUpload = multer({
  storage: makeStorage("documents"),
  limits: { fileSize: MAX_SIZES.document! },
  fileFilter: mimeFilter(ALLOWED_MIMES.document!),
});

const logoUpload = multer({
  storage: makeStorage("logos"),
  limits: { fileSize: MAX_SIZES.logo! },
  fileFilter: mimeFilter(ALLOWED_MIMES.logo!),
});

export function createMeUploadRouter() {
  const r = Router();

  // ── POST /upload/student-photo ────────────────────────────────────────────
  r.post("/upload/student-photo", (req, res, next) => {
    photoUpload.single("photo")(req, res, async (err) => {
      if (err) return res.status(415).json({ error: err.message });
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });

      const studentId = Number(req.body.student_id);
      if (!studentId) return res.status(400).json({ error: "student_id required" });

      try {
        const sequelize = (await import("../models/index.js")).User.sequelize;
        if (!sequelize) return res.status(500).json({ error: "DB not initialized" });

        const relPath = path.relative(UPLOAD_BASE, req.file.path).replace(/\\/g, "/");
        const url = `/uploads/${relPath}`;

        await sequelize.query(
          "UPDATE students SET passport_photo_filename = :filename WHERE id = :id",
          { replacements: { filename: req.file.filename, id: studentId } },
        );

        await writeAuditLog({
          sequelize,
          userId: req.userId ?? null,
          action: "file_uploaded",
          entity: "students",
          entityId: studentId,
          severity: "info",
          channel: "web",
          metadata: { type: "student_photo", filename: req.file.filename, size: req.file.size },
        });

        return res.json({ success: true, url, public_id: req.file.filename });
      } catch (e) {
        console.error("[upload/student-photo]", e);
        return res.status(500).json({ error: "Upload failed" });
      }
    });
  });

  // ── POST /upload/document ─────────────────────────────────────────────────
  r.post("/upload/document", (req, res) => {
    documentUpload.single("file")(req, res, async (err) => {
      if (err) return res.status(415).json({ error: err.message });
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });

      const studentId = Number(req.body.student_id);
      const docType = req.body.doc_type ?? "other";

      if (!studentId) return res.status(400).json({ error: "student_id required" });

      try {
        const sequelize = (await import("../models/index.js")).User.sequelize;
        if (!sequelize) return res.status(500).json({ error: "DB not initialized" });

        const relPath = path.relative(UPLOAD_BASE, req.file.path).replace(/\\/g, "/");
        const url = `/uploads/${relPath}`;

        await sequelize.query(
          `INSERT INTO student_documents (student_id, doc_type, file_url, public_id, file_name_original, mime_type, file_size_bytes, uploaded_by)
           VALUES (:sid, :docType, :url, :publicId, :originalName, :mimeType, :size, :by)`,
          {
            replacements: {
              sid: studentId,
              docType,
              url,
              publicId: req.file.filename,
              originalName: req.file.originalname,
              mimeType: req.file.mimetype,
              size: req.file.size,
              by: req.userId ?? null,
            },
          },
        );

        await writeAuditLog({
          sequelize,
          userId: req.userId ?? null,
          action: "file_uploaded",
          entity: "student_documents",
          entityId: studentId,
          severity: "info",
          channel: "web",
          metadata: { doc_type: docType, filename: req.file.filename, size: req.file.size },
        });

        return res.json({ success: true, url, public_id: req.file.filename, doc_type: docType });
      } catch (e) {
        console.error("[upload/document]", e);
        return res.status(500).json({ error: "Upload failed" });
      }
    });
  });

  // ── POST /upload/school-logo ──────────────────────────────────────────────
  r.post("/upload/school-logo", (req, res) => {
    logoUpload.single("logo")(req, res, async (err) => {
      if (err) return res.status(415).json({ error: err.message });
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });

      try {
        const sequelize = (await import("../models/index.js")).User.sequelize;
        if (!sequelize) return res.status(500).json({ error: "DB not initialized" });

        const relPath = path.relative(UPLOAD_BASE, req.file.path).replace(/\\/g, "/");
        const url = `/uploads/${relPath}`;

        await sequelize.query(
          `INSERT INTO school_settings (setting_key, setting_value) VALUES ('logo_url', :url)
           ON DUPLICATE KEY UPDATE setting_value = :url`,
          { replacements: { url } },
        );

        await writeAuditLog({
          sequelize,
          userId: req.userId ?? null,
          action: "school_settings_updated",
          entity: "school_settings",
          severity: "info",
          channel: "web",
          metadata: { key: "logo_url" },
        });

        return res.json({ success: true, url, public_id: req.file.filename });
      } catch (e) {
        console.error("[upload/school-logo]", e);
        return res.status(500).json({ error: "Upload failed" });
      }
    });
  });

  // ── DELETE /upload/:publicId ───────────────────────────────────────────────
  r.delete("/upload/:publicId", async (req, res) => {
    const publicId = req.params.publicId;
    if (!publicId) return res.status(400).json({ error: "publicId required" });

    try {
      const sequelize = (await import("../models/index.js")).User.sequelize;
      if (!sequelize) return res.status(500).json({ error: "DB not initialized" });

      // Try to find in student_documents
      const [rows] = await sequelize.query(
        "SELECT id, file_url FROM student_documents WHERE public_id = :pid LIMIT 1",
        { replacements: { pid: publicId } },
      ) as [Array<{ id: number; file_url: string }>];

      if (rows.length) {
        await sequelize.query("DELETE FROM student_documents WHERE public_id = :pid", { replacements: { pid: publicId } });
      }

      // Delete from disk
      const localPath = path.join(UPLOAD_BASE, publicId.replace(/\//g, path.sep));
      if (fs.existsSync(localPath)) fs.unlinkSync(localPath);

      await writeAuditLog({
        sequelize,
        userId: req.userId ?? null,
        action: "file_deleted",
        entity: "student_documents",
        severity: "warning",
        channel: "web",
        metadata: { public_id: publicId },
      });

      return res.json({ success: true, message: "File deleted" });
    } catch (e) {
      console.error("[upload/delete]", e);
      return res.status(500).json({ error: "Delete failed" });
    }
  });

  return r;
}
