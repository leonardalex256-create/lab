import type { Sequelize } from "sequelize";

/** MySQL ER_DUP_FIELDNAME — column already exists */
const MYSQL_DUP_FIELDNAME = 1060;

async function addColumnIfMissing(sequelize: Sequelize, sql: string, label: string): Promise<void> {
  try {
    await sequelize.query(sql);
    console.info(`[db] Added column ${label}`);
  } catch (e: unknown) {
    const errno = (e as { parent?: { errno?: number } })?.parent?.errno;
    if (errno !== MYSQL_DUP_FIELDNAME) throw e;
  }
}

/**
 * Finance columns needed for historical payment allocation.
 * Safe to run on every startup (idempotent).
 */
export async function ensureFinanceHistoricalSchema(sequelize: Sequelize): Promise<void> {
  if (sequelize.getDialect() !== "mysql") return;

  await addColumnIfMissing(
    sequelize,
    "ALTER TABLE student_fee_payments ADD COLUMN allocates_prior_terms TINYINT(1) NOT NULL DEFAULT 0",
    "student_fee_payments.allocates_prior_terms",
  );
  await addColumnIfMissing(
    sequelize,
    "ALTER TABLE student_fee_payments ADD COLUMN note VARCHAR(200) NULL",
    "student_fee_payments.note",
  );
  await addColumnIfMissing(
    sequelize,
    "ALTER TABLE student_fee_payments ADD COLUMN payment_date DATE NULL",
    "student_fee_payments.payment_date",
  );
}

