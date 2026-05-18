import { useEffect, useMemo, useState } from "react";
import { type DashboardPayload } from "../api/dashboard";
import { fetchPerformanceSummary, type PerformanceSummaryRow } from "../api/academics";
import { useI18n } from "../i18n/I18nProvider";
import { useTermContext } from "../context/TermContext";
import { StatCard, EventScheduleCard, DashboardSectionTitle, OverviewErrorBanner } from "./OverviewShared";

export function DOSOverview({ dash, loading }: { dash: DashboardPayload | null, loading: boolean }) {
  const { t } = useI18n();
  const { viewingTerm, viewingAcademicYear } = useTermContext();
  const [summary, setSummary] = useState<PerformanceSummaryRow[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const availableExamTypes = useMemo(
    () => dash?.availableExamTypes ?? ["BOT", "MID", "EOT"],
    [dash?.availableExamTypes],
  );
  const [selectedExamType, setSelectedExamType] = useState("BOT");

  useEffect(() => {
    if (!availableExamTypes.includes(selectedExamType)) {
      setSelectedExamType(availableExamTypes[0] ?? "BOT");
    }
  }, [availableExamTypes, selectedExamType]);

  useEffect(() => {
    let cancelled = false;
    setSummaryLoading(true);
    setError(null);
    void fetchPerformanceSummary(viewingTerm, selectedExamType, viewingAcademicYear)
      .then((rows) => {
        if (!cancelled) setSummary(rows);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load performance data");
        }
      })
      .finally(() => {
        if (!cancelled) setSummaryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [viewingTerm, viewingAcademicYear, selectedExamType]);

  const s = dash?.stats;
  const avgPassRate = summary.length > 0 
    ? (summary.reduce((acc, r) => acc + (r.passRate ?? 0), 0) / summary.length).toFixed(1)
    : "—";
  
  const avgScore = summary.length > 0
    ? (summary.reduce((acc, r) => acc + (r.avgScore ?? 0), 0) / summary.length).toFixed(1)
    : "—";

  if (loading && !dash) {
    return <div className="p-8 text-center animate-pulse text-[#636e72] font-semibold">Loading Academic Dashboard...</div>;
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <DashboardSectionTitle 
        title={t("dashboard.dosOverview")} 
        subtitle="Academic performance, grading status, and school calendar" 
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Average Pass Rate"
          value={`${avgPassRate}%`}
          className="bg-gradient-to-br from-[#e8f4e9] to-[#c5e3c8]"
          iconTint="bg-white/40 text-[#2d3436]"
          icon={<span className="text-xl">📈</span>}
        />
        <StatCard
          title="Average Score"
          value={avgScore}
          className="bg-gradient-to-br from-[#e8f2fa] to-[#c5dff0]"
          iconTint="bg-white/40 text-[#2d3436]"
          icon={<span className="text-xl">🎯</span>}
        />
        <StatCard
          title="Present Today"
          value={String(s?.presentToday ?? "—")}
          className="bg-gradient-to-br from-[#fce8e5] to-[#efd5d2]"
          iconTint="bg-white/40 text-[#2d3436]"
          icon={<span className="text-xl">🙋‍♂️</span>}
        />
        <StatCard
          title="Total Teachers"
          value={String(s?.totalTeachers ?? "—")}
          className="bg-gradient-to-br from-[#dfe8f5] to-[#a8bdd9]"
          iconTint="bg-white/40 text-[#2d3436]"
          icon={<span className="text-xl">🧑‍🏫</span>}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <section className="neo-card p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-[#636e72]">
                Performance by Class ({selectedExamType} {viewingTerm})
              </h3>
              <select
                value={selectedExamType}
                onChange={(e) => setSelectedExamType(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700"
              >
                {availableExamTypes.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </div>
            {error ? (
              <div className="mb-4">
                <OverviewErrorBanner message={error} />
              </div>
            ) : null}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#ebe4d9] text-[#636e72]">
                    <th className="pb-2 font-semibold">Class</th>
                    <th className="pb-2 font-semibold text-center">Enrolled</th>
                    <th className="pb-2 font-semibold text-center">Graded</th>
                    <th className="pb-2 font-semibold text-center">Avg Score</th>
                    <th className="pb-2 font-semibold text-right">Pass Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#ebe4d9]/50">
                  {summary.map((row, i) => (
                    <tr key={i} className="group hover:bg-[#faf7f0]/50 transition">
                      <td className="py-2.5 font-bold text-[#2d3436]">{row.className} {row.sectionName}</td>
                      <td className="py-2.5 text-center font-semibold text-[#636e72]">{row.totalStudents}</td>
                      <td className="py-2.5 text-center font-semibold text-[#636e72]">{row.resultsEntered}</td>
                      <td className="py-2.5 text-center font-bold text-[#5a8faf]">{row.avgScore?.toFixed(1) ?? "—"}</td>
                      <td className="py-2.5 text-right font-bold text-[#6a9570]">{row.passRate?.toFixed(1) ?? "—"}%</td>
                    </tr>
                  ))}
                  {summary.length === 0 && !summaryLoading && (
                    <tr><td colSpan={5} className="py-8 text-center text-[#636e72] italic">No performance data found for this term.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
        <div className="space-y-6">
          <EventScheduleCard calendar={dash?.calendar ?? null} />
          <section className="neo-card p-5 bg-gradient-to-br from-[#f5f0e6] to-[#e8f2ec]">
            <h3 className="text-sm font-bold text-[#2d3436] mb-2 uppercase tracking-tight">Academic Alerts</h3>
            {(dash?.academicAlerts ?? []).length === 0 ? (
              <p className="text-xs text-[#636e72] italic opacity-80">No active academic alerts.</p>
            ) : (
              <ul className="space-y-2 text-xs font-semibold text-[#636e72]">
                {(dash?.academicAlerts ?? []).map((a, idx) => {
                  const dot =
                    a.level === "danger"
                      ? "bg-red-400"
                      : a.level === "warning"
                        ? "bg-amber-400"
                        : "bg-blue-400";
                  return (
                    <li key={idx} className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${dot}`} />
                      {a.message}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
