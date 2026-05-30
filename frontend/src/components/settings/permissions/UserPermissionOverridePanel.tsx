import { useMemo, useState } from "react";
import {
  getModuleSectionsEnriched,
  listAllAssignablePermissionKeys,
  permissionDescription,
} from "./permissionModuleCatalog";
import { roleGrantsPermissionKey } from "./legacyPermissionMap";
import { UserPermissionOverrideSection } from "./UserPermissionOverrideSection";

export type UserPermissionOverridePanelProps = {
  userRole: string;
  rolePermissions: string[];
  overrides: Record<string, boolean>;
  onOverridesChange: (next: Record<string, boolean>) => void;
  searchQuery?: string;
  disabled?: boolean;
  className?: string;
};

function countEffectiveGranted(
  rolePermissionSet: Set<string>,
  overrides: Record<string, boolean>,
): number {
  return listAllAssignablePermissionKeys().filter((key) => {
    if (Object.prototype.hasOwnProperty.call(overrides, key)) {
      return Boolean(overrides[key]);
    }
    return roleGrantsPermissionKey(rolePermissionSet, key);
  }).length;
}

export function UserPermissionOverridePanel({
  userRole,
  rolePermissions,
  overrides,
  onOverridesChange,
  searchQuery = "",
  disabled = false,
  className = "",
}: UserPermissionOverridePanelProps) {
  const rolePermissionSet = useMemo(() => new Set(rolePermissions), [rolePermissions]);
  const [expandedInitialized] = useState(() => new Set(["students"]));

  const searchLower = searchQuery.trim().toLowerCase();

  const sections = useMemo(() => {
    return getModuleSectionsEnriched()
      .map((section) => {
        const keys = section.keys.filter((def) => {
          if (!searchLower) return true;
          return (
            def.key.toLowerCase().includes(searchLower) ||
            def.desc.toLowerCase().includes(searchLower)
          );
        });
        const legacyKeys = section.legacyKeys.filter((key) => {
          if (!searchLower) return true;
          const desc = permissionDescription(key);
          return key.toLowerCase().includes(searchLower) || desc.toLowerCase().includes(searchLower);
        });
        return { ...section, keys, legacyKeys };
      })
      .filter((section) => section.keys.length > 0 || section.legacyKeys.length > 0);
  }, [searchLower]);

  const grantedCount = countEffectiveGranted(rolePermissionSet, overrides);
  const totalCount = listAllAssignablePermissionKeys().length;

  function cycleOverride(permissionKey: string) {
    const baseAllowed = roleGrantsPermissionKey(rolePermissionSet, permissionKey);
    const hasOverride = Object.prototype.hasOwnProperty.call(overrides, permissionKey);

    if (!hasOverride) {
      onOverridesChange({ ...overrides, [permissionKey]: true });
      return;
    }
    const currentOverride = Boolean(overrides[permissionKey]);
    if (currentOverride === true) {
      onOverridesChange({ ...overrides, [permissionKey]: false });
      return;
    }
    const copy = { ...overrides };
    delete copy[permissionKey];
    onOverridesChange(copy);
  }

  function clearOverride(permissionKey: string) {
    const copy = { ...overrides };
    delete copy[permissionKey];
    onOverridesChange(copy);
  }

  return (
    <div className={className}>
      <p className="text-xs font-medium text-slate-500">
        Base role: <span className="font-bold text-slate-700">{userRole || "—"}</span>. Toggle switches
        cycle inherited → allow override → deny override → inherited. Only overrides are saved.
      </p>

      <p className="mt-3 text-sm font-semibold text-slate-700">
        <span className="font-black text-indigo-600">{grantedCount}</span>
        <span className="text-slate-500"> / {totalCount} effective permissions</span>
        {Object.keys(overrides).length > 0 ? (
          <span className="ml-2 text-xs font-bold text-amber-600">
            {Object.keys(overrides).length} override(s)
          </span>
        ) : null}
      </p>

      {sections.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-6 text-center">
          <p className="text-sm font-bold text-slate-800">No permissions match your search.</p>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {sections.map((section) => (
            <UserPermissionOverrideSection
              key={section.id}
              moduleId={section.id}
              title={section.title}
              keys={section.keys}
              legacyKeys={section.legacyKeys}
              rolePermissions={rolePermissionSet}
              overrides={overrides}
              onCycleOverride={cycleOverride}
              onClearOverride={clearOverride}
              defaultOpen={expandedInitialized.has(section.id)}
              disabled={disabled}
            />
          ))}
        </div>
      )}
    </div>
  );
}
