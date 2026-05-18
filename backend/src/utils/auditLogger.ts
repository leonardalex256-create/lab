/**
 * Central audit logger (Section G2).
 * All write operations that must be audited call writeAuditLog().
 */
import type { Sequelize } from "sequelize";

export interface AuditPayload {
  sequelize: Sequelize;
  userId?: number | null;
  userRole?: string | null;
  action: string;
  entity: string;
  entityId?: number | null;
  entityLabel?: string | null;
  severity?: "info" | "warning" | "critical";
  channel?: "web" | "api" | "import" | "system";
  sessionId?: string | null;
  ipAddress?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  metadata?: unknown;
  durationMs?: number | null;
}

export async function writeAuditLog(payload: AuditPayload): Promise<void> {
  const {
    sequelize,
    userId = null,
    userRole = null,
    action,
    entity,
    entityId = null,
    entityLabel = null,
    severity = "info",
    channel = "web",
    sessionId = null,
    ipAddress = null,
    oldValue,
    newValue,
    metadata,
    durationMs = null,
  } = payload;

  try {
    await sequelize.query(
      `INSERT INTO audit_logs
        (user_id, user_role, action, entity, entity_id, entity_label,
         severity, channel, session_id, ip_address,
         old_value, new_value, metadata, duration_ms, created_at)
       VALUES
        (:userId, :userRole, :action, :entity, :entityId, :entityLabel,
         :severity, :channel, :sessionId, :ipAddress,
         :oldValue, :newValue, :metadata, :durationMs, NOW())`,
      {
        replacements: {
          userId,
          userRole,
          action,
          entity,
          entityId,
          entityLabel,
          severity,
          channel,
          sessionId,
          ipAddress,
          oldValue: oldValue !== undefined ? JSON.stringify(oldValue) : null,
          newValue: newValue !== undefined ? JSON.stringify(newValue) : null,
          metadata: metadata !== undefined ? JSON.stringify(metadata) : null,
          durationMs,
        },
      },
    );
  } catch (err) {
    // Never let audit failures crash the main request
    console.error("[audit] Failed to write audit log:", err);
  }
}
