/**
 * Tokenized forgot-password email flow (Section C2).
 * Adds: POST /api/auth/forgot-password
 *       POST /api/auth/reset-password   (token from email link)
 *       POST /api/auth/set-password     (welcome token for new users)
 *
 * The existing OTP-based flow (request-password-reset / verify-password-reset-otp)
 * is preserved unchanged in passwordReset.ts.
 */
import crypto from "node:crypto";
import { Router } from "express";
import bcrypt from "bcrypt";
import { z } from "zod";
import type { Config } from "../config.js";
import { User } from "../models/index.js";
import { sendMail } from "../utils/mailer.js";
import { writeAuditLog } from "../utils/auditLogger.js";
import { strongPassword } from "../lib/passwordPolicy.js";

function sha256hex(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function getSchoolSettings(config: Config): Record<string, string> {
  // Best-effort: read from env or fall back to generic values
  return {
    school_name: process.env.SCHOOL_NAME ?? "School",
    school_address: process.env.SCHOOL_ADDRESS ?? "",
    school_phone: process.env.SCHOOL_PHONE ?? "",
    school_email: process.env.SCHOOL_EMAIL ?? "",
    login_url: (process.env.FRONTEND_URL ?? `http://localhost:${config.PORT}`) + "/login",
  };
}

const forgotPasswordSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Enter a valid email address")
    .refine((v) => v === v.toLowerCase(), { message: "Email must be lowercase." }),
});

const resetPasswordSchema = z.object({
  token: z.string().min(10),
  newPassword: strongPassword(),
  confirmPassword: z.string(),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

const setPasswordSchema = z.object({
  token: z.string().min(10),
  newPassword: strongPassword(),
  confirmPassword: z.string(),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export function createForgotPasswordRouter(config: Config) {
  const r = Router();

  // ── POST /api/auth/forgot-password ─────────────────────────────────────
  r.post("/forgot-password", async (req, res) => {
    const parsed = forgotPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      // Still return 200 to avoid email enumeration
      return res.json({ success: true, message: "If that email exists, a reset link was sent." });
    }

    const { email } = parsed.data;
    const frontendUrl = process.env.FRONTEND_URL ?? `http://localhost:5173`;

    try {
      const sequelize = User.sequelize;
      if (!sequelize) return res.status(500).json({ error: "Database not initialized" });

      const [users]: [Array<{id: number; email: string}>] = await sequelize.query(
        "SELECT id, email FROM users WHERE LOWER(email) = LOWER(:email) AND is_deleted = 0 AND is_active = 1 LIMIT 1",
        { replacements: { email } },
      ) as [Array<{id: number; email: string}>, unknown];

      // Always return success — no enumeration
      if (!users.length) {
        return res.json({ success: true, message: "If that email exists, a reset link was sent." });
      }

      const user = users[0]!;
      const rawToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = sha256hex(rawToken);
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      const ipFrom = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ?? req.ip ?? null;

      // Invalidate old tokens
      await sequelize.query(
        "DELETE FROM password_reset_tokens WHERE user_id = :userId",
        { replacements: { userId: user.id } },
      );
      await sequelize.query(
        "INSERT INTO password_reset_tokens (user_id, token_hash, expires_at, ip_requested_from) VALUES (:userId, :tokenHash, :expiresAt, :ip)",
        { replacements: { userId: user.id, tokenHash, expiresAt, ip: ipFrom } },
      );

      const resetUrl = `${frontendUrl}/reset-password?token=${rawToken}`;
      const school = getSchoolSettings(config);

      await sendMail({
        to: user.email,
        subject: `Reset your password — ${school.school_name}`,
        templateName: "reset-password",
        variables: { ...school, reset_url: resetUrl },
      });

      await writeAuditLog({
        sequelize,
        userId: user.id,
        action: "password_reset_requested",
        entity: "users",
        entityId: user.id,
        entityLabel: user.email,
        severity: "info",
        channel: "web",
        ipAddress: ipFrom,
      });

      return res.json({ success: true, message: "If that email exists, a reset link was sent." });
    } catch (err) {
      console.error("[forgot-password]", err);
      return res.json({ success: true, message: "If that email exists, a reset link was sent." });
    }
  });

  // ── POST /api/auth/reset-password ──────────────────────────────────────
  r.post("/reset-password", async (req, res) => {
    const parsed = resetPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Invalid request";
      return res.status(400).json({ error: msg });
    }

    const { token, newPassword } = parsed.data;
    const tokenHash = sha256hex(token);

    try {
      const sequelize = User.sequelize;
      if (!sequelize) return res.status(500).json({ error: "Database not initialized" });

      const [rows]: [Array<{id: number; user_id: number}>] = await sequelize.query(
        `SELECT id, user_id FROM password_reset_tokens
         WHERE token_hash = :tokenHash
           AND used_at IS NULL
           AND expires_at > NOW()
         LIMIT 1`,
        { replacements: { tokenHash } },
      ) as [Array<{id: number; user_id: number}>, unknown];

      if (!rows.length) {
        return res.status(400).json({ error: "Invalid or expired reset link. Please request a new one." });
      }

      const row = rows[0]!;
      const passwordHash = await bcrypt.hash(newPassword, 12);

      await sequelize.transaction(async (t) => {
        // Update password
        await sequelize.query(
          "UPDATE users SET password_hash = :passwordHash WHERE id = :userId",
          { replacements: { passwordHash, userId: row.user_id }, transaction: t },
        );
        // Mark token used
        await sequelize.query(
          "UPDATE password_reset_tokens SET used_at = NOW() WHERE id = :id",
          { replacements: { id: row.id }, transaction: t },
        );
        // Delete all other pending tokens for the user
        await sequelize.query(
          "DELETE FROM password_reset_tokens WHERE user_id = :userId AND id != :id",
          { replacements: { userId: row.user_id, id: row.id }, transaction: t },
        );
      });

      await writeAuditLog({
        sequelize,
        userId: row.user_id,
        action: "password_reset_completed",
        entity: "users",
        entityId: row.user_id,
        severity: "info",
        channel: "web",
        ipAddress: (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ?? req.ip ?? null,
      });

      return res.json({ success: true, message: "Password updated. Please sign in." });
    } catch (err) {
      console.error("[reset-password]", err);
      return res.status(500).json({ error: "Something went wrong. Please try again." });
    }
  });

  // ── POST /api/auth/set-password (welcome link) ──────────────────────────
  r.post("/set-password", async (req, res) => {
    const parsed = setPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Invalid request";
      return res.status(400).json({ error: msg });
    }

    const { token, newPassword } = parsed.data;
    const tokenHash = sha256hex(token);

    try {
      const sequelize = User.sequelize;
      if (!sequelize) return res.status(500).json({ error: "Database not initialized" });

      const [rows]: [Array<{id: number; user_id: number}>] = await sequelize.query(
        `SELECT id, user_id FROM welcome_tokens
         WHERE token_hash = :tokenHash
           AND used_at IS NULL
           AND expires_at > NOW()
         LIMIT 1`,
        { replacements: { tokenHash } },
      ) as [Array<{id: number; user_id: number}>, unknown];

      if (!rows.length) {
        return res.status(400).json({ error: "This invitation link has expired or already been used." });
      }

      const row = rows[0]!;
      const passwordHash = await bcrypt.hash(newPassword, 12);

      await sequelize.transaction(async (t) => {
        await sequelize.query(
          "UPDATE users SET password_hash = :passwordHash, must_change_password = 0 WHERE id = :userId",
          { replacements: { passwordHash, userId: row.user_id }, transaction: t },
        );
        await sequelize.query(
          "UPDATE welcome_tokens SET used_at = NOW() WHERE id = :id",
          { replacements: { id: row.id }, transaction: t },
        );
      });

      await writeAuditLog({
        sequelize,
        userId: row.user_id,
        action: "password_reset_completed",
        entity: "users",
        entityId: row.user_id,
        severity: "info",
        channel: "web",
      });

      return res.json({ success: true, message: "Password set. You can now sign in." });
    } catch (err) {
      console.error("[set-password]", err);
      return res.status(500).json({ error: "Something went wrong. Please try again." });
    }
  });

  return r;
}
