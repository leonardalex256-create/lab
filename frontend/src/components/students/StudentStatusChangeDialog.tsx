import { useEffect, useState } from "react";
import { useI18n } from "../../i18n/I18nProvider";
import { statusLabelFromRow } from "../../utils/studentStatusDisplay";
import type { StudentStatusRow } from "../../api/studentStatuses";

export type StatusFeeRecalcScope = "current_term" | "all_terms";

export function StudentStatusChangeDialog({
  open,
  fromLabel,
  toLabel,
  termLabel,
  busy,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  fromLabel: string;
  toLabel: string;
  termLabel: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (scope: StatusFeeRecalcScope) => void;
}) {
  const { t } = useI18n();
  const [scope, setScope] = useState<StatusFeeRecalcScope>("current_term");

  useEffect(() => {
    if (open) setScope("current_term");
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-md animate-in fade-in duration-200"
        onClick={busy ? undefined : onCancel}
        aria-hidden
      />
      <div
        className="relative w-full max-w-md rounded-[2rem] border border-amber-200/80 bg-white p-8 shadow-2xl animate-in zoom-in-95 duration-200"
        role="alertdialog"
        aria-labelledby="status-change-title"
        aria-describedby="status-change-desc"
      >
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-2xl">
          ⚠️
        </div>
        <h3 id="status-change-title" className="text-lg font-black text-[#0c2340]">
          {t("students.modal.statusChangeTitle")}
        </h3>
        <p id="status-change-desc" className="mt-2 text-sm leading-relaxed text-slate-600">
          {t("students.modal.statusChangeIntro")}{" "}
          <strong>{fromLabel}</strong> {t("students.modal.statusChangeTo")} <strong>{toLabel}</strong>.
          {" "}
          {t("students.modal.statusChangeChoose")}
        </p>

        <div className="mt-6 space-y-3">
          <label className="flex cursor-pointer gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 transition-colors has-[:checked]:border-teal-500 has-[:checked]:bg-teal-50/50">
            <input
              type="radio"
              name="statusFeeScope"
              className="mt-1"
              checked={scope === "current_term"}
              onChange={() => setScope("current_term")}
              disabled={busy}
            />
            <span className="text-sm">
              <span className="font-bold text-[#0c2340]">{t("students.modal.statusScopeCurrentTitle")}</span>
              <span className="mt-1 block text-slate-600">
                {t("students.modal.statusScopeCurrentBody")} <strong>{termLabel}</strong>.
              </span>
            </span>
          </label>

          <label className="flex cursor-pointer gap-3 rounded-2xl border border-rose-200/80 bg-rose-50/30 p-4 transition-colors has-[:checked]:border-rose-500 has-[:checked]:bg-rose-50/60">
            <input
              type="radio"
              name="statusFeeScope"
              className="mt-1"
              checked={scope === "all_terms"}
              onChange={() => setScope("all_terms")}
              disabled={busy}
            />
            <span className="text-sm">
              <span className="font-bold text-rose-900">{t("students.modal.statusScopeAllTitle")}</span>
              <span className="mt-1 block text-slate-600">{t("students.modal.statusScopeAllBody")}</span>
            </span>
          </label>
        </div>

        <div className="mt-8 flex gap-3">
          <button
            type="button"
            className="flex-1 rounded-xl bg-slate-100 py-3 text-sm font-bold text-slate-600 hover:bg-slate-200 disabled:opacity-50"
            onClick={onCancel}
            disabled={busy}
          >
            {t("students.modal.cancelEdit")}
          </button>
          <button
            type="button"
            className="flex-1 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 py-3 text-sm font-bold text-white shadow-lg disabled:opacity-50"
            onClick={() => onConfirm(scope)}
            disabled={busy}
          >
            {busy ? t("students.form.saving") : t("students.modal.statusChangeConfirm")}
          </button>
        </div>
      </div>
    </div>
  );
}

export { statusLabelFromRow };
export type { StudentStatusRow };
