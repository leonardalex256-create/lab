import type { RequestHandler } from "express";
import { User, RolePermission, UserPermissionOverride } from "../models/index.js";
import type { PermissionKey } from "../constants/permissions.js";
import { PERMISSION_KEYS } from "../constants/permissions.js";

/**
 * Computes effective permissions by combining role permissions with user overrides
 */
function effectivePermissions(
  rolePermissions: string[],
  overrides: Array<{ permissionKey: string; allowed: boolean }>,
): string[] {
  const set = new Set(rolePermissions);
  for (const row of overrides) {
    if (row.allowed) {
      set.add(row.permissionKey);
    } else {
      set.delete(row.permissionKey);
    }
  }
  return [...set];
}

/**
 * Middleware factory that returns a middleware checking for a specific permission.
 * Requires requireAuth to be called first to set req.userId
 *
 * @param requiredPermission - The permission key to check
 * @returns Express middleware
 *
 * @example
 * router.post("/settings", requireAuth(config), requirePermission("settings_general"), handler)
 */
export function requirePermission(requiredPermission: PermissionKey): RequestHandler {
  return async (req, res, next) => {
    const userId = (req as any).userId as number | undefined;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      // Validate the permission key exists
      if (!PERMISSION_KEYS.includes(requiredPermission as any)) {
        console.error(`Invalid permission key requested: ${requiredPermission}`);
        return res.status(500).json({ error: "Internal server error" });
      }

      // Load user role
      const user = await User.findByPk(userId, {
        attributes: ["role"],
      });

      if (!user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Admins bypass all permission checks
      if (user.role === "admin" || user.role === "super_admin") {
        return next();
      }

      // Load role permissions
      const rolePerms = await RolePermission.findAll({
        where: { role: user.role },
        attributes: ["permissionKey"],
      });
      const rolePermissions = rolePerms.map((p) => p.permissionKey);

      // Load user permission overrides
      const overrides = await UserPermissionOverride.findAll({
        where: { userId },
        attributes: ["permissionKey", "allowed"],
      });

      // Compute effective permissions
      const permissions = effectivePermissions(rolePermissions, overrides);

      // Check if user has required permission
      if (!permissions.includes(requiredPermission)) {
        return res.status(403).json({
          error: "Forbidden",
          message: `Missing permission: ${requiredPermission}`,
        });
      }

      return next();
    } catch (error) {
      console.error("Permission check error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  };
}
