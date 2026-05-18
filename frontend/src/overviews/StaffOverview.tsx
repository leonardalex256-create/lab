import { useMemo } from "react";
import type { DashboardPayload } from "../api/dashboard";
import { useTermContext } from "../context/TermContext";
import {
  DashboardSectionTitle,
  EventScheduleCard,
  LiveClock,
  StatCard,
} from "../dashboards/OverviewShared";

type StaffOverviewProps = {
  dash: DashboardPayload | null;
  loading: boolean;
  onNavigateCommunication?: () => void;
  onNavigateAttendance?: () => void;
};

function todayLabel(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function StaffOverview({
  dash,
  loading,
  onNavigateCommunication,
  onNavigateAttendance,
}: StaffOverviewProps) {
  const { viewingTerm } = useTermContext();

  const s = dash?.stats;
  const userName = dash?.userName ?? "Staff";

  const kpi = useMemo(
    () => [
      {
        title: "Present Today",
        value: String(s?.presentToday ?? "—"),
        icon: <span className="text-xl">📅</span>,
        iconTint: "bg-emerald-50 text-emerald-700",
        className: "border-l-4 border-l-emerald-500",
      },
      {
        title: "Active Notices",
        value: String(s?.activeNotices ?? "—"),
        icon: <span className="text-xl">📢</span>,
        iconTint: "bg-indigo-50 text-indigo-700",
        className: "border-l-4 border-l-indigo-500",
      },
      {
        title: "Unread Messages",
        value: String(s?.unreadMessages ?? "—"),
        icon: <span className="text-xl">📬</span>,
        iconTint: "bg-amber-50 text-amber-700",
        className: "border-l-4 border-l-amber-500",
      },
    ],
    [s?.activeNotices, s?.presentToday, s?.unreadMessages],
  );

  if (loading && !dash) {
    return (
      <div className="p-8 text-center animate-pulse text-slate-400 font-semibold">
        Loading Staff Dashboard…
      </div>
    );
  }

  const quickBtnBase =
    "flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black shadow-sm transition hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed";

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <DashboardSectionTitle
            title={`Welcome back, ${userName}.`}
            subtitle={`${todayLabel()} • ${viewingTerm}`}
          />
        </div>
        <LiveClock />
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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

      <div className="space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 border-b border-slate-100 pb-2 text-sm font-bold uppercase tracking-wider text-slate-500">
            School Notices
          </h3>
          <div className="space-y-3">
            {(dash?.notices ?? []).slice(0, 5).map((n, i) => (
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

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 border-b border-slate-100 pb-2 text-sm font-bold uppercase tracking-wider text-slate-500">
            Quick Links
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <button
              type="button"
              className={quickBtnBase}
              onClick={onNavigateCommunication}
              disabled={!onNavigateCommunication}
              title={!onNavigateCommunication ? "Access not granted." : undefined}
            >
              📢 Notice Board
            </button>
            <button
              type="button"
              className={quickBtnBase}
              onClick={onNavigateAttendance}
              disabled={!onNavigateAttendance}
              title={!onNavigateAttendance ? "Access not granted." : undefined}
            >
              ✅ Attendance
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

