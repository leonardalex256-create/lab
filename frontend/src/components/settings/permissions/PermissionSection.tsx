import { useEffect, useId, useRef, useState } from "react";
import type { PermissionKeyDef } from "./permissionModuleCatalog";
import { inferActionFromKey, permissionDescription } from "./permissionModuleCatalog";
import { ActionBadge } from "./ActionBadge";

export type PermissionSectionProps = {
  moduleId: string;
  title: string;
  keys: PermissionKeyDef[];
  legacyKeys?: string[];
  checked: Record<string, boolean>;
  onToggle: (key: string) => void;
  onToggleAll: (nextChecked: boolean) => void;
  defaultOpen?: boolean;
  readOnly?: boolean;
};

function sectionKeys(keys: PermissionKeyDef[], legacyKeys: string[]): string[] {
  return [...keys.map((k) => k.key), ...legacyKeys];
}

export function PermissionSection({
  moduleId,
  title,
  keys,
  legacyKeys = [],
  checked,
  onToggle,
  onToggleAll,
  defaultOpen = false,
  readOnly = false,
}: PermissionSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [bodyHeight, setBodyHeight] = useState(0);
  const headerId = useId();
  const panelId = useId();

  const allKeys = sectionKeys(keys, legacyKeys);
  const selectedCount = allKeys.filter((k) => checked[k]).length;
  const totalCount = allKeys.length;
  const allSelected = totalCount > 0 && selectedCount === totalCount;

  useEffect(() => {
    if (!bodyRef.current) return;
    const ro = new ResizeObserver(() => {
      if (bodyRef.current) setBodyHeight(bodyRef.current.scrollHeight);
    });
    ro.observe(bodyRef.current);
    setBodyHeight(bodyRef.current.scrollHeight);
    return () => ro.disconnect();
  }, [keys, legacyKeys, checked, open]);

  function renderRow(key: string, desc: string, action: ReturnType<typeof inferActionFromKey>, isLegacy: boolean) {
    const inputId = `perm-${moduleId}-${key}`;
    const isOn = Boolean(checked[key]);
    return (
      <div
        key={key}
        role="button"
        tabIndex={readOnly ? -1 : 0}
        onClick={() => {
          if (!readOnly) onToggle(key);
        }}
        onKeyDown={(e) => {
          if (readOnly) return;
          if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            onToggle(key);
          }
        }}
        className={`flex cursor-pointer items-start gap-3 px-4 py-3 transition-colors sm:px-5 ${
          readOnly ? "cursor-default" : "hover:bg-slate-50"
        } ${isOn ? "bg-indigo-50/30" : ""}`}
      >
        <input
          id={inputId}
          type="checkbox"
          checked={isOn}
          disabled={readOnly}
          onChange={() => onToggle(key)}
          onClick={(e) => e.stopPropagation()}
          className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
          aria-describedby={`${inputId}-desc`}
        />
        <label htmlFor={inputId} className="min-w-0 flex-1 cursor-pointer">
          <div className="flex flex-wrap items-center gap-2">
            <code className="text-xs font-semibold text-slate-500">{key}</code>
            <ActionBadge action={action} />
            {isLegacy ? (
              <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500 ring-1 ring-slate-200">
                legacy
              </span>
            ) : null}
          </div>
          <p id={`${inputId}-desc`} className="mt-0.5 text-sm text-slate-600">
            {desc}
          </p>
        </label>
      </div>
    );
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-4 py-3 sm:px-5">
        <button
          type="button"
          id={headerId}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
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
            {selectedCount} / {totalCount}
          </span>
        </button>
        {!readOnly ? (
          <button
            type="button"
            onClick={() => onToggleAll(!allSelected)}
            className="shrink-0 text-xs font-bold text-indigo-600 hover:underline"
          >
            {allSelected ? "Deselect all" : "Select all"}
          </button>
        ) : null}
      </div>

      <div
        id={panelId}
        role="region"
        aria-labelledby={headerId}
        className="overflow-hidden transition-[max-height] duration-300 ease-in-out"
        style={{ maxHeight: open ? `${bodyHeight}px` : "0px" }}
      >
        <div ref={bodyRef} className="divide-y divide-slate-100" data-module={moduleId}>
          {keys.map((def) => renderRow(def.key, def.desc, def.action, false))}
          {legacyKeys.map((key) =>
            renderRow(key, permissionDescription(key), inferActionFromKey(key), true),
          )}
        </div>
      </div>
    </section>
  );
}
