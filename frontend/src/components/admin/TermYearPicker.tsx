import { useEffect, useRef, useState } from "react";
import { TERM_OPTIONS, useTermContext } from "../../context/TermContext";
import { useI18n } from "../../i18n/I18nProvider";

export function TermYearPicker() {
  const { t } = useI18n();
  const {
    status,
    viewingTerm,
    viewingAcademicYear,
    setViewingTerm,
    setViewingAcademicYear,
    isViewingSystemCurrent,
    yearChoices,
  } = useTermContext();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const label =
    status === "loading"
      ? t("termContext.loadingShort")
      : `${viewingTerm} · ${viewingAcademicYear}`;

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={`flex max-w-[11rem] items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold shadow-sm transition sm:max-w-[13rem] sm:text-[11px] ${
          isViewingSystemCurrent
            ? "border-[#ebe4d9]/90 bg-white/90 text-[#2d3436]"
            : "border-amber-300/80 bg-amber-50/95 text-amber-950"
        }`}
      >
        <span aria-hidden>📅</span>
        <span className="min-w-0 truncate">{label}</span>
        {!isViewingSystemCurrent ? (
          <span className="shrink-0 rounded bg-amber-200/80 px-1 py-0.5 text-[8px] font-black uppercase tracking-wide text-amber-900">
            {t("termContext.historicalBadge")}
          </span>
        ) : null}
        <span className="shrink-0 text-[#636e72]">▾</span>
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label={t("termContext.pickerTitle")}
          className="neo-dropdown absolute right-0 top-full z-[70] mt-2 w-[min(18rem,calc(100vw-1.5rem))] overflow-hidden p-3 shadow-lg"
        >
          <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-[#636e72]">
            {t("termContext.termLabel")}
          </p>
          <div className="mb-3 flex flex-col gap-1">
            {TERM_OPTIONS.map((opt) => (
              <label
                key={opt}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-semibold text-[#2d3436] hover:bg-[#b9d9eb]/25"
              >
                <input
                  type="radio"
                  name="term_ctx_term"
                  checked={viewingTerm === opt}
                  onChange={() => setViewingTerm(opt)}
                  className="accent-[#5a8faf]"
                />
                {opt}
              </label>
            ))}
          </div>
          <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-[#636e72]">
            {t("termContext.yearLabel")}
          </p>
          <select
            value={viewingAcademicYear}
            onChange={(e) => setViewingAcademicYear(e.target.value)}
            className="neo-inset-field w-full rounded-xl px-3 py-2 text-sm font-bold text-[#2d3436] outline-none"
          >
            {yearChoices.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <p className="mt-2 text-[10px] font-medium leading-snug text-[#636e72]">
            {t("termContext.pickerHint")}
          </p>
        </div>
      ) : null}
    </div>
  );
}
