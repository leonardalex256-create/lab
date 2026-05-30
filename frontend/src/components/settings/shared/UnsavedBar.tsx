import type { ReactNode } from "react";

export type UnsavedBarProps = {
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
  onDiscard: () => void;
  label?: string;
  saveLabel?: string;
  children?: ReactNode;
};

export function UnsavedBar({
  dirty,
  saving,
  onSave,
  onDiscard,
  label = "Unsaved changes",
  saveLabel = "Save",
  children,
}: UnsavedBarProps) {
  if (!dirty) return null;

  return (
    <div className="neo-card sticky bottom-4 z-10 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-xs font-semibold text-amber-600">{label}</span>
        </span>
        <button
          type="button"
          onClick={onDiscard}
          disabled={saving}
          className="text-xs font-bold text-slate-500 underline underline-offset-2 transition hover:text-slate-800 disabled:opacity-50"
        >
          Discard
        </button>
        {children}
      </div>
      <button
        type="button"
        onClick={onSave}
        disabled={saving}
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0c2340] to-[#1a3a5c] px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-[#0c2340]/20 transition-all hover:-translate-y-0.5 hover:shadow-xl disabled:pointer-events-none disabled:opacity-60"
      >
        {saving && (
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {saving ? "Saving…" : saveLabel}
      </button>
    </div>
  );
}
