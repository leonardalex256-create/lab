import type { ReactNode } from "react";

export type SettingsRowProps = {
  label: string;
  description?: string;
  required?: boolean;
  children?: ReactNode;
  /** @deprecated Prefer children — kept for panel migration */
  control?: ReactNode;
};

export function SettingsRow({ label, description, required, children, control }: SettingsRowProps) {
  const content = children ?? control;
  return (
    <div className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="sm:max-w-xs">
        <label className="text-sm font-semibold text-slate-700">
          {label}
          {required ? <span className="ml-1 text-red-500">*</span> : null}
        </label>
        {description ? <p className="mt-0.5 text-xs text-slate-500">{description}</p> : null}
      </div>
      <div className="w-full sm:max-w-md">{content}</div>
    </div>
  );
}
