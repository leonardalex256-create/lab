import { useEffect, useId, useRef, useState } from "react";
import type { PermissionKeyDef } from "./permissionModuleCatalog";
import { inferActionFromKey, permissionDescription } from "./permissionModuleCatalog";
import { roleGrantsPermissionKey } from "./legacyPermissionMap";
import { ActionBadge } from "./ActionBadge";

export type UserPermissionOverrideSectionProps = {
  moduleId: string;
  title: string;
  keys: PermissionKeyDef[];
  legacyKeys?: string[];
  rolePermissions: Set<string>;
  overrides: Record<string, boolean>;
  onCycleOverride: (key: string) => void;
  onClearOverride: (key: string) => void;
  defaultOpen?: boolean;
  disabled?: boolean;
};

function effectiveAllowed(
  key: string,
  rolePermissions: Set<string>,
  overrides: Record<string, boolean>,
): boolean {
  if (Object.prototype.hasOwnProperty.call(overrides, key)) {
    return Boolean(overrides[key]);
  }
  return roleGrantsPermissionKey(rolePermissions, key);
}

function fromRoleDirect(
  key: string,
  rolePermissions: Set<string>,
): boolean {
  return rolePermissions.has(key) || roleGrantsPermissionKey(rolePermissions, key);
}

export function UserPermissionOverrideSection({
  moduleId,
  title,
  keys,
  legacyKeys = [],
  rolePermissions,
  overrides,
  onCycleOverride,
  onClearOverride,
  defaultOpen = false,
  disabled = false,
}: UserPermissionOverrideSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [bodyHeight, setBodyHeight] = useState(0);
  const headerId = useId();
  const panelId = useId();

  const allKeys = [...keys.map((k) => k.key), ...legacyKeys];
  const grantedCount = allKeys.filter((k) => effectiveAllowed(k, rolePermissions, overrides)).length;

  useEffect(() => {
    if (!bodyRef.current) return;
    const ro = new ResizeObserver(() => {
      if (bodyRef.current) setBodyHeight(bodyRef.current.scrollHeight);
    });
    ro.observe(bodyRef.current);
    setBodyHeight(bodyRef.current.scrollHeight);
    return () => ro.disconnect();
  }, [keys, legacyKeys, overrides, open, rolePermissions]);

  function renderRow(key: string, desc: string, action: ReturnType<typeof inferActionFromKey>, isLegacy: boolean) {
    const allowed = effectiveAllowed(key, rolePermissions, overrides);
    const fromRole = fromRoleDirect(key, rolePermissions);
    const hasOverride = Object.prototype.hasOwnProperty.call(overrides, key);
    const overrideVal = hasOverride ? Boolean(overrides[key]) : null;

    const stateBadge =
      hasOverride && overrideVal === true
        ? { label: "Override: Allowed", cls: "bg-amber-50 text-amber-800 ring-amber-200" }
        : hasOverride && overrideVal === false
          ? { label: "Override: Denied", cls: "bg-rose-50 text-rose-700 ring-rose-200" }
          : fromRole && allowed
            ? { label: "From role", cls: "bg-slate-100 text-slate-700 ring-slate-200" }
            : { label: "Not granted", cls: "bg-slate-100 text-slate-500 ring-slate-200" };

    const toggleColor =
      hasOverride && overrideVal === true
        ? "bg-emerald-500 border-emerald-500"
        : hasOverride && overrideVal === false
          ? "bg-rose-500 border-rose-500"
          : fromRole && allowed
            ? "bg-blue-500 border-blue-500"
            : "bg-slate-200 border-slate-300";

    return (
      <div
        key={key}
        className={`flex items-start gap-3 px-4 py-3 sm:px-5 ${allowed ? "bg-indigo-50/20" : ""}`}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <code className="text-xs font-semibold text-slate-500">{key}</code>
            <ActionBadge action={action} />
            {isLegacy ? (
              <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500 ring-1 ring-slate-200">
                legacy
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 text-sm text-slate-600">{desc}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${stateBadge.cls}`}
            >
              {stateBadge.label}
            </span>
            {hasOverride && !disabled ? (
              <button
                type="button"
                onClick={() => onClearOverride(key)}
                className="text-[11px] font-semibold text-indigo-600 hover:underline"
              >
                Reset to role default
              </button>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={allowed}
          aria-label={`${key}: ${allowed ? "allowed" : "denied"}`}
          disabled={disabled}
          onClick={() => onCycleOverride(key)}
          className="mt-1 inline-flex shrink-0 items-center disabled:opacity-50"
          title="Cycle: Inherited → Override allow → Override deny → Inherited"
        >
          <span
            className={`relative inline-flex h-6 w-11 cursor-pointer rounded-full border transition-colors ${toggleColor}`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                allowed ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </span>
        </button>
      </div>
    );
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        id={headerId}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-4 py-3 text-left sm:px-5"
      >
        <svg
          className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.94a.75.75 0 111.08 1.04l-4.24 4.5a.75.75 0 01-1.08 0l-4.24-4.5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
        <span className="truncate text-sm font-bold text-slate-800">{title}</span>
        <span className="shrink-0 rounded-lg bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-indigo-700 ring-1 ring-indigo-100">
          {grantedCount} / {allKeys.length}
        </span>
      </button>

      <div
        id={panelId}
        role="region"
        aria-labelledby={headerId}
        className="overflow-hidden transition-[max-height] duration-300 ease-in-out"
        style={{ maxHeight: open ? `${bodyHeight}px` : "0px" }}
      >
        <div ref={bodyRef} className="divide-y divide-slate-100">
          {keys.map((def) => renderRow(def.key, def.desc, def.action, false))}
          {legacyKeys.map((key) =>
            renderRow(key, permissionDescription(key), inferActionFromKey(key), true),
          )}
        </div>
      </div>
    </section>
  );
}
