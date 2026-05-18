import type { Sequelize } from "sequelize";

/** MySQL ER_DUP_FIELDNAME — column already exists */
const MYSQL_DUP_FIELDNAME = 1060;
/** MySQL ER_CANT_DROP_FIELD_OR_KEY — column does not exist (or index) */
const MYSQL_CANT_DROP_FIELD_OR_KEY = 1091;
/** MySQL ER_DUP_KEYNAME — index already exists */
const MYSQL_DUP_KEYNAME = 1061;

async function addColumnIfMissing(
  sequelize: Sequelize,
  sql: string,
  label: string,
): Promise<void> {
  try {
    await sequelize.query(sql);
    console.info(`[db] Added column ${label}`);
  } catch (e: unknown) {
    const errno = (e as { parent?: { errno?: number } })?.parent?.errno;
    if (errno !== MYSQL_DUP_FIELDNAME) {
      throw e;
    }
  }
}

async function dropColumnIfExists(
  sequelize: Sequelize,
  sql: string,
  label: string,
): Promise<void> {
  try {
    await sequelize.query(sql);
    console.info(`[db] Dropped column ${label}`);
  } catch (e: unknown) {
    const errno = (e as { parent?: { errno?: number } })?.parent?.errno;
    if (errno !== MYSQL_CANT_DROP_FIELD_OR_KEY) {
      throw e;
    }
  }
}

async function addIndexIfMissing(
  sequelize: Sequelize,
  sql: string,
  label: string,
): Promise<void> {
  try {
    await sequelize.query(sql);
    console.info(`[db] Added index ${label}`);
  } catch (e: unknown) {
    const errno = (e as { parent?: { errno?: number } })?.parent?.errno;
    if (errno !== MYSQL_DUP_KEYNAME) {
      throw e;
    }
  }
}

async function dropIndexIfExists(
  sequelize: Sequelize,
  sql: string,
  label: string,
): Promise<void> {
  try {
    await sequelize.query(sql);
    console.info(`[db] Dropped index ${label}`);
  } catch (e: unknown) {
    const errno = (e as { parent?: { errno?: number } })?.parent?.errno;
    if (errno !== MYSQL_CANT_DROP_FIELD_OR_KEY) {
      throw e;
    }
  }
}

/**
 * Dashboard-related tables and additive `students` columns.
 * Safe on every startup (idempotent).
 */
export async function ensureDashboardSchema(sequelize: Sequelize): Promise<void> {
  if (sequelize.getDialect() !== "mysql") {
    return;
  }

  // Drop the legacy roll_number column if it still exists from older deploys.
  // Idempotent: swallows ER_CANT_DROP_FIELD_OR_KEY (1091) once the column is gone.
  await dropColumnIfExists(
    sequelize,
    "ALTER TABLE students DROP COLUMN roll_number",
    "students.roll_number",
  );

  await addColumnIfMissing(
    sequelize,
    "ALTER TABLE students ADD COLUMN gender VARCHAR(20) NULL",
    "students.gender",
  );
  await addColumnIfMissing(
    sequelize,
    "ALTER TABLE students ADD COLUMN section_name VARCHAR(80) NULL",
    "students.section_name",
  );
  await addColumnIfMissing(
    sequelize,
    "ALTER TABLE students ADD COLUMN passport_photo_filename VARCHAR(255) NULL",
    "students.passport_photo_filename",
  );
  await addColumnIfMissing(
    sequelize,
    "ALTER TABLE students ADD COLUMN nationality VARCHAR(100) NULL",
    "students.nationality",
  );
  await addColumnIfMissing(
    sequelize,
    "ALTER TABLE students ADD COLUMN country_code VARCHAR(10) NULL",
    "students.country_code",
  );
  await addColumnIfMissing(
    sequelize,
    "ALTER TABLE students ADD COLUMN district VARCHAR(120) NULL",
    "students.district",
  );
  await addColumnIfMissing(
    sequelize,
    "ALTER TABLE students ADD COLUMN registration_type VARCHAR(24) NOT NULL DEFAULT 'first'",
    "students.registration_type",
  );
  await addColumnIfMissing(
    sequelize,
    "ALTER TABLE students ADD COLUMN middle_name VARCHAR(100) NULL",
    "students.middle_name",
  );
  await addColumnIfMissing(
    sequelize,
    "ALTER TABLE students ADD COLUMN previous_school VARCHAR(200) NULL",
    "students.previous_school",
  );
  await addColumnIfMissing(
    sequelize,
    "ALTER TABLE students ADD COLUMN previous_school_location VARCHAR(200) NULL",
    "students.previous_school_location",
  );
  await addColumnIfMissing(
    sequelize,
    "ALTER TABLE students ADD COLUMN last_class_attended VARCHAR(120) NULL",
    "students.last_class_attended",
  );
  await addColumnIfMissing(
    sequelize,
    "ALTER TABLE students ADD COLUMN last_term_year VARCHAR(40) NULL",
    "students.last_term_year",
  );
  await addColumnIfMissing(
    sequelize,
    "ALTER TABLE students ADD COLUMN previous_report_card_filename VARCHAR(255) NULL",
    "students.previous_report_card_filename",
  );
  await addColumnIfMissing(
    sequelize,
    "ALTER TABLE students ADD COLUMN previous_grades VARCHAR(200) NULL",
    "students.previous_grades",
  );
  await addColumnIfMissing(
    sequelize,
    "ALTER TABLE students ADD COLUMN transfer_reason VARCHAR(120) NULL",
    "students.transfer_reason",
  );
  await addColumnIfMissing(
    sequelize,
    "ALTER TABLE students ADD COLUMN parent_alive_status VARCHAR(16) NULL",
    "students.parent_alive_status",
  );
  await addColumnIfMissing(
    sequelize,
    "ALTER TABLE students ADD COLUMN parent_full_name VARCHAR(120) NULL",
    "students.parent_full_name",
  );
  await addColumnIfMissing(
    sequelize,
    "ALTER TABLE students ADD COLUMN parent_phone VARCHAR(32) NULL",
    "students.parent_phone",
  );
  await addColumnIfMissing(
    sequelize,
    "ALTER TABLE students ADD COLUMN parent_address VARCHAR(255) NULL",
    "students.parent_address",
  );
  await addColumnIfMissing(
    sequelize,
    "ALTER TABLE students ADD COLUMN religion VARCHAR(80) NULL",
    "students.religion",
  );
  await addColumnIfMissing(
    sequelize,
    "ALTER TABLE students ADD COLUMN special_needs VARCHAR(255) NULL",
    "students.special_needs",
  );
  await addColumnIfMissing(
    sequelize,
    "ALTER TABLE students ADD COLUMN boarding_status VARCHAR(16) NULL",
    "students.boarding_status",
  );
  await addColumnIfMissing(
    sequelize,
    "ALTER TABLE students ADD COLUMN residence_address VARCHAR(255) NULL",
    "students.residence_address",
  );
  await addColumnIfMissing(
    sequelize,
    "ALTER TABLE students ADD COLUMN medical_info TEXT NULL",
    "students.medical_info",
  );
  await addColumnIfMissing(
    sequelize,
    "ALTER TABLE students ADD COLUMN emergency_contact_name VARCHAR(120) NULL",
    "students.emergency_contact_name",
  );
  await addColumnIfMissing(
    sequelize,
    "ALTER TABLE students ADD COLUMN emergency_contact_phone VARCHAR(32) NULL",
    "students.emergency_contact_phone",
  );
  await addColumnIfMissing(
    sequelize,
    "ALTER TABLE students ADD COLUMN guardian_name VARCHAR(120) NULL",
    "students.guardian_name",
  );
  await addColumnIfMissing(
    sequelize,
    "ALTER TABLE students ADD COLUMN guardian_phone VARCHAR(32) NULL",
    "students.guardian_phone",
  );
  await addColumnIfMissing(
    sequelize,
    "ALTER TABLE students ADD COLUMN bursary_percentage INT NOT NULL DEFAULT 0",
    "students.bursary_percentage",
  );
  await addColumnIfMissing(
    sequelize,
    "ALTER TABLE students ADD COLUMN bursary_starts_at DATETIME NULL",
    "students.bursary_starts_at",
  );
  await addColumnIfMissing(
    sequelize,
    "ALTER TABLE students ADD COLUMN bursary_ends_at DATETIME NULL",
    "students.bursary_ends_at",
  );

  await addIndexIfMissing(
    sequelize,
    "ALTER TABLE students ADD INDEX idx_students_admission_number (admission_number)",
    "students.idx_students_admission_number",
  );
  await addIndexIfMissing(
    sequelize,
    "ALTER TABLE students ADD INDEX idx_students_class_section (class_room_id, section_name)",
    "students.idx_students_class_section",
  );
  await addIndexIfMissing(
    sequelize,
    "ALTER TABLE students ADD INDEX idx_students_name_sort (last_name, first_name)",
    "students.idx_students_name_sort",
  );
  await addIndexIfMissing(
    sequelize,
    "ALTER TABLE students ADD INDEX idx_students_created_at (created_at)",
    "students.idx_students_created_at",
  );

  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS staff_members (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id INT UNSIGNED NULL,
      staff_type VARCHAR(20) NOT NULL DEFAULT 'teaching',
      display_name VARCHAR(120) NOT NULL,
      email VARCHAR(255) NULL,
      staff_role VARCHAR(40) NOT NULL,
      phone VARCHAR(32) NULL,
      address VARCHAR(255) NULL,
      gender VARCHAR(20) NULL,
      date_of_birth VARCHAR(20) NULL,
      nationality VARCHAR(100) NULL,
      marital_status VARCHAR(40) NULL,
      national_id VARCHAR(60) NULL,
      qualification VARCHAR(120) NULL,
      languages VARCHAR(255) NULL,
      date_of_joining VARCHAR(20) NULL,
      experience TEXT NULL,
      emergency_contact_name VARCHAR(120) NULL,
      emergency_contact_phone VARCHAR(32) NULL,
      referee_name VARCHAR(120) NULL,
      referee_contact VARCHAR(120) NULL,
      staff_photo_url VARCHAR(255) NULL,
      staff_photo_name VARCHAR(255) NULL,
      assigned_class VARCHAR(80) NULL,
      teaching_section VARCHAR(32) NULL,
      staff_category VARCHAR(32) NULL,
      national_id_photo_url VARCHAR(255) NULL,
      national_id_photo_name VARCHAR(255) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY staff_members_role_idx (staff_role),
      KEY staff_members_type_idx (staff_type),
      KEY staff_members_user_idx (user_id),
      CONSTRAINT fk_staff_members_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await addColumnIfMissing(
    sequelize,
    "ALTER TABLE staff_members ADD COLUMN staff_type VARCHAR(20) NOT NULL DEFAULT 'teaching'",
    "staff_members.staff_type",
  );
  await addColumnIfMissing(
    sequelize,
    "ALTER TABLE staff_members ADD COLUMN phone VARCHAR(32) NULL",
    "staff_members.phone",
  );
  await addColumnIfMissing(
    sequelize,
    "ALTER TABLE staff_members ADD COLUMN address VARCHAR(255) NULL",
    "staff_members.address",
  );
  await addColumnIfMissing(
    sequelize,
    "ALTER TABLE staff_members ADD COLUMN gender VARCHAR(20) NULL",
    "staff_members.gender",
  );
  await addColumnIfMissing(
    sequelize,
    "ALTER TABLE staff_members ADD COLUMN date_of_birth VARCHAR(20) NULL",
    "staff_members.date_of_birth",
  );
  await addColumnIfMissing(
    sequelize,
    "ALTER TABLE staff_members ADD COLUMN nationality VARCHAR(100) NULL",
    "staff_members.nationality",
  );
  await addColumnIfMissing(
    sequelize,
    "ALTER TABLE staff_members ADD COLUMN marital_status VARCHAR(40) NULL",
    "staff_members.marital_status",
  );
  await addColumnIfMissing(
    sequelize,
    "ALTER TABLE staff_members ADD COLUMN national_id VARCHAR(60) NULL",
    "staff_members.national_id",
  );
  await addColumnIfMissing(
    sequelize,
    "ALTER TABLE staff_members ADD COLUMN qualification VARCHAR(120) NULL",
    "staff_members.qualification",
  );
  await addColumnIfMissing(
    sequelize,
    "ALTER TABLE staff_members ADD COLUMN languages VARCHAR(255) NULL",
    "staff_members.languages",
  );
  await addColumnIfMissing(
    sequelize,
    "ALTER TABLE staff_members ADD COLUMN date_of_joining VARCHAR(20) NULL",
    "staff_members.date_of_joining",
  );
  await addColumnIfMissing(
    sequelize,
    "ALTER TABLE staff_members ADD COLUMN experience TEXT NULL",
    "staff_members.experience",
  );
  await addColumnIfMissing(
    sequelize,
    "ALTER TABLE staff_members ADD COLUMN emergency_contact_name VARCHAR(120) NULL",
    "staff_members.emergency_contact_name",
  );
  await addColumnIfMissing(
    sequelize,
    "ALTER TABLE staff_members ADD COLUMN emergency_contact_phone VARCHAR(32) NULL",
    "staff_members.emergency_contact_phone",
  );
  await addColumnIfMissing(
    sequelize,
    "ALTER TABLE staff_members ADD COLUMN referee_name VARCHAR(120) NULL",
    "staff_members.referee_name",
  );
  await addColumnIfMissing(
    sequelize,
    "ALTER TABLE staff_members ADD COLUMN referee_contact VARCHAR(120) NULL",
    "staff_members.referee_contact",
  );
  await addColumnIfMissing(
    sequelize,
    "ALTER TABLE staff_members ADD COLUMN staff_photo_url VARCHAR(255) NULL",
    "staff_members.staff_photo_url",
  );
  await addColumnIfMissing(
    sequelize,
    "ALTER TABLE staff_members ADD COLUMN staff_photo_name VARCHAR(255) NULL",
    "staff_members.staff_photo_name",
  );
  await addColumnIfMissing(
    sequelize,
    "ALTER TABLE staff_members ADD COLUMN assigned_class VARCHAR(80) NULL",
    "staff_members.assigned_class",
  );
  await addColumnIfMissing(
    sequelize,
    "ALTER TABLE staff_members ADD COLUMN teaching_section VARCHAR(32) NULL",
    "staff_members.teaching_section",
  );
  await addColumnIfMissing(
    sequelize,
    "ALTER TABLE staff_members ADD COLUMN staff_category VARCHAR(32) NULL",
    "staff_members.staff_category",
  );
  await addColumnIfMissing(
    sequelize,
    "ALTER TABLE staff_members ADD COLUMN national_id_photo_url VARCHAR(255) NULL",
    "staff_members.national_id_photo_url",
  );
  await addColumnIfMissing(
    sequelize,
    "ALTER TABLE staff_members ADD COLUMN national_id_photo_name VARCHAR(255) NULL",
    "staff_members.national_id_photo_name",
  );
  await addColumnIfMissing(
    sequelize,
    "ALTER TABLE staff_members ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP",
    "staff_members.updated_at",
  );

  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS enquiries (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      subject VARCHAR(255) NOT NULL,
      message_body TEXT NOT NULL,
      source_email VARCHAR(255) NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'open',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY enquiries_status_idx (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS notice_board_entries (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      author_user_id INT UNSIGNED NULL,
      author_label VARCHAR(120) NOT NULL,
      body TEXT NOT NULL,
      published_at DATETIME NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY notice_board_published_idx (published_at),
      CONSTRAINT fk_notice_board_author FOREIGN KEY (author_user_id) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS school_expenses (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      reference_code VARCHAR(32) NOT NULL,
      expense_type VARCHAR(120) NOT NULL,
      amount_ugx BIGINT NOT NULL,
      status VARCHAR(20) NOT NULL,
      contact_email VARCHAR(255) NOT NULL,
      expense_date DATE NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_school_expenses_ref (reference_code),
      KEY school_expenses_date_idx (expense_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS school_events (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      title VARCHAR(255) NOT NULL,
      event_date DATE NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY school_events_date_idx (event_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS dashboard_chart_points (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      sort_order INT NOT NULL DEFAULT 0,
      x_pos INT NOT NULL,
      y_pos INT NOT NULL,
      PRIMARY KEY (id),
      KEY dashboard_chart_sort_idx (sort_order)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS social_platform_stats (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      platform_key VARCHAR(32) NOT NULL,
      display_label VARCHAR(64) NOT NULL,
      follower_count INT UNSIGNED NOT NULL DEFAULT 0,
      sort_order INT NOT NULL DEFAULT 0,
      PRIMARY KEY (id),
      UNIQUE KEY uq_social_platform_key (platform_key),
      KEY social_sort_idx (sort_order)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS attendance_records (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      student_id INT UNSIGNED NOT NULL,
      record_date DATE NOT NULL,
      present TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY attendance_student_date_idx (student_id, record_date),
      KEY attendance_date_idx (record_date),
      CONSTRAINT fk_attendance_student FOREIGN KEY (student_id) REFERENCES students (id) ON DELETE CASCADE ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS dashboard_kpis (
      kpi_key VARCHAR(64) NOT NULL,
      value_text VARCHAR(120) NOT NULL,
      PRIMARY KEY (kpi_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS student_fee_structures (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      term VARCHAR(20) NOT NULL,
      boarding_status VARCHAR(16) NOT NULL,
      amount_due_ugx BIGINT NOT NULL,
      notes VARCHAR(255) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_student_fee_structures_term_status (term, boarding_status),
      KEY student_fee_structures_term_idx (term)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Widen boarding_status to support custom entity slugs
  await addColumnIfMissing(
    sequelize,
    "ALTER TABLE student_fee_structures MODIFY boarding_status VARCHAR(60) NOT NULL",
    "student_fee_structures.boarding_status (widen)",
  );
  await addColumnIfMissing(
    sequelize,
    "ALTER TABLE student_fee_structures ADD COLUMN label VARCHAR(120) NULL",
    "student_fee_structures.label",
  );

  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS class_sections (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      class_room_id INT UNSIGNED NOT NULL,
      name VARCHAR(80) NOT NULL,
      academic_year VARCHAR(20) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_class_sections_name (class_room_id, name, academic_year),
      KEY class_sections_class_idx (class_room_id),
      CONSTRAINT fk_class_sections_classroom FOREIGN KEY (class_room_id) REFERENCES classrooms (id) ON DELETE CASCADE ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await addColumnIfMissing(
    sequelize,
    "ALTER TABLE classrooms ADD COLUMN category_id INT UNSIGNED NULL",
    "classrooms.category_id",
  );
  await addColumnIfMissing(
    sequelize,
    "ALTER TABLE classrooms ADD COLUMN description VARCHAR(255) NULL",
    "classrooms.description",
  );
  await addColumnIfMissing(
    sequelize,
    "ALTER TABLE classrooms ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1",
    "classrooms.is_active",
  );
  await addColumnIfMissing(
    sequelize,
    "ALTER TABLE class_sections ADD COLUMN class_teacher_name VARCHAR(120) NULL",
    "class_sections.class_teacher_name",
  );

  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS class_categories (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      name VARCHAR(80) NOT NULL,
      description VARCHAR(255) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_class_categories_name (name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS user_class_authorizations (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id INT UNSIGNED NOT NULL,
      class_room_id INT UNSIGNED NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_user_class_authorizations_user_class (user_id, class_room_id),
      KEY user_class_authorizations_class_idx (class_room_id),
      CONSTRAINT fk_user_class_authorizations_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT fk_user_class_authorizations_classroom FOREIGN KEY (class_room_id) REFERENCES classrooms (id) ON DELETE CASCADE ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS student_assessment_results (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      student_id INT UNSIGNED NOT NULL,
      class_room_id INT UNSIGNED NOT NULL,
      section_name VARCHAR(80) NULL,
      term VARCHAR(20) NOT NULL,
      exam_type VARCHAR(20) NOT NULL,
      subject VARCHAR(120) NOT NULL,
      score DECIMAL(5,2) NOT NULL,
      remarks VARCHAR(255) NULL,
      entered_by_user_id INT UNSIGNED NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_student_assessment_results_student_term_exam_subject (student_id, term, exam_type, subject),
      KEY student_assessment_results_class_idx (class_room_id),
      KEY student_assessment_results_lookup_idx (term, exam_type, class_room_id),
      CONSTRAINT fk_student_assessment_results_student FOREIGN KEY (student_id) REFERENCES students (id) ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT fk_student_assessment_results_classroom FOREIGN KEY (class_room_id) REFERENCES classrooms (id) ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT fk_student_assessment_results_entered_by FOREIGN KEY (entered_by_user_id) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await addColumnIfMissing(
    sequelize,
    "ALTER TABLE student_assessment_results ADD COLUMN subject VARCHAR(120) NOT NULL DEFAULT 'General'",
    "student_assessment_results.subject",
  );

  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS school_settings (
      setting_key VARCHAR(64) NOT NULL,
      setting_value TEXT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (setting_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS academic_exam_types (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      exam_key VARCHAR(40) NOT NULL,
      display_name VARCHAR(80) NOT NULL,
      is_system TINYINT(1) NOT NULL DEFAULT 0,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_academic_exam_types_exam_key (exam_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS academic_subject_assignments (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      class_category_id INT UNSIGNED NOT NULL,
      section_name VARCHAR(80) NOT NULL DEFAULT '',
      subject_name VARCHAR(120) NOT NULL,
      short_form VARCHAR(8) NOT NULL DEFAULT '',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_subject_assignment_category_section_subject (class_category_id, section_name, subject_name),
      KEY idx_subject_assignment_category (class_category_id),
      CONSTRAINT fk_subject_assignment_category FOREIGN KEY (class_category_id) REFERENCES class_categories (id) ON DELETE CASCADE ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS grading_scale (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      name VARCHAR(80) NOT NULL,
      thresholds JSON NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_grading_scale_name (name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS report_comments (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      student_id INT UNSIGNED NOT NULL,
      term VARCHAR(20) NOT NULL,
      comment TEXT NOT NULL,
      created_by_user_id INT UNSIGNED NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY report_comments_student_idx (student_id),
      KEY report_comments_term_idx (term),
      CONSTRAINT fk_report_comments_student FOREIGN KEY (student_id) REFERENCES students (id) ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT fk_report_comments_user FOREIGN KEY (created_by_user_id) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id INT UNSIGNED NULL,
      action VARCHAR(120) NOT NULL,
      entity VARCHAR(80) NOT NULL,
      entity_id INT UNSIGNED NULL,
      details JSON NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY audit_logs_user_idx (user_id),
      KEY audit_logs_entity_idx (entity, entity_id),
      CONSTRAINT fk_audit_logs_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS exams (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      exam_key VARCHAR(40) NOT NULL,
      class_room_id INT UNSIGNED NOT NULL,
      subject VARCHAR(120) NOT NULL,
      exam_date DATE NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY exams_classroom_idx (class_room_id),
      KEY exams_date_idx (exam_date),
      CONSTRAINT fk_exams_classroom FOREIGN KEY (class_room_id) REFERENCES classrooms (id) ON DELETE CASCADE ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // --- Academic year on fee + assessment rows (operational period at save time) ---
  const academicYearTables = [
    "student_fee_assignments",
    "student_fee_payments",
    "student_fee_receipts",
    "student_assessment_results",
  ] as const;
  for (const tbl of academicYearTables) {
    await addColumnIfMissing(
      sequelize,
      `ALTER TABLE \`${tbl}\` ADD COLUMN academic_year VARCHAR(4) NULL`,
      `${tbl}.academic_year`,
    );
  }

  for (const tbl of academicYearTables) {
    await sequelize.query(`
      UPDATE \`${tbl}\` t
      SET t.academic_year = COALESCE(
        NULLIF(TRIM((SELECT setting_value FROM school_settings WHERE setting_key = 'academic_year' LIMIT 1)), ''),
        '2026'
      )
      WHERE t.academic_year IS NULL
    `);
  }

  for (const tbl of academicYearTables) {
    await sequelize.query(
      `ALTER TABLE \`${tbl}\` MODIFY COLUMN academic_year VARCHAR(4) NOT NULL`,
    );
  }

  await dropIndexIfExists(
    sequelize,
    "ALTER TABLE student_assessment_results DROP INDEX uq_student_assessment_results_student_term_exam_subject",
    "student_assessment_results.uq_student_assessment_results_student_term_exam_subject",
  );
  await addIndexIfMissing(
    sequelize,
    "ALTER TABLE student_assessment_results ADD UNIQUE KEY uq_student_assessment_results_student_year_term_exam_subject (student_id, academic_year, term, exam_type, subject)",
    "student_assessment_results.uq_student_assessment_results_student_year_term_exam_subject",
  );
  await addIndexIfMissing(
    sequelize,
    "ALTER TABLE student_assessment_results ADD KEY student_assessment_results_year_term_class_idx (academic_year, term, class_room_id)",
    "student_assessment_results.student_assessment_results_year_term_class_idx",
  );

  await addIndexIfMissing(
    sequelize,
    "ALTER TABLE student_fee_assignments ADD UNIQUE KEY uq_student_fee_assignments_student_year_term (student_id, academic_year, term)",
    "student_fee_assignments.uq_student_fee_assignments_student_year_term",
  );
}
