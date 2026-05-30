/**
 * Seeds default granular role_permissions for the five template roles.
 * Bursar defaults are stored under role slug `accountant` (UI alias).
 *
 * Run: cd backend && npx tsx scripts/seed-granular-permissions.ts
 */
import "./loadBackendEnv.js";
import { loadConfig } from "../src/config.js";
import { setupDatabase, RolePermission } from "../src/models/index.js";
import { PERMISSION_KEYS } from "../src/constants/permissions.js";

type RoleSlug = "admin" | "accountant" | "registrar" | "teacher" | "viewer";

/** permission key → default on/off per role (1 = grant) */
const MATRIX: Array<{
  key: string;
  admin: 0 | 1;
  accountant: 0 | 1;
  registrar: 0 | 1;
  teacher: 0 | 1;
  viewer: 0 | 1;
}> = [
  { key: "students_view_list", admin: 1, accountant: 1, registrar: 1, teacher: 1, viewer: 1 },
  { key: "students_view_profile", admin: 1, accountant: 1, registrar: 1, teacher: 1, viewer: 1 },
  { key: "students_create", admin: 1, accountant: 0, registrar: 1, teacher: 0, viewer: 0 },
  { key: "students_edit", admin: 1, accountant: 0, registrar: 1, teacher: 0, viewer: 0 },
  { key: "students_edit_status", admin: 1, accountant: 0, registrar: 1, teacher: 0, viewer: 0 },
  { key: "students_delete", admin: 1, accountant: 0, registrar: 0, teacher: 0, viewer: 0 },
  { key: "students_restore", admin: 1, accountant: 0, registrar: 0, teacher: 0, viewer: 0 },
  { key: "students_print_profile", admin: 1, accountant: 0, registrar: 1, teacher: 1, viewer: 0 },
  { key: "students_export", admin: 1, accountant: 0, registrar: 1, teacher: 0, viewer: 0 },
  { key: "classes_view", admin: 1, accountant: 0, registrar: 1, teacher: 1, viewer: 0 },
  { key: "classes_create", admin: 1, accountant: 0, registrar: 1, teacher: 0, viewer: 0 },
  { key: "classes_edit", admin: 1, accountant: 0, registrar: 1, teacher: 0, viewer: 0 },
  { key: "classes_delete", admin: 1, accountant: 0, registrar: 0, teacher: 0, viewer: 0 },
  { key: "classes_assign_teacher", admin: 1, accountant: 0, registrar: 1, teacher: 0, viewer: 0 },
  { key: "classes_view_students", admin: 1, accountant: 0, registrar: 1, teacher: 1, viewer: 0 },
  { key: "classes_print_list", admin: 1, accountant: 0, registrar: 1, teacher: 1, viewer: 0 },
  { key: "classes_export", admin: 1, accountant: 0, registrar: 1, teacher: 0, viewer: 0 },
  { key: "attendance_view", admin: 1, accountant: 0, registrar: 1, teacher: 1, viewer: 1 },
  { key: "attendance_mark", admin: 1, accountant: 0, registrar: 1, teacher: 1, viewer: 0 },
  { key: "attendance_edit", admin: 1, accountant: 0, registrar: 1, teacher: 1, viewer: 0 },
  { key: "attendance_delete", admin: 1, accountant: 0, registrar: 0, teacher: 0, viewer: 0 },
  { key: "attendance_print", admin: 1, accountant: 0, registrar: 1, teacher: 1, viewer: 0 },
  { key: "attendance_export", admin: 1, accountant: 0, registrar: 1, teacher: 0, viewer: 0 },
  { key: "finance_view_dashboard", admin: 1, accountant: 1, registrar: 0, teacher: 0, viewer: 0 },
  { key: "finance_manage_fees", admin: 1, accountant: 1, registrar: 0, teacher: 0, viewer: 0 },
  { key: "finance_assign_fees", admin: 1, accountant: 1, registrar: 0, teacher: 0, viewer: 0 },
  { key: "finance_view_balance", admin: 1, accountant: 1, registrar: 0, teacher: 0, viewer: 0 },
  { key: "finance_record_payment", admin: 1, accountant: 1, registrar: 0, teacher: 0, viewer: 0 },
  { key: "finance_edit_payment", admin: 1, accountant: 0, registrar: 0, teacher: 0, viewer: 0 },
  { key: "finance_delete_payment", admin: 1, accountant: 0, registrar: 0, teacher: 0, viewer: 0 },
  { key: "finance_print_receipt", admin: 1, accountant: 1, registrar: 0, teacher: 0, viewer: 0 },
  { key: "finance_export_payments", admin: 1, accountant: 1, registrar: 0, teacher: 0, viewer: 0 },
  { key: "finance_view_reports", admin: 1, accountant: 1, registrar: 0, teacher: 0, viewer: 0 },
  { key: "finance_submit_report", admin: 1, accountant: 1, registrar: 0, teacher: 0, viewer: 0 },
  { key: "finance_approve_report", admin: 1, accountant: 0, registrar: 0, teacher: 0, viewer: 0 },
  { key: "finance_view_expenses", admin: 1, accountant: 1, registrar: 0, teacher: 0, viewer: 0 },
  { key: "finance_create_expense", admin: 1, accountant: 1, registrar: 0, teacher: 0, viewer: 0 },
  { key: "finance_delete_expense", admin: 1, accountant: 0, registrar: 0, teacher: 0, viewer: 0 },
  { key: "staff_view", admin: 1, accountant: 0, registrar: 0, teacher: 0, viewer: 0 },
  { key: "staff_create", admin: 1, accountant: 0, registrar: 0, teacher: 0, viewer: 0 },
  { key: "staff_edit", admin: 1, accountant: 0, registrar: 0, teacher: 0, viewer: 0 },
  { key: "staff_delete", admin: 1, accountant: 0, registrar: 0, teacher: 0, viewer: 0 },
  { key: "staff_view_payroll", admin: 1, accountant: 0, registrar: 0, teacher: 0, viewer: 0 },
  { key: "staff_create_payroll", admin: 1, accountant: 0, registrar: 0, teacher: 0, viewer: 0 },
  { key: "staff_edit_payroll", admin: 1, accountant: 0, registrar: 0, teacher: 0, viewer: 0 },
  { key: "staff_delete_payroll", admin: 1, accountant: 0, registrar: 0, teacher: 0, viewer: 0 },
  { key: "staff_print_payslip", admin: 1, accountant: 0, registrar: 0, teacher: 0, viewer: 0 },
  { key: "staff_export", admin: 1, accountant: 0, registrar: 0, teacher: 0, viewer: 0 },
  { key: "communication_view_notices", admin: 1, accountant: 1, registrar: 1, teacher: 1, viewer: 1 },
  { key: "communication_create_notice", admin: 1, accountant: 1, registrar: 1, teacher: 0, viewer: 0 },
  { key: "communication_edit_notice", admin: 1, accountant: 0, registrar: 1, teacher: 0, viewer: 0 },
  { key: "communication_delete_notice", admin: 1, accountant: 0, registrar: 0, teacher: 0, viewer: 0 },
  { key: "communication_send_message", admin: 1, accountant: 1, registrar: 1, teacher: 1, viewer: 0 },
  { key: "communication_view_messages", admin: 1, accountant: 1, registrar: 1, teacher: 1, viewer: 0 },
  { key: "communication_delete_message", admin: 1, accountant: 0, registrar: 0, teacher: 0, viewer: 0 },
  { key: "communication_print_notice", admin: 1, accountant: 0, registrar: 1, teacher: 0, viewer: 0 },
  { key: "settings_view_users", admin: 1, accountant: 0, registrar: 0, teacher: 0, viewer: 0 },
  { key: "settings_create_user", admin: 1, accountant: 0, registrar: 0, teacher: 0, viewer: 0 },
  { key: "settings_edit_user", admin: 1, accountant: 0, registrar: 0, teacher: 0, viewer: 0 },
  { key: "settings_delete_user", admin: 1, accountant: 0, registrar: 0, teacher: 0, viewer: 0 },
  { key: "settings_assign_role", admin: 1, accountant: 0, registrar: 0, teacher: 0, viewer: 0 },
  { key: "settings_manage_permissions", admin: 1, accountant: 0, registrar: 0, teacher: 0, viewer: 0 },
  { key: "settings_view_audit_log", admin: 1, accountant: 0, registrar: 0, teacher: 0, viewer: 0 },
  { key: "settings_school_info", admin: 1, accountant: 0, registrar: 0, teacher: 0, viewer: 0 },
  { key: "settings_manage_periods", admin: 1, accountant: 0, registrar: 1, teacher: 0, viewer: 0 },
];

const ROLES: RoleSlug[] = ["admin", "accountant", "registrar", "teacher", "viewer"];

async function main() {
  const config = loadConfig();
  const sequelize = setupDatabase(config);
  await sequelize.authenticate();

  const validKeys = new Set<string>(PERMISSION_KEYS);
  let created = 0;

  for (const role of ROLES) {
    for (const row of MATRIX) {
      if (!validKeys.has(row.key)) {
        console.warn(`Skip unknown key: ${row.key}`);
        continue;
      }
      if (!row[role]) continue;
      await RolePermission.findOrCreate({
        where: { role, permissionKey: row.key },
        defaults: { role, permissionKey: row.key },
      });
      created += 1;
    }
  }

  console.log(`Granular permission defaults seeded (${created} role/key pairs ensured).`);
  await sequelize.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
