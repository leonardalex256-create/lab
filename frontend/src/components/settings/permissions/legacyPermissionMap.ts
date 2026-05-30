/**
 * Maps granular permission keys to legacy keys for phased enforcement migration.
 * Phase 2: use in hasPermission() to grant implied legacy access when a granular key is set.
 */

export const LEGACY_PERMISSION_MAP: Record<string, readonly string[]> = {
  students_view_list: ["nav_students", "students_all"],
  students_view_profile: ["students_view", "nav_students"],
  students_create: ["students_admissions", "nav_students"],
  students_edit: ["students_edit"],
  students_edit_status: ["students_edit"],
  students_delete: ["students_delete"],
  students_restore: ["students_delete"],
  students_print_profile: ["students_print", "students_report_card"],
  students_export: ["students_export"],

  classes_view: ["nav_classes", "classes_all"],
  classes_create: ["classes_all", "nav_classes"],
  classes_edit: ["classes_all", "nav_classes"],
  classes_delete: ["classes_all"],
  classes_assign_teacher: ["classes_teachers"],
  classes_view_students: ["classes_students"],
  classes_print_list: ["classes_reports"],
  classes_export: ["classes_reports"],

  attendance_view: ["students_attendance"],
  attendance_mark: ["students_attendance"],
  attendance_edit: ["students_attendance"],
  attendance_delete: ["students_attendance"],
  attendance_print: ["students_attendance"],
  attendance_export: ["students_attendance"],

  finance_view_dashboard: ["nav_operations", "nav_dashboard"],
  finance_manage_fees: ["settings_fees_structure"],
  finance_assign_fees: ["finance_assign_fees", "nav_operations"],
  finance_view_balance: ["students_financial", "nav_operations"],
  finance_record_payment: ["finance_record_payments", "nav_operations"],
  finance_edit_payment: ["finance_record_payments"],
  finance_delete_payment: ["finance_record_payments"],
  finance_print_receipt: ["finance_record_payments"],
  finance_export_payments: ["finance_record_payments"],
  finance_view_reports: ["finance_reports"],
  finance_submit_report: ["finance_reports"],
  finance_approve_report: ["finance_reports"],
  finance_view_expenses: ["finance_record_payments"],
  finance_create_expense: ["finance_record_payments"],
  finance_delete_expense: ["finance_record_payments"],

  staff_view: ["nav_staff", "staff_teaching", "staff_non_teaching"],
  staff_create: ["nav_staff"],
  staff_edit: ["nav_staff"],
  staff_delete: ["nav_staff"],
  staff_view_payroll: ["finance_staff_pay"],
  staff_create_payroll: ["finance_staff_pay"],
  staff_edit_payroll: ["finance_staff_pay"],
  staff_delete_payroll: ["finance_staff_pay"],
  staff_print_payslip: ["finance_staff_pay"],
  staff_export: ["nav_staff"],

  communication_view_notices: ["communication_notice", "nav_communication"],
  communication_create_notice: ["communication_notice"],
  communication_edit_notice: ["communication_notice"],
  communication_delete_notice: ["communication_notice"],
  communication_send_message: ["communication_messages"],
  communication_view_messages: ["communication_messages", "communication_notifications"],
  communication_delete_message: ["communication_messages"],
  communication_print_notice: ["communication_notice"],

  settings_view_users: ["settings_users_roles"],
  settings_create_user: ["settings_users_roles"],
  settings_edit_user: ["settings_users_roles"],
  settings_delete_user: ["settings_users_roles"],
  settings_assign_role: ["settings_users_roles"],
  settings_manage_permissions: ["settings_users_roles"],
  settings_view_audit_log: ["settings_users_roles"],
  settings_school_info: ["settings_general"],
  settings_manage_periods: ["settings_general"],
};

export function legacyKeysForGranular(granularKey: string): readonly string[] {
  return LEGACY_PERMISSION_MAP[granularKey] ?? [];
}

/** True if the role's permission set grants a granular key (directly or via legacy alias). */
export function roleGrantsGranularKey(
  rolePermissions: Iterable<string>,
  granularKey: string,
): boolean {
  const set = rolePermissions instanceof Set ? rolePermissions : new Set(rolePermissions);
  if (set.has(granularKey)) return true;
  return legacyKeysForGranular(granularKey).some((legacyKey) => set.has(legacyKey));
}

/** Effective grant for any assignable key (granular or legacy-only). */
export function roleGrantsPermissionKey(
  rolePermissions: Iterable<string>,
  permissionKey: string,
): boolean {
  const set = rolePermissions instanceof Set ? rolePermissions : new Set(rolePermissions);
  if (set.has(permissionKey)) return true;
  return roleGrantsGranularKey(set, permissionKey);
}
