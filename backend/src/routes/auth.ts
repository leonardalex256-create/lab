import { Router } from "express";
import bcrypt from "bcrypt";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { Op } from "sequelize";
import { z } from "zod";
import type { Config } from "../config.js";
import { ensureSecuritySchema } from "../db/ensureSecuritySchema.js";
import { loadUserMeFields } from "../db/loadUserSafe.js";
import { User, UserNotification, userByEmailCi } from "../models/index.js";
import {
  isStrongPassword,
  STRONG_PASSWORD_MESSAGE,
} from "../lib/passwordPolicy.js";
import {
  issueSecurityOtpChallenge,
  verifyAndConsumeSecurityOtpChallenge,
} from "../services/securityOtpChallenge.js";

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1)
    .email("Enter a valid email")
    .refine((v) => v === v.toLowerCase(), { message: "Email must be lowercase." }),
  password: z.string().min(1),
  /** When true, issue a longer-lived JWT (same as “Remember me” on the client). */
  rememberMe: z.boolean().optional(),
});

const verify2faSchema = z.object({
  twoFactorToken: z.string().min(10),
  otp: z.string().min(4),
});

const registerSchema = z
  .object({
    name: z.string().trim().min(2, "Enter your full name").max(120),
    email: z
      .string()
      .trim()
      .email("Enter a valid email")
      .max(255)
      .refine((v) => v === v.toLowerCase(), {
        message: "Email must be lowercase.",
      }),
    phoneNumber: z.string().trim().regex(/^(?:\+256|0|256)[1-9]\d{8}$/, "Must be a valid Ugandan phone number (e.g. 0772123456 or +256772123456)"),
    gender: z.string().trim().min(1, "Select gender").max(32),
    dateOfBirth: z.string().trim().min(4, "Select date of birth"),
    addressLine: z.string().trim().min(4, "Enter your address").max(255),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Confirm password "),
  })
  .superRefine((value, ctx) => {
    if (!isStrongPassword(value.password)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["password"],
        message: STRONG_PASSWORD_MESSAGE,
      });
    }
    if (value.password !== value.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmPassword"],
        message: "Passwords do not match! Please try again.",
      });
    }
  });

/** Valid bcrypt hash so unknown emails still pay compare cost */
const DUMMY_HASH =
  "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.G7.i1bq7QE.BG";

export function createAuthRouter(config: Config) {
  const r = Router();

  r.post("/login", async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Enter your email and password.",
      });
    }

    const { email, password, rememberMe } = parsed.data;
    const normalized = email.trim();

    let hashToCompare = DUMMY_HASH;
    let user: InstanceType<typeof User> | null = null;

    try {
      const found = await userByEmailCi(normalized);
      if (found) {
        hashToCompare = found.passwordHash;
        user = found;
      }
    } catch (err) {
      console.error(err);
      return res.status(503).json({ error: "Database unavailable" });
    }

    const ok = await bcrypt.compare(password, hashToCompare);
    if (!ok || !user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    if (user.isDeleted) {
      return res.status(403).json({ error: "Account is no longer available." });
    }
    if (!user.isActive) {
      return res.status(403).json({ error: "Account is deactivated. Contact an administrator." });
    }

    if (user.role === "pending_assignment") {
      return res.status(403).json({
        error:
          "Your account is awaiting admin role assignment. Please contact the school administrator.",
      });
    }

    if (user.twoFactorEnabled) {
      const issued = await issueSecurityOtpChallenge(config, {
        userId: user.id,
        email: user.email,
        purpose: "login_2fa",
      });
      if (!issued.ok) {
        return res.status(503).json({ error: issued.error });
      }
      const twoFactorToken = jwt.sign(
        {
          tfPending: true,
          sub: String(user.id),
          email: user.email,
          role: user.role,
          remember: Boolean(rememberMe),
        },
        config.JWT_SECRET,
        { expiresIn: "10m" },
      );
      return res.json({ requiresTwoFactor: true, twoFactorToken });
    }

    const expiresIn = rememberMe ? "30d" : "7d";
    const token = jwt.sign(
      { sub: String(user.id), role: user.role, email: user.email },
      config.JWT_SECRET,
      { expiresIn },
    );

    return res.json({ token });
  });

  r.post("/register", async (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Invalid registration details";
      return res.status(400).json({ error: msg });
    }
    const { name, email, phoneNumber, gender, dateOfBirth, addressLine, password } = parsed.data;
    const normalizedEmail = email.trim().toLowerCase();
    try {
      const existing = await userByEmailCi(normalizedEmail);
      if (existing) {
        return res.status(409).json({ error: "An account with this email already exists! Please try another email." });
      }

      const passwordHash = await bcrypt.hash(password, 12);
      await User.create({
        fullName: name.trim(),
        email: normalizedEmail,
        phoneNumber: phoneNumber.trim(),
        gender: gender.trim(),
        dateOfBirth: dateOfBirth.trim(),
        addressLine: addressLine.trim(),
        role: "pending_assignment",
        passwordHash,
        isActive: true,
        isDeleted: false,
      });

      const admins = await User.findAll({
        attributes: ["id"],
        where: { role: { [Op.in]: ["admin", "super_admin"] } },
      });

      if (admins.length > 0) {
        await UserNotification.bulkCreate(
          admins.map((admin) => ({
            userId: admin.id,
            title: "New user registration pending approval",
            body: `${name.trim()} (${normalizedEmail}) registered and is waiting for role assignment.`,
          })),
        );
      }

      return res.status(201).json({
        message:
          "Registration submitted successfully. An admin will assign your role before you can sign in.",
      });
    } catch (err) {
      console.error(err);
      return res.status(503).json({ error: "Database unavailable" });
    }
  });

  r.post("/verify-login-2fa", async (req, res) => {
    const parsed = verify2faSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Enter the verification code." });
    }
    const { twoFactorToken, otp } = parsed.data;

    let payload: JwtPayload & {
      tfPending?: boolean;
      sub?: string;
      email?: string;
      role?: string;
      remember?: boolean;
    };
    try {
      payload = jwt.verify(twoFactorToken, config.JWT_SECRET) as typeof payload;
    } catch {
      return res.status(400).json({
        error: "Sign-in session expired. Please sign in again.",
      });
    }

    if (!payload.tfPending || typeof payload.sub !== "string") {
      return res.status(400).json({ error: "Invalid sign-in session." });
    }

    const userId = Number.parseInt(payload.sub, 10);
    if (!Number.isFinite(userId)) {
      return res.status(400).json({ error: "Invalid sign-in session." });
    }

    try {
      const otpOk = await verifyAndConsumeSecurityOtpChallenge(
        userId,
        "login_2fa",
        otp,
      );
      if (!otpOk) {
        return res.status(400).json({
          error: "Invalid or expired verification code.",
        });
      }

      const row = await User.findByPk(userId);
      if (!row || row.email !== payload.email) {
        return res.status(400).json({ error: "Invalid sign-in session." });
      }
      if (row.isDeleted) {
        return res.status(403).json({ error: "Account is no longer available." });
      }
      if (!row.isActive) {
        return res.status(403).json({ error: "Account is deactivated. Contact an administrator." });
      }

      const expiresIn = payload.remember ? "30d" : "7d";
      const token = jwt.sign(
        { sub: String(row.id), role: row.role, email: row.email },
        config.JWT_SECRET,
        { expiresIn },
      );
      return res.json({ token });
    } catch (err) {
      console.error(err);
      return res.status(503).json({ error: "Database unavailable" });
    }
  });

  r.get("/me", async (req, res) => {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const token = header.slice(7);
    try {
      const payload = jwt.verify(token, config.JWT_SECRET) as JwtPayload & {
        sub: string;
        role: string;
        email: string;
      };
      const id = Number.parseInt(payload.sub, 10);
      if (!Number.isFinite(id)) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const authUser = await User.findByPk(id, { attributes: ["id", "isActive", "isDeleted"] });
      if (!authUser || authUser.isDeleted || !authUser.isActive) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const jwtFallback = {
        email: payload.email,
        role: payload.role,
      };
      let fields: Awaited<ReturnType<typeof loadUserMeFields>>;
      try {
        fields = await loadUserMeFields(id, jwtFallback);
      } catch (err) {
        console.error("[auth/me] load user failed; re-running security schema DDL…", err);
        try {
          await ensureSecuritySchema(User.sequelize!);
          fields = await loadUserMeFields(id, jwtFallback);
        } catch (err2) {
          console.error(err2);
          return res.status(503).json({ error: "Database unavailable" });
        }
      }
      return res.json({
        user: {
          sub: payload.sub,
          name: fields.name,
          email: fields.email,
          role: fields.role,
          twoFactorEnabled: fields.twoFactorEnabled,
          permissions: fields.permissions,
        },
      });
    } catch {
      return res.status(401).json({ error: "Unauthorized" });
    }
  });

  return r;
}
