/**
 * Mirrors backend `PERMISSION_KEYS` — grouped by sector for the settings UI.
 * When new keys are added on the server, extend this catalog.
 */

export type PermissionSectorDef = {
  id: string;
  title: string;
  subtitle: string;
  keys: readonly string[];
};

export const PERMISSION_SECTORS: PermissionSectorDef[] = [
  {
    id: "dashboard",
    title: "Dashboard & overview",
    subtitle: "Home screen, headline metrics, and leadership insights.",
    keys: ["nav_dashboard", "view_stats", "view_insights"],
  },
  {
    id: "students",
    title: "Students",
    subtitle: "Admissions, profiles, lists, imports, and parent-linked records.",
    keys: [
      "nav_students",
      "students_all",
      "students_admissions",
      "students_import",
      "students_parents",
      "students_view",
      "students_edit",
      "students_delete",
      "students_transfer",
      "students_promote",
      "students_export",
      "students_print",
      "students_attendance",
      "students_medical",
      "students_financial",
      "students_report_card",
      "students_documents",
    ],
  },
  {
    id: "classes",
    title: "Classes & sections",
    subtitle: "Class lists, streams, teachers on class, and class reports.",
    keys: [
      "nav_classes",
      "classes_all",
      "classes_sections_streams",
      "classes_students",
      "classes_teachers",
      "classes_categories",
      "classes_reports",
    ],
  },
  {
    id: "staff",
    title: "Staff",
    subtitle: "Teaching and non-teaching staff records and assignments.",
    keys: ["nav_staff", "staff_teaching", "staff_non_teaching"],
  },
  {
    id: "curriculum",
    title: "Curriculum & assessments",
    subtitle: "Exams, marks entry, results, and academic assessment tools.",
    keys: [
      "nav_curriculum",
      "curriculum_exams_dashboard",
      "curriculum_exam_bot",
      "curriculum_exam_mid",
      "curriculum_exam_eot",
      "curriculum_assessment_tests",
      "curriculum_result_entry",
      "curriculum_subjects",
    ],
  },
  {
    id: "operations",
    title: "Finance & operations",
    subtitle: "Finance module access and per-section controls for reports, fees, payments, bursary, payroll, and summaries.",
    keys: [
      "nav_operations",
      "finance_reports",
      "finance_past_ledger",
      "finance_assign_fees",
      "finance_record_payments",
      "finance_bursary",
      "finance_staff_pay",
      "finance_summaries",
    ],
  },
  {
    id: "communication",
    title: "Communication",
    subtitle: "Notice board, messaging, and school-wide announcements.",
    keys: [
      "nav_communication",
      "communication_notice",
      "communication_notifications",
      "communication_messages",
    ],
  },
  {
    id: "settings",
    title: "Settings & administration",
    subtitle: "School profile, fees structure, users, roles, and system preferences.",
    keys: [
      "nav_settings",
      "settings_modes",
      "settings_fees_structure",
      "settings_general",
      "settings_users_roles",
      "settings_backup",
      "settings_restore",
    ],
  },
] as const;

export const PERMISSION_DETAILS: Record<
  string,
  { title: string; description: string }
> = {
  nav_dashboard: {
    title: "Access dashboard",
    description: "Open the main dashboard after sign-in (role-specific overview cards).",
  },
  view_stats: {
    title: "View headline statistics",
    description: "See aggregate counts and KPI-style figures on the dashboard.",
  },
  view_insights: {
    title: "View insights & summaries",
    description: "See deeper summaries, trends, or analytical callouts where provided.",
  },
  nav_students: {
    title: "Students module",
    description: "Use the Students area: overview, admissions, all students, profiles, import, parents.",
  },
  students_all: {
    title: "Students - all",
    description: "Open the full students list and profile view.",
  },
  students_admissions: {
    title: "Students - admissions",
    description: "Access admissions and student registration screens.",
  },
  students_import: {
    title: "Students - import",
    description: "Access student bulk import pages.",
  },
  students_parents: {
    title: "Students - parents",
    description: "Access parent-linked student records.",
  },
  students_view: {
    title: "View student profiles",
    description: "Read-only access to individual student profile records.",
  },
  students_edit: {
    title: "Edit student details",
    description: "Modify existing student profiles, personal data, photos, and boarding status.",
  },
  students_delete: {
    title: "Delete / archive students",
    description: "Permanently remove or soft-delete a student record from the system.",
  },
  students_transfer: {
    title: "Transfer students",
    description: "Move a student between classes or sections within the school.",
  },
  students_promote: {
    title: "Promote students",
    description: "Bulk promote students to the next class at term or year end.",
  },
  students_export: {
    title: "Export student data",
    description: "Download student lists as CSV/Excel/PDF files.",
  },
  students_print: {
    title: "Print student records",
    description: "Print ID cards, individual profiles, or class lists.",
  },
  students_attendance: {
    title: "Student attendance",
    description: "Mark and view daily attendance records for students.",
  },
  students_medical: {
    title: "Medical information",
    description: "Access sensitive medical and health records for students.",
  },
  students_financial: {
    title: "Student fee status",
    description: "View fee balances and payment history on the student profile.",
  },
  students_report_card: {
    title: "Report cards",
    description: "View and print academic report cards from the student profile.",
  },
  students_documents: {
    title: "Student documents",
    description: "Upload and manage birth certificates, transfer letters, and other documents.",
  },
  nav_classes: {
    title: "Classes & sections module",
    description: "Use the Classes area: classes, sections/streams, class students, teachers, categories, reports.",
  },
  classes_all: {
    title: "Classes - all classes",
    description: "View the all classes page.",
  },
  classes_sections_streams: {
    title: "Classes - sections & streams",
    description: "View and manage class sections and streams.",
  },
  classes_students: {
    title: "Classes - class students",
    description: "Access class student allocations.",
  },
  classes_teachers: {
    title: "Classes - class teachers",
    description: "Access class teacher allocations.",
  },
  classes_categories: {
    title: "Classes - categories",
    description: "Access class category configuration.",
  },
  classes_reports: {
    title: "Classes - reports",
    description: "Access class-level report pages.",
  },
  nav_staff: {
    title: "Staff module",
    description: "Use the Staff area: teaching and non-teaching staff views and related workflows.",
  },
  staff_teaching: {
    title: "Staff - teaching",
    description: "Access teaching staff pages.",
  },
  staff_non_teaching: {
    title: "Staff - non-teaching",
    description: "Access non-teaching staff pages.",
  },
  nav_curriculum: {
    title: "Curriculum module",
    description: "Use the Curriculum area: exams, assessments, result entry, and related tools.",
  },
  curriculum_exams_dashboard: {
    title: "Curriculum - exams dashboard",
    description: "Access the exams dashboard landing page.",
  },
  curriculum_exam_bot: {
    title: "Curriculum - BOT exam",
    description: "Access BOT exam pages.",
  },
  curriculum_exam_mid: {
    title: "Curriculum - MID exam",
    description: "Access MID exam pages.",
  },
  curriculum_exam_eot: {
    title: "Curriculum - EOT exam",
    description: "Access EOT exam pages.",
  },
  curriculum_assessment_tests: {
    title: "Curriculum - assessments",
    description: "Access assessment tests pages.",
  },
  curriculum_result_entry: {
    title: "Curriculum - result entry",
    description: "Access result entry workflow.",
  },
  curriculum_subjects: {
    title: "Curriculum - subjects",
    description: "Access subject configuration page.",
  },
  nav_operations: {
    title: "Finance & operations module",
    description: "Open the Finance & Operations module.",
  },
  finance_reports: {
    title: "Finance reports",
    description: "Allow finance report pages such as daily ledger and debtors report.",
  },
  finance_past_ledger: {
    title: "Past daily ledger records",
    description: "Allow viewing previous-day ledger history. If disabled, user can view only today's ledger.",
  },
  finance_assign_fees: {
    title: "Assign fees",
    description: "Allow assigning and editing student fee structures.",
  },
  finance_record_payments: {
    title: "Record payments",
    description: "Allow recording student payments and expense capture flows.",
  },
  finance_bursary: {
    title: "Bursary",
    description: "Allow bursary listings, assignment, and related bursary operations.",
  },
  finance_staff_pay: {
    title: "Staff pay",
    description: "Allow payroll and staff payment summary screens.",
  },
  finance_summaries: {
    title: "Finance summaries",
    description: "Allow closing/review summaries and admin daily finance summaries.",
  },
  nav_communication: {
    title: "Communication module",
    description: "Use the Communication area: notice board and related messaging features.",
  },
  communication_notice: {
    title: "Communication - notice board",
    description: "Access notice board pages.",
  },
  communication_notifications: {
    title: "Communication - notifications list",
    description: "Access notifications inbox list.",
  },
  communication_messages: {
    title: "Communication - messages list",
    description: "Access messages inbox list.",
  },
  nav_settings: {
    title: "Settings module",
    description: "Use Settings: general school options, fees structure, users, roles, and security-related panels.",
  },
  settings_modes: {
    title: "Settings - modes",
    description: "Access mode and theme settings.",
  },
  settings_fees_structure: {
    title: "Settings - fees structure",
    description: "Access fees structure settings.",
  },
  settings_general: {
    title: "Settings - general",
    description: "Access general school settings.",
  },
  settings_users_roles: {
    title: "Settings - users & roles",
    description: "Access users, roles, and permission management.",
  },
  settings_backup: {
    title: "Settings - backup",
    description: "Access backup settings/actions.",
  },
  settings_restore: {
    title: "Settings - restore",
    description: "Access restore settings/actions.",
  },
};

export function groupAvailableKeysBySector(availableKeys: string[]): PermissionSectorDef[] {
  const set = new Set(availableKeys);
  return PERMISSION_SECTORS.map((sector) => ({
    ...sector,
    keys: sector.keys.filter((k) => set.has(k)),
  })).filter((s) => s.keys.length > 0);
}

/** Keys returned by API but missing from sector defs (fallback bucket). */
export function orphanPermissionKeys(availableKeys: string[]): string[] {
  const assigned = new Set(PERMISSION_SECTORS.flatMap((s) => [...s.keys]));
  return availableKeys.filter((k) => !assigned.has(k));
}
