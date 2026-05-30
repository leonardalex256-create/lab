import { PERMISSION_KEYS, type PermissionKey } from "../constants/permissions.js";

/**
 * Validates a single permission key exists in PERMISSION_KEYS
 */
export function isValidPermissionKey(key: unknown): key is PermissionKey {
  return typeof key === "string" && PERMISSION_KEYS.includes(key as any);
}

/**
 * Validates an array of permission keys
 * @returns The valid keys, or throws error if any key is invalid
 */
export function validatePermissionKeys(keys: unknown[]): PermissionKey[] {
  const invalid = keys.filter((k) => !isValidPermissionKey(k));
  if (invalid.length > 0) {
    throw new Error(`Invalid permission keys: ${invalid.join(", ")}`);
  }
  return keys as PermissionKey[];
}

/**
 * Validates and filters permission keys, removing invalid ones
 * @returns Array of valid keys (invalid ones are filtered out silently)
 */
export function filterValidPermissionKeys(keys: unknown[]): PermissionKey[] {
  return keys.filter((k) => isValidPermissionKey(k)) as PermissionKey[];
}

/**
 * Gets all available permission keys organized by category
 */
export function getPermissionsByCategory() {
  const knownPrefixes = [
    "nav_",
    "students_",
    "classes_",
    "attendance_",
    "staff_",
    "curriculum_",
    "finance_",
    "communication_",
    "settings_",
  ] as const;
  return {
    navigation: PERMISSION_KEYS.filter((k) => k.startsWith("nav_")),
    students: PERMISSION_KEYS.filter((k) => k.startsWith("students_")),
    classes: PERMISSION_KEYS.filter((k) => k.startsWith("classes_")),
    attendance: PERMISSION_KEYS.filter((k) => k.startsWith("attendance_")),
    staff: PERMISSION_KEYS.filter((k) => k.startsWith("staff_")),
    curriculum: PERMISSION_KEYS.filter((k) => k.startsWith("curriculum_")),
    finance: PERMISSION_KEYS.filter((k) => k.startsWith("finance_")),
    communication: PERMISSION_KEYS.filter((k) => k.startsWith("communication_")),
    settings: PERMISSION_KEYS.filter((k) => k.startsWith("settings_")),
    other: PERMISSION_KEYS.filter((k) => !knownPrefixes.some((p) => k.startsWith(p))),
  };
}

/**
 * Checks if a permission key is in a specific category
 */
export function isPermissionInCategory(
  permission: PermissionKey,
  category: keyof ReturnType<typeof getPermissionsByCategory>,
): boolean {
  return getPermissionsByCategory()[category].includes(permission);
}
