import { Router } from "express";
import bcrypt from "bcrypt";
import { z } from "zod";
import { Op } from "sequelize";
import type { Config } from "../config.js";
import { loadUserEmailAndTwoFactor, loadUserMeFields } from "../db/loadUserSafe.js";
import {
  User,
  RolePermission,
  UserPermissionOverride,
  UserClassAuthorization,
  ClassRoom,
  StaffMember,
} from "../models/index.js";
import { PERMISSION_KEYS } from "../constants/permissions.js";
import { requirePermission } from "../middleware/requirePermission.js";
import {
  issueSecurityOtpChallenge,
  verifyAndConsumeSecurityOtpChallenge,
} from "../services/securityOtpChallenge.js";

const STRONG_PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

const requestPasswordChangeOtpSchema = z.object({});

const confirmPasswordChangeSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password"),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
  otp: z.string().min(4),
});

const requestTwoFactorOtpSchema = z.object({
  enable: z.boolean(),
});

const confirmTwoFactorSchema = z.object({
  enable: z.boolean(),
  otp: z.string().min(4),
});

const updateRolePermissionsSchema = z.object({
  role: z.string().min(1),
  permissions: z.array(z.string()),
});

const bulkUpdateRolePermissionsSchema = z.object({
  updates: z.array(updateRolePermissionsSchema),
});

const updateUserRoleSchema = z.object({
  role: z.string().trim().min(2, "Enter a role").max(50),
});

const updateUserStatusSchema = z.object({
  active: z.boolean(),
});

const adminResetUserPasswordSchema = z
  .object({
    newPassword: z.string().min(8, "Password must be at least 8 characters"),
  })
  .superRefine((value, ctx) => {
    if (!STRONG_PASSWORD_REGEX.test(value.newPassword)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Password must include uppercase, lowercase, number, and symbol characters",
        path: ["newPassword"],
      });
    }
  });

const permissionOverrideItemSchema = z.object({
  permissionKey: z.enum(PERMISSION_KEYS),
  allowed: z.boolean(),
});

const updateUserPermissionOverridesSchema = z.object({
  overrides: z.array(permissionOverrideItemSchema),
});

const updateUserClassRoomsSchema = z.object({
  classRoomIds: z.array(z.number().int().positive()).max(200),
});

const createUserSchema = z
  .object({
    name: z.string().trim().min(2, "Enter the user's full name").max(120),
    email: z.string().trim().email("Enter a valid email").max(255),
    role: z.string().trim().min(2, "Enter a role").max(50),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Confirm password is required"),
    classRoomIds: z.array(z.number().int().positive()).max(200).optional().default([]),
    staffMemberId: z.number().int().positive().nullable().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.password !== value.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Passwords do not match",
        path: ["confirmPassword"],
      });
    }
    if (!STRONG_PASSWORD_REGEX.test(value.password)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Password must include uppercase, lowercase, number, and symbol characters",
        path: ["password"],
      });
    }
  });

const updateManagedUserProfileSchema = z.object({
  name: z.string().trim().min(2, "Enter the user's full name").max(120),
  email: z.string().trim().email("Enter a valid email").max(255),
  role: z.string().trim().min(2, "Enter a role").max(50),
});

function normalizeRole(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 50);
}

function isAdminRole(role: string): boolean {
  return role === "admin" || role === "super_admin";
}

function toManagedUser(row: User) {
  return {
    id: row.id,
    name: row.fullName?.trim() || row.email.split("@")[0],
    email: row.email,
    phoneNumber: row.phoneNumber ?? null,
    gender: row.gender ?? null,
    dateOfBirth: row.dateOfBirth ?? null,
    addressLine: row.addressLine ?? null,
    role: row.role,
    isActive: Boolean(row.isActive),
    isDeleted: Boolean(row.isDeleted),
    createdAt: row.createdAt,
  };
}

function effectivePermissionKeys(
  rolePermissionKeys: string[],
  overrides: Array<{ permissionKey: string; allowed: boolean }>,
): string[] {
  const set = new Set(rolePermissionKeys);
  for (const item of overrides) {
    if (item.allowed) set.add(item.permissionKey);
    else set.delete(item.permissionKey);
  }
  return [...set];
}

export function createMeAccountRouter(config: Config) {
  const r = Router();

  r.get("/account", async (req, res) => {
    const userId = req.userId!;
    try {
      const row = await loadUserEmailAndTwoFactor(userId);
      if (!row) {
        return res.status(404).json({ error: "Account not found" });
      }
      return res.json({
        email: row.email,
        twoFactorEnabled: row.twoFactorEnabled,
      });
    } catch (err) {
      console.error(err);
      return res.status(503).json({ error: "Database unavailable" });
    }
  });

  r.post("/security/password-change/request-otp", async (req, res) => {
    const parsed = requestPasswordChangeOtpSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request" });
    }
    const userId = req.userId!;
    try {
      const user = await User.findByPk(userId);
      if (!user) return res.status(404).json({ error: "Account not found" });

      const issued = await issueSecurityOtpChallenge(config, {
        userId,
        email: user.email,
        purpose: "password_change",
      });
      if (!issued.ok) {
        return res.status(503).json({ error: issued.error });
      }
      return res.json({
        message: "Verification code sent to your email.",
      });
    } catch (err) {
      console.error(err);
      return res.status(503).json({ error: "Database unavailable" });
    }
  });

  r.post("/security/password-change/confirm", async (req, res) => {
    const parsed = confirmPasswordChangeSchema.safeParse(req.body);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Invalid body";
      return res.status(400).json({ error: msg });
    }
    const { currentPassword, newPassword, otp } = parsed.data;
    const userId = req.userId!;
    try {
      const user = await User.findByPk(userId);
      if (!user) return res.status(404).json({ error: "Account not found" });

      const currentOk = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!currentOk) {
        return res.status(400).json({ error: "Current password is incorrect." });
      }

      const otpOk = await verifyAndConsumeSecurityOtpChallenge(
        userId,
        "password_change",
        otp,
      );
      if (!otpOk) {
        return res.status(400).json({
          error: "Invalid or expired verification code.",
        });
      }

      const passwordHash = await bcrypt.hash(newPassword, 12);
      await user.update({ passwordHash });
      return res.json({ message: "Password updated successfully." });
    } catch (err) {
      console.error(err);
      return res.status(503).json({ error: "Database unavailable" });
    }
  });

  r.post("/security/two-factor/request-otp", async (req, res) => {
    const parsed = requestTwoFactorOtpSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid body" });
    }
    const { enable } = parsed.data;
    const userId = req.userId!;
    try {
      const user = await User.findByPk(userId);
      if (!user) return res.status(404).json({ error: "Account not found" });

      if (enable && user.twoFactorEnabled) {
        return res.status(400).json({ error: "Two-factor authentication is already on." });
      }
      if (!enable && !user.twoFactorEnabled) {
        return res.status(400).json({ error: "Two-factor authentication is already off." });
      }

      const purpose = enable ? "two_factor_on" : "two_factor_off";
      const issued = await issueSecurityOtpChallenge(config, {
        userId,
        email: user.email,
        purpose,
      });
      if (!issued.ok) {
        return res.status(503).json({ error: issued.error });
      }
      return res.json({
        message: "Verification code sent to your email.",
      });
    } catch (err) {
      console.error(err);
      return res.status(503).json({ error: "Database unavailable" });
    }
  });

  r.post("/security/two-factor/confirm", async (req, res) => {
    const parsed = confirmTwoFactorSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid body" });
    }
    const { enable, otp } = parsed.data;
    const userId = req.userId!;
    try {
      const user = await User.findByPk(userId);
      if (!user) return res.status(404).json({ error: "Account not found" });

      if (enable && user.twoFactorEnabled) {
        return res.status(400).json({ error: "Two-factor authentication is already on." });
      }
      if (!enable && !user.twoFactorEnabled) {
        return res.status(400).json({ error: "Two-factor authentication is already off." });
      }

      const purpose = enable ? "two_factor_on" : "two_factor_off";
      const otpOk = await verifyAndConsumeSecurityOtpChallenge(
        userId,
        purpose,
        otp,
      );
      if (!otpOk) {
        return res.status(400).json({
          error: "Invalid or expired verification code.",
        });
      }

      await user.update({ twoFactorEnabled: enable });
      return res.json({
        twoFactorEnabled: enable,
        message: enable
          ? "Two-factor authentication is now on."
          : "Two-factor authentication is now off.",
      });
    } catch (err) {
      console.error(err);
      return res.status(503).json({ error: "Database unavailable" });
    }
  });

  r.get("/users", requirePermission("settings_users_roles"), async (req, res) => {
    const userId = req.userId!;
    const limit = Number.parseInt(req.query.limit as string, 10) || 100;
    const offset = Number.parseInt(req.query.offset as string, 10) || 0;

    try {

      const { count, rows: users } = await User.findAndCountAll({
        attributes: [
          "id",
          "fullName",
          "email",
          "phoneNumber",
          "gender",
          "dateOfBirth",
          "addressLine",
          "role",
          "isActive",
          "isDeleted",
          "createdAt",
        ],
        where: { isDeleted: false },
        order: [["id", "DESC"]],
        limit,
        offset,
      });

      const userIds = users.map((u) => u.id);
      const classIdsByUser = new Map<number, number[]>();
      if (userIds.length > 0) {
        const authRows = await UserClassAuthorization.findAll({
          where: { userId: { [Op.in]: userIds } },
          attributes: ["userId", "classRoomId"],
        });
        for (const ar of authRows) {
          const uid = ar.userId;
          const cid = ar.classRoomId;
          const cur = classIdsByUser.get(uid) ?? [];
          cur.push(cid);
          classIdsByUser.set(uid, cur);
        }
      }

      return res.json({
        users: users.map((row) => ({
          ...toManagedUser(row),
          classRoomIds: classIdsByUser.get(row.id) ?? [],
        })),
        total: count,
      });
    } catch (err) {
      console.error(err);
      return res.status(503).json({ error: "Database unavailable" });
    }
  });

  r.post("/users", requirePermission("settings_users_roles"), async (req, res) => {
    const userId = req.userId!;
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Invalid body";
      return res.status(400).json({ error: msg });
    }

    const { name, email, role, password, classRoomIds, staffMemberId } = parsed.data;
    const normalizedRole = normalizeRole(role);
    if (!normalizedRole) {
      return res.status(400).json({ error: "Enter a valid role" });
    }

    try {

      const normalizedEmail = email.trim().toLowerCase();
      const existing = await User.findOne({ where: { email: normalizedEmail } });
      if (existing) {
        return res.status(409).json({ error: "An account with this email already exists." });
      }

      const dedupClassRoomIds = [...new Set(classRoomIds)];

      const sequelize = User.sequelize;
      if (!sequelize) {
        return res.status(500).json({ error: "Database not initialized" });
      }

      const passwordHash = await bcrypt.hash(password, 12);
      let created: User | null = null;

      await sequelize.transaction(async (t) => {
        if (dedupClassRoomIds.length > 0) {
          const existingClasses = await ClassRoom.findAll({
            where: { id: { [Op.in]: dedupClassRoomIds } },
            attributes: ["id"],
            transaction: t,
          });
          if (existingClasses.length !== dedupClassRoomIds.length) {
            throw new Error("One or more selected classes do not exist.");
          }
        }

        created = await User.create({
          fullName: name.trim(),
          email: normalizedEmail,
          role: normalizedRole,
          passwordHash,
          isActive: true,
          isDeleted: false,
        }, { transaction: t });

        if (dedupClassRoomIds.length > 0 && created) {
          await UserClassAuthorization.bulkCreate(
            dedupClassRoomIds.map((classRoomId) => ({
              userId: created!.id,
              classRoomId,
            })),
            { transaction: t },
          );
        }
        if (staffMemberId != null && created) {
          const staff = await StaffMember.findByPk(staffMemberId, { transaction: t });
          if (!staff) {
            throw new Error("Selected staff member was not found.");
          }
          if (staff.userId != null) {
            throw new Error("Selected staff member is already linked to another account.");
          }
          await staff.update({ userId: created.id }, { transaction: t });
        }
      });

      if (!created) {
        return res.status(500).json({ error: "Failed to create user" });
      }

      return res.status(201).json({
        user: {
          ...toManagedUser(created),
          classRoomIds: dedupClassRoomIds,
        },
      });
    } catch (err) {
      if (
        err instanceof Error &&
        (err.message.includes("selected classes") || err.message.includes("staff member"))
      ) {
        return res.status(400).json({ error: err.message });
      }
      console.error(err);
      return res.status(503).json({ error: "Database unavailable" });
    }
  });

  r.put("/users/:id/class-rooms", requirePermission("settings_users_roles"), async (req, res) => {
    const actorId = req.userId!;
    const targetUserId = Number.parseInt(req.params.id, 10);
    if (!Number.isFinite(targetUserId)) {
      return res.status(400).json({ error: "Invalid user id" });
    }
    const parsed = updateUserClassRoomsSchema.safeParse(req.body);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Invalid body";
      return res.status(400).json({ error: msg });
    }
    const dedupIds = [...new Set(parsed.data.classRoomIds)];

    try {
      const actor = await User.findByPk(actorId);
      if (!actor) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const target = await User.findByPk(targetUserId);
      if (!target) {
        return res.status(404).json({ error: "User not found" });
      }
      if (target.isDeleted) {
        return res.status(400).json({ error: "Cannot update class access for deleted user" });
      }

      const sequelize = User.sequelize;
      if (!sequelize) {
        return res.status(500).json({ error: "Database not initialized" });
      }

      if (dedupIds.length > 0) {
        const existingClasses = await ClassRoom.findAll({
          where: { id: { [Op.in]: dedupIds } },
          attributes: ["id"],
        });
        if (existingClasses.length !== dedupIds.length) {
          return res.status(400).json({ error: "One or more selected classes do not exist." });
        }
      }

      await sequelize.transaction(async (t) => {
        await UserClassAuthorization.destroy({
          where: { userId: targetUserId },
          transaction: t,
        });
        if (dedupIds.length > 0) {
          await UserClassAuthorization.bulkCreate(
            dedupIds.map((classRoomId) => ({
              userId: targetUserId,
              classRoomId,
            })),
            { transaction: t },
          );
        }
      });

      await target.reload();
      return res.json({
        user: {
          ...toManagedUser(target),
          classRoomIds: dedupIds,
        },
      });
    } catch (err) {
      console.error(err);
      return res.status(503).json({ error: "Database unavailable" });
    }
  });

  r.patch("/users/:id/profile", requirePermission("settings_users_roles"), async (req, res) => {
    const userId = req.userId!;
    const targetUserId = Number.parseInt(req.params.id, 10);
    if (!Number.isFinite(targetUserId)) {
      return res.status(400).json({ error: "Invalid user id" });
    }
    const parsed = updateManagedUserProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Invalid body";
      return res.status(400).json({ error: msg });
    }

    const normalizedRole = normalizeRole(parsed.data.role);
    if (!normalizedRole || normalizedRole === "pending_assignment") {
      return res.status(400).json({ error: "Enter a valid assigned role" });
    }

    try {
      const actor = await User.findByPk(userId);
      if (!actor) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const target = await User.findByPk(targetUserId);
      if (!target) {
        return res.status(404).json({ error: "User not found" });
      }
      if (target.isDeleted) {
        return res.status(400).json({ error: "Cannot update profile for deleted user" });
      }

      const normalizedEmail = parsed.data.email.trim().toLowerCase();
      const existing = await User.findOne({ where: { email: normalizedEmail } });
      if (existing && existing.id !== target.id) {
        return res.status(409).json({ error: "An account with this email already exists." });
      }

      await target.update({
        fullName: parsed.data.name.trim(),
        email: normalizedEmail,
        role: normalizedRole,
      });
      return res.json({ user: toManagedUser(target) });
    } catch (err) {
      console.error(err);
      return res.status(503).json({ error: "Database unavailable" });
    }
  });

  r.patch("/users/:id/role", requirePermission("settings_users_roles"), async (req, res) => {
    const userId = req.userId!;
    const targetUserId = Number.parseInt(req.params.id, 10);
    if (!Number.isFinite(targetUserId)) {
      return res.status(400).json({ error: "Invalid user id" });
    }
    const parsed = updateUserRoleSchema.safeParse(req.body);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Invalid body";
      return res.status(400).json({ error: msg });
    }
    const normalizedRole = normalizeRole(parsed.data.role);
    if (!normalizedRole || normalizedRole === "pending_assignment") {
      return res.status(400).json({ error: "Enter a valid assigned role" });
    }
    try {
      const actor = await User.findByPk(userId);
      if (!actor) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const target = await User.findByPk(targetUserId);
      if (!target) {
        return res.status(404).json({ error: "User not found" });
      }
      if (target.isDeleted) {
        return res.status(400).json({ error: "Cannot update role for deleted user" });
      }
      await target.update({ role: normalizedRole });
      return res.json({
        user: toManagedUser(target),
      });
    } catch (err) {
      console.error(err);
      return res.status(503).json({ error: "Database unavailable" });
    }
  });

  r.patch("/users/:id/status", requirePermission("settings_users_roles"), async (req, res) => {
    const userId = req.userId!;
    const targetUserId = Number.parseInt(req.params.id, 10);
    if (!Number.isFinite(targetUserId)) {
      return res.status(400).json({ error: "Invalid user id" });
    }
    const parsed = updateUserStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Invalid body";
      return res.status(400).json({ error: msg });
    }
    try {
      const actor = await User.findByPk(userId);
      if (!actor) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      if (actor.id === targetUserId && !parsed.data.active) {
        return res.status(400).json({ error: "You cannot deactivate your own account." });
      }
      const target = await User.findByPk(targetUserId);
      if (!target) {
        return res.status(404).json({ error: "User not found" });
      }
      if (target.isDeleted) {
        return res.status(400).json({ error: "Cannot update status for deleted user" });
      }
      await target.update({ isActive: parsed.data.active });
      return res.json({ user: toManagedUser(target) });
    } catch (err) {
      console.error(err);
      return res.status(503).json({ error: "Database unavailable" });
    }
  });

  r.post("/users/:id/reset-password", requirePermission("settings_users_roles"), async (req, res) => {
    const userId = req.userId!;
    const targetUserId = Number.parseInt(req.params.id, 10);
    if (!Number.isFinite(targetUserId)) {
      return res.status(400).json({ error: "Invalid user id" });
    }
    const parsed = adminResetUserPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Invalid body";
      return res.status(400).json({ error: msg });
    }
    try {
      const actor = await User.findByPk(userId);
      if (!actor) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const target = await User.findByPk(targetUserId);
      if (!target) {
        return res.status(404).json({ error: "User not found" });
      }
      if (target.isDeleted) {
        return res.status(400).json({ error: "Cannot reset password for deleted user" });
      }
      const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
      await target.update({ passwordHash, isActive: true });
      return res.json({ message: "Password reset successfully.", user: toManagedUser(target) });
    } catch (err) {
      console.error(err);
      return res.status(503).json({ error: "Database unavailable" });
    }
  });

  r.delete("/users/:id", requirePermission("settings_users_roles"), async (req, res) => {
    const userId = req.userId!;
    const targetUserId = Number.parseInt(req.params.id, 10);
    if (!Number.isFinite(targetUserId)) {
      return res.status(400).json({ error: "Invalid user id" });
    }
    try {
      const actor = await User.findByPk(userId);
      if (!actor) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      if (actor.id === targetUserId) {
        return res.status(400).json({ error: "You cannot delete your own account." });
      }
      const target = await User.findByPk(targetUserId);
      if (!target) {
        return res.status(404).json({ error: "User not found" });
      }
      if (target.isDeleted) {
        return res.json({ message: "User already deleted." });
      }

      const local = target.email.split("@")[0].replace(/[^a-zA-Z0-9._-]/g, "").slice(0, 24) || "user";
      const tombstoneEmail = `${local}.deleted.${target.id}.${Date.now()}@archived.local`;
      await target.update({
        isDeleted: true,
        isActive: false,
        role: "deleted_user",
        email: tombstoneEmail,
        fullName: target.fullName ? `[DELETED] ${target.fullName}`.slice(0, 120) : "[DELETED]",
      });
      return res.json({ message: "User deleted successfully." });
    } catch (err) {
      console.error(err);
      return res.status(503).json({ error: "Database unavailable" });
    }
  });

  r.get("/users/:id/permissions", requirePermission("settings_users_roles"), async (req, res) => {
    const userId = req.userId!;
    const targetUserId = Number.parseInt(req.params.id, 10);
    if (!Number.isFinite(targetUserId)) {
      return res.status(400).json({ error: "Invalid user id" });
    }
    try {

      const target = await User.findByPk(targetUserId);
      if (!target) {
        return res.status(404).json({ error: "User not found" });
      }

      const roleRows = await RolePermission.findAll({
        where: { role: target.role },
        attributes: ["permissionKey"],
      });
      const rolePermissions = roleRows.map((row) => row.permissionKey);
      const overrideRows = await UserPermissionOverride.findAll({
        where: { userId: targetUserId },
        attributes: ["permissionKey", "allowed"],
      });
      const overrides = overrideRows.map((row) => ({
        permissionKey: row.permissionKey,
        allowed: Boolean(row.allowed),
      }));
      const effective = effectivePermissionKeys(rolePermissions, overrides);

      return res.json({
        userId: target.id,
        userRole: target.role,
        availableKeys: PERMISSION_KEYS,
        rolePermissions,
        overrides,
        effectivePermissions: effective,
      });
    } catch (err) {
      console.error(err);
      return res.status(503).json({ error: "Database unavailable" });
    }
  });

  r.put("/users/:id/permissions", requirePermission("settings_users_roles"), async (req, res) => {
    const userId = req.userId!;
    const targetUserId = Number.parseInt(req.params.id, 10);
    if (!Number.isFinite(targetUserId)) {
      return res.status(400).json({ error: "Invalid user id" });
    }
    const parsed = updateUserPermissionOverridesSchema.safeParse(req.body);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Invalid body";
      return res.status(400).json({ error: msg });
    }
    try {
      const target = await User.findByPk(targetUserId);
      if (!target) {
        return res.status(404).json({ error: "User not found" });
      }

      const sequelize = UserPermissionOverride.sequelize;
      if (!sequelize) {
        return res.status(500).json({ error: "Database not initialized" });
      }

      const dedup = new Map<string, boolean>();
      for (const item of parsed.data.overrides) {
        dedup.set(item.permissionKey, item.allowed);
      }
      const rows = [...dedup.entries()].map(([permissionKey, allowed]) => ({
        userId: targetUserId,
        permissionKey,
        allowed,
      }));

      await sequelize.transaction(async (t) => {
        await UserPermissionOverride.destroy({ where: { userId: targetUserId }, transaction: t });
        if (rows.length > 0) {
          await UserPermissionOverride.bulkCreate(rows, { transaction: t });
        }
      });

      return res.json({ message: "User permission overrides updated." });
    } catch (err) {
      console.error(err);
      return res.status(503).json({ error: "Database unavailable" });
    }
  });

  r.get("/role-permissions", requirePermission("settings_users_roles"), async (req, res) => {
    const userId = req.userId!;
    try {
      const user = await User.findByPk(userId);
      if (!user || !isAdminRole(user.role)) {
        return res.status(403).json({ error: "Access denied" });
      }

      const all = await RolePermission.findAll();
      return res.json({
        permissions: all,
        availableKeys: PERMISSION_KEYS,
      });
    } catch (err) {
      console.error(err);
      return res.status(503).json({ error: "Database unavailable" });
    }
  });

  r.post("/role-permissions", requirePermission("settings_users_roles"), async (req, res) => {
    const userId = req.userId!;
    const parsed = updateRolePermissionsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid body" });
    }

    const { role, permissions } = parsed.data;

    try {

      // Bulk update: delete all for this role and re-insert, atomically so
      // a failure mid-way never leaves the role with zero permissions.
      const sequelize = RolePermission.sequelize;
      if (!sequelize) {
        return res.status(500).json({ error: "Database not initialized" });
      }
      const toCreate = permissions.map((pk) => ({
        role,
        permissionKey: pk,
      }));
      await sequelize.transaction(async (t) => {
        await RolePermission.destroy({ where: { role }, transaction: t });
        if (toCreate.length > 0) {
          await RolePermission.bulkCreate(toCreate, { transaction: t });
        }
      });

      return res.json({ message: `Permissions updated for ${role}` });
    } catch (err) {
      console.error(err);
      return res.status(503).json({ error: "Database unavailable" });
    }
  });

  r.post("/role-permissions/bulk", requirePermission("settings_users_roles"), async (req, res) => {
    const userId = req.userId!;
    const parsed = bulkUpdateRolePermissionsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid body" });
    }

    try {

      const sequelize = RolePermission.sequelize;
      if (!sequelize) {
        return res.status(500).json({ error: "Database not initialized" });
      }

      await sequelize.transaction(async (t) => {
        for (const update of parsed.data.updates) {
          const { role, permissions } = update;
          await RolePermission.destroy({ where: { role }, transaction: t });
          if (permissions.length > 0) {
            const toCreate = permissions.map((pk) => ({
              role,
              permissionKey: pk,
            }));
            await RolePermission.bulkCreate(toCreate, { transaction: t });
          }
        }
      });

      return res.json({ message: "Bulk permissions updated successfully" });
    } catch (err) {
      console.error(err);
      return res.status(503).json({ error: "Database unavailable" });
    }
  });

  return r;
}
