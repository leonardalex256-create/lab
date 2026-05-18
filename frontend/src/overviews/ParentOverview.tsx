import { useEffect, useMemo, useState } from "react";
import type { DashboardPayload } from "../api/dashboard";
import { useTermContext } from "../context/TermContext";
import {
  EventScheduleCard,
  OverviewErrorBanner,
  OverviewSkeletonCard,
  StatCard,
} from "../dashboards/OverviewShared";
import {
  fetchChildAcademicSummary,
  fetchChildFinanceMiniStatement,
  type ChildAcademicSummaryRow,
  type ChildFinanceMiniStatement,
} from "../api/parents";

type ParentOverviewProps = {
  dash: DashboardPayload | null;
  loading: boolean;
  onViewStatement?: (studentId: number) => void;
};

function pill(active: boolean): string {
  return active
    ? "rounded-full bg-indigo-600 px-4 py-2 text-xs font-black text-white"
    : "rounded-full bg-slate-100 px-4 py-2 text-xs font-black text-slate-700 hover:bg-slate-200";
}

export function ParentOverview({ dash, loading, onViewStatement }: ParentOverviewProps) {
  const { viewingTerm, viewingAcademicYear } = useTermContext();

  const children = dash?.linkedChildren ?? [];
  const [selectedChildId, setSelectedChildId] = useState<number | null>(
    children.length > 0 ? children[0]!.id : null,
  );

  useEffect(() => {
    if (children.length === 0) {
      setSelectedChildId(null);
      return;
    }
    if (selectedChildId == null || !children.some((c) => c.id === selectedChildId)) {
      setSelectedChildId(children[0]!.id);
    }
  }, [children, selectedChildId]);

  const [academic, setAcademic] = useState<ChildAcademicSummaryRow[]>([]);
  const [academicLoading, setAcademicLoading] = useState(false);
  const [academicError, setAcademicError] = useState<string | null>(null);

  const [fin, setFin] = useState<ChildFinanceMiniStatement | null>(null);
  const [finLoading, setFinLoading] = useState(false);
  const [finError, setFinError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedChildId) return;
    let cancelled = false;
    setAcademicLoading(true);
    setAcademicError(null);
    void fetchChildAcademicSummary(selectedChildId, viewingTerm, viewingAcademicYear)
      .then((rows) => {
        if (!cancelled) setAcademic(rows);
      })
      .catch((e) => {
        if (!cancelled) setAcademicError(e instanceof Error ? e.message : "Failed to load academic summary");
      })
      .finally(() => {
        if (!cancelled) setAcademicLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedChildId, viewingTerm, viewingAcademicYear]);

  useEffect(() => {
    if (!selectedChildId) return;
    let cancelled = false;
    setFinLoading(true);
    setFinError(null);
    void fetchChildFinanceMiniStatement(selectedChildId, viewingTerm, viewingAcademicYear)
      .then((data) => {
        if (!cancelled) setFin(data);
      })
      .catch((e) => {
        if (!cancelled) setFinError(e instanceof Error ? e.message : "Failed to load fee status");
      })
      .finally(() => {
        if (!cancelled) setFinLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedChildId, viewingTerm, viewingAcademicYear]);

  const selectedChild = useMemo(
    () => (selectedChildId ? children.find((c) => c.id === selectedChildId) ?? null : null),
    [children, selectedChildId],
  );

  const feeBalance = Number(fin?.balanceDue ?? 0);
  const attendanceRate = Number(fin?.attendanceRate ?? 0);
  const termAverage = Number(fin?.termAverageScore ?? 0);

  if (loading && !dash) {
    return (
      <div className="p-8 text-center animate-pulse text-slate-400 font-semibold">
        Loading Parent Dashboard…
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="border-b border-slate-200 pb-6">
        <h1 className="text-3xl font-black tracking-tight text-slate-800">
          Parent Portal — {dash?.userName ?? "Parent"}
        </h1>
        <p className="mt-2 text-sm font-semibold text-slate-500">
          Viewing linked children for {viewingTerm}
        </p>
      </header>

      {children.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          {children.map((c) => (
            <button
              key={c.id}
              type="button"
              className={pill(c.id === selectedChildId)}
              onClick={() => setSelectedChildId(c.id)}
            >
              {c.name} • {c.className}
            </button>
          ))}
        </div>
      ) : null}

      {!selectedChildId ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-slate-500 italic">
          No linked children found for this account.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard
              title="Term Average Score"
              value={finLoading ? "…" : Number.isFinite(termAverage) ? termAverage.toFixed(1) : "—"}
              className="border-l-4 border-l-indigo-500"
              iconTint="bg-indigo-50 text-indigo-700"
              icon={<span className="text-xl">📊</span>}
            />
            <StatCard
              title="Fee Balance"
              value={finLoading ? "…" : Number.isFinite(feeBalance) ? feeBalance.toLocaleString("en-UG") : "—"}
              className={feeBalance > 0 ? "border-l-4 border-l-rose-500" : "border-l-4 border-l-emerald-500"}
              iconTint={feeBalance > 0 ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}
              icon={<span className="text-xl">💳</span>}
            />
            <StatCard
              title="Attendance Rate"
              value={finLoading ? "…" : Number.isFinite(attendanceRate) ? `${attendanceRate.toFixed(1)}%` : "—"}
              className="border-l-4 border-l-amber-500"
              iconTint="bg-amber-50 text-amber-700"
              icon={<span className="text-xl">✅</span>}
            />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-4">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">
                    Academic Summary
                  </h3>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    {selectedChild?.name ?? "Child"} • {selectedChild?.className ?? "—"}
                  </span>
                </div>
                {academicError ? (
                  <div className="mb-4">
                    <OverviewErrorBanner message={academicError} />
                  </div>
                ) : null}
                {academicLoading ? (
                  <OverviewSkeletonCard rows={5} />
                ) : academic.length === 0 ? (
                  <p className="text-sm text-slate-500 italic text-center py-8">
                    No results recorded yet for this term.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500">
                          <th className="py-2 font-semibold">Subject</th>
                          <th className="py-2 font-semibold text-center">Score</th>
                          <th className="py-2 font-semibold text-center">Grade</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {academic.map((r, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/60 transition">
                            <td className="py-3 font-bold text-slate-800">{r.subject}</td>
                            <td className="py-3 text-center font-bold text-slate-700">
                              {r.score == null ? "—" : r.score.toFixed(1)}
                            </td>
                            <td className="py-3 text-center font-black text-indigo-700">
                              {r.grade ?? "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </div>

            <div className="space-y-6">
              <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="mb-3 border-b border-slate-100 pb-2 text-sm font-bold uppercase tracking-wider text-slate-500">
                  Fee Statement
                </h3>
                {finError ? (
                  <div className="mb-4">
                    <OverviewErrorBanner message={finError} />
                  </div>
                ) : null}
                {finLoading ? (
                  <OverviewSkeletonCard rows={3} />
                ) : (
                  <div className="space-y-3 text-xs font-semibold text-slate-700">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Total Fees</span>
                      <span className="font-black">{(fin?.totalFees ?? 0).toLocaleString("en-UG")}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Amount Paid</span>
                      <span className="font-black">{(fin?.amountPaid ?? 0).toLocaleString("en-UG")}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Balance Due</span>
                      <span className={`font-black ${feeBalance > 0 ? "text-rose-700" : "text-emerald-700"}`}>
                        {(fin?.balanceDue ?? 0).toLocaleString("en-UG")}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="mt-2 w-full rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-xs font-black text-indigo-950 shadow-sm transition hover:bg-indigo-100 disabled:opacity-60 disabled:cursor-not-allowed"
                      onClick={() => {
                        if (selectedChildId) onViewStatement?.(selectedChildId);
                      }}
                      disabled={!onViewStatement}
                      title={!onViewStatement ? "Access not granted." : undefined}
                    >
                      View Full Statement
                    </button>
                  </div>
                )}
              </section>

              <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="mb-3 border-b border-slate-100 pb-2 text-sm font-bold uppercase tracking-wider text-slate-500">
                  School Notices
                </h3>
                <div className="space-y-3">
                  {(dash?.notices ?? []).slice(0, 3).map((n, i) => (
                    <div
                      key={i}
                      className="flex gap-3 rounded-xl border-l-4 border-indigo-300 bg-indigo-50/40 p-3"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-bold uppercase text-indigo-600">{n.author}</p>
                        <p className="mt-0.5 text-xs leading-relaxed text-slate-600 line-clamp-2">
                          {n.text}
                        </p>
                      </div>
                      <span className="shrink-0 text-[10px] font-semibold text-slate-400 whitespace-nowrap">
                        {n.date}
                      </span>
                    </div>
                  ))}
                  {(dash?.notices ?? []).length === 0 && (
                    <p className="text-xs text-slate-400 italic text-center py-4">
                      No active notices.
                    </p>
                  )}
                </div>
              </section>

              <EventScheduleCard calendar={dash?.calendar ?? null} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

