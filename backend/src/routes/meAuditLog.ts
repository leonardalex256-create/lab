/**
 * Audit Log viewer API (Section G3).
 * GET  /api/me/settings/audit-log  — paginated, filtered
 */
import { Router } from "express";
import { dayRangeUtc } from "../lib/dateBounds.js";

export function createMeAuditLogRouter() {
  const r = Router();

  r.get("/audit-log", async (req, res) => {
    try {
      const sequelize = (await import("../models/index.js")).User.sequelize;
      if (!sequelize) return res.status(500).json({ error: "DB not initialized" });

      // Only SUPER_ADMIN / ADMIN can view. `userRole` is declared on the
      // Express Request type via backend/src/types/express.d.ts, so the
      // previous `(req as { userRole?: string })` cast was redundant; using
      // the typed property catches future middleware contract changes.
      const role = req.userRole ?? "";
      if (role !== "super_admin" && role !== "admin") {
        return res.status(403).json({ error: "Access denied" });
      }

      const page = Math.max(1, Number(req.query.page ?? 1));
      const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 50)));
      const offset = (page - 1) * limit;

      const dateFrom = (req.query.date_from as string) ?? "";
      const dateTo = (req.query.date_to as string) ?? "";
      const userId = req.query.user_id ? Number(req.query.user_id) : null;
      const action = (req.query.action as string) ?? "";
      const severity = (req.query.severity as string) ?? "";
      const channel = (req.query.channel as string) ?? "";
      const search = (req.query.search as string) ?? "";
      const sessionId = (req.query.session_id as string) ?? "";

      let where = "WHERE 1=1";
      const replacements: Record<string, unknown> = { limit, offset };

      if (dateFrom && /^\d{4}-\d{2}-\d{2}$/.test(dateFrom)) {
        where += " AND al.created_at >= :dateFrom";
        replacements["dateFrom"] = dayRangeUtc(dateFrom)[0];
      }
      if (dateTo && /^\d{4}-\d{2}-\d{2}$/.test(dateTo)) {
        where += " AND al.created_at <= :dateTo";
        replacements["dateTo"] = dayRangeUtc(dateTo)[1];
      }
      if (userId) { where += " AND al.user_id = :userId"; replacements["userId"] = userId; }
      if (action) { where += " AND al.action = :action"; replacements["action"] = action; }
      if (severity) { where += " AND al.severity = :severity"; replacements["severity"] = severity; }
      if (channel) { where += " AND al.channel = :channel"; replacements["channel"] = channel; }
      if (sessionId) { where += " AND al.session_id = :sessionId"; replacements["sessionId"] = sessionId; }
      if (search) {
        where += " AND (al.entity_label LIKE :search OR al.action LIKE :search OR u.email LIKE :search)";
        replacements["search"] = `%${search}%`;
      }

      const [rows] = await sequelize.query(
        `SELECT
           al.id, al.created_at, al.action, al.entity, al.entity_id, al.entity_label,
           al.severity, al.channel, al.session_id, al.ip_address, al.duration_ms,
           al.old_value, al.new_value, al.metadata,
           al.user_id, al.user_role,
           COALESCE(u.email, 'System') AS user_email,
           COALESCE(u.full_name, u.email, 'System') AS user_display
         FROM audit_logs al
         LEFT JOIN users u ON u.id = al.user_id
         ${where}
         ORDER BY al.created_at DESC
         LIMIT :limit OFFSET :offset`,
        { replacements },
      );

      const [[{ total }]] = await sequelize.query(
        `SELECT COUNT(*) AS total FROM audit_logs al LEFT JOIN users u ON u.id = al.user_id ${where}`,
        { replacements: { ...replacements, limit: 999999, offset: 0 } },
      ) as [[{ total: number }]];

      // Distinct action types for filter dropdown
      const [actions] = await sequelize.query(
        "SELECT DISTINCT action FROM audit_logs ORDER BY action",
        {},
      );

      return res.json({
        success: true,
        data: rows,
        meta: {
          page,
          limit,
          total: Number(total),
          pages: Math.ceil(Number(total) / limit),
        },
        filters: { actions },
      });
    } catch (err) {
      console.error("[audit-log]", err);
      return res.status(500).json({ error: "Failed to load audit log" });
    }
  });

  return r;
}
