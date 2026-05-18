import { useEffect, useMemo, useState } from "react";
import type { DashboardPayload } from "../api/dashboard";
import { useTermContext } from "../context/TermContext";
import { fetchRecentAdmissions, type RecentAdmissionRow } from "../api/students";
import {
  DashboardSectionTitle,
  EventScheduleCard,
  OverviewErrorBanner,
  OverviewSkeletonCard,
  StatCard,
} from "../dashboards/OverviewShared";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] ?? "?";
  const b = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  return `${a}${b}`.toUpperCase();
}

function statusBadge(status: "Active" | "Pending" | string) {
  const s = status.toLowerCase();
  const isActive = s === "active";
  return (
    <span
      className={
        isActive
          ? "rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700 border border-emerald-200"
          : "rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-800 border border-amber-200"
      }
    >
      {isActive ? "Active" : "Pending"}
    </span>
  );
}

export function RegistrarOverview({
  dash,
  loading,
}: {
  dash: DashboardPayload | null;
  loading: boolean;
}) {
  const { viewingTerm, viewingAcademicYear } = useTermContext();
  const [recent, setRecent] = useState<RecentAdmissionRow[]>([]);
  const [recentLoading, setRecentLoading] = useState(false);
  const [recentError, setRecentError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setRecentLoading(true);
    setRecentError(null);
    void fetchRecentAdmissions(viewingTerm, viewingAcademicYear)
      .then((rows) => {
        if (!cancelled) setRecent(rows);
      })
      .catch((e) => {
        if (!cancelled) {
          setRecentError(e instanceof Error ? e.message : "Failed to load recent admissions");
        }
      })
      .finally(() => {
        if (!cancelled) setRecentLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [viewingTerm, viewingAcademicYear]);

  const s = dash?.stats;
  const actions = dash?.registrarActions ?? [];

  const kpi = useMemo(
    () => [
      {
        title: "Total Students",
        value: String(s?.totalStudents ?? "—"),
        icon: <span className="text-xl">🧑‍🎓</span>,
        iconTint: "bg-blue-50 text-blue-600",
        className: "border-l-4 border-l-blue-500",
      },
      {
        title: "New Admissions (This Term)",
        value: String(s?.newAdmissionsThisTerm ?? "—"),
        icon: <span className="text-xl">📋</span>,
        iconTint: "bg-indigo-50 text-indigo-600",
        className: "border-l-4 border-l-indigo-500",
      },
      {
        title: "Linked Parents",
        value: String(s?.linkedParents ?? "—"),
        icon: <span className="text-xl">👨‍👩‍👧</span>,
        iconTint: "bg-emerald-50 text-emerald-600",
        className: "border-l-4 border-l-emerald-500",
      },
      {
        title: "Incomplete Profiles",
        value: String(s?.incompleteProfiles ?? "—"),
        icon: <span className="text-xl">⚠️</span>,
        iconTint: "bg-amber-50 text-amber-700",
        className: "border-l-4 border-l-amber-500",
      },
    ],
    [s?.incompleteProfiles, s?.linkedParents, s?.newAdmissionsThisTerm, s?.totalStudents],
  );

  if (loading && !dash) {
    return (
      <div className="p-8 text-center animate-pulse text-slate-400 font-semibold">
        Loading Registrar Dashboard…
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <DashboardSectionTitle
        title="Registrar Dashboard"
        subtitle="Admissions, learner profiles, and parent-linked records"
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpi.map((c) => (
          <StatCard
            key={c.title}
            title={c.title}
            value={c.value}
            icon={c.icon}
            iconTint={c.iconTint}
            className={c.className}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">
                Recent Admissions
              </h3>
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                {viewingTerm} • {viewingAcademicYear}
              </span>
            </div>

            {recentError ? (
              <div className="mb-4">
                <OverviewErrorBanner message={recentError} />
              </div>
            ) : null}

            {recentLoading ? (
              <OverviewSkeletonCard rows={5} />
            ) : recent.length === 0 ? (
              <div className="py-10 text-center text-sm text-slate-500 italic">
                No recent admissions found for this term.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="py-2 font-semibold">Student</th>
                      <th className="py-2 font-semibold">Admission No.</th>
                      <th className="py-2 font-semibold">Class</th>
                      <th className="py-2 font-semibold">Date Admitted</th>
                      <th className="py-2 font-semibold text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {recent.map((r) => (
                      <tr key={r.studentId} className="hover:bg-slate-50/60 transition">
                        <td className="py-3">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center font-black text-indigo-700">
                              {initials(r.studentName)}
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-slate-800 truncate">{r.studentName}</div>
                              <div className="text-[10px] font-semibold text-slate-400 truncate">
                                {r.sectionName ? `Section ${r.sectionName}` : "—"}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 font-bold text-slate-700">{r.admissionNumber}</td>
                        <td className="py-3 font-semibold text-slate-600">{r.className ?? "—"}</td>
                        <td className="py-3 font-semibold text-slate-600">{r.admittedAtLabel}</td>
                        <td className="py-3 text-right">{statusBadge(r.status)}</td>
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
              Pending Actions
            </h3>
            {actions.length === 0 ? (
              <p className="text-sm text-slate-500 italic text-center py-6">No pending actions.</p>
            ) : (
              <ul className="space-y-3">
                {actions.map((a, idx) => {
                  const icon =
                    a.type === "missing_parent"
                      ? "👨‍👩‍👧"
                      : a.type === "incomplete_profile"
                        ? "📋"
                        : "⏳";
                  return (
                    <li key={idx} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <div className="flex items-start gap-3">
                        <div className="h-9 w-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center">
                          {icon}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-black text-slate-800 truncate">{a.studentName}</p>
                          <p className="mt-0.5 text-[11px] font-semibold text-slate-600">
                            {a.detail}
                          </p>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <EventScheduleCard calendar={dash?.calendar ?? null} />
        </div>
      </div>
    </div>
  );
}

