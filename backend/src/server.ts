import { loadConfig } from "./config.js";
import { appendDebugNdjson } from "./debugSessionLog.js";
import { ensureSecuritySchema } from "./db/ensureSecuritySchema.js";
import { ensureDashboardSchema } from "./db/ensureDashboardSchema.js";
import { ensureAddendumSchema } from "./db/ensureAddendumSchema.js";
import { ensureFinanceHistoricalSchema } from "./db/ensureFinanceHistoricalSchema.js";
import { setupDatabase } from "./models/index.js";
import { buildApp } from "./app.js";

const config = loadConfig();
const sequelize = setupDatabase(config);

try {
  await sequelize.authenticate();
  await ensureSecuritySchema(sequelize);
  await ensureDashboardSchema(sequelize);
  await ensureFinanceHistoricalSchema(sequelize);
  await ensureAddendumSchema(sequelize);
} catch (err) {
  appendDebugNdjson({
    sessionId: "d76cee",
    hypothesisId: "H1",
    location: "server.ts:boot:mysql",
    message: "sequelize_boot_failed",
    data: {
      dbHost: config.DB_HOST,
      dbPort: config.DB_PORT,
      errName: err instanceof Error ? err.name : "unknown",
      errMsg: err instanceof Error ? err.message.slice(0, 400) : String(err).slice(0, 400),
    },
  });
  console.error(
    `[fatal] Cannot connect to MySQL at ${config.DB_HOST}:${config.DB_PORT} (database "${config.DB_NAME}").\n` +
      "  Start MySQL (or MariaDB) locally, or set DB_HOST / DB_PORT / DB_USER / DB_PASSWORD in backend/.env.\n" +
      "  Until the database is reachable, the API will not start and the frontend will show settings/network errors.",
    err,
  );
  process.exit(1);
}

if (config.NODE_ENV === "development") {
  const skipSync =
    process.env.DB_SYNC_ON_START === "false" ||
    process.env.DB_SYNC_ON_START === "0";
  if (!skipSync) {
    console.info(
      "[db] Development — syncing MySQL schema from Sequelize models (alter: true)…",
    );
    try {
      await sequelize.sync({ alter: true });
      console.info("[db] Schema sync finished.");
    } catch (err) {
      console.error(
        "[db] sequelize.sync({ alter: true }) failed — API will still start.\n" +
          "  Fix: run SQL from backend/db/schema.sql, or cd backend && npm run db:sync after fixing indexes.\n" +
          "  To skip sync: set DB_SYNC_ON_START=false",
        err,
      );
    }
  } else {
    console.info("[db] Schema sync skipped (DB_SYNC_ON_START=false).");
  }
}

const app = buildApp(config);

const server = app.listen(config.PORT, config.HOST, () => {
  console.log(
    `API (Express + Sequelize) on http://${config.HOST}:${config.PORT} · MySQL ${config.DB_NAME} @ ${config.DB_HOST}:${config.DB_PORT}`,
  );
});

async function shutdown() {
  await sequelize.close();
  server.close(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
