import { Router } from "express";
import { z } from "zod";
import { appendDebugNdjson } from "../debugSessionLog.js";
import { User, SchoolSetting } from "../models/index.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { scheduleFeeComplianceCheckAndNotify } from "../services/feeAssignmentCompliance.js";

const updateGeneralSettingsSchema = z.object({
  settings: z.record(z.string()),
});

export function createMeSettingsRouter() {
  const r = Router();

  if (process.env.NODE_ENV !== "production") {
    r.post("/debug-client-log", (req, res) => {
      try {
        const body = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
        appendDebugNdjson({ source: "browser", sessionId: "d76cee", ...body });
      } catch {
        /* ignore */
      }
      res.status(204).end();
    });
  }

  r.get("/general", async (req, res) => {
    // #region agent log
    appendDebugNdjson({
      sessionId: "d76cee",
      hypothesisId: "H4",
      location: "meSettings.ts:GET:entry",
      message: "settings_general_get_entry",
      data: { userId: typeof req.userId === "number" ? req.userId : null },
    });
    // #endregion
    try {
      const allSettings = await SchoolSetting.findAll();
      const settingsMap: Record<string, string> = {};
      for (const row of allSettings) {
        if (row.settingValue !== null) {
          settingsMap[row.settingKey] = row.settingValue;
        }
      }
      // #region agent log
      appendDebugNdjson({
        sessionId: "d76cee",
        hypothesisId: "H1",
        location: "meSettings.ts:GET:success",
        message: "settings_general_get_ok",
        data: { rowCount: allSettings.length, keyCount: Object.keys(settingsMap).length },
      });
      // #endregion
      return res.json(settingsMap);
    } catch (err) {
      console.error(err);
      // #region agent log
      appendDebugNdjson({
        sessionId: "d76cee",
        hypothesisId: "H1",
        location: "meSettings.ts:GET:catch",
        message: "settings_general_get_db_error",
        data: {
          errName: err instanceof Error ? err.name : "unknown",
          errMsg: err instanceof Error ? err.message.slice(0, 240) : String(err).slice(0, 240),
        },
      });
      // #endregion
      return res.status(503).json({ error: "Database unavailable" });
    }
  });

  r.post("/general", requirePermission("settings_general"), async (req, res) => {
    const userId = req.userId!;

    const parsed = updateGeneralSettingsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid body" });
    }

    const { settings } = parsed.data;

    try {
      const sequelize = SchoolSetting.sequelize;
      if (!sequelize) {
        return res.status(500).json({ error: "Database not initialized" });
      }
      await sequelize.transaction(async (t) => {
        for (const [key, value] of Object.entries(settings)) {
          const existing = await SchoolSetting.findByPk(key, { transaction: t });
          if (existing) {
            await existing.update({ settingValue: value }, { transaction: t });
          } else {
            await SchoolSetting.create(
              { settingKey: key, settingValue: value },
              { transaction: t },
            );
          }
        }
      });

      const allSettings = await SchoolSetting.findAll();
      const settingsMap: Record<string, string> = {};
      for (const row of allSettings) {
        if (row.settingValue !== null) {
          settingsMap[row.settingKey] = row.settingValue;
        }
      }

      if (Object.prototype.hasOwnProperty.call(settings, "current_term")) {
        scheduleFeeComplianceCheckAndNotify();
      }

      return res.json({ message: "Settings updated successfully", settings: settingsMap });
    } catch (err) {
      console.error(err);
      return res.status(503).json({ error: "Database unavailable" });
    }
  });

  return r;
}
