import type { ReactNode } from "react";

export type PanelHeaderProps = {
  icon: ReactNode;
  title: string;
  description?: string;
  gradient?: boolean;
  action?: ReactNode;
};

export function PanelHeader({ icon, title, description, gradient, action }: PanelHeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-start gap-4">
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-xl shadow-lg ${
            gradient
              ? "bg-gradient-to-br from-[#0c2340] to-[#1a3a5c] text-white shadow-[#0c2340]/20"
              : "bg-slate-100 text-slate-700"
          }`}
        >
          {icon}
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900">{title}</h2>
          {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
