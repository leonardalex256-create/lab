import crypto from "node:crypto";
import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { Op } from "sequelize";
import { z } from "zod";
import type { Config } from "../config.js";
import { sendPasswordResetOtp } from "../mail/sendPasswordResetOtp.js";
import { PasswordResetOtp, User, userByEmailCi } from "../models/index.js";

const requestSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Enter your email address")
    .email("Enter a valid email address")
    .refine((v) => v === v.toLowerCase(), { message: "Email must be lowercase." }),
});

const verifyOtpSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Enter your email address")
    .email("Enter a valid email address")
    .refine((v) => v === v.toLowerCase(), { message: "Email must be lowercase." }),
  otp: z.string().min(4),
});

const resetWithTokenSchema = z.object({
  resetToken: z.string().min(10, "Invalid reset session"),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

function emailKey(email: string) {
  return email.trim().toLowerCase();
}

function normalizeOtp(raw: string) {
  return raw.replace(/\D/g, "").slice(0, 6);
}

export function createPasswordResetRouter(config: Config) {
  const r = Router();

  r.post("/request-password-reset", async (req, res) => {
    const parsed = requestSchema.safeParse(req.body);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Invalid body";
      return res.status(400).json({ error: msg });
    }

    const normalized = parsed.data.email;

    try {
      const user = await userByEmailCi(normalized);
      if (!user) {
        return res.status(404).json({
          error: "No account is registered with this email address.",
        });
      }

      const code = String(crypto.randomInt(100_000, 1_000_000));
      const codeHash = await bcrypt.hash(code, 10);
      const emailLower = emailKey(user.email);
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

      const sequelize = PasswordResetOtp.sequelize;
      if (!sequelize) {
        return res.status(500).json({ error: "Database not initialized" });
      }
      await sequelize.transaction(async (t) => {
        await PasswordResetOtp.destroy({
          where: { emailLower },
          transaction: t,
        });
        await PasswordResetOtp.create(
          {
            emailLower,
            codeHash,
            expiresAt,
          },
          { transaction: t },
        );
      });

      const sent = await sendPasswordResetOtp(config, user.email, code);
      if (!sent.ok) {
        await PasswordResetOtp.destroy({ where: { emailLower } });
        return res.status(503).json({ error: sent.error });
      }

      return res.json({
        message: "Verification code sent. Check your email.",
      });
    } catch (err) {
      console.error(err);
      return res.status(503).json({ error: "Database unavailable" });
    }
  });

  r.post("/verify-password-reset-otp", async (req, res) => {
    const parsed = verifyOtpSchema.safeParse(req.body);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Invalid body";
      return res.status(400).json({ error: msg });
    }

    const { email } = parsed.data;
    const otp = normalizeOtp(parsed.data.otp);
    if (otp.length !== 6) {
      return res.status(400).json({ error: "Enter the 6-digit code" });
    }

    try {
      const user = await userByEmailCi(email);
      if (!user) {
        return res.status(400).json({
          error: "Invalid or expired verification code",
        });
      }

      const emailLower = emailKey(user.email);

      const row = await PasswordResetOtp.findOne({
        where: {
          emailLower,
          expiresAt: { [Op.gt]: new Date() },
        },
        order: [["id", "DESC"]],
      });

      if (!row) {
        return res.status(400).json({ error: "Invalid or expired verification code" });
      }

      const match = await bcrypt.compare(otp, row.codeHash);
      if (!match) {
        return res.status(400).json({ error: "Invalid or expired verification code" });
      }

      await PasswordResetOtp.destroy({ where: { emailLower } });

      const resetToken = jwt.sign(
        {
          pwdReset: true,
          sub: String(user.id),
          email: user.email,
        },
        config.JWT_SECRET,
        { expiresIn: "15m" },
      );

      return res.json({ resetToken });
    } catch (err) {
      console.error(err);
      return res.status(503).json({ error: "Database unavailable" });
    }
  });

  r.post("/reset-password-with-token", async (req, res) => {
    const parsed = resetWithTokenSchema.safeParse(req.body);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Invalid body";
      return res.status(400).json({ error: msg });
    }

    const { resetToken, newPassword } = parsed.data;

    try {
      let payload: jwt.JwtPayload & {
        pwdReset?: boolean;
        email?: string;
      };
      try {
        payload = jwt.verify(resetToken, config.JWT_SECRET) as typeof payload;
      } catch {
        return res.status(400).json({
          error: "Invalid or expired reset session. Request a new code.",
        });
      }

      if (
        !payload.pwdReset ||
        typeof payload.sub !== "string" ||
        typeof payload.email !== "string"
      ) {
        return res.status(400).json({ error: "Invalid or expired reset session." });
      }

      const user = await User.findByPk(Number(payload.sub));
      if (!user || user.email !== payload.email) {
        return res.status(400).json({ error: "Invalid or expired reset session." });
      }

      const passwordHash = await bcrypt.hash(newPassword, 12);
      const sequelize = User.sequelize;
      if (!sequelize) {
        return res.status(500).json({ error: "Database not initialized" });
      }
      await sequelize.transaction(async (t) => {
        await user.update({ passwordHash }, { transaction: t });
        await PasswordResetOtp.destroy({
          where: { emailLower: emailKey(user.email) },
          transaction: t,
        });
      });

      return res.json({ message: "Password updated. You can sign in now." });
    } catch (err) {
      console.error(err);
      return res.status(503).json({ error: "Database unavailable" });
    }
  });

  return r;
}
