import type { ReactNode } from "react";

export function SetupSectionCard({
  stepNum,
  title,
  hint,
  children,
  tone = "bg-indigo-100 text-indigo-700",
}: {
  stepNum: number;
  title: string;
  hint?: string;
  children: ReactNode;
  tone?: string;
}) {
  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4 sm:px-8">
        <h3 className="flex items-center gap-3 text-lg font-bold text-slate-800">
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${tone}`}
          >
            {stepNum}
          </span>
          {title}
        </h3>
        {hint ? <p className="mt-2 pl-11 text-sm text-slate-500">{hint}</p> : null}
      </div>
      <div className="p-6 sm:p-8">{children}</div>
    </div>
  );
}
