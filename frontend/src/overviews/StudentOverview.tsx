import { useEffect, useMemo, useState } from "react";
import type { DashboardPayload } from "../api/dashboard";
import {
  EventScheduleCard,
  LearnerProfileCard,
  OverviewErrorBanner,
  OverviewSkeletonCard,
  StatCard,
} from "../dashboards/OverviewShared";
import { fetchStudentResultSummary, type StudentResultSummaryRow } from "../api/results";

export function StudentOverview({
  dash,
  loading,
}: {
  dash: DashboardPayload | null;
  loading: boolean;
}) {
  const learner = dash?.learner ?? null;
  const [rows, setRows] = useState<StudentResultSummaryRow[]>([]);
  const [rowsLoading, setRowsLoading] = useState(false);
  const [rowsError, setRowsError] = useState<string | null>(null);

  useEffect(() => {
    const studentId = learner?.id;
    if (!studentId) {
      setRows([]);
      return;
    }
    let cancelled = false;
    setRowsLoading(true);
    setRowsError(null);
    void fetchStudentResultSummary(studentId)
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .catch((e) => {
        if (!cancelled) {
          setRowsError(e instanceof Error ? e.message : "Failed to load results");
        }
      })
      .finally(() => {
        if (!cancelled) setRowsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [learner?.id]);

  const s = dash?.stats;

  const subjectCount = useMemo(() => {
    const n = s?.mySubjectsCount;
    return Number.isFinite(Number(n)) ? Number(n) : null;
  }, [s?.mySubjectsCount]);

  const lastExamAvg = useMemo(() => {
    const n = s?.lastExamAverage;
    return Number.isFinite(Number(n)) ? Number(n) : null;
  }, [s?.lastExamAverage]);

  const feeBalance = Number(s?.feeBalance ?? 0);
  const attendanceRate = Number(s?.attendanceRate ?? 0);

  if (loading && !dash) {
    return (
      <div className="p-8 text-center animate-pulse text-slate-400 font-semibold">
        Loading Student Dashboard…
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="border-b border-slate-200 pb-6">
        <h1 className="text-3xl font-black tracking-tight text-slate-800">
          Hello, {learner?.name ?? "Learner"} 👋
        </h1>
        <p className="mt-2 text-sm font-semibold text-slate-500">
          {learner?.className ?? "—"} • {learner?.admissionNumber ?? "—"}
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="My Subjects"
          value={subjectCount == null ? "—" : String(subjectCount)}
          className="border-l-4 border-l-indigo-500"
          iconTint="bg-indigo-50 text-indigo-700"
          icon={<span className="text-xl">📚</span>}
        />
        <StatCard
          title="Last Exam Average"
          value={lastExamAvg == null ? "—" : lastExamAvg.toFixed(1)}
          className="border-l-4 border-l-sky-500"
          iconTint="bg-sky-50 text-sky-700"
          icon={<span className="text-xl">🎯</span>}
        />
        <StatCard
          title="Fee Balance"
          value={
            Number.isFinite(feeBalance) ? feeBalance.toLocaleString("en-UG") : "—"
          }
          className={feeBalance > 0 ? "border-l-4 border-l-rose-500" : "border-l-4 border-l-emerald-500"}
          iconTint={feeBalance > 0 ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}
          icon={<span className="text-xl">💳</span>}
        />
        <StatCard
          title="Attendance Rate"
          value={Number.isFinite(attendanceRate) ? `${attendanceRate.toFixed(1)}%` : "—"}
          className="border-l-4 border-l-amber-500"
          iconTint="bg-amber-50 text-amber-700"
          icon={<span className="text-xl">✅</span>}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-3 border-b border-slate-100 pb-2 text-sm font-bold uppercase tracking-wider text-slate-500">
              My Results
            </h3>
            {rowsError ? (
              <div className="mb-4">
                <OverviewErrorBanner message={rowsError} />
              </div>
            ) : null}
            {rowsLoading ? (
              <OverviewSkeletonCard rows={5} />
            ) : rows.length === 0 ? (
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
                      <th className="py-2 font-semibold text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map((r, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/60 transition">
                        <td className="py-3 font-bold text-slate-800">{r.subject}</td>
                        <td className="py-3 text-center font-bold text-slate-700">
                          {r.score == null ? "—" : r.score.toFixed(1)}
                        </td>
                        <td className="py-3 text-center font-black text-indigo-700">
                          {r.grade ?? "—"}
                        </td>
                        <td className="py-3 text-right">
                          <span className="rounded-full bg-slate-50 px-2.5 py-1 text-[10px] font-bold text-slate-700 border border-slate-200">
                            {r.status}
                          </span>
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
          {learner ? <LearnerProfileCard learner={learner} /> : null}
          <EventScheduleCard calendar={dash?.calendar ?? null} />
        </div>
      </div>
    </div>
  );
}

