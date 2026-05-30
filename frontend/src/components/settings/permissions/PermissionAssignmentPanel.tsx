import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ConfirmModal } from "../shared/ConfirmModal";
import { PermissionSection } from "./PermissionSection";
import {
  ALL_PERMISSION_KEYS,
  buildCheckedFromMappings,
  checkedToPermissionList,
  countSelected,
  getDefaultCheckedForRole,
  getModuleSectionsEnriched,
  listAllAssignablePermissionKeys,
  PERMISSION_ROLES,
  permissionsEqual,
  roleToApiSlug,
  ROLE_LABELS,
  type PermissionRoleSlug,
} from "./permissionModuleCatalog";

export type PermissionMapping = {
  role: string;
  permissionKey: string;
};

export type PermissionAssignmentPanelProps = {
  initialRole?: string;
  mappings?: PermissionMapping[];
  onSave?: (role: string, permissionKeys: string[]) => Promise<void>;
  readOnly?: boolean;
  className?: string;
};

export function PermissionAssignmentPanel({
  initialRole = "admin",
  mappings = [],
  onSave,
  readOnly = false,
  className = "",
}: PermissionAssignmentPanelProps) {
  const sections = useMemo(() => getModuleSectionsEnriched(), []);
  const [selectedRole, setSelectedRole] = useState<PermissionRoleSlug>(() => {
    const r = initialRole.toLowerCase();
    if (PERMISSION_ROLES.includes(r as PermissionRoleSlug)) return r as PermissionRoleSlug;
    if (r === "accountant") return "bursar";
    return "admin";
  });
  const [checkedPerms, setCheckedPerms] = useState<Record<string, boolean>>(() =>
    buildCheckedFromMappings(initialRole, mappings),
  );
  const [expandedInitialized] = useState(() => new Set(["students"]));
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);
  const [pendingRole, setPendingRole] = useState<PermissionRoleSlug | null>(null);

  const serverBaselineRef = useRef<Record<string, boolean>>(
    buildCheckedFromMappings(selectedRole, mappings),
  );
  const defaultBaselineRef = useRef<Record<string, boolean>>(
    getDefaultCheckedForRole(selectedRole),
  );

  const loadRoleState = useCallback(
    (role: PermissionRoleSlug) => {
      const fromServer = buildCheckedFromMappings(role, mappings);
      serverBaselineRef.current = { ...fromServer };
      defaultBaselineRef.current = getDefaultCheckedForRole(role);
      setCheckedPerms({ ...fromServer });
    },
    [mappings],
  );

  useEffect(() => {
    loadRoleState(selectedRole);
  }, [mappings, selectedRole, loadRoleState]);

  const isDirtyVsServer = useMemo(
    () => !permissionsEqual(checkedPerms, serverBaselineRef.current),
    [checkedPerms],
  );

  const selectedCount = countSelected(checkedPerms);
  const totalCount = listAllAssignablePermissionKeys().length;

  function handleToggle(key: string) {
    setCheckedPerms((prev) => ({ ...prev, [key]: !prev[key] }));
    setStatusMessage(null);
  }

  function handleToggleSection(moduleKeys: string[], nextChecked: boolean) {
    setCheckedPerms((prev) => {
      const copy = { ...prev };
      for (const k of moduleKeys) copy[k] = nextChecked;
      return copy;
    });
    setStatusMessage(null);
  }

  function requestRoleChange(role: PermissionRoleSlug) {
    if (role === selectedRole) return;
    if (isDirtyVsServer) {
      setPendingRole(role);
      setConfirmDiscardOpen(true);
      return;
    }
    setSelectedRole(role);
  }

  function confirmDiscardAndSwitch() {
    if (pendingRole) {
      setSelectedRole(pendingRole);
      setPendingRole(null);
    }
    setConfirmDiscardOpen(false);
  }

  function handleResetToDefaults() {
    setCheckedPerms(getDefaultCheckedForRole(selectedRole));
    setStatusMessage(null);
  }

  async function handleSave() {
    if (!onSave || readOnly || !isDirtyVsServer) return;
    setIsSaving(true);
    setStatusMessage(null);
    try {
      const keys = checkedToPermissionList(checkedPerms);
      await onSave(roleToApiSlug(selectedRole), keys);
      serverBaselineRef.current = { ...checkedPerms };
      setStatusMessage("Permissions saved successfully.");
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : "Failed to save permissions.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className={`relative flex flex-col ${className}`}>
      <div className="inline-flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
        {PERMISSION_ROLES.map((role) => (
          <button
            key={role}
            type="button"
            onClick={() => requestRoleChange(role)}
            className={`rounded-lg px-4 py-2 text-xs font-bold transition-all ${
              selectedRole === role
                ? "bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200"
                : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            }`}
          >
            {ROLE_LABELS[role]}
          </button>
        ))}
      </div>

      <p className="mt-2 text-xs font-medium text-slate-500">
        Configure defaults for <span className="font-bold text-slate-700">{ROLE_LABELS[selectedRole]}</span>
        {selectedRole === "bursar" ? (
          <span className="text-slate-400"> (stored as role <code className="text-[10px]">accountant</code>)</span>
        ) : null}
        . Changes apply to all users with this role after save.
      </p>

      {statusMessage ? (
        <div
          className={`mt-3 rounded-xl border px-4 py-3 text-sm font-semibold ${
            statusMessage.includes("success")
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {statusMessage}
        </div>
      ) : null}

      <div className="mt-4 space-y-3 pb-28">
        {sections.map((section) => (
          <PermissionSection
            key={section.id}
            moduleId={section.id}
            title={section.title}
            keys={section.keys}
            checked={checkedPerms}
            onToggle={handleToggle}
            legacyKeys={section.legacyKeys}
            onToggleAll={(next) =>
              handleToggleSection(
                [...section.keys.map((k) => k.key), ...section.legacyKeys],
                next,
              )
            }
            defaultOpen={expandedInitialized.has(section.id)}
            readOnly={readOnly}
          />
        ))}
      </div>

      <div className="sticky bottom-0 z-10 -mx-1 mt-2 border-t border-slate-200 bg-white/95 px-1 py-4 backdrop-blur-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-semibold text-slate-700">
            <span className="font-black text-indigo-600">{selectedCount}</span>
            <span className="text-slate-500"> / {totalCount} permissions selected</span>
            {isDirtyVsServer ? (
              <span className="ml-2 text-xs font-bold text-amber-600">Unsaved changes</span>
            ) : null}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            {!readOnly ? (
              <button
                type="button"
                onClick={handleResetToDefaults}
                disabled={permissionsEqual(checkedPerms, getDefaultCheckedForRole(selectedRole))}
                className="text-sm font-bold text-slate-600 hover:text-indigo-600 disabled:opacity-40"
              >
                Reset to defaults
              </button>
            ) : null}
            {!readOnly && onSave ? (
              <button
                type="button"
                disabled={!isDirtyVsServer || isSaving}
                onClick={() => void handleSave()}
                className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-200 transition hover:bg-indigo-700 disabled:pointer-events-none disabled:opacity-50"
              >
                {isSaving ? "Saving…" : "Save permissions"}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <ConfirmModal
        open={confirmDiscardOpen}
        title="Discard unsaved changes?"
        description="You have unsaved permission changes for this role. Switching roles will discard them."
        confirmLabel="Discard"
        cancelLabel="Stay"
        variant="danger"
        onClose={() => {
          setConfirmDiscardOpen(false);
          setPendingRole(null);
        }}
        onConfirm={confirmDiscardAndSwitch}
      />
    </div>
  );
}
