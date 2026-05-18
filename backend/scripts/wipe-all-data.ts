import "./loadBackendEnv.js";
import { loadConfig } from "../src/config.js";
import { setupDatabase } from "../src/models/index.js";

/**
 * Deletes every row in every base table in the configured MySQL database.
 * Opt-in only: set ALLOW_WIPE_ALL_DATA=1. Production additionally requires
 * ALLOW_PRODUCTION_DATA_WIPE=1 (defense in depth).
 *
 * After running: restore login with `npm run seed:admin` and optionally
 * `npm run seed:permissions`.
 */
async function main() {
  if (process.env.ALLOW_WIPE_ALL_DATA !== "1") {
    console.error(
      "Refusing to wipe data. Set ALLOW_WIPE_ALL_DATA=1 to confirm.\n" +
        "  Example (PowerShell): $env:ALLOW_WIPE_ALL_DATA='1'; npm run db:wipe",
    );
    process.exit(1);
  }

  const config = loadConfig();

  if (config.NODE_ENV === "production" && process.env.ALLOW_PRODUCTION_DATA_WIPE !== "1") {
    console.error(
      "Refusing to wipe production data.\n" +
        "  Set ALLOW_PRODUCTION_DATA_WIPE=1 only if you intend to erase this database.",
    );
    process.exit(1);
  }

  const sequelize = setupDatabase(config);
  await sequelize.authenticate();

  const dbName = config.DB_NAME;
  console.warn(`[db:wipe] Truncating ALL tables in database "${dbName}" @ ${config.DB_HOST}:${config.DB_PORT} …`);

  const [rows] = await sequelize.query<{ TABLE_NAME: string }>(
    `SELECT TABLE_NAME AS TABLE_NAME FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = :db AND TABLE_TYPE = 'BASE TABLE'`,
    { replacements: { db: dbName } },
  );

  const tables = (rows as { TABLE_NAME: string }[]).map((r) => r.TABLE_NAME).filter(Boolean);
  if (tables.length === 0) {
    console.info("[db:wipe] No tables found — nothing to do.");
    await sequelize.close();
    return;
  }

  await sequelize.query("SET FOREIGN_KEY_CHECKS = 0");
  try {
    for (const name of tables) {
      await sequelize.query(`TRUNCATE TABLE \`${name.replace(/`/g, "``")}\``);
      console.info(`  truncated ${name}`);
    }
  } finally {
    await sequelize.query("SET FOREIGN_KEY_CHECKS = 1");
  }

  console.info(`[db:wipe] Done (${tables.length} tables). Run seed:admin (and seed:permissions) if you need a fresh login.`);
  await sequelize.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
