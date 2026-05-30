/**
 * Granular permission catalog for the Permission Assignment UI.
 * Mirrors the role default matrix from product spec.
 *
 * Role alias: UI label "bursar" maps to DB slug `accountant` (see roleToApiSlug / roleFromApiSlug).
 *
 * Legacy keys from permissionCatalog.ts are folded into the same module sections when they
 * are not already represented by a granular row (and not aliased by a granular grant).
 */

import { PERMISSION_DETAILS, PERMISSION_SECTORS } from "../permissionCatalog";
import { LEGACY_PERMISSION_MAP } from "./legacyPermissionMap";

export type PermissionAction =
  | "view"
  | "create"
  | "edit"
  | "delete"
  | "print"
  | "export"
  | "approve"
  | "restore";

export type PermissionRoleSlug = "admin" | "bursar" | "registrar" | "teacher" | "viewer";

export type PermissionKeyDef = {
  key: string;
  action: PermissionAction;
  desc: string;
  admin: 0 | 1;
  bursar: 0 | 1;
  registrar: 0 | 1;
  teacher: 0 | 1;
  viewer: 0 | 1;
};

export type ModuleDef = {
  keys: PermissionKeyDef[];
};

export const PERMISSION_ROLES: PermissionRoleSlug[] = [
  "admin",
  "bursar",
  "registrar",
  "teacher",
  "viewer",
];

export const ROLE_LABELS: Record<PermissionRoleSlug, string> = {
  admin: "Admin",
  bursar: "Bursar",
  registrar: "Registrar",
  teacher: "Teacher",
  viewer: "Viewer",
};

/** DB / API role slug for a UI role tab */
export function roleToApiSlug(role: string): string {
  const r = role.trim().toLowerCase();
  if (r === "bursar") return "accountant";
  return r;
}

/** UI role tab for a DB role slug */
export function roleFromApiSlug(apiRole: string): PermissionRoleSlug | null {
  const r = apiRole.trim().toLowerCase();
  if (r === "accountant") return "bursar";
  if (PERMISSION_ROLES.includes(r as PermissionRoleSlug)) return r as PermissionRoleSlug;
  return null;
}

export const MODULE_ORDER = [
  "dashboard",
  "students",
  "classes",
  "attendance",
  "finance",
  "staff",
  "curriculum",
  "communication",
  "settings",
] as const;

export type ModuleId = (typeof MODULE_ORDER)[number];

export const MODULE_TITLES: Record<ModuleId, string> = {
  dashboard: "Dashboard & overview",
  students: "Students",
  classes: "Classes",
  attendance: "Attendance",
  finance: "Finance",
  staff: "Staff",
  curriculum: "Curriculum & assessments",
  communication: "Communication",
  settings: "Settings",
};

/** Maps granular module id → legacy sector id in permissionCatalog.ts */
const MODULE_TO_LEGACY_SECTOR: Partial<Record<ModuleId, string>> = {
  dashboard: "dashboard",
  students: "students",
  classes: "classes",
  finance: "operations",
  staff: "staff",
  curriculum: "curriculum",
  communication: "communication",
  settings: "settings",
};

export type EnrichedModuleSection = {
  id: ModuleId;
  title: string;
  keys: PermissionKeyDef[];
  /** Legacy-only keys for this module (not duplicated by granular rows or aliases). */
  legacyKeys: string[];
};

export const MODULES: Record<ModuleId, ModuleDef> = {
  students: {
    keys: [
      { key: "students_view_list", action: "view", desc: "See the students list page", admin: 1, bursar: 1, registrar: 1, teacher: 1, viewer: 1 },
      { key: "students_view_profile", action: "view", desc: "Open a student profile / detail page", admin: 1, bursar: 1, registrar: 1, teacher: 1, viewer: 1 },
      { key: "students_create", action: "create", desc: "Enrol / admit a new student", admin: 1, bursar: 0, registrar: 1, teacher: 0, viewer: 0 },
      { key: "students_edit", action: "edit", desc: "Edit student personal details", admin: 1, bursar: 0, registrar: 1, teacher: 0, viewer: 0 },
      { key: "students_edit_status", action: "edit", desc: "Change student status (active/withdrawn…)", admin: 1, bursar: 0, registrar: 1, teacher: 0, viewer: 0 },
      { key: "students_delete", action: "delete", desc: "Delete / archive a student record", admin: 1, bursar: 0, registrar: 0, teacher: 0, viewer: 0 },
      { key: "students_restore", action: "restore", desc: "Restore a soft-deleted student", admin: 1, bursar: 0, registrar: 0, teacher: 0, viewer: 0 },
      { key: "students_print_profile", action: "print", desc: "Print a student profile/report card", admin: 1, bursar: 0, registrar: 1, teacher: 1, viewer: 0 },
      { key: "students_export", action: "export", desc: "Export student list to CSV / Excel", admin: 1, bursar: 0, registrar: 1, teacher: 0, viewer: 0 },
    ],
  },
  classes: {
    keys: [
      { key: "classes_view", action: "view", desc: "See classrooms and class lists", admin: 1, bursar: 0, registrar: 1, teacher: 1, viewer: 0 },
      { key: "classes_create", action: "create", desc: "Create a new classroom / section", admin: 1, bursar: 0, registrar: 1, teacher: 0, viewer: 0 },
      { key: "classes_edit", action: "edit", desc: "Edit classroom name, year, category", admin: 1, bursar: 0, registrar: 1, teacher: 0, viewer: 0 },
      { key: "classes_delete", action: "delete", desc: "Delete a classroom", admin: 1, bursar: 0, registrar: 0, teacher: 0, viewer: 0 },
      { key: "classes_assign_teacher", action: "edit", desc: "Assign / remove a teacher from a class", admin: 1, bursar: 0, registrar: 1, teacher: 0, viewer: 0 },
      { key: "classes_view_students", action: "view", desc: "See students enrolled in a class", admin: 1, bursar: 0, registrar: 1, teacher: 1, viewer: 0 },
      { key: "classes_print_list", action: "print", desc: "Print a class register / list", admin: 1, bursar: 0, registrar: 1, teacher: 1, viewer: 0 },
      { key: "classes_export", action: "export", desc: "Export class data to CSV", admin: 1, bursar: 0, registrar: 1, teacher: 0, viewer: 0 },
    ],
  },
  attendance: {
    keys: [
      { key: "attendance_view", action: "view", desc: "View attendance records", admin: 1, bursar: 0, registrar: 1, teacher: 1, viewer: 1 },
      { key: "attendance_mark", action: "create", desc: "Mark attendance for a class / student", admin: 1, bursar: 0, registrar: 1, teacher: 1, viewer: 0 },
      { key: "attendance_edit", action: "edit", desc: "Edit a submitted attendance record", admin: 1, bursar: 0, registrar: 1, teacher: 1, viewer: 0 },
      { key: "attendance_delete", action: "delete", desc: "Delete an attendance record", admin: 1, bursar: 0, registrar: 0, teacher: 0, viewer: 0 },
      { key: "attendance_print", action: "print", desc: "Print attendance report", admin: 1, bursar: 0, registrar: 1, teacher: 1, viewer: 0 },
      { key: "attendance_export", action: "export", desc: "Export attendance to CSV", admin: 1, bursar: 0, registrar: 1, teacher: 0, viewer: 0 },
    ],
  },
  finance: {
    keys: [
      { key: "finance_view_dashboard", action: "view", desc: "View the finance overview/dashboard", admin: 1, bursar: 1, registrar: 0, teacher: 0, viewer: 0 },
      { key: "finance_manage_fees", action: "edit", desc: "Create / edit fee categories and rules", admin: 1, bursar: 1, registrar: 0, teacher: 0, viewer: 0 },
      { key: "finance_assign_fees", action: "create", desc: "Assign fees to a student for a term", admin: 1, bursar: 1, registrar: 0, teacher: 0, viewer: 0 },
      { key: "finance_view_balance", action: "view", desc: "View a student balance / statement", admin: 1, bursar: 1, registrar: 0, teacher: 0, viewer: 0 },
      { key: "finance_record_payment", action: "create", desc: "Record a fee payment / receipt", admin: 1, bursar: 1, registrar: 0, teacher: 0, viewer: 0 },
      { key: "finance_edit_payment", action: "edit", desc: "Edit a recorded payment", admin: 1, bursar: 0, registrar: 0, teacher: 0, viewer: 0 },
      { key: "finance_delete_payment", action: "delete", desc: "Delete / void a payment record", admin: 1, bursar: 0, registrar: 0, teacher: 0, viewer: 0 },
      { key: "finance_print_receipt", action: "print", desc: "Print a fee receipt", admin: 1, bursar: 1, registrar: 0, teacher: 0, viewer: 0 },
      { key: "finance_export_payments", action: "export", desc: "Export payments to CSV / Excel", admin: 1, bursar: 1, registrar: 0, teacher: 0, viewer: 0 },
      { key: "finance_view_reports", action: "view", desc: "View daily finance reports", admin: 1, bursar: 1, registrar: 0, teacher: 0, viewer: 0 },
      { key: "finance_submit_report", action: "approve", desc: "Submit the daily finance report", admin: 1, bursar: 1, registrar: 0, teacher: 0, viewer: 0 },
      { key: "finance_approve_report", action: "approve", desc: "Approve / close a daily report", admin: 1, bursar: 0, registrar: 0, teacher: 0, viewer: 0 },
      { key: "finance_view_expenses", action: "view", desc: "View expense entries", admin: 1, bursar: 1, registrar: 0, teacher: 0, viewer: 0 },
      { key: "finance_create_expense", action: "create", desc: "Add a daily expense entry", admin: 1, bursar: 1, registrar: 0, teacher: 0, viewer: 0 },
      { key: "finance_delete_expense", action: "delete", desc: "Delete an expense entry", admin: 1, bursar: 0, registrar: 0, teacher: 0, viewer: 0 },
    ],
  },
  staff: {
    keys: [
      { key: "staff_view", action: "view", desc: "View staff list and profiles", admin: 1, bursar: 0, registrar: 0, teacher: 0, viewer: 0 },
      { key: "staff_create", action: "create", desc: "Add a new staff member", admin: 1, bursar: 0, registrar: 0, teacher: 0, viewer: 0 },
      { key: "staff_edit", action: "edit", desc: "Edit staff personal details", admin: 1, bursar: 0, registrar: 0, teacher: 0, viewer: 0 },
      { key: "staff_delete", action: "delete", desc: "Delete / archive a staff member", admin: 1, bursar: 0, registrar: 0, teacher: 0, viewer: 0 },
      { key: "staff_view_payroll", action: "view", desc: "View payroll entries", admin: 1, bursar: 0, registrar: 0, teacher: 0, viewer: 0 },
      { key: "staff_create_payroll", action: "create", desc: "Add a payroll entry", admin: 1, bursar: 0, registrar: 0, teacher: 0, viewer: 0 },
      { key: "staff_edit_payroll", action: "edit", desc: "Edit a payroll entry", admin: 1, bursar: 0, registrar: 0, teacher: 0, viewer: 0 },
      { key: "staff_delete_payroll", action: "delete", desc: "Delete a payroll entry", admin: 1, bursar: 0, registrar: 0, teacher: 0, viewer: 0 },
      { key: "staff_print_payslip", action: "print", desc: "Print a payslip", admin: 1, bursar: 0, registrar: 0, teacher: 0, viewer: 0 },
      { key: "staff_export", action: "export", desc: "Export staff list to CSV", admin: 1, bursar: 0, registrar: 0, teacher: 0, viewer: 0 },
    ],
  },
  communication: {
    keys: [
      { key: "communication_view_notices", action: "view", desc: "View notice board entries", admin: 1, bursar: 1, registrar: 1, teacher: 1, viewer: 1 },
      { key: "communication_create_notice", action: "create", desc: "Post a new notice", admin: 1, bursar: 1, registrar: 1, teacher: 0, viewer: 0 },
      { key: "communication_edit_notice", action: "edit", desc: "Edit a posted notice", admin: 1, bursar: 0, registrar: 1, teacher: 0, viewer: 0 },
      { key: "communication_delete_notice", action: "delete", desc: "Delete a notice", admin: 1, bursar: 0, registrar: 0, teacher: 0, viewer: 0 },
      { key: "communication_send_message", action: "create", desc: "Send a direct message to a user", admin: 1, bursar: 1, registrar: 1, teacher: 1, viewer: 0 },
      { key: "communication_view_messages", action: "view", desc: "View inbox / sent messages", admin: 1, bursar: 1, registrar: 1, teacher: 1, viewer: 0 },
      { key: "communication_delete_message", action: "delete", desc: "Delete a message", admin: 1, bursar: 0, registrar: 0, teacher: 0, viewer: 0 },
      { key: "communication_print_notice", action: "print", desc: "Print a notice for display", admin: 1, bursar: 0, registrar: 1, teacher: 0, viewer: 0 },
    ],
  },
  dashboard: { keys: [] },
  curriculum: { keys: [] },
  settings: {
    keys: [
      { key: "settings_view_users", action: "view", desc: "View user accounts list", admin: 1, bursar: 0, registrar: 0, teacher: 0, viewer: 0 },
      { key: "settings_create_user", action: "create", desc: "Create a new user account", admin: 1, bursar: 0, registrar: 0, teacher: 0, viewer: 0 },
      { key: "settings_edit_user", action: "edit", desc: "Edit a user account / reset password", admin: 1, bursar: 0, registrar: 0, teacher: 0, viewer: 0 },
      { key: "settings_delete_user", action: "delete", desc: "Delete / deactivate a user", admin: 1, bursar: 0, registrar: 0, teacher: 0, viewer: 0 },
      { key: "settings_assign_role", action: "edit", desc: "Change a user's role", admin: 1, bursar: 0, registrar: 0, teacher: 0, viewer: 0 },
      { key: "settings_manage_permissions", action: "edit", desc: "Set per-user permission overrides", admin: 1, bursar: 0, registrar: 0, teacher: 0, viewer: 0 },
      { key: "settings_view_audit_log", action: "view", desc: "View system audit / activity log", admin: 1, bursar: 0, registrar: 0, teacher: 0, viewer: 0 },
      { key: "settings_school_info", action: "edit", desc: "Edit school name, logo, term dates", admin: 1, bursar: 0, registrar: 0, teacher: 0, viewer: 0 },
      { key: "settings_manage_periods", action: "edit", desc: "Create / edit academic periods", admin: 1, bursar: 0, registrar: 1, teacher: 0, viewer: 0 },
    ],
  },
};

export const ALL_PERMISSION_KEY_DEFS: PermissionKeyDef[] = MODULE_ORDER.flatMap(
  (id) => MODULES[id].keys,
);

export const ALL_PERMISSION_KEYS: string[] = ALL_PERMISSION_KEY_DEFS.map((k) => k.key);

export function getLegacyKeysCoveredByGranular(): Set<string> {
  const covered = new Set<string>();
  for (const aliases of Object.values(LEGACY_PERMISSION_MAP)) {
    for (const legacy of aliases) covered.add(legacy);
  }
  return covered;
}

let enrichedSectionsCache: EnrichedModuleSection[] | null = null;

/** Granular modules plus legacy-only keys grouped in the same accordions. */
export function getModuleSectionsEnriched(): EnrichedModuleSection[] {
  if (enrichedSectionsCache) return enrichedSectionsCache;
  const coveredLegacy = getLegacyKeysCoveredByGranular();
  const granularSet = new Set(ALL_PERMISSION_KEYS);

  enrichedSectionsCache = MODULE_ORDER.map((id) => {
    const sectorId = MODULE_TO_LEGACY_SECTOR[id];
    const sector = sectorId ? PERMISSION_SECTORS.find((s) => s.id === sectorId) : undefined;
    const legacyKeys = (sector?.keys ?? []).filter(
      (k) => !granularSet.has(k) && !coveredLegacy.has(k),
    );
    return {
      id,
      title: MODULE_TITLES[id],
      keys: MODULES[id].keys,
      legacyKeys: [...legacyKeys],
    };
  }).filter((s) => s.keys.length > 0 || s.legacyKeys.length > 0);

  return enrichedSectionsCache;
}

export function getModuleSections(): Array<{
  id: ModuleId;
  title: string;
  keys: PermissionKeyDef[];
}> {
  return getModuleSectionsEnriched().map(({ id, title, keys }) => ({ id, title, keys }));
}

export function listAllAssignablePermissionKeys(): string[] {
  const legacyOnly = getModuleSectionsEnriched().flatMap((s) => s.legacyKeys);
  return [...ALL_PERMISSION_KEYS, ...legacyOnly];
}

export function permissionDescription(key: string): string {
  const def = getKeyDef(key);
  if (def) return def.desc;
  return PERMISSION_DETAILS[key]?.description ?? key;
}

export function getKeyDef(key: string): PermissionKeyDef | undefined {
  return ALL_PERMISSION_KEY_DEFS.find((k) => k.key === key);
}

export function getDefaultCheckedForRole(role: string): Record<string, boolean> {
  const uiRole = roleFromApiSlug(role) ?? (PERMISSION_ROLES.includes(role as PermissionRoleSlug) ? role : null);
  const out: Record<string, boolean> = {};
  for (const k of listAllAssignablePermissionKeys()) out[k] = false;
  if (!uiRole || !PERMISSION_ROLES.includes(uiRole as PermissionRoleSlug)) {
    return out;
  }
  const slug = uiRole as PermissionRoleSlug;
  for (const def of ALL_PERMISSION_KEY_DEFS) {
    out[def.key] = Boolean(def[slug]);
  }
  return out;
}

export function buildCheckedFromMappings(
  role: string,
  mappings: Array<{ role: string; permissionKey: string }>,
): Record<string, boolean> {
  const apiRole = roleToApiSlug(role);
  const roleKeys = new Set(
    mappings
      .filter((m) => m.role === apiRole || m.role === role)
      .map((m) => m.permissionKey),
  );
  const assignable = listAllAssignablePermissionKeys();
  const hasStored = assignable.some((k) => roleKeys.has(k));
  if (!hasStored) {
    return getDefaultCheckedForRole(role);
  }
  const out: Record<string, boolean> = {};
  for (const k of assignable) {
    out[k] = roleKeys.has(k);
  }
  return out;
}

export function countSelected(checked: Record<string, boolean>): number {
  return listAllAssignablePermissionKeys().filter((k) => checked[k]).length;
}

export function permissionsEqual(
  a: Record<string, boolean>,
  b: Record<string, boolean>,
): boolean {
  return listAllAssignablePermissionKeys().every((k) => Boolean(a[k]) === Boolean(b[k]));
}

export function checkedToPermissionList(checked: Record<string, boolean>): string[] {
  return listAllAssignablePermissionKeys().filter((k) => checked[k]);
}

export function inferActionFromKey(key: string): PermissionAction {
  const def = getKeyDef(key);
  if (def) return def.action;
  if (key.includes("_view") || key.startsWith("view_")) return "view";
  if (key.includes("_create") || key.includes("_mark") || key.includes("_record_")) return "create";
  if (key.includes("_delete")) return "delete";
  if (key.includes("_print")) return "print";
  if (key.includes("_export")) return "export";
  if (key.includes("_approve") || key.includes("_submit_")) return "approve";
  if (key.includes("_restore")) return "restore";
  return "edit";
}
