import { useI18n } from "../../i18n/I18nProvider";
import { useTheme, type Density, type ThemePreference, type FontPreference } from "../../theme/ThemeProvider";

const optionBtn =
  "group relative overflow-hidden rounded-2xl border-2 p-4 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sky)]/60";


const themeOptions: Array<{ id: ThemePreference; labelKey: string }> = [
  { id: "light", labelKey: "settings.modes.themeLight" },
  { id: "dark", labelKey: "settings.modes.themeDark" },
  { id: "tinted-dark", labelKey: "settings.modes.themeTintedDark" },
  { id: "system", labelKey: "settings.modes.themeSystem" },
];

const fontOptions: Array<{ id: FontPreference; labelKey: string; family: string }> = [
  { id: "Inter", labelKey: "settings.modes.fontInter", family: "Inter" },
  { id: "Outfit", labelKey: "settings.modes.fontOutfit", family: "Outfit" },
  { id: "Poppins", labelKey: "settings.modes.fontPoppins", family: "Poppins" },
  { id: "Manrope", labelKey: "settings.modes.fontManrope", family: "Manrope" },
  { id: "Plus Jakarta Sans", labelKey: "settings.modes.fontJakarta", family: "Plus Jakarta Sans" },
];

export function SettingsModesPanel() {
  const { t } = useI18n();
  const {
    themePreference,
    setThemePreference,
    resolvedTheme,
    density,
    setDensity,
    fontFamily,
    setFontFamily,
  } = useTheme();
  const isDarkUi = resolvedTheme === "dark" || resolvedTheme === "tinted-dark";

  return (
    <div className="mx-auto max-w-4xl">
      <div
        className={`neo-card-elevated p-6 sm:p-8 ${
          isDarkUi ? "border border-[#334155] bg-[#111827]/90" : ""
        }`}
      >
        <div
          className={`rounded-2xl border p-5 ${
            isDarkUi
              ? "border-[#334155] bg-gradient-to-r from-[#0f172a] via-[#111827] to-[#172554]"
              : "border-[#ebe4d9]/80 bg-gradient-to-r from-[#f7f4ec] via-[#f3efe5] to-[#eef5fb]"
          }`}
        >
          <h1 className={`text-xl font-black tracking-tight ${isDarkUi ? "text-[#e2e8f0]" : "text-[#2d3436]"}`}>
            {t("settings.modes.title")}
          </h1>
          <p className={`mt-2 text-sm ${isDarkUi ? "text-[#94a3b8]" : "text-[#636e72]"}`}>
            {t("settings.modes.subtitle")}
          </p>
          {themePreference === "system" ? (
            <p
              className={`mt-2 inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold ring-1 ${
                isDarkUi
                  ? "bg-[#0f172a]/70 text-[#93c5fd] ring-[#334155]"
                  : "bg-white/70 text-[#5a8faf] ring-[#b9d9eb]"
              }`}
            >
              {t("settings.modes.resolved")}{" "}
              {resolvedTheme === "tinted-dark" ? t("settings.modes.themeTintedDark") : resolvedTheme === "dark" ? t("settings.modes.themeDark") : t("settings.modes.themeLight")}
            </p>
          ) : null}
        </div>

        <section className="mt-8">
          <div className="mb-3">
            <h2 className={`text-xs font-bold uppercase tracking-wide ${isDarkUi ? "text-[#94a3b8]" : "text-[#636e72]"}`}>
              {t("settings.modes.theme")}
            </h2>
            <p className={`mt-1 text-xs ${isDarkUi ? "text-[#94a3b8]/90" : "text-[#636e72]/90"}`}>
              {t("settings.modes.themeHint")}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-4">
            {themeOptions.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setThemePreference(opt.id)}
                className={`${optionBtn} ${
                  themePreference === opt.id
                    ? isDarkUi
                      ? "border-[#60a5fa] bg-[#0f172a] text-[#e2e8f0] shadow-[0_8px_20px_rgba(59,130,246,0.25)]"
                      : "border-[#5a8faf] bg-white text-[#2d3436] shadow-[0_8px_20px_rgba(90,143,175,0.25)]"
                    : isDarkUi
                      ? "border-[#334155] bg-[#111827]/70 text-[#94a3b8] hover:border-[#475569]"
                      : "border-[#ebe4d9]/90 bg-[#faf7f0]/60 text-[#636e72] hover:border-[#b9d9eb]/80"
                }`}
              >
                {t(opt.labelKey)}
              </button>
            ))}
          </div>
        </section>

        <section className={`mt-10 border-t pt-8 ${isDarkUi ? "border-[#334155]" : "border-[#ebe4d9]/80"}`}>
          <h2 className={`text-xs font-bold uppercase tracking-wide ${isDarkUi ? "text-[#94a3b8]" : "text-[#636e72]"}`}>
            {t("settings.modes.density")}
          </h2>
          <p className={`mt-1 text-xs ${isDarkUi ? "text-[#94a3b8]/90" : "text-[#636e72]/90"}`}>
            {t("settings.modes.densityHint")}
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {(
              [
                { id: "comfortable" as const, labelKey: "settings.modes.densityComfortable" },
                { id: "compact" as const, labelKey: "settings.modes.densityCompact" },
              ] satisfies { id: Density; labelKey: string }[]
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setDensity(opt.id)}
                className={`${optionBtn} ${
                  density === opt.id
                    ? isDarkUi
                      ? "border-[#60a5fa] bg-[#0f172a] text-[#e2e8f0] shadow-[0_8px_20px_rgba(59,130,246,0.25)]"
                      : "border-[#5a8faf] bg-gradient-to-br from-[#d4e8f5]/80 to-[#b9d9eb]/40 text-[#2d3436] shadow-[3px_3px_8px_rgba(90,143,175,0.3)]"
                    : isDarkUi
                      ? "border-[#334155] bg-[#111827]/70 text-[#94a3b8] hover:border-[#475569]"
                      : "border-[#ebe4d9]/90 bg-[#faf7f0]/60 text-[#636e72] hover:border-[#b9d9eb]/80"
                }`}
              >
                {t(opt.labelKey)}
              </button>
            ))}
          </div>
        </section>

        <section className={`mt-10 border-t pt-8 ${isDarkUi ? "border-[#334155]" : "border-[#ebe4d9]/80"}`}>
          <h2 className={`text-xs font-bold uppercase tracking-wide ${isDarkUi ? "text-[#94a3b8]" : "text-[#636e72]"}`}>
            {t("settings.modes.font")}
          </h2>
          <p className={`mt-1 text-xs ${isDarkUi ? "text-[#94a3b8]/90" : "text-[#636e72]/90"}`}>
            {t("settings.modes.fontHint")}
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {fontOptions.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setFontFamily(opt.id)}
                style={{ fontFamily: `'${opt.family}', sans-serif` }}
                className={`${optionBtn} ${
                  fontFamily === opt.id
                    ? isDarkUi
                      ? "border-[#60a5fa] bg-[#0f172a] text-[#e2e8f0] shadow-[0_8px_20px_rgba(59,130,246,0.25)]"
                      : "border-[#5a8faf] bg-gradient-to-br from-[#d4e8f5]/80 to-[#b9d9eb]/40 text-[#2d3436] shadow-[3px_3px_8px_rgba(90,143,175,0.3)]"
                    : isDarkUi
                      ? "border-[#334155] bg-[#111827]/70 text-[#94a3b8] hover:border-[#475569]"
                      : "border-[#ebe4d9]/90 bg-[#faf7f0]/60 text-[#636e72] hover:border-[#b9d9eb]/80"
                }`}
              >
                <div className="flex flex-col">
                  <span className="text-base font-bold">{t(opt.labelKey)}</span>
                  <span className="mt-1 text-[10px] opacity-70">
                    {t("settings.modes.fontPreview")}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
