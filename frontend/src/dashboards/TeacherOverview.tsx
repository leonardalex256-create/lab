import { useEffect, useState } from "react";
import { type DashboardPayload } from "../api/dashboard";
import {
  fetchResultEntryOptions,
  type ResultEntryOptions,
  fetchUpcomingExams,
  type UpcomingExamRow,
} from "../api/academics";
import {
  EventScheduleCard,
  LiveClock,
  OverviewSkeletonCard,
  DashboardSectionTitle,
} from "./OverviewShared";

// ─── helpers ────────────────────────────────────────────────────────────────

function daysUntil(dateStr: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - now.getTime()) / 86_400_000);
}

function urgencyStyle(days: number): string {
  if (days < 0) return "bg-slate-50 text-slate-400 border-slate-200";
  if (days === 0) return "bg-rose-50 text-rose-700 border-rose-200 ring-1 ring-rose-300";
  if (days <= 3) return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-emerald-50 text-emerald-700 border-emerald-200";
}

// ─── sub-components ─────────────────────────────────────────────────────────

function ClassCard({
  cls,
  sections,
  students,
}: {
  cls: ResultEntryOptions["classes"][number];
  sections: ResultEntryOptions["sections"];
  students: number; // total students in the class from the stats, or 0
}) {
  const classSections = sections.filter((s) => s.classRoomId === cls.id);
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
      {/* class name */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            {cls.categoryName ?? "Class"}
          </p>
          <h3 className="text-base font-black tracking-tight text-slate-800">{cls.name}</h3>
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-xl border border-indigo-100">
          🏫
        </div>
      </div>

      {/* stats row */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2 text-center">
          <p className="text-lg font-black text-slate-800">{students}</p>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Students</p>
        </div>
        <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2 text-center">
          <p className="text-lg font-black text-slate-800">{classSections.length || "—"}</p>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Sections</p>
        </div>
      </div>

      {/* sections list */}
      {classSections.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {classSections.map((sec) => (
            <span
              key={sec.id}
              className="rounded-lg bg-indigo-50 px-2.5 py-0.5 text-[10px] font-bold text-indigo-700 border border-indigo-100"
            >
              {sec.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function ExamRow({ exam }: { exam: UpcomingExamRow }) {
  const days = daysUntil(exam.examDate);
  const style = urgencyStyle(days);
  const label = days < 0 ? "Passed" : days === 0 ? "Today!" : `${days}d`;

  return (
    <div className={`flex items-center gap-3 rounded-xl border p-3 transition-all ${style}`}>
      {/* date badge */}
      <div className="flex w-14 shrink-0 flex-col items-center rounded-xl border border-current/20 bg-white/60 px-2 py-1.5 text-center">
        <span className="text-[10px] font-bold uppercase opacity-70">
          {new Date(exam.examDate).toLocaleDateString("en-UG", { month: "short" })}
        </span>
        <span className="text-lg font-black leading-none">
          {new Date(exam.examDate).getDate().toString().padStart(2, "0")}
        </span>
      </div>

      {/* info */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-slate-800 truncate">
          {exam.subject}
        </p>
        <p className="text-[10px] font-semibold opacity-70 mt-0.5">
          {exam.className} • {exam.examKey.toUpperCase()}
        </p>
      </div>

      {/* countdown */}
      <div className="shrink-0 text-[10px] font-black uppercase tracking-wide opacity-80">{label}</div>
    </div>
  );
}

// ─── main component ──────────────────────────────────────────────────────────

export function TeacherOverview({
  dash,
  loading,
}: {
  dash: DashboardPayload | null;
  loading: boolean;
}) {
  const [options, setOptions] = useState<ResultEntryOptions | null>(null);
  const [exams, setExams] = useState<UpcomingExamRow[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [examsLoading, setExamsLoading] = useState(false);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [examsError, setExamsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setOptionsLoading(true);
    setOptionsError(null);
    void fetchResultEntryOptions()
      .then((data) => {
        if (!cancelled) setOptions(data);
      })
      .catch((e) => {
        if (!cancelled) {
          setOptionsError(
            e instanceof Error ? e.message : "Failed to load class assignments",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setOptionsLoading(false);
      });

    setExamsLoading(true);
    setExamsError(null);
    void fetchUpcomingExams()
      .then((data) => {
        if (!cancelled) setExams(data);
      })
      .catch((e) => {
        if (!cancelled) {
          setExamsError(e instanceof Error ? e.message : "Failed to load exams");
        }
      })
      .finally(() => {
        if (!cancelled) setExamsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading && !dash) {
    return (
      <div className="p-8 text-center animate-pulse text-slate-400 font-semibold">
        Loading Teacher Dashboard…
      </div>
    );
  }

  const assignedClasses = options?.classes ?? [];
  const sections = options?.sections ?? [];
  const upcomingExams = exams
    .filter((e) => daysUntil(e.examDate) >= 0)
    .sort((a, b) => new Date(a.examDate).getTime() - new Date(b.examDate).getTime())
    .slice(0, 8);
  const pastExams = exams
    .filter((e) => daysUntil(e.examDate) < 0)
    .sort((a, b) => new Date(b.examDate).getTime() - new Date(a.examDate).getTime())
    .slice(0, 3);

  const totalAssignedStudents = dash?.stats.totalStudents ?? 0;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">

      {/* ── Header ── */}
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <DashboardSectionTitle
            title="Teacher Dashboard"
            subtitle="Your assigned classes, upcoming exams, and school schedule"
          />
        </div>

        {/* Live clock */}
        <LiveClock />
      </header>

      {/* ── KPI Strip ── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {/* Assigned Classes */}
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow border-l-4 border-l-indigo-500">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-xl">
            🏫
          </div>
          <div>
            <p className="text-2xl font-black text-slate-800">
              {optionsLoading ? <span className="animate-pulse">…</span> : assignedClasses.length}
            </p>
            <p className="text-[11px] font-semibold text-slate-500">Classes</p>
          </div>
        </div>

        {/* Students */}
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow border-l-4 border-l-sky-500">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-xl">
            🎓
          </div>
          <div>
            <p className="text-2xl font-black text-slate-800">
              {dash ? totalAssignedStudents : <span className="animate-pulse text-slate-300">…</span>}
            </p>
            <p className="text-[11px] font-semibold text-slate-500">Students</p>
          </div>
        </div>

        {/* Upcoming Exams */}
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow border-l-4 border-l-amber-500">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-xl">
            📝
          </div>
          <div>
            <p className="text-2xl font-black text-slate-800">
              {examsLoading ? <span className="animate-pulse">…</span> : upcomingExams.length}
            </p>
            <p className="text-[11px] font-semibold text-slate-500">Upcoming Exams</p>
          </div>
        </div>

        {/* Present Today */}
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow border-l-4 border-l-emerald-500">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-xl">
            ✅
          </div>
          <div>
            <p className="text-2xl font-black text-slate-800">
              {dash?.stats.presentToday ?? "—"}
            </p>
            <p className="text-[11px] font-semibold text-slate-500">Present Today</p>
          </div>
        </div>
      </div>

      {/* ── Main 3-col grid ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

        {/* Left col: Assigned Classes */}
        <div className="lg:col-span-2 flex flex-col gap-6">

          {/* Classes */}
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 border-b border-slate-100 pb-2 text-sm font-bold uppercase tracking-wider text-slate-500">
              My Assigned Classes
            </h3>
            {optionsError ? (
              <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-900">
                {optionsError}
              </div>
            ) : null}
            {optionsLoading ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <OverviewSkeletonCard rows={4} />
              </div>
            ) : assignedClasses.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <span className="mb-3 text-4xl">📭</span>
                <p className="text-sm font-semibold text-slate-500">
                  No classes assigned yet.
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Contact the administrator to be assigned to a class.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {assignedClasses.map((cls) => (
                  <ClassCard
                    key={cls.id}
                    cls={cls}
                    sections={sections}
                    students={
                      (cls as ResultEntryOptions["classes"][number] & { studentCount?: number }).studentCount ??
                      0
                    }
                  />
                ))}
              </div>
            )}
          </section>

          {/* Exam Schedule */}
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">
                Exam Schedule
              </h3>
              {upcomingExams.length > 0 && (
                <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-700">
                  {upcomingExams.length} upcoming
                </span>
              )}
            </div>
            {examsError ? (
              <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-900">
                {examsError}
              </div>
            ) : null}

            {examsLoading ? (
              <div className="space-y-2">
                <OverviewSkeletonCard rows={3} />
              </div>
            ) : upcomingExams.length === 0 && pastExams.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <span className="mb-3 text-4xl">🗓️</span>
                <p className="text-sm font-semibold text-slate-500">No exams scheduled.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {upcomingExams.map((exam) => (
                  <ExamRow key={exam.id} exam={exam} />
                ))}
                {pastExams.length > 0 && (
                  <>
                    <p className="pt-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      Recently Passed
                    </p>
                    {pastExams.map((exam) => (
                      <ExamRow key={exam.id} exam={exam} />
                    ))}
                  </>
                )}
              </div>
            )}
          </section>
        </div>

        {/* Right col: Calendar + Notices */}
        <div className="flex flex-col gap-6">
          <EventScheduleCard calendar={dash?.calendar ?? null} />

          {/* Notices */}
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-3 border-b border-slate-100 pb-2 text-sm font-bold uppercase tracking-wider text-slate-500">
              School Notices
            </h3>
            <div className="space-y-3">
              {(dash?.notices ?? []).slice(0, 4).map((n, i) => (
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
              {(dash?.notices.length === 0 || !dash) && (
                <p className="text-xs text-slate-400 italic text-center py-4">
                  No active notices.
                </p>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
