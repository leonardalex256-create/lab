import type { Sequelize } from "sequelize";

/** MySQL ER_DUP_FIELDNAME — column already exists */
const MYSQL_DUP_FIELDNAME = 1060;
/** MySQL ER_CANT_DROP_FIELD_OR_KEY — column does not exist */
const MYSQL_CANT_DROP = 1091;

async function addColumnIfMissing(
  sequelize: Sequelize,
  sql: string,
  label: string,
): Promise<void> {
  try {
    await sequelize.query(sql);
    console.info(`[addendum] Added column ${label}`);
  } catch (e: unknown) {
    const errno = (e as { parent?: { errno?: number } })?.parent?.errno;
    if (errno !== MYSQL_DUP_FIELDNAME) throw e;
  }
}

async function addIndexIfMissing(
  sequelize: Sequelize,
  sql: string,
  label: string,
): Promise<void> {
  try {
    await sequelize.query(sql);
    console.info(`[addendum] Added index ${label}`);
  } catch (e: unknown) {
    const errno = (e as { parent?: { errno?: number } })?.parent?.errno;
    // 1061 = ER_DUP_KEYNAME
    if (errno !== 1061 && errno !== MYSQL_CANT_DROP) throw e;
  }
}

/**
 * Addendum schema additions — safe to run on every startup (idempotent).
 * Contains NEW tables and column extensions introduced by the addendum prompt.
 */
export async function ensureAddendumSchema(sequelize: Sequelize): Promise<void> {
  if (sequelize.getDialect() !== "mysql") return;

  // ─────────────────────────────────────────────────────────────────────────
  // A) Extended audit_logs columns (Section G1)
  // ─────────────────────────────────────────────────────────────────────────
  await addColumnIfMissing(
    sequelize,
    "ALTER TABLE audit_logs ADD COLUMN session_id VARCHAR(64) NULL",
    "audit_logs.session_id",
  );
  await addColumnIfMissing(
    sequelize,
    "ALTER TABLE audit_logs ADD COLUMN entity_label VARCHAR(255) NULL",
    "audit_logs.entity_label",
  );
  await addColumnIfMissing(
    sequelize,
    "ALTER TABLE audit_logs ADD COLUMN severity ENUM('info','warning','critical') NOT NULL DEFAULT 'info'",
    "audit_logs.severity",
  );
  await addColumnIfMissing(
    sequelize,
    "ALTER TABLE audit_logs ADD COLUMN channel ENUM('web','api','import','system') NOT NULL DEFAULT 'web'",
    "audit_logs.channel",
  );
  await addColumnIfMissing(
    sequelize,
    "ALTER TABLE audit_logs ADD COLUMN duration_ms INT UNSIGNED NULL",
    "audit_logs.duration_ms",
  );
  await addColumnIfMissing(
    sequelize,
    "ALTER TABLE audit_logs ADD COLUMN old_value JSON NULL",
    "audit_logs.old_value",
  );
  await addColumnIfMissing(
    sequelize,
    "ALTER TABLE audit_logs ADD COLUMN new_value JSON NULL",
    "audit_logs.new_value",
  );
  await addColumnIfMissing(
    sequelize,
    "ALTER TABLE audit_logs ADD COLUMN metadata JSON NULL",
    "audit_logs.metadata",
  );
  await addColumnIfMissing(
    sequelize,
    "ALTER TABLE audit_logs ADD COLUMN ip_address VARCHAR(45) NULL",
    "audit_logs.ip_address",
  );
  await addColumnIfMissing(
    sequelize,
    "ALTER TABLE audit_logs ADD COLUMN user_role VARCHAR(50) NULL",
    "audit_logs.user_role",
  );
  await addIndexIfMissing(
    sequelize,
    "ALTER TABLE audit_logs ADD INDEX idx_audit_logs_severity (severity)",
    "audit_logs.idx_audit_logs_severity",
  );
  await addIndexIfMissing(
    sequelize,
    "ALTER TABLE audit_logs ADD INDEX idx_audit_logs_channel (channel)",
    "audit_logs.idx_audit_logs_channel",
  );
  await addIndexIfMissing(
    sequelize,
    "ALTER TABLE audit_logs ADD INDEX idx_audit_logs_created_at (created_at)",
    "audit_logs.idx_audit_logs_created_at",
  );

  // ─────────────────────────────────────────────────────────────────────────
  // A2) Academics — subject short forms (used by results-entry pivot table)
  // ─────────────────────────────────────────────────────────────────────────
  await addColumnIfMissing(
    sequelize,
    "ALTER TABLE academic_subject_assignments ADD COLUMN short_form VARCHAR(8) NOT NULL DEFAULT ''",
    "academic_subject_assignments.short_form",
  );

  // ─────────────────────────────────────────────────────────────────────────
  // B) Password reset tokens (Section C1)
  // ─────────────────────────────────────────────────────────────────────────
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id INT UNSIGNED NOT NULL,
      token_hash VARCHAR(64) NOT NULL COMMENT 'sha256 hex of raw token',
      expires_at DATETIME NOT NULL,
      used_at DATETIME NULL,
      ip_requested_from VARCHAR(45) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_prt_user (user_id),
      KEY idx_prt_token (token_hash),
      KEY idx_prt_expires (expires_at),
      CONSTRAINT fk_prt_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // ─────────────────────────────────────────────────────────────────────────
  // C) Welcome tokens for new-user set-password links (Section C1)
  // ─────────────────────────────────────────────────────────────────────────
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS welcome_tokens (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id INT UNSIGNED NOT NULL,
      token_hash VARCHAR(64) NOT NULL,
      expires_at DATETIME NOT NULL,
      used_at DATETIME NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_wt_user (user_id),
      KEY idx_wt_token (token_hash),
      CONSTRAINT fk_wt_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Add must_change_password to users
  await addColumnIfMissing(
    sequelize,
    "ALTER TABLE users ADD COLUMN must_change_password TINYINT(1) NOT NULL DEFAULT 0",
    "users.must_change_password",
  );
  await addColumnIfMissing(
    sequelize,
    "ALTER TABLE users ADD COLUMN last_login_at DATETIME NULL",
    "users.last_login_at",
  );
  await addColumnIfMissing(
    sequelize,
    "ALTER TABLE users ADD COLUMN failed_login_attempts TINYINT UNSIGNED NOT NULL DEFAULT 0",
    "users.failed_login_attempts",
  );
  await addColumnIfMissing(
    sequelize,
    "ALTER TABLE users ADD COLUMN locked_until DATETIME NULL",
    "users.locked_until",
  );

  // ─────────────────────────────────────────────────────────────────────────
  // D) Student documents table (Section H3)
  // ─────────────────────────────────────────────────────────────────────────
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS student_documents (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      student_id INT UNSIGNED NOT NULL,
      doc_type VARCHAR(40) NOT NULL COMMENT 'birth_certificate|transfer_letter|medical_record|other',
      file_url VARCHAR(512) NOT NULL,
      public_id VARCHAR(255) NULL COMMENT 'Cloudinary public_id or local filename key',
      file_name_original VARCHAR(255) NULL,
      mime_type VARCHAR(100) NULL,
      file_size_bytes INT UNSIGNED NULL,
      uploaded_by INT UNSIGNED NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_sdoc_student (student_id),
      KEY idx_sdoc_type (doc_type),
      CONSTRAINT fk_sdoc_student FOREIGN KEY (student_id) REFERENCES students (id) ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT fk_sdoc_uploader FOREIGN KEY (uploaded_by) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // ─────────────────────────────────────────────────────────────────────────
  // E) Attendance enhancements — status column, recorded_by, class_room_id (Section A3)
  // ─────────────────────────────────────────────────────────────────────────
  try {
    // Some deploys have a wide attendance_records row; DYNAMIC row format pushes large varlen columns off-page.
    await sequelize.query("ALTER TABLE attendance_records ROW_FORMAT=DYNAMIC");
  } catch {
    // ignore
  }
  await addColumnIfMissing(
    sequelize,
    "ALTER TABLE attendance_records ADD COLUMN status ENUM('present','absent','late','excused') NOT NULL DEFAULT 'present'",
    "attendance_records.status",
  );
  await addColumnIfMissing(
    sequelize,
    "ALTER TABLE attendance_records ADD COLUMN class_room_id INT UNSIGNED NULL",
    "attendance_records.class_room_id",
  );
  await addColumnIfMissing(
    sequelize,
    "ALTER TABLE attendance_records ADD COLUMN recorded_by INT UNSIGNED NULL",
    "attendance_records.recorded_by",
  );
  await addColumnIfMissing(
    sequelize,
    "ALTER TABLE attendance_records ADD COLUMN recorded_at DATETIME NULL",
    "attendance_records.recorded_at",
  );
  await addIndexIfMissing(
    sequelize,
    "ALTER TABLE attendance_records ADD INDEX idx_ar_class_date (class_room_id, record_date)",
    "attendance_records.idx_ar_class_date",
  );

  // ─────────────────────────────────────────────────────────────────────────
  // F) Fee automation rules (Section I1)
  // ─────────────────────────────────────────────────────────────────────────
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS fee_automation_rules (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      name VARCHAR(120) NOT NULL,
      description TEXT NULL,
      rule_type VARCHAR(10) NOT NULL COMMENT 'discount|penalty',
      condition_type VARCHAR(20) NOT NULL COMMENT 'sibling|scholarship|staff_child|manual|late_payment',
      value_type VARCHAR(8) NOT NULL COMMENT 'flat|percent',
      value DECIMAL(12,4) NOT NULL DEFAULT 0,
      grace_period_days TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'For penalty rules only',
      stacks_with_other_discounts TINYINT(1) NOT NULL DEFAULT 1,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      priority SMALLINT UNSIGNED NOT NULL DEFAULT 100,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_far_type_active (rule_type, is_active),
      KEY idx_far_priority (priority)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // ─────────────────────────────────────────────────────────────────────────
  // G) Fee invoice discounts applied (Section I4)
  // ─────────────────────────────────────────────────────────────────────────
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS fee_invoice_discounts (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      invoice_id INT UNSIGNED NOT NULL COMMENT 'FK to student_fee_assignments.id',
      rule_id INT UNSIGNED NULL COMMENT 'FK to fee_automation_rules; NULL = manual',
      discount_type VARCHAR(40) NOT NULL,
      amount_applied DECIMAL(12,2) NOT NULL,
      applied_by VARCHAR(40) NOT NULL DEFAULT 'system' COMMENT 'user_id or system',
      applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      notes TEXT NULL,
      PRIMARY KEY (id),
      KEY idx_fid_invoice (invoice_id),
      KEY idx_fid_rule (rule_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // ─────────────────────────────────────────────────────────────────────────
  // H) Fee invoice penalties applied (Section I4)
  // ─────────────────────────────────────────────────────────────────────────
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS fee_invoice_penalties (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      invoice_id INT UNSIGNED NOT NULL,
      rule_id INT UNSIGNED NULL,
      amount DECIMAL(12,2) NOT NULL,
      applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      period VARCHAR(7) NOT NULL COMMENT 'YYYY-MM for idempotency',
      deleted_at DATETIME NULL COMMENT 'Soft delete when waived',
      waived_by INT UNSIGNED NULL,
      waive_reason TEXT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uq_fip_invoice_period (invoice_id, period),
      KEY idx_fip_rule (rule_id),
      KEY idx_fip_deleted (deleted_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // ─────────────────────────────────────────────────────────────────────────
  // I) Contact logs for parents (Section A1)
  // ─────────────────────────────────────────────────────────────────────────
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS parent_contact_logs (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      parent_id INT UNSIGNED NOT NULL COMMENT 'FK to students table parent_full_name workaround or future parents table',
      logged_by INT UNSIGNED NULL,
      note TEXT NOT NULL,
      contact_type VARCHAR(20) NOT NULL DEFAULT 'note' COMMENT 'note|call|meeting',
      logged_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_pcl_parent (parent_id),
      CONSTRAINT fk_pcl_logger FOREIGN KEY (logged_by) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // ─────────────────────────────────────────────────────────────────────────
  // J) Notification settings per event (Section A6 - /settings/notifications)
  // ─────────────────────────────────────────────────────────────────────────
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS notification_settings (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      event_type VARCHAR(60) NOT NULL,
      channel VARCHAR(20) NOT NULL COMMENT 'email|in_app',
      is_enabled TINYINT(1) NOT NULL DEFAULT 1,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_ns_event_channel (event_type, channel)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // ─────────────────────────────────────────────────────────────────────────
  // K) Timetable slots (Section A2 - /classes/[id] Tab 3)
  // ─────────────────────────────────────────────────────────────────────────
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS timetable_slots (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      class_room_id INT UNSIGNED NOT NULL,
      academic_year VARCHAR(4) NOT NULL,
      term VARCHAR(20) NOT NULL,
      day_of_week TINYINT UNSIGNED NOT NULL COMMENT '1=Mon..7=Sun',
      period_number TINYINT UNSIGNED NOT NULL,
      subject_name VARCHAR(120) NULL,
      teacher_name VARCHAR(120) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_ts_class_year_term_day_period (class_room_id, academic_year, term, day_of_week, period_number),
      KEY idx_ts_class (class_room_id),
      CONSTRAINT fk_ts_classroom FOREIGN KEY (class_room_id) REFERENCES classrooms (id) ON DELETE CASCADE ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // ─────────────────────────────────────────────────────────────────────────
  // L) Results published flag on existing table (Section A4)
  // ─────────────────────────────────────────────────────────────────────────
  await addColumnIfMissing(
    sequelize,
    "ALTER TABLE student_assessment_results ADD COLUMN is_locked TINYINT(1) NOT NULL DEFAULT 0",
    "student_assessment_results.is_locked",
  );
  await addColumnIfMissing(
    sequelize,
    "ALTER TABLE student_assessment_results ADD COLUMN locked_by INT UNSIGNED NULL",
    "student_assessment_results.locked_by",
  );
  await addColumnIfMissing(
    sequelize,
    "ALTER TABLE student_assessment_results ADD COLUMN locked_at DATETIME NULL",
    "student_assessment_results.locked_at",
  );
  await addColumnIfMissing(
    sequelize,
    "ALTER TABLE student_assessment_results ADD COLUMN is_draft TINYINT(1) NOT NULL DEFAULT 1",
    "student_assessment_results.is_draft",
  );
  await addColumnIfMissing(
    sequelize,
    "ALTER TABLE student_assessment_results ADD COLUMN max_score DECIMAL(5,2) NOT NULL DEFAULT 100",
    "student_assessment_results.max_score",
  );

  // Results published per term
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS results_publish_status (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      class_room_id INT UNSIGNED NOT NULL,
      academic_year VARCHAR(4) NOT NULL,
      term VARCHAR(20) NOT NULL,
      exam_type VARCHAR(20) NOT NULL,
      is_published TINYINT(1) NOT NULL DEFAULT 0,
      published_by INT UNSIGNED NULL,
      published_at DATETIME NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_rps_class_year_term_exam (class_room_id, academic_year, term, exam_type),
      CONSTRAINT fk_rps_classroom FOREIGN KEY (class_room_id) REFERENCES classrooms (id) ON DELETE CASCADE ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.info("[addendum] ensureAddendumSchema complete");
}
