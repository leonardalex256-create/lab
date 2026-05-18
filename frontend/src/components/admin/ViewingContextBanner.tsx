import { useTermContext } from "../../context/TermContext";
import { useI18n } from "../../i18n/I18nProvider";

export function ViewingContextBanner() {
  const { t } = useI18n();
  const {
    isViewingSystemCurrent,
    viewingTerm,
    viewingAcademicYear,
    historicalReadOnly,
    resetViewingToSystem,
  } = useTermContext();

  if (isViewingSystemCurrent) return null;

  return (
    <div
      className="sticky top-0 z-40 mb-4 flex flex-wrap items-center justify-center gap-3 border border-amber-200/90 bg-amber-50/95 px-3 py-2.5 text-center text-xs font-semibold text-amber-950 shadow-sm sm:text-sm"
      role="status"
    >
      <span>
        {t("termContext.bannerPrefix")}{" "}
        <strong>
          {viewingTerm} · {viewingAcademicYear}
        </strong>
        {historicalReadOnly
          ? ` ${t("termContext.bannerReadOnly")}`
          : ` ${t("termContext.bannerEditable")}`}
      </span>
      <button
        type="button"
        onClick={() => resetViewingToSystem()}
        className="shrink-0 rounded-full bg-amber-700 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-white shadow-sm transition hover:bg-amber-800 sm:text-[11px]"
      >
        {t("termContext.switchToCurrent")}
      </button>
    </div>
  );
}
