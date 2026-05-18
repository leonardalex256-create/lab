import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  createExamTypeConfig,
  createSubjectConfig,
  deleteExamTypeConfig,
  deleteSubjectConfig,
  fetchExamTypeConfigs,
  fetchPerformanceSummary,
  fetchResultEntryOptions,
  fetchResultEntryStudents,
  fetchSubjectAssignmentUsage,
  fetchSubjectConfigs,
  fetchStudentMarkEntry,
  generateClassMarksheet,
  fetchUpcomingExams,
  fetchExamsPerformanceSummary,
  createExam,
  fetchExams,
  fetchGradingScales,
  saveStudentMarkEntry,
  updateSubjectConfig,
  type ExamTypeConfigRow,
  type PerformanceSummaryRow,
  type ResultEntryOptions,
  type SubjectAssignmentConfigRow,
  type SubjectConfigPayload,
  type UpcomingExamRow,
  type ExamPerformanceSummaryRow,
  type GeneratedMarksheetPayload,
  type GradingScaleRow,
} from "../../api/academics";
import { useTheme } from "../../theme/ThemeProvider";
import { useTermContext } from "../../context/TermContext";

/** Dispatched to open Subject & Examination Configuration on the Scheduling tab (see dashboards/Dashboard listener). */
export const CURRICULUM_OPEN_SUBJECTS_SCHEDULE_EVENT = "curriculum:open-subjects-schedule";
export const SUBJECTS_CONFIG_TAB_STORAGE_KEY = "subjectsConfigInitialTab";

let subjectConfigsCachedPromise: Promise<SubjectConfigPayload> | null = null;
function getSubjectConfigsCached(): Promise<SubjectConfigPayload> {
  subjectConfigsCachedPromise ??= fetchSubjectConfigs();
  return subjectConfigsCachedPromise;
}

export type CurriculumSection =
  | "exams_dashboard"
  | "exam_bot"
  | "exam_mid"
  | "exam_eot"
  | `exam_type:${string}`
  | "assessment_tests"
  | "result_entry"
  | "grading_standards"
  | "report_remarks"
  | "exam_schedule"
  | "promotion_engine"
  | "learns_report"
  | "blank_page";

type ExamType = string;

function titleForSection(section: CurriculumSection): string {
  if (section === "exams_dashboard") return "Exams Dashboard";
  if (section === "exam_bot") return "BOT Exam Performance";
  if (section === "exam_mid") return "MID Exam Performance";
  if (section === "exam_eot") return "EOT Exam Performance";
  if (section.startsWith("exam_type:")) {
    const examKey = section.slice("exam_type:".length).trim();
    return `${examKey || "Custom"} Exam Performance`;
  }
  if (section === "assessment_tests") return "Assessment Tests Entry";
  if (section === "result_entry") return "Result Entry";
  if (section === "grading_standards") return "Grading Standards & Scales";
  if (section === "report_remarks") return "Student Report Remarks";
  if (section === "exam_schedule") return "Academic Exam Scheduling";
  if (section === "promotion_engine") return "Promotion & Graduation Engine";
  return "Subjects & Exam Settings";
}

function daysFromTodayStart(ymd: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const [y, m, d] = ymd.split("-").map((x) => Number(x));
  const examDay = new Date(y, m - 1, d);
  if (Number.isNaN(examDay.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  examDay.setHours(0, 0, 0, 0);
  return Math.round((examDay.getTime() - today.getTime()) / 86400000);
}

function assessmentStatusMeta(days: number | null): { label: string; pillClass: string; dotClass: string } {
  if (days != null && days >= 0 && days <= 3) {
    return {
      label: "Soon",
      pillClass: "bg-amber-50 text-amber-900 ring-amber-200/90",
      dotClass: "bg-amber-500",
    };
  }
  if (days != null && days >= 0 && days <= 7) {
    return {
      label: "This Week",
      pillClass: "bg-blue-50 text-blue-900 ring-blue-200/90",
      dotClass: "bg-blue-500",
    };
  }
  return {
    label: "Scheduled",
    pillClass: "bg-slate-50 text-slate-800 ring-slate-200/90",
    dotClass: "bg-slate-400",
  };
}

function examTypeStripAccent(examKey: string): string {
  const k = examKey.trim().toUpperCase();
  if (k === "BOT") return "border-l-[#3b82f6]";
  if (k === "MID") return "border-l-[#f59e0b]";
  if (k === "EOT") return "border-l-[#10b981]";
  return "border-l-slate-400";
}

function ExamsDashboardPage() {
  const { viewingTerm, viewingAcademicYear } = useTermContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [upcomingExams, setUpcomingExams] = useState<UpcomingExamRow[]>([]);
  const [performanceSummary, setPerformanceSummary] = useState<ExamPerformanceSummaryRow[]>([]);
  const [examTypes, setExamTypes] = useState<ExamTypeConfigRow[]>([]);
  const loadRequestId = useRef(0);

  const loadDashboard = useCallback(async () => {
    const reqId = ++loadRequestId.current;
    setLoading(true);
    setError(null);
    try {
      const [upcoming, performance, types] = await Promise.all([
        fetchUpcomingExams(),
        fetchExamsPerformanceSummary(viewingTerm, viewingAcademicYear),
        fetchExamTypeConfigs(),
      ]);
      if (reqId !== loadRequestId.current) return;
      setUpcomingExams(upcoming);
      setPerformanceSummary(performance);
      setExamTypes(types.filter((t) => t.isActive));
    } catch (e) {
      if (reqId !== loadRequestId.current) return;
      setError(e instanceof Error ? e.message : "Failed to load dashboard data");
    } finally {
      if (reqId === loadRequestId.current) setLoading(false);
    }
  }, [viewingTerm, viewingAcademicYear]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const retry = useCallback(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const globalAvg = useMemo(() => {
    if (performanceSummary.length === 0) return 0;
    return performanceSummary.reduce((sum, r) => sum + Number(r.avgScore), 0) / performanceSummary.length;
  }, [performanceSummary]);

  const termProgressPct = useMemo(() => {
    // TODO: Replace with real academic-calendar-based term progress when that data is available.
    return Math.min(Math.round(upcomingExams.length > 0 ? 40 : 70), 100);
  }, [upcomingExams.length]);

  const sortedPerformance = useMemo(
    () => [...performanceSummary].sort((a, b) => Number(b.avgScore) - Number(a.avgScore)),
    [performanceSummary],
  );

  function openScheduleAssessment() {
    try {
      sessionStorage.setItem(SUBJECTS_CONFIG_TAB_STORAGE_KEY, "schedule");
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new Event(CURRICULUM_OPEN_SUBJECTS_SCHEDULE_EVENT));
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 space-y-8 duration-700">
      <header className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-start">
        <div className="min-w-0 border-l-4 border-[#0f172a] pl-4">
          <h1 className="text-2xl font-black tracking-tight text-slate-900">Examination Control Centre</h1>
          <p className="mt-1 text-sm font-medium text-slate-500">
            Academic Year {viewingAcademicYear} · {viewingTerm}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-[#0f172a] px-4 py-2 text-sm font-semibold text-white">
            <svg className="h-4 w-4 shrink-0 opacity-90" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span>{viewingTerm}</span>
          </div>
          <div className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700">
            {viewingAcademicYear}
          </div>
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
            title="Print executive summary"
            aria-label="Print executive summary"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
          </button>
        </div>
      </header>

      {error ? (
        <div
          className="flex flex-wrap items-center gap-4 rounded-lg border border-red-100 border-l-4 border-l-red-500 bg-red-50 px-4 py-3 text-sm text-red-800"
          role="alert"
        >
          <svg className="h-5 w-5 shrink-0 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span className="min-w-0 flex-1 font-medium">{error}</span>
          <button
            type="button"
            onClick={() => retry()}
            className="rounded-full border border-red-200 bg-white px-4 py-1.5 text-xs font-semibold text-red-700 shadow-sm hover:bg-red-50"
          >
            Retry
          </button>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-100 bg-white p-5">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 shrink-0 rounded-full bg-[#3b82f6]" aria-hidden />
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Global Average</p>
          </div>
          {loading ? (
            <div className="mt-3 h-10 animate-pulse rounded bg-slate-100" />
          ) : (
            <p className="mt-2 text-4xl font-black tabular-nums text-slate-900">{globalAvg.toFixed(1)}%</p>
          )}
          <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full bg-gradient-to-r from-[#3b82f6] to-sky-400 transition-all duration-1000"
              style={{ width: `${Math.min(globalAvg, 100)}%` }}
            />
          </div>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-5">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 shrink-0 rounded-full bg-[#f59e0b]" aria-hidden />
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Upcoming Exams</p>
          </div>
          {loading ? (
            <div className="mt-3 h-10 animate-pulse rounded bg-slate-100" />
          ) : (
            <p className="mt-2 text-4xl font-black tabular-nums text-slate-900">{upcomingExams.length}</p>
          )}
          <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full bg-gradient-to-r from-[#f59e0b] to-amber-300 transition-all duration-1000"
              style={{ width: `${Math.min(upcomingExams.length * 12, 100)}%` }}
            />
          </div>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-5">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 shrink-0 rounded-full bg-[#10b981]" aria-hidden />
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Active Classes</p>
          </div>
          {loading ? (
            <div className="mt-3 h-10 animate-pulse rounded bg-slate-100" />
          ) : (
            <p className="mt-2 text-4xl font-black tabular-nums text-slate-900">{performanceSummary.length}</p>
          )}
          <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full bg-gradient-to-r from-[#10b981] to-emerald-300 transition-all duration-1000"
              style={{
                width: `${performanceSummary.length === 0 ? 0 : Math.min(100, performanceSummary.length * 14)}%`,
              }}
            />
          </div>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-5">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 shrink-0 rounded-full bg-[#8b5cf6]" aria-hidden />
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Term Progress</p>
          </div>
          {loading ? (
            <div className="mt-3 h-10 animate-pulse rounded bg-slate-100" />
          ) : (
            <p className="mt-2 text-4xl font-black tabular-nums text-slate-900">{termProgressPct}%</p>
          )}
          <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full bg-gradient-to-r from-[#8b5cf6] to-violet-300 transition-all duration-1000"
              style={{ width: `${termProgressPct}%` }}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="flex flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-900">Upcoming Assessments</h2>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-black tabular-nums text-slate-900 ring-1 ring-slate-200">
              {loading ? "…" : upcomingExams.length}
            </span>
          </div>
          <div className="flex-1 p-5">
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100" />
                ))}
              </div>
            ) : upcomingExams.length > 0 ? (
              <ul className="space-y-3">
                {upcomingExams.map((ex) => {
                  const delta = daysFromTodayStart(ex.examDate);
                  const meta = assessmentStatusMeta(delta);
                  const examDt = /^\d{4}-\d{2}-\d{2}$/.test(ex.examDate) ? new Date(ex.examDate + "T12:00:00") : null;
                  const monthAbbr =
                    examDt && !Number.isNaN(examDt.getTime())
                      ? examDt.toLocaleDateString("en-US", { month: "short" })
                      : "—";
                  const dayNum =
                    examDt && !Number.isNaN(examDt.getTime()) ? String(examDt.getDate()) : ex.examDate.slice(8, 10);
                  return (
                    <li
                      key={ex.id}
                      className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-xl border border-slate-100 bg-white px-3 py-3"
                    >
                      <div className="flex min-w-[52px] flex-col items-center justify-center rounded-lg border border-slate-100 bg-white px-2 py-2 text-center">
                        <span className="text-[10px] font-bold uppercase leading-none text-slate-500">{monthAbbr}</span>
                        <span className="text-lg font-black leading-tight text-slate-900">{dayNum}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-900">{ex.subject}</p>
                        <p className="text-xs font-medium text-slate-500">
                          {ex.className} · {ex.examKey}
                        </p>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ring-1 ${meta.pillClass}`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${meta.dotClass}`} aria-hidden />
                        {meta.label}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="flex flex-col items-center justify-center py-14 text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-100 bg-slate-50 text-slate-400">
                  <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-slate-700">No assessments scheduled</p>
                <button
                  type="button"
                  onClick={() => openScheduleAssessment()}
                  className="mt-5 rounded-full border border-slate-200 bg-white px-5 py-2 text-xs font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
                >
                  Schedule Assessment
                </button>
              </div>
            )}
          </div>
        </section>

        <section className="flex flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-900">Performance Overview</h2>
            <button
              type="button"
              className="rounded-full border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-50"
              title="Sort / filter"
              aria-label="Sort or filter"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
              </svg>
            </button>
          </div>
          <div className="flex-1 p-5">
            {loading ? (
              <div className="h-48 animate-pulse rounded-xl bg-slate-100" />
            ) : sortedPerformance.length > 0 ? (
              <ul className="space-y-5">
                {sortedPerformance.map((row, idx) => {
                  const pct = Number(row.avgScore);
                  const barClass =
                    pct >= 75
                      ? "bg-gradient-to-r from-emerald-500 to-emerald-400"
                      : pct >= 50
                        ? "bg-gradient-to-r from-blue-500 to-sky-400"
                        : "bg-gradient-to-r from-rose-500 to-rose-400";
                  return (
                    <li key={row.classRoomId}>
                      <div className="mb-1.5 flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="text-xs font-semibold tabular-nums text-slate-400">#{idx + 1}</span>
                          <span className="truncate font-semibold text-slate-900">{row.className}</span>
                        </div>
                        <span className="shrink-0 rounded-full bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-800 ring-1 ring-slate-100">
                          {row.avgScore}%
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={`h-full rounded-full transition-all duration-1000 ${barClass}`}
                          style={{ width: `${Math.min(Math.max(pct, 0), 100)}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="flex flex-col items-center justify-center py-14 text-center">
                <p className="text-sm font-semibold text-slate-600">No result data available for this term.</p>
              </div>
            )}
          </div>
        </section>
      </div>

      <div>
        <h2 className="mb-3 text-xs font-black uppercase tracking-wider text-slate-900">Assessment modules</h2>
        <div className="flex flex-wrap gap-3">
          {examTypes.map((t) => (
            <div
              key={t.id}
              className={`min-w-[140px] flex-1 rounded-2xl border border-slate-100 border-l-4 bg-white px-4 py-3 sm:flex-none ${examTypeStripAccent(t.examKey)}`}
            >
              <p className="font-mono text-xs font-semibold text-slate-600">{t.examKey}</p>
              <p className="mt-0.5 text-sm font-medium text-slate-900">{t.displayName}</p>
            </div>
          ))}
          {examTypes.length === 0 && !loading ? (
            <p className="w-full py-4 text-center text-xs font-semibold text-slate-500">No active assessment modules found.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function examTypeForSection(section: CurriculumSection): ExamType {
  if (section === "exam_mid") return "MID";
  if (section === "exam_eot") return "EOT";
  if (section === "assessment_tests") return "ASSESSMENT";
  if (section.startsWith("exam_type:")) {
    return section.slice("exam_type:".length).trim() || "BOT";
  }
  return "BOT";
}

function fmtAvg(v: number | null): string {
  return v == null ? "—" : v.toFixed(1);
}

function fmtPct(v: number | null): string {
  return v == null ? "—" : `${v.toFixed(1)}%`;
}

function PerformanceStatsPage({ section }: { section: CurriculumSection }) {
  const { viewingTerm, viewingAcademicYear } = useTermContext();
  const [rows, setRows] = useState<PerformanceSummaryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const examType = examTypeForSection(section);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetchPerformanceSummary(viewingTerm, examType, viewingAcademicYear)
      .then((items) => {
        if (!cancelled) setRows(items);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load performance summary");
          setRows([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [examType, viewingTerm, viewingAcademicYear]);

  const classesCount = useMemo(() => new Set(rows.map((x) => x.className)).size, [rows]);
  const totalStudents = useMemo(() => rows.reduce((sum, r) => sum + r.totalStudents, 0), [rows]);
  const resultsEntered = useMemo(
    () => rows.reduce((sum, r) => sum + r.resultsEntered, 0),
    [rows],
  );

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 space-y-6 duration-700">
      <header className="flex flex-col justify-between gap-4 border-b border-[#ebe4d9]/80 pb-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-[#2d3436]">{titleForSection(section)}</h1>
          <p className="mt-1 text-sm font-semibold text-[#636e72]">Performance statistics grouped by section and class.</p>
        </div>
        
        <div className="flex items-center gap-2 rounded-full border border-[#ebe4d9]/80 bg-[#faf7f0]/80 px-4 py-2 text-sm font-bold text-[#2d3436]">
          <span className="text-xs font-black uppercase tracking-widest text-[#636e72]">Term</span>
          {viewingTerm}
        </div>
      </header>

      {error ? (
        <div className="neo-card border-l-4 border-red-500 p-4 text-sm font-bold text-red-700">{error}</div>
      ) : null}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="neo-card-elevated p-5">
          <p className="text-[10px] font-black uppercase tracking-widest text-[#636e72]">Total Students</p>
          <p className="mt-1 text-2xl font-black text-[#2d3436]">{loading ? "…" : totalStudents}</p>
        </div>
        <div className="neo-card-elevated p-5">
          <p className="text-[10px] font-black uppercase tracking-widest text-[#636e72]">Classes Covered</p>
          <p className="mt-1 text-2xl font-black text-[#3498db]">{loading ? "…" : classesCount}</p>
        </div>
        <div className="neo-card-elevated p-5">
          <p className="text-[10px] font-black uppercase tracking-widest text-[#636e72]">Results Entered</p>
          <p className="mt-1 text-2xl font-black text-[#2ecc71]">{loading ? "…" : resultsEntered}</p>
        </div>
      </div>

      <div className="neo-card-elevated overflow-hidden">
        <div className="border-b border-[#ebe4d9]/80 bg-[#faf7f0]/60 px-6 py-4">
          <h2 className="text-sm font-black uppercase tracking-widest text-[#2d3436]">Performance Breakdown by Class</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#f5f8f5]/50 text-[10px] font-black uppercase tracking-widest text-[#6a9570]">
              <tr>
                <th className="px-6 py-4">Class</th>
                <th className="px-6 py-4">Section</th>
                <th className="px-6 py-4 text-right">Students</th>
                <th className="px-6 py-4 text-right">Avg Score</th>
                <th className="px-6 py-4 text-right">Pass Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ebe4d9]/40">
              {rows.map((row) => (
                <tr key={`${row.className}-${row.sectionName}`} className="group transition-colors hover:bg-white/40">
                  <td className="px-6 py-4 font-bold text-[#2d3436]">{row.className}</td>
                  <td className="px-6 py-4 text-sm font-medium text-[#636e72]">{row.sectionName}</td>
                  <td className="px-6 py-4 text-right font-bold text-[#2d3436]">{row.totalStudents}</td>
                  <td className="px-6 py-4 text-right">
                    <span className="font-black text-[#3498db]">{fmtAvg(row.avgScore)}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="inline-flex items-center gap-2">
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-[#ebe4d9]/50 hidden sm:block">
                        <div 
                          className="h-full bg-[#2ecc71] transition-all" 
                          style={{ width: `${row.passRate ?? 0}%` }}
                        ></div>
                      </div>
                      <span className="font-black text-[#2ecc71]">{fmtPct(row.passRate)}</span>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#ebe4d9]/30 text-[#636e72]">
                        <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <p className="text-sm font-bold text-[#636e72]">No performance data found for this selection.</p>
                    </div>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StudentMarksEntryPage({
  studentId,
  term,
  examType,
  onBack,
  onSaved,
}: {
  studentId: number;
  term: string;
  examType: ExamType;
  onBack: () => void;
  onSaved: () => void;
}) {
  const { viewingAcademicYear, historicalReadOnly } = useTermContext();
  const [entryStudent, setEntryStudent] = useState<{
    studentId: number;
    fullName: string;
    admissionNumber: string;
    className: string;
    subjects: Array<{ subject: string; score: string }>;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetchStudentMarkEntry({ studentId, term, examType, academicYear: viewingAcademicYear })
      .then((data) => {
        if (cancelled) return;
        setEntryStudent({
          studentId: data.studentId,
          fullName: data.fullName,
          admissionNumber: data.admissionNumber,
          className: data.className,
          subjects: data.subjects.map((s) => ({
            subject: s.subject,
            score: s.score == null ? "" : String(s.score),
          })),
        });
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to open marks entry");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [studentId, term, examType, viewingAcademicYear]);

  function updateSubjectMark(subject: string, score: string) {
    setEntryStudent((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        subjects: prev.subjects.map((row) => (row.subject === subject ? { ...row, score } : row)),
      };
    });
  }

  async function onSaveStudentMarks() {
    if (!entryStudent) return;
    if (historicalReadOnly) {
      setError("Only administrators can save marks when viewing a past term.");
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const marks = entryStudent.subjects
        .map((row) => ({
          subject: row.subject,
          score: Number(row.score),
        }))
        .filter((x) => Number.isFinite(x.score) && x.score >= 0 && x.score <= 100);
      
      if (marks.length === 0 && entryStudent.subjects.length > 0) {
        setError("Enter at least one valid mark between 0 and 100 before saving.");
        setSaving(false);
        return;
      }
      
      const saved = await saveStudentMarkEntry({
        studentId: entryStudent.studentId,
        term,
        examType,
        academicYear: viewingAcademicYear,
        marks,
      });
      if (saved.saved > 0) {
        setSuccess(`Saved ${saved.saved} subject mark entries.`);
        setTimeout(() => {
          onSaved();
        }, 1000);
      } else {
        setError("No marks were saved. Confirm subject values and try again.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save result entries");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 space-y-6 duration-500">
      <header className="flex flex-col justify-between gap-4 border-b border-[#ebe4d9]/80 pb-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="neo-icon-btn flex h-10 w-10 items-center justify-center bg-white/60 text-[#2d3436] transition-transform active:scale-90"
            title="Return to the student list"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-[#2d3436]">Marks Entry</h1>
            <p className="mt-0.5 text-sm font-medium text-[#636e72]">
              Academic Year {viewingAcademicYear} · {term} · {examType}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void onSaveStudentMarks()}
            disabled={historicalReadOnly || saving || loading || !entryStudent}
            className="flex items-center gap-2 rounded-full bg-gradient-to-br from-[#2ecc71] to-[#27ae60] px-6 py-2.5 text-sm font-bold text-white shadow-lg transition hover:brightness-110 active:scale-95 disabled:opacity-50"
            title="Save and finalize student marks for this subject"
          >
            {saving ? (
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
            )}
            <span>{saving ? "Saving..." : "Save Marks"}</span>
          </button>
        </div>
      </header>

      {error ? (
        <div className="neo-card border-l-4 border-red-500 bg-red-50/30 p-4 text-sm font-bold text-red-700 animate-in shake duration-500">
          <div className="flex items-center gap-3">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </div>
        </div>
      ) : null}

      {success ? (
        <div className="neo-card border-l-4 border-green-500 bg-green-50/30 p-4 text-sm font-bold text-green-700 animate-in zoom-in duration-300">
          <div className="flex items-center gap-3">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {success}
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#3498db] border-t-transparent"></div>
          <p className="mt-4 font-bold text-[#636e72]">Loading student records...</p>
        </div>
      ) : entryStudent ? (
        <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
          <aside className="space-y-6">
            <div className="neo-card-elevated p-6 text-center">
              <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-[#3498db]/20 to-[#2980b9]/20 text-[#3498db]">
                <svg className="h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h2 className="text-xl font-black text-[#2d3436]">{entryStudent.fullName}</h2>
              <p className="mt-1 text-sm font-bold text-[#3498db]">{entryStudent.admissionNumber}</p>
              
              <div className="mt-6 grid grid-cols-2 gap-3">
                <div className="neo-inset p-3 text-center">
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#636e72]">Class</p>
                  <p className="mt-1 text-sm font-bold text-[#2d3436]">{entryStudent.className}</p>
                </div>
                <div className="neo-inset p-3 text-center">
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#636e72]">Status</p>
                  <p className="mt-1 text-sm font-bold text-green-600">Missing Marks</p>
                </div>
              </div>
            </div>

            <div className="neo-card p-5">
              <h3 className="mb-3 text-xs font-black uppercase tracking-widest text-[#636e72]">Instructions</h3>
              <ul className="space-y-2 text-sm text-[#2d3436]">
                <li className="flex gap-2">
                  <span className="text-[#3498db] font-bold">•</span>
                  Enter marks out of 100 for each subject.
                </li>
                <li className="flex gap-2">
                  <span className="text-[#3498db] font-bold">•</span>
                  Leave empty if the student missed the exam.
                </li>
                <li className="flex gap-2">
                  <span className="text-[#3498db] font-bold">•</span>
                  Use decimals (e.g. 85.5) if required.
                </li>
              </ul>
            </div>
          </aside>

          <main className="neo-card overflow-hidden">
            <div className="border-b border-[#ebe4d9]/80 bg-[#faf7f0]/60 px-6 py-4">
              <h3 className="text-sm font-black uppercase tracking-widest text-[#2d3436]">Subject Marks List</h3>
            </div>
            <div className="divide-y divide-[#ebe4d9]/60 p-6">
              {entryStudent.subjects.map((row) => {
                const scoreNum = parseFloat(row.score);
                const isValid = row.score === "" || (scoreNum >= 0 && scoreNum <= 100);
                
                return (
                  <div
                    key={row.subject}
                    className="group flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between first:pt-0 last:pb-0"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-black/5 group-hover:scale-110 transition-transform">
                        <span className="text-xs font-black text-[#3498db]">{row.subject.slice(0, 2).toUpperCase()}</span>
                      </div>
                      <span className="font-bold text-[#2d3436]">{row.subject}</span>
                    </div>
                    
                    <div className="relative w-full sm:w-48">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.01}
                        value={row.score}
                        onChange={(e) => updateSubjectMark(row.subject, e.target.value)}
                        className={`neo-inset-field w-full rounded-xl px-4 py-3 text-right text-sm font-black transition-all outline-none focus:ring-2 ${
                          !isValid 
                            ? "text-red-600 ring-red-400 ring-2" 
                            : row.score !== "" 
                              ? "text-[#2d3436] ring-[#2ecc71]/30 ring-2" 
                              : "text-[#636e72]"
                        }`}
                        placeholder="0.00"
                      />
                      {!isValid && (
                        <span className="absolute -bottom-5 right-0 text-[10px] font-bold text-red-500">Must be 0-100</span>
                      )}
                    </div>
                  </div>
                );
              })}
              
              {entryStudent.subjects.length === 0 && (
                <div className="py-10 text-center">
                  <p className="text-sm font-medium text-[#636e72]">No subjects assigned to this student's class.</p>
                </div>
              )}
            </div>
          </main>
        </div>
      ) : (
        <div className="neo-card p-20 text-center">
          <p className="text-lg font-bold text-[#636e72]">Student records could not be found.</p>
          <button onClick={onBack} className="mt-4 text-[#3498db] font-bold hover:underline">Return to list</button>
        </div>
      )}
    </div>
  );
}

function ResultEntryPage({ mode }: { mode: "exams" | "assessments" }) {
  const { viewingTerm: term, viewingAcademicYear: academicYear } = useTermContext();
  const [options, setOptions] = useState<ResultEntryOptions | null>(null);
  const [examType, setExamType] = useState<ExamType>("");
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
  const [rows, setRows] = useState<
    Array<{
      studentId: number;
      admissionNumber: string;
      fullName: string;
      className: string;
      sectionName: string;
      hasResults: boolean;
    }>
  >([]);
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetchResultEntryOptions()
      .then((data) => {
        if (cancelled) return;
        setOptions(data);
        setSelectedClassId(data.classes[0]?.id ?? null);
        if (mode === "assessments") {
          const hasAssessment = data.examTypes.includes("ASSESSMENT");
          setExamType(hasAssessment ? "ASSESSMENT" : "");
        } else {
          const examChoices = data.examTypes.filter((x) => x !== "ASSESSMENT");
          setExamType((examChoices[0] as ExamType | undefined) ?? "");
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load entry options");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mode]);

  useEffect(() => {
    if (!selectedClassId || !examType) {
      setRows([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSelectedStudentId(null);
    void fetchResultEntryStudents({
      term,
      examType,
      classRoomId: selectedClassId,
      academicYear,
    })
      .then((items) => {
        if (cancelled) return;
        setRows(
          items.map((x) => ({
            studentId: x.studentId,
            admissionNumber: x.admissionNumber,
            fullName: x.fullName,
            className:
              options?.classes.find((cls) => cls.id === x.classRoomId)?.name ?? "Unknown class",
            sectionName: x.sectionName ?? "General",
            hasResults: x.hasResults,
          })),
        );
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load students");
          setRows([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedClassId, term, examType, academicYear, options?.classes]);

  const filteredRows = useMemo(() => {
    const s = searchTerm.toLowerCase().trim();
    if (!s) return rows;
    return rows.filter(
      (r) =>
        r.fullName.toLowerCase().includes(s) ||
        r.admissionNumber.toLowerCase().includes(s) ||
        r.className.toLowerCase().includes(s) ||
        r.sectionName.toLowerCase().includes(s)
    );
  }, [rows, searchTerm]);

  const authorityText =
    options?.authority === "full"
      ? "Full Administrative Authority"
      : "Restricted Access (Assigned Classes Only)";
  const examChoices = (options?.examTypes ?? []).filter((t) => t !== "ASSESSMENT");

  if (selectedStudentId != null) {
    return (
      <StudentMarksEntryPage
        studentId={selectedStudentId}
        term={term}
        examType={examType}
        onBack={() => setSelectedStudentId(null)}
        onSaved={() => {
          setSelectedStudentId(null);
          setRows((prev) =>
            prev.map((x) => (x.studentId === selectedStudentId ? { ...x, hasResults: true } : x)),
          );
        }}
      />
    );
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 space-y-6 duration-700">
      <header className="flex flex-col justify-between gap-4 border-b border-[#ebe4d9]/80 pb-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-[#2d3436]">
            {mode === "assessments" ? "Assessment Entry" : "Result Entry"}
          </h1>
          <p className="mt-1 text-sm font-semibold text-[#636e72] flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${options?.authority === 'full' ? 'bg-green-500' : 'bg-orange-500'}`}></span>
            {authorityText}
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-full border border-[#ebe4d9]/80 bg-[#faf7f0]/80 px-3 py-2 text-sm font-bold text-[#2d3436]">
            <span className="text-xs font-black uppercase tracking-widest text-[#636e72]">Term</span>
            {term}
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-black uppercase tracking-widest text-[#636e72]">Class:</label>
            <select
              value={selectedClassId ?? ""}
              onChange={(e) => setSelectedClassId(e.target.value ? Number(e.target.value) : null)}
              className="neo-inset-field rounded-full px-4 py-2 text-sm font-bold text-[#2d3436] outline-none"
            >
              {(options?.classes ?? []).map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-black uppercase tracking-widest text-[#636e72]">Type:</label>
            {mode === "assessments" ? (
              <div className="neo-inset px-4 py-2 text-sm font-bold text-[#3498db]">
                ASSESSMENT
              </div>
            ) : (
              <select
                value={examType}
                onChange={(e) => setExamType(e.target.value as ExamType)}
                disabled={examChoices.length === 0}
                className="neo-inset-field rounded-full px-4 py-2 text-sm font-bold text-[#2d3436] outline-none disabled:opacity-50"
              >
                {examChoices.length === 0 ? (
                  <option value="">None Configured</option>
                ) : null}
                {examChoices.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </header>

      {error ? (
        <div className="neo-card border-l-4 border-red-500 p-4 text-sm font-bold text-red-700">{error}</div>
      ) : null}

      <div className="grid gap-6">
        {/* Stats Row */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="neo-card-elevated p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-[#636e72]">Total Students</p>
            <p className="mt-1 text-2xl font-black text-[#2d3436]">{loading ? "..." : rows.length}</p>
          </div>
          <div className="neo-card-elevated p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-[#636e72]">Filtered</p>
            <p className="mt-1 text-2xl font-black text-[#3498db]">{loading ? "..." : filteredRows.length}</p>
          </div>
          <div className="neo-card-elevated p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-[#636e72]">Saved</p>
            <p className="mt-1 text-2xl font-black text-[#2ecc71]">
              {loading ? "..." : rows.filter((row) => row.hasResults).length}
            </p>
          </div>
          <div className="neo-card-elevated p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-[#636e72]">Missing Marks</p>
            <p className="mt-1 text-2xl font-black text-[#e74c3c]">
              {loading ? "..." : rows.filter((row) => !row.hasResults).length}
            </p>
          </div>
        </div>

        {/* List Section */}
        <section className="neo-card-elevated flex flex-col overflow-hidden">
          <div className="flex flex-col gap-4 border-b border-[#ebe4d9]/60 bg-[#faf7f0]/40 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-sm font-black uppercase tracking-widest text-[#2d3436]">Students In Selected Class</h2>
            <div className="relative w-full sm:w-64">
              <input
                type="text"
                placeholder="Search students..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="neo-inset-field w-full rounded-full py-2 pl-10 pr-4 text-sm font-medium outline-none focus:ring-2 focus:ring-[#3498db]/30"
              />
              <svg className="absolute left-3.5 top-2.5 h-4 w-4 text-[#636e72]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#f5f8f5]/50 text-[10px] font-black uppercase tracking-widest text-[#6a9570]">
                <tr>
                  <th className="px-6 py-4">Student Info</th>
                  <th className="px-6 py-4">Class & Section</th>
                  <th className="px-6 py-4">Admission No</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ebe4d9]/40">
                {filteredRows.map((row) => (
                  <tr key={row.studentId} className="group transition-colors hover:bg-white/40">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#3498db]/10 to-[#2980b9]/10 font-black text-[#3498db]">
                          {row.fullName.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-bold text-[#2d3436]">{row.fullName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-[#2d3436]">{row.className}</span>
                        <span className="text-xs font-medium text-[#636e72]">{row.sectionName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="neo-inset px-3 py-1 text-xs font-black text-[#636e72]">
                        {row.admissionNumber}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                          row.hasResults ? "bg-[#cde8cf] text-[#2d3436]" : "bg-[#f7d1cd] text-[#8a2f2f]"
                        }`}
                      >
                        {row.hasResults ? "Saved" : "Missing Marks"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedStudentId(row.studentId)}
                        className="inline-flex items-center gap-2 rounded-full bg-gradient-to-br from-[#3498db] to-[#2980b9] px-4 py-2 text-xs font-black text-white shadow-md transition hover:brightness-110 active:scale-95"
                      >
                        <span>{row.hasResults ? "Edit Marks" : "Enter Marks"}</span>
                        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
                
                {filteredRows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#ebe4d9]/30 text-[#636e72]">
                          <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9.172 9.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-lg font-black text-[#2d3436]">
                            {loading ? "Syncing data..." : rows.length === 0 ? "All caught up!" : "No matches found"}
                          </p>
                          <p className="text-sm font-medium text-[#636e72]">
                            {loading ? "Fetching latest records from server" : rows.length === 0 ? "No students found for this class and selection." : `Try searching for something else.`}
                          </p>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

function SubjectsConfigPage() {
  const { resolvedTheme } = useTheme();
  const { viewingTerm, viewingAcademicYear } = useTermContext();
  const isDarkUi = resolvedTheme === "dark" || resolvedTheme === "tinted-dark";

  type TabKey = "subjects" | "exams" | "schedule";

  type ToastMessage = { type: "success" | "error"; message: string };

  function Toast({ toast, onClose }: { toast: ToastMessage; onClose: () => void }) {
    return (
      <div
        className={`fixed top-4 right-4 z-50 max-w-[92vw] rounded-xl px-4 py-3 shadow-lg ring-1 backdrop-blur ${
          toast.type === "success"
            ? "bg-emerald-50/90 text-emerald-800 ring-emerald-200"
            : "bg-amber-50/90 text-amber-900 ring-amber-200"
        }`}
        role="status"
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5 text-sm">{toast.type === "success" ? "✅" : "⚠️"}</div>
          <div className="text-sm font-semibold">{toast.message}</div>
          <button
            type="button"
            className="ml-1 rounded-full p-1 opacity-70 hover:bg-black/5 hover:opacity-100 transition"
            onClick={onClose}
            aria-label="Dismiss"
            title="Dismiss"
          >
            ✕
          </button>
        </div>
      </div>
    );
  }

  function classNames(...parts: Array<string | false | null | undefined>) {
    return parts.filter(Boolean).join(" ");
  }

  function categoryBadgeClass(categoryName: string): string {
    const name = categoryName.trim().toLowerCase();
    const palette = [
      "bg-blue-50 text-blue-700 ring-blue-200",
      "bg-emerald-50 text-emerald-700 ring-emerald-200",
      "bg-violet-50 text-violet-700 ring-violet-200",
      "bg-amber-50 text-amber-800 ring-amber-200",
      "bg-sky-50 text-sky-700 ring-sky-200",
      "bg-teal-50 text-teal-700 ring-teal-200",
    ];
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
    return palette[h % palette.length]!;
  }

  function toYmd(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function parseYmd(v: string): Date | null {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
    const [y, m, d] = v.split("-").map((x) => Number(x));
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
    const dt = new Date(y, m - 1, d);
    if (Number.isNaN(dt.getTime())) return null;
    // Guard against JS date coercion (e.g. 2026-02-31).
    if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
    return dt;
  }

  function CalendarPicker({
    value,
    onChange,
    disabled,
    placeholder,
  }: {
    value: string;
    onChange: (v: string) => void;
    disabled?: boolean;
    placeholder?: string;
  }) {
    const [open, setOpen] = useState(false);
    const selected = parseYmd(value);
    const [cursor, setCursor] = useState<Date>(() => selected ?? new Date());
    const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const monthLabel = monthStart.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    const startDow = monthStart.getDay(); // 0 sun
    const gridStart = new Date(monthStart);
    gridStart.setDate(gridStart.getDate() - startDow);

    const days: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      days.push(d);
    }

    const display = selected ? selected.toLocaleDateString("en-UG", { day: "2-digit", month: "short", year: "numeric" }) : "";

    return (
      <div className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((v) => !v)}
          className={classNames(
            "w-full rounded-xl border px-3 py-2.5 text-sm text-left transition focus:outline-none focus:ring-2",
            "border-slate-200 bg-white focus:ring-[#3B3FD8]/30",
            disabled && "bg-slate-100 text-slate-500 cursor-not-allowed",
          )}
        >
          <div className="flex items-center justify-between gap-3">
            <span className={classNames("truncate", display ? "text-slate-800" : "text-slate-400")}>
              {display || placeholder || "Select a date"}
            </span>
            <span className="text-slate-500">📅</span>
          </div>
        </button>

        {open ? (
          <div className="absolute z-50 mt-2 w-full rounded-2xl border border-slate-200 bg-white shadow-xl p-3">
            <div className="flex items-center justify-between">
              <button
                type="button"
                className="rounded-lg px-2 py-1 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                onClick={() => setCursor((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
                title="Previous month"
              >
                ←
              </button>
              <div className="text-sm font-bold text-slate-800">{monthLabel}</div>
              <button
                type="button"
                className="rounded-lg px-2 py-1 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                onClick={() => setCursor((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
                title="Next month"
              >
                →
              </button>
            </div>

            <div className="mt-2 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-slate-500">
              {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
                <div key={d} className="py-1">{d}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {days.map((d) => {
                const inMonth = d.getMonth() === monthStart.getMonth();
                const ymd = toYmd(d);
                const isSelected = value === ymd;
                return (
                  <button
                    key={ymd}
                    type="button"
                    className={classNames(
                      "h-9 rounded-lg text-sm font-semibold transition",
                      inMonth ? "text-slate-800 hover:bg-slate-50" : "text-slate-400 hover:bg-slate-50",
                      isSelected && "bg-[#3B3FD8] text-white hover:bg-[#3B3FD8]",
                    )}
                    onClick={() => {
                      onChange(ymd);
                      setOpen(false);
                    }}
                  >
                    {d.getDate()}
                  </button>
                );
              })}
            </div>

            <div className="mt-2 flex items-center justify-between">
              <button
                type="button"
                className="text-xs font-semibold text-slate-600 hover:underline"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
              >
                Clear
              </button>
              <button
                type="button"
                className="text-xs font-semibold text-[#3B3FD8] hover:underline"
                onClick={() => {
                  onChange(toYmd(new Date()));
                  setOpen(false);
                }}
              >
                Today
              </button>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  const [activeTab, setActiveTab] = useState<TabKey>("subjects");
  useEffect(() => {
    try {
      const v = sessionStorage.getItem(SUBJECTS_CONFIG_TAB_STORAGE_KEY);
      if (v === "schedule") {
        setActiveTab("schedule");
        sessionStorage.removeItem(SUBJECTS_CONFIG_TAB_STORAGE_KEY);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const [categories, setCategories] = useState<Array<{ id: number; name: string }>>([]);
  const [subjectItems, setSubjectItems] = useState<SubjectAssignmentConfigRow[]>([]);
  const [examTypes, setExamTypes] = useState<ExamTypeConfigRow[]>([]);
  const [classes, setClasses] = useState<
    Array<{ id: number; name: string; categoryId: number | null; categoryName: string | null }>
  >([]);
  const [loading, setLoading] = useState(false);
  const [bannerOpen, setBannerOpen] = useState(true);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Tab 3 — Scheduling
  const [schedCategoryId, setSchedCategoryId] = useState<number | null>(null);
  const [schedClassId, setSchedClassId] = useState("");
  const [schedExamType, setSchedExamType] = useState("");
  const [schedSubject, setSchedSubject] = useState("");
  const [schedDate, setSchedDate] = useState("");
  const [schedBusy, setSchedBusy] = useState(false);

  // Tab 1 — Subject assignment (modal)
  const [subjectCategoryId, setSubjectCategoryId] = useState<number | null>(null);
  const [subjectSectionName, setSubjectSectionName] = useState("");
  const [subjectName, setSubjectName] = useState("");
  const [subjectShortForm, setSubjectShortForm] = useState("");
  const [editingSubjectId, setEditingSubjectId] = useState<number | null>(null);
  const [subjectModalOpen, setSubjectModalOpen] = useState(false);

  // Tab 2 — Exam types (form)
  const [newExamKey, setNewExamKey] = useState("");
  const [newExamLabel, setNewExamLabel] = useState("");
  const [examFormTouched, setExamFormTouched] = useState<{ key: boolean; label: boolean }>({ key: false, label: false });

  const inputBase = classNames(
    "w-full rounded-xl border px-3 py-2.5 text-sm transition focus:outline-none focus:ring-2",
    isDarkUi ? "border-slate-700 bg-slate-900 text-slate-100 focus:ring-[#3B3FD8]/30" : "border-slate-200 bg-white text-slate-800 focus:ring-[#3B3FD8]/30",
  );

  const createdExamTypes = useMemo(
    () => examTypes.filter((row) => row.isActive),
    [examTypes],
  );

  const subjectCountsByCategory = useMemo(() => {
    const m = new Map<number, number>();
    for (const row of subjectItems) m.set(row.classCategoryId, (m.get(row.classCategoryId) ?? 0) + 1);
    return m;
  }, [subjectItems]);

  const [filterCategoryId, setFilterCategoryId] = useState<number | "">("");
  const [filterSection, setFilterSection] = useState("");
  const [filterSubject, setFilterSubject] = useState("");

  const filteredSubjectItems = useMemo(() => {
    const qSection = filterSection.trim().toLowerCase();
    const qSubject = filterSubject.trim().toLowerCase();
    return subjectItems.filter((row) => {
      if (filterCategoryId !== "" && row.classCategoryId !== filterCategoryId) return false;
      const sec = (row.sectionName ?? "").trim().toLowerCase();
      const subj = row.subjectName.trim().toLowerCase();
      if (qSection && !sec.includes(qSection)) return false;
      if (qSubject && !subj.includes(qSubject)) return false;
      return true;
    });
  }, [subjectItems, filterCategoryId, filterSection, filterSubject]);

  const groupedSubjects = useMemo(() => {
    const m = new Map<number, SubjectAssignmentConfigRow[]>();
    for (const row of filteredSubjectItems) {
      const list = m.get(row.classCategoryId) ?? [];
      list.push(row);
      m.set(row.classCategoryId, list);
    }
    for (const [k, list] of m.entries()) {
      list.sort((a, b) => (a.sectionName ?? "").localeCompare(b.sectionName ?? "") || a.subjectName.localeCompare(b.subjectName));
      m.set(k, list);
    }
    return m;
  }, [filteredSubjectItems]);

  const sectionOptionsForSelectedCategory = useMemo(() => {
    const id = subjectCategoryId;
    if (!id) return [];
    const set = new Set<string>();
    for (const row of subjectItems) {
      if (row.classCategoryId !== id) continue;
      const s = (row.sectionName ?? "").trim();
      if (s) set.add(s);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [subjectCategoryId, subjectItems]);

  const selectedClassRow = useMemo(() => {
    const id = Number(schedClassId);
    if (!Number.isFinite(id) || id < 1) return null;
    return classes.find((c) => c.id === id) ?? null;
  }, [schedClassId, classes]);

  const selectedClassHasAssignments = useMemo(() => {
    const catId = selectedClassRow?.categoryId ?? null;
    if (!catId) return false;
    return subjectItems.some((x) => x.classCategoryId === catId);
  }, [selectedClassRow?.categoryId, subjectItems]);

  const scheduleCategoryOptions = useMemo(
    () =>
      Array.from(
        new Map(
          classes
            .filter((c) => c.categoryId != null)
            .map((c) => [c.categoryId as number, c.categoryName ?? "Uncategorized"]),
        ).entries(),
      ).map(([id, name]) => ({ id, name })),
    [classes],
  );

  const scheduleClassOptions = useMemo(() => {
    if (schedCategoryId == null) return [];
    return classes.filter((c) => c.categoryId === schedCategoryId);
  }, [classes, schedCategoryId]);

  const scheduleSubjectSelectOptions = useMemo(() => {
    const catId = selectedClassRow?.categoryId ?? null;
    if (catId == null) return [];
    const byName = new Map<string, SubjectAssignmentConfigRow>();
    for (const row of subjectItems) {
      if (row.classCategoryId !== catId) continue;
      if (!byName.has(row.subjectName)) byName.set(row.subjectName, row);
    }
    return Array.from(byName.values()).sort((a, b) => a.subjectName.localeCompare(b.subjectName));
  }, [selectedClassRow?.categoryId, subjectItems]);

  useLayoutEffect(() => {
    if (scheduleCategoryOptions.length === 0) {
      setSchedCategoryId(null);
      return;
    }
    setSchedCategoryId((prev) => {
      if (prev != null && scheduleCategoryOptions.some((o) => o.id === prev)) return prev;
      return scheduleCategoryOptions[0]!.id;
    });
  }, [scheduleCategoryOptions]);

  useEffect(() => {
    setSchedClassId("");
    setSchedSubject("");
  }, [schedCategoryId]);

  const toastError = useMemo(() => (msg: string) => {
    setToast({ type: "error", message: msg });
    window.setTimeout(() => setToast(null), 3500);
  }, []);

  const toastSuccess = useMemo(() => (msg: string) => {
    setToast({ type: "success", message: msg });
    window.setTimeout(() => setToast(null), 3500);
  }, []);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const [subjectPayload, examRows, entryOptions] = await Promise.all([
        fetchSubjectConfigs(),
        fetchExamTypeConfigs(),
        fetchResultEntryOptions(),
      ]);
      setCategories(subjectPayload.categories);
      setSubjectItems(subjectPayload.items);
      setExamTypes(examRows);
      setClasses(
        (entryOptions.classes ?? []).map((c) => ({
          id: c.id,
          name: c.name,
          categoryId: c.categoryId ?? null,
          categoryName: c.categoryName ?? null,
        })),
      );
      if (subjectPayload.categories.length > 0 && subjectCategoryId == null) {
        setSubjectCategoryId(subjectPayload.categories[0]!.id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onScheduleExam() {
    if (schedCategoryId == null) return;
    const classRoomId = Number(schedClassId);
    const examKey = schedExamType.trim().toUpperCase();
    const subject = schedSubject.trim();
    const examDate = schedDate.trim();

    if (!Number.isFinite(classRoomId) || classRoomId < 1) return;
    if (!examKey || !examDate) return;

    setSchedBusy(true);
    setError(null);
    try {
      await createExam({
        examKey,
        classRoomId,
        subject,
        examDate,
        term: viewingTerm,
        academicYear: viewingAcademicYear,
      });
      setSchedSubject("");
      setSchedDate("");
      toastSuccess("Assessment scheduled successfully.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to schedule exam";
      setError(msg);
      toastError(msg);
    } finally {
      setSchedBusy(false);
    }
  }

  const examKeyNorm = newExamKey.toUpperCase().replace(/\s+/g, "_");
  const examKeyError =
    !examKeyNorm.trim()
      ? "Reference Key is required."
      : /[^A-Z0-9_]/.test(examKeyNorm)
        ? "Use uppercase letters, numbers, and underscores only."
        : null;
  const examLabelError = !newExamLabel.trim() ? "Display Label is required." : null;
  const canSubmitExamType = !examKeyError && !examLabelError;

  async function onAddExamType() {
    setExamFormTouched({ key: true, label: true });
    if (!canSubmitExamType) return;
    try {
      await createExamTypeConfig({ examKey: examKeyNorm.trim(), displayName: newExamLabel.trim() });
      setNewExamKey("");
      setNewExamLabel("");
      setExamFormTouched({ key: false, label: false });
      await refresh();
      window.dispatchEvent(new Event("academics:exam-types-changed"));
      toastSuccess("Exam type registered.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to add exam type";
      setError(msg);
      toastError(msg);
    }
  }

  async function onDeleteExamType(row: ExamTypeConfigRow) {
    const ok = window.confirm(`Delete exam type "${row.displayName}" (${row.examKey})?`);
    if (!ok) return;
    try {
      await deleteExamTypeConfig(row.id);
      await refresh();
      window.dispatchEvent(new Event("academics:exam-types-changed"));
      toastSuccess("Exam type deleted.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to delete exam type";
      setError(msg);
      toastError(msg);
    }
  }

  async function onAddSubject() {
    if (!subjectCategoryId) return;
    const subjectNameClean = subjectName.trim();
    const shortForm = subjectShortForm.trim().toUpperCase();
    if (!subjectNameClean) {
      toastError("Subject is required.");
      return;
    }
    if (!shortForm || shortForm.length < 2 || shortForm.length > 5 || !/^[A-Z0-9.]+$/.test(shortForm)) {
      toastError("Short Form is required (2–5 chars, uppercase; letters/numbers/dot).");
      return;
    }
    try {
      if (editingSubjectId) {
        await updateSubjectConfig(editingSubjectId, {
          classCategoryId: subjectCategoryId,
          sectionName: subjectSectionName.trim() || undefined,
          subjectName: subjectNameClean,
          shortForm,
        });
      } else {
        await createSubjectConfig({
          classCategoryId: subjectCategoryId,
          sectionName: subjectSectionName.trim() || undefined,
          subjectName: subjectNameClean,
          shortForm,
        });
      }
      setSubjectName("");
      setSubjectShortForm("");
      setSubjectSectionName("");
      setEditingSubjectId(null);
      setSubjectModalOpen(false);
      await refresh();
      toastSuccess(editingSubjectId ? "Subject assignment updated." : "Subject assignment saved.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to add subject assignment";
      setError(msg);
      toastError(msg);
    }
  }

  function openAddSubjectModal() {
    setEditingSubjectId(null);
    setSubjectCategoryId(categories[0]?.id ?? null);
    setSubjectSectionName("");
    setSubjectName("");
    setSubjectShortForm("");
    setSubjectModalOpen(true);
  }

  function openEditSubjectModal(row: SubjectAssignmentConfigRow) {
    setEditingSubjectId(row.id);
    setSubjectCategoryId(row.classCategoryId);
    setSubjectSectionName((row.sectionName ?? "").trim());
    setSubjectName(row.subjectName);
    setSubjectShortForm(String(row.shortForm ?? "").trim().toUpperCase());
    setSubjectModalOpen(true);
  }

  async function onDeleteSubject(id: number) {
    const row = subjectItems.find((x) => x.id === id) ?? null;
    let usage: { marksCount: number; examsCount: number } | null = null;
    try {
      usage = await fetchSubjectAssignmentUsage(id);
    } catch {
      usage = null;
    }
    const subjectLabel = row ? `"${row.subjectName}"` : "this subject";
    const msg =
      usage && usage.marksCount > 0
        ? `Delete ${subjectLabel}?\n\nWARNING: ${usage.marksCount} recorded mark entries will be permanently deleted${
            usage.examsCount > 0 ? `, and ${usage.examsCount} scheduled exams will be removed` : ""
          }.\n\nIf you just want to rename it, click Cancel and use Edit instead.`
        : `Remove ${subjectLabel} subject assignment?`;
    const ok = window.confirm(msg);
    if (!ok) return;
    try {
      await deleteSubjectConfig(id);
      await refresh();
      toastSuccess("Subject assignment removed.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to delete subject assignment";
      setError(msg);
      toastError(msg);
    }
  }

  const cardClass = classNames(
    "rounded-2xl border shadow-sm",
    isDarkUi ? "border-slate-800 bg-slate-950/40" : "border-slate-200 bg-white",
  );

  const pageBg = isDarkUi ? "bg-slate-950" : "bg-[#F1F5F9]";

  return (
    <div className={classNames("space-y-4 rounded-2xl p-4 sm:p-6", pageBg)}>
      {toast ? <Toast toast={toast} onClose={() => setToast(null)} /> : null}

      <div className={classNames(cardClass, "overflow-hidden")}>
        <div className={classNames("p-5 sm:p-6 border-b", isDarkUi ? "border-slate-800" : "border-slate-100")}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className={classNames("text-2xl font-bold tracking-tight", isDarkUi ? "text-white" : "text-slate-900")}>
                Subject &amp; Examination Configuration
              </div>
              <div className={classNames("mt-1 text-sm", isDarkUi ? "text-slate-400" : "text-slate-600")}>
                Manage subjects, exam types, and assessment schedules
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:items-end">
              <div className={classNames("inline-flex rounded-xl p-1", isDarkUi ? "bg-slate-900 ring-1 ring-slate-800" : "bg-slate-100 ring-1 ring-slate-200")}>
                <TabBtn active={activeTab === "subjects"} onClick={() => setActiveTab("subjects")} label="Subject Assignment" icon="📚" isDarkUi={isDarkUi} />
                <TabBtn active={activeTab === "exams"} onClick={() => setActiveTab("exams")} label="Exam Types" icon="📝" isDarkUi={isDarkUi} />
                <TabBtn active={activeTab === "schedule"} onClick={() => setActiveTab("schedule")} label="Scheduling" icon="📅" isDarkUi={isDarkUi} />
              </div>
            </div>
          </div>

          {bannerOpen ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
              <div className="flex items-start justify-between gap-4">
                <div className="text-sm font-semibold">
                  ⚠️ Changes made here directly affect student academic records. Proceed with caution.
                </div>
                <button
                  type="button"
                  onClick={() => setBannerOpen(false)}
                  className="rounded-full p-1 text-amber-900/70 hover:bg-amber-100 hover:text-amber-900 transition"
                  aria-label="Dismiss warning"
                  title="Dismiss"
                >
                  ✕
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="p-5 sm:p-6">
          {error ? (
            <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
              ⚠️ {error}
            </div>
          ) : null}

          <div
            key={activeTab}
            className="animate-in fade-in duration-200"
          >
            {activeTab === "subjects" ? (
              <div className="grid gap-4 lg:grid-cols-10">
                {/* Left (≈70%) */}
                <section className={classNames(cardClass, "lg:col-span-7 overflow-hidden")}>
                  <div className={classNames("p-5 border-b", isDarkUi ? "border-slate-800" : "border-slate-100")}>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className={classNames("text-lg font-semibold", isDarkUi ? "text-white" : "text-slate-900")}>
                          Subject Hierarchy
                        </div>
                        <div className={classNames("mt-1 text-sm", isDarkUi ? "text-slate-400" : "text-slate-600")}>
                          Complete overview of assigned subjects by category and section.
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => openAddSubjectModal()}
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#22C55E] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:brightness-110 active:scale-[0.99] transition"
                      >
                        <span className="text-base">＋</span>
                        Add Subject
                      </button>
                    </div>

                    {/* Filter bar */}
                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <div>
                        <div className={classNames("text-[12px] font-semibold uppercase tracking-wide", isDarkUi ? "text-slate-400" : "text-slate-500")}>
                          Category
                        </div>
                        <select
                          className={inputBase}
                          value={filterCategoryId === "" ? "" : String(filterCategoryId)}
                          onChange={(e) => {
                            const v = e.target.value;
                            setFilterCategoryId(v ? Number(v) : "");
                          }}
                        >
                          <option value="">All categories</option>
                          {categories.map((c) => (
                            <option key={c.id} value={String(c.id)}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <div className={classNames("text-[12px] font-semibold uppercase tracking-wide", isDarkUi ? "text-slate-400" : "text-slate-500")}>
                          Section
                        </div>
                        <input
                          className={inputBase}
                          value={filterSection}
                          onChange={(e) => setFilterSection(e.target.value)}
                          placeholder="Filter by section…"
                        />
                      </div>
                      <div>
                        <div className={classNames("text-[12px] font-semibold uppercase tracking-wide", isDarkUi ? "text-slate-400" : "text-slate-500")}>
                          Subject
                        </div>
                        <input
                          className={inputBase}
                          value={filterSubject}
                          onChange={(e) => setFilterSubject(e.target.value)}
                          placeholder="Filter by subject…"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Table */}
                  {loading ? (
                    <div className="p-6">
                      <div className="h-24 rounded-2xl bg-slate-100 animate-pulse" />
                    </div>
                  ) : subjectItems.length === 0 ? (
                    <div className="p-10 text-center">
                      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-2xl">
                        📚
                      </div>
                      <div className={classNames("text-base font-semibold", isDarkUi ? "text-white" : "text-slate-900")}>
                        No subjects assigned yet
                      </div>
                      <div className={classNames("mt-1 text-sm", isDarkUi ? "text-slate-400" : "text-slate-600")}>
                        Add subject assignments to start building your academic structure.
                      </div>
                    </div>
                  ) : filteredSubjectItems.length === 0 ? (
                    <div className="p-10 text-center">
                      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-2xl">
                        🔎
                      </div>
                      <div className={classNames("text-base font-semibold", isDarkUi ? "text-white" : "text-slate-900")}>
                        No matches
                      </div>
                      <div className={classNames("mt-1 text-sm", isDarkUi ? "text-slate-400" : "text-slate-600")}>
                        Try a different category/section/subject filter.
                      </div>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm min-w-[720px]">
                        <thead className={classNames("border-b", isDarkUi ? "border-slate-800 bg-slate-900/40" : "border-slate-100 bg-slate-50")}>
                          <tr>
                            {["Category", "Section", "Subject", ""].map((h) => (
                              <th
                                key={h}
                                className={classNames(
                                  "px-5 py-3 text-left text-[12px] font-semibold uppercase tracking-wide",
                                  isDarkUi ? "text-slate-400" : "text-slate-500",
                                )}
                              >
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className={classNames("divide-y", isDarkUi ? "divide-slate-900" : "divide-slate-50")}>
                          {categories
                            .filter((c) => groupedSubjects.has(c.id))
                            .map((category) => {
                              const rows = groupedSubjects.get(category.id) ?? [];
                              return (
                                <Fragment key={category.id}>
                                  <tr className={classNames(isDarkUi ? "bg-slate-950/30" : "bg-white")}>
                                    <td colSpan={4} className="px-5 py-3">
                                      <span
                                        className={classNames(
                                          "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1",
                                          categoryBadgeClass(category.name),
                                        )}
                                      >
                                        {category.name}
                                      </span>
                                    </td>
                                  </tr>
                                  {rows.map((row, idx) => {
                                    const sectionLabel = (row.sectionName ?? "").trim() || "General";
                                    return (
                                      <tr
                                        key={row.id}
                                        className={classNames(
                                          idx % 2 === 0 ? (isDarkUi ? "bg-slate-950/10" : "bg-white") : (isDarkUi ? "bg-slate-950/20" : "bg-slate-50/30"),
                                          "hover:bg-slate-50",
                                        )}
                                      >
                                        <td className={classNames("px-5 py-3", isDarkUi ? "text-slate-100" : "text-slate-900")}>
                                          <span className="text-xs font-semibold">{category.name}</span>
                                        </td>
                                        <td className={classNames("px-5 py-3 text-slate-600")}>
                                          <span className="text-sm text-slate-500">{sectionLabel}</span>
                                        </td>
                                        <td className={classNames("px-5 py-3 font-semibold", isDarkUi ? "text-slate-100" : "text-slate-900")}>
                                          {row.subjectName.toUpperCase()}
                                        </td>
                                        <td className="px-5 py-3 text-right">
                                          <div className="inline-flex items-center gap-2">
                                            <button
                                              type="button"
                                              onClick={() => openEditSubjectModal(row)}
                                              className="inline-flex items-center justify-center rounded-lg p-2 text-slate-600 hover:bg-slate-100 transition"
                                              title="Edit subject assignment"
                                              aria-label="Edit subject assignment"
                                            >
                                              ✏️
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => void onDeleteSubject(row.id)}
                                              className="inline-flex items-center justify-center rounded-lg p-2 text-[#EF4444] hover:bg-red-50 transition"
                                              title="Remove subject assignment"
                                              aria-label="Remove subject assignment"
                                            >
                                              🗑️
                                            </button>
                                          </div>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </Fragment>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>

                {/* Right (≈30%) */}
                <aside className={classNames("lg:col-span-3 space-y-4")}>
                  <section className={classNames(cardClass, "p-5")}>
                    <div className={classNames("text-lg font-semibold", isDarkUi ? "text-white" : "text-slate-900")}>
                      Summary
                    </div>
                    <div className={classNames("mt-1 text-sm", isDarkUi ? "text-slate-400" : "text-slate-600")}>
                      Quick overview of assignments.
                    </div>

                    <div className="mt-4 space-y-3">
                      <button
                        type="button"
                        onClick={() => setFilterCategoryId("")}
                        className="w-full text-left rounded-xl border border-slate-200 bg-white px-4 py-3 hover:bg-slate-50 transition"
                        title="Show all categories"
                      >
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-semibold text-slate-800">🗂️ Total Categories</div>
                          <div className="text-sm font-bold text-slate-900">{categories.length}</div>
                        </div>
                        <div className="mt-1 text-xs text-slate-500">Click to clear category filter</div>
                      </button>

                      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-semibold text-slate-800">📋 Total Assignments</div>
                          <div className="text-sm font-bold text-slate-900">{subjectItems.length}</div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4">
                      <div className="text-[12px] font-semibold uppercase tracking-wide text-slate-500">
                        Breakdown
                      </div>
                      <div className="mt-2 space-y-2">
                        {categories.map((c) => {
                          const count = subjectCountsByCategory.get(c.id) ?? 0;
                          if (count === 0) return null;
                          return (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => setFilterCategoryId(c.id)}
                              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-left hover:bg-slate-50 transition"
                              title="Filter table by this category"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-semibold text-slate-800">{c.name}</span>
                                <span className="text-sm font-bold text-slate-900">{count}</span>
                              </div>
                              <div className="mt-1 text-xs text-slate-500">{c.name} → {count} subjects</div>
                            </button>
                          );
                        })}
                        {subjectItems.length === 0 ? (
                          <div className="text-sm text-slate-500">No assignments to summarize yet.</div>
                        ) : null}
                      </div>
                    </div>
                  </section>
                </aside>
              </div>
            ) : activeTab === "exams" ? (
              <div className="grid gap-4 lg:grid-cols-10">
                {/* Left (≈40%) */}
                <section className={classNames(cardClass, "lg:col-span-4 p-5")}>
                  <div className={classNames("text-lg font-semibold", isDarkUi ? "text-white" : "text-slate-900")}>
                    Register Exam Type
                  </div>
                  <div className={classNames("mt-1 text-sm", isDarkUi ? "text-slate-400" : "text-slate-600")}>
                    Add custom assessment cycles to the system.
                  </div>

                  <div className="mt-4 space-y-4">
                    <div>
                      <div className={classNames("text-[12px] font-semibold uppercase tracking-wide", isDarkUi ? "text-slate-400" : "text-slate-500")}>
                        Reference Key
                      </div>
                      <input
                        value={newExamKey}
                        onBlur={() => setExamFormTouched((p) => ({ ...p, key: true }))}
                        onChange={(e) => setNewExamKey(e.target.value.toUpperCase())}
                        placeholder="e.g. MOCK"
                        className={inputBase}
                      />
                      <div className={classNames("mt-1 text-xs", isDarkUi ? "text-slate-400" : "text-slate-500")}>
                        Use uppercase, no spaces. This is used internally.
                      </div>
                      {examFormTouched.key && examKeyError ? (
                        <div className="mt-1 text-xs font-semibold text-[#EF4444]">{examKeyError}</div>
                      ) : null}
                    </div>

                    <div>
                      <div className={classNames("text-[12px] font-semibold uppercase tracking-wide", isDarkUi ? "text-slate-400" : "text-slate-500")}>
                        Display Label
                      </div>
                      <input
                        value={newExamLabel}
                        onBlur={() => setExamFormTouched((p) => ({ ...p, label: true }))}
                        onChange={(e) => setNewExamLabel(e.target.value)}
                        placeholder="e.g. Mock Examination"
                        className={inputBase}
                      />
                      {examFormTouched.label && examLabelError ? (
                        <div className="mt-1 text-xs font-semibold text-[#EF4444]">{examLabelError}</div>
                      ) : null}
                    </div>

                    <button
                      type="button"
                      onClick={() => void onAddExamType()}
                      disabled={!canSubmitExamType}
                      className="w-full rounded-lg px-4 py-3 text-sm font-semibold text-white shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ backgroundImage: "linear-gradient(90deg, #3B3FD8 0%, #6366F1 100%)" }}
                    >
                      Register Exam Type
                    </button>
                  </div>
                </section>

                {/* Right (≈60%) */}
                <section className={classNames(cardClass, "lg:col-span-6 p-5")}>
                  <div className={classNames("text-lg font-semibold", isDarkUi ? "text-white" : "text-slate-900")}>
                    Exam Registry
                  </div>
                  <div className={classNames("mt-1 text-sm", isDarkUi ? "text-slate-400" : "text-slate-600")}>
                    All registered assessment cycles in the system.
                  </div>

                  {createdExamTypes.length === 0 ? (
                    <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center">
                      <div className="text-2xl">📝</div>
                      <div className="mt-2 text-sm font-semibold text-slate-800">No exam types registered yet. Add one to get started.</div>
                    </div>
                  ) : (
                    <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {createdExamTypes.map((row) => (
                        <div
                          key={row.id}
                          className="group relative rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition"
                        >
                          {!row.isSystem ? (
                            <button
                              type="button"
                              onClick={() => void onDeleteExamType(row)}
                              className="absolute right-3 top-3 rounded-lg p-2 text-slate-400 opacity-0 group-hover:opacity-100 hover:bg-slate-50 hover:text-[#EF4444] transition"
                              aria-label="Delete exam type"
                              title="Delete exam type"
                            >
                              🗑️
                            </button>
                          ) : null}

                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center">
                              📄
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold text-slate-900 truncate">{row.displayName}</div>
                              <div className="mt-1 text-xs font-mono text-slate-500">{row.examKey}</div>
                            </div>
                          </div>

                          {row.isSystem ? (
                            <div className="mt-3 inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200">
                              System
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            ) : (
              <div className="mx-auto max-w-[680px]">
                <section className={classNames(cardClass, "p-5")}>
                  <div className={classNames("text-lg font-semibold", isDarkUi ? "text-white" : "text-slate-900")}>
                    Schedule New Assessment
                  </div>
                  <div className={classNames("mt-1 text-sm", isDarkUi ? "text-slate-400" : "text-slate-600")}>
                    Publish an exam or test to the academic calendar.
                  </div>

                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor="sched-category"
                        className={classNames("text-[12px] font-semibold uppercase tracking-wide", isDarkUi ? "text-slate-400" : "text-slate-500")}
                      >
                        Category
                      </label>
                      <select
                        id="sched-category"
                        className={classNames(inputBase, "mt-1")}
                        value={schedCategoryId ?? ""}
                        onChange={(e) => setSchedCategoryId(e.target.value ? Number(e.target.value) : null)}
                        aria-label="Category"
                      >
                        {scheduleCategoryOptions.length === 0 ? <option value="">No categories</option> : null}
                        {scheduleCategoryOptions.map((c) => (
                          <option key={c.id} value={String(c.id)}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="sched-class"
                        className={classNames("text-[12px] font-semibold uppercase tracking-wide", isDarkUi ? "text-slate-400" : "text-slate-500")}
                      >
                        Class
                      </label>
                      <select
                        id="sched-class"
                        className={classNames(inputBase, "mt-1")}
                        value={schedClassId}
                        onChange={(e) => {
                          setSchedClassId(e.target.value);
                          setSchedSubject("");
                        }}
                        aria-label="Class"
                      >
                        <option value="">Select a class...</option>
                        {scheduleClassOptions.map((c) => (
                          <option key={c.id} value={String(c.id)}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <span
                        className={classNames("text-[12px] font-semibold uppercase tracking-wide", isDarkUi ? "text-slate-400" : "text-slate-500")}
                      >
                        Term
                      </span>
                      <div
                        className={classNames(
                          inputBase,
                          "mt-1 flex items-center justify-between cursor-not-allowed opacity-80 select-none",
                        )}
                        role="group"
                        aria-label="Term from system"
                      >
                        <span>{viewingTerm}</span>
                        <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">System</span>
                      </div>
                    </div>

                    <div>
                      <span
                        className={classNames("text-[12px] font-semibold uppercase tracking-wide", isDarkUi ? "text-slate-400" : "text-slate-500")}
                      >
                        Academic Year
                      </span>
                      <div
                        className={classNames(
                          inputBase,
                          "mt-1 flex items-center justify-between cursor-not-allowed opacity-80 select-none",
                        )}
                        role="group"
                        aria-label="Academic year from system"
                      >
                        <span>{viewingAcademicYear}</span>
                        <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">System</span>
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="sched-exam-type"
                        className={classNames("text-[12px] font-semibold uppercase tracking-wide", isDarkUi ? "text-slate-400" : "text-slate-500")}
                      >
                        Assessment Cycle
                      </label>
                      <select
                        id="sched-exam-type"
                        className={classNames(inputBase, "mt-1")}
                        value={schedExamType}
                        onChange={(e) => setSchedExamType(e.target.value)}
                        aria-label="Assessment cycle"
                      >
                        <option value="">Select exam type...</option>
                        {createdExamTypes
                          .filter((t) => t.isActive)
                          .map((t) => (
                            <option key={t.examKey} value={t.examKey}>
                              {t.displayName}
                            </option>
                          ))}
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="sched-subject"
                        className={classNames("text-[12px] font-semibold uppercase tracking-wide", isDarkUi ? "text-slate-400" : "text-slate-500")}
                      >
                        Subject
                      </label>
                      <select
                        id="sched-subject"
                        className={classNames(inputBase, "mt-1")}
                        value={schedSubject}
                        onChange={(e) => setSchedSubject(e.target.value)}
                        aria-label="Subject"
                        disabled={!schedClassId}
                      >
                        <option value="">All Subjects / General</option>
                        {scheduleSubjectSelectOptions.map((row) => {
                          const sf = String(row.shortForm ?? "").trim();
                          const label = sf ? `${row.subjectName} (${sf})` : row.subjectName;
                          return (
                            <option key={`${row.subjectName}-${row.id}`} value={row.subjectName}>
                              {label}
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      {!selectedClassHasAssignments && schedClassId ? (
                        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
                          <div className="flex items-start justify-between gap-3">
                            <div className="text-sm font-semibold">
                              No subject assignments found for this class. Please configure subjects first.
                              <button
                                type="button"
                                onClick={() => setActiveTab("subjects")}
                                className="ml-2 text-sm font-semibold text-[#3B3FD8] hover:underline"
                              >
                                Go to Subject Assignment
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <div className="sm:col-span-2">
                      <label
                        htmlFor="sched-calendar"
                        className={classNames("text-[12px] font-semibold uppercase tracking-wide", isDarkUi ? "text-slate-400" : "text-slate-500")}
                      >
                        Scheduled Date
                      </label>
                      <div id="sched-calendar" className="mt-1">
                        <CalendarPicker value={schedDate} onChange={setSchedDate} placeholder="Pick a date…" />
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => void onScheduleExam()}
                    disabled={
                      schedBusy ||
                      schedCategoryId == null ||
                      !schedClassId ||
                      !schedExamType.trim() ||
                      !schedDate.trim()
                    }
                    className="mt-5 w-full rounded-lg px-4 py-3 text-sm font-semibold text-white shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ backgroundImage: "linear-gradient(90deg, #3B3FD8 0%, #6366F1 100%)" }}
                  >
                    {schedBusy ? "Publishing…" : "Publish Assessment Schedule"}
                  </button>
                </section>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Subject Modal */}
      {subjectModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setSubjectModalOpen(false)}
            aria-hidden
          />
          <div className={classNames("relative w-full max-w-lg rounded-2xl bg-white shadow-xl border border-slate-200", "animate-in fade-in zoom-in-95 duration-200")}>
            <div className="p-5 border-b border-slate-100">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-lg font-semibold text-slate-900">{editingSubjectId ? "Edit Subject" : "Add Subject"}</div>
                  <div className="mt-1 text-sm text-slate-600">
                    {editingSubjectId ? "Update the saved subject assignment." : "Assign a subject to a category and section."}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSubjectModalOpen(false)}
                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-50 transition"
                  aria-label="Close"
                  title="Close"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <div className="text-[12px] font-semibold uppercase tracking-wide text-slate-500">Category</div>
                <select
                  className={inputBase}
                  value={subjectCategoryId ?? ""}
                  onChange={(e) => setSubjectCategoryId(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">Select a category…</option>
                  {categories.map((c) => (
                    <option key={c.id} value={String(c.id)}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <div className="text-[12px] font-semibold uppercase tracking-wide text-slate-500">Section</div>
                <select
                  className={inputBase}
                  value={subjectSectionName}
                  onChange={(e) => setSubjectSectionName(e.target.value)}
                  disabled={!subjectCategoryId}
                >
                  <option value="">{subjectCategoryId ? "General" : "Select category first…"}</option>
                  {sectionOptionsForSelectedCategory.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div>
                <div className="text-[12px] font-semibold uppercase tracking-wide text-slate-500">Subject</div>
                <input
                  className={inputBase}
                  value={subjectName}
                  onChange={(e) => setSubjectName(e.target.value)}
                  placeholder="e.g. Mathematics"
                />
              </div>

              <div>
                <div className="text-[12px] font-semibold uppercase tracking-wide text-slate-500">Short Form</div>
                <input
                  className={inputBase}
                  value={subjectShortForm}
                  onChange={(e) => setSubjectShortForm(e.target.value.toUpperCase())}
                  placeholder="e.g. MTH"
                  maxLength={5}
                />
                <div className="mt-1 text-xs text-slate-500">
                  This abbreviation will appear as the column header in the results table.
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-slate-100 flex flex-col sm:flex-row gap-3 justify-end">
              <button
                type="button"
                onClick={() => setSubjectModalOpen(false)}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void onAddSubject()}
                disabled={!subjectCategoryId || !subjectName.trim() || !subjectShortForm.trim()}
                className="rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: "#22C55E" }}
              >
                {editingSubjectId ? "Save Changes" : "Save"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TabBtn({ active, onClick, label, icon, isDarkUi }: { 
  active: boolean; 
  onClick: () => void; 
  label: string; 
  icon: string;
  isDarkUi: boolean;
}) {
  const cls = [
    "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-all",
    active
      ? (isDarkUi ? "bg-slate-800 text-white" : "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200")
      : (isDarkUi ? "text-slate-400 hover:text-slate-200" : "text-slate-600 hover:text-slate-900"),
  ].join(" ");
  return (
    <button
      onClick={onClick}
      className={cls}
      title={`Switch to ${label} view`}
    >
      <span className="text-base leading-none">{icon}</span>
      <span className={active ? "font-bold" : "font-semibold"}>{label}</span>
    </button>
  );
}

function GradingStandardsPage() {
  const [scales, setScales] = useState<GradingScaleRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchGradingScales()
      .then(setScales)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 space-y-8 duration-700">
      <header className="flex flex-col justify-between gap-4 border-b border-[#ebe4d9]/80 pb-6 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-[#2d3436]">Grading Standards & Scales</h1>
          <p className="mt-1 text-sm font-semibold text-[#636e72]">Configure academic grading thresholds and division logic.</p>
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-2">
        <section className="neo-card-elevated flex flex-col overflow-hidden">
          <div className="border-b border-[#ebe4d9]/60 bg-[#faf7f0]/60 px-6 py-5">
             <h2 className="text-xs font-black uppercase tracking-widest text-[#2d3436]">Active Grading Policies</h2>
          </div>
          <div className="flex-1 p-6">
            {error ? <div className="mb-4 rounded-xl bg-red-50 p-4 text-sm font-bold text-red-600">{error}</div> : null}
            <div className="space-y-4">
              {scales.map(s => (
                <div key={s.id} className="group rounded-2xl border border-[#ebe4d9]/60 bg-white/40 p-5 transition-all hover:bg-white/80">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-lg font-black text-[#2d3436]">{s.name}</h3>
                    <button 
                      className="text-[10px] font-black uppercase tracking-widest text-[#3498db]"
                      title="Edit the thresholds and rules for this grading policy"
                    >Edit Policy</button>
                  </div>
                  <div className="grid grid-cols-4 gap-4 text-center">
                    {Object.entries(s.thresholds).slice(0, 4).map(([grade, score]) => (
                      <div key={grade} className="rounded-xl bg-[#ebe4d9]/30 p-2">
                        <p className="text-[10px] font-black uppercase text-[#636e72]">{grade}</p>
                        <p className="text-sm font-black text-[#2d3436]">{score as number}+</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex items-center gap-2 text-[10px] font-bold text-[#636e72]">
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                    <span>Used across {s.name.includes('Primary') ? '7' : '6'} class sections</span>
                  </div>
                </div>
              ))}
              {scales.length === 0 && !loading && (
                <div className="py-12 text-center text-sm font-bold text-[#636e72]">No grading scales found.</div>
              )}
              {loading && <div className="h-32 w-full animate-pulse rounded-2xl bg-[#ebe4d9]/40"></div>}
            </div>
          </div>
        </section>

        <section className="neo-card-elevated p-8">
           <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-[#3498db]/10 to-[#2980b9]/10 text-3xl">
              📐
            </div>
            <h2 className="text-xl font-black text-[#2d3436]">Global Academic Policy</h2>
            <p className="mt-3 max-w-sm text-sm font-medium text-[#636e72]">
              Define custom grading logic for Primary or Secondary sections. Changes here will instantly update performance reports across the entire school.
            </p>
            <button 
              className="mt-10 w-full rounded-2xl bg-gradient-to-br from-[#3498db] to-[#2980b9] py-4 text-sm font-black uppercase tracking-widest text-white shadow-xl transition hover:brightness-110 active:scale-95"
              title="Create a new grading policy using a standardized template"
            >
              Initialize New Template
            </button>
            <p className="mt-4 text-[10px] font-bold uppercase tracking-widest text-[#636e72]">Last updated 2 days ago</p>
          </div>
        </section>
      </div>
    </div>
  );
}

function ReportRemarksPage() {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 space-y-6 duration-700">
      <header className="flex flex-col justify-between gap-4 border-b border-[#ebe4d9]/80 pb-6 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-[#2d3436]">Student Report Remarks</h1>
          <p className="mt-1 text-sm font-semibold text-[#636e72]">Manage teacher comments and conduct reports for student cards.</p>
        </div>
      </header>

      <div className="neo-card-elevated p-16 text-center">
        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-[#3498db]/10 to-[#2980b9]/10 text-4xl mb-8">
          💬
        </div>
        <h2 className="text-2xl font-black text-[#2d3436]">No Student Selected</h2>
        <p className="mx-auto mt-3 max-w-lg text-sm font-medium text-[#636e72]">
          Remarks are managed during the result entry process. To add comments, please select a student from the Results Entry page and click on the "Add Remarks" option in their mark entry form.
        </p>
        
        <div className="mt-12 inline-flex items-center gap-3 rounded-2xl bg-[#3498db]/10 px-8 py-4 text-sm font-black text-[#3498db]">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#3498db]"></span>
          Select a student from Results Entry to begin
        </div>

        <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl mx-auto">
          <div className="p-4 rounded-2xl bg-[#ebe4d9]/30 border border-white/50">
            <p className="text-xs font-black uppercase text-[#636e72] mb-1">Conduct Reports</p>
            <p className="text-[10px] font-bold text-[#2d3436]">Behavioral assessment logs</p>
          </div>
          <div className="p-4 rounded-2xl bg-[#ebe4d9]/30 border border-white/50">
            <p className="text-xs font-black uppercase text-[#636e72] mb-1">Termly Comments</p>
            <p className="text-[10px] font-bold text-[#2d3436]">Custom teacher feedback</p>
          </div>
          <div className="p-4 rounded-2xl bg-[#ebe4d9]/30 border border-white/50">
            <p className="text-xs font-black uppercase text-[#636e72] mb-1">HM Signature</p>
            <p className="text-[10px] font-bold text-[#2d3436]">Official report validation</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ExamSchedulePage() {
  const { viewingAcademicYear } = useTermContext();
  const [exams, setExams] = useState<UpcomingExamRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    void fetchExams()
      .then((rows) =>
        setExams(rows.filter((ex) => String(ex.examDate ?? "").startsWith(viewingAcademicYear))),
      )
      .finally(() => setLoading(false));
  }, [viewingAcademicYear]);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 space-y-6 duration-700">
      <header className="flex flex-col justify-between gap-4 border-b border-[#ebe4d9]/80 pb-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-[#2d3436]">Exam Scheduling</h1>
          <p className="mt-1 text-sm font-semibold text-[#636e72]">Set and manage dates for BOT, MID, and EOT exams.</p>
        </div>
      </header>

      <div className="neo-card-elevated overflow-hidden">
        <div className="border-b border-[#ebe4d9]/60 bg-[#faf7f0]/40 px-6 py-4">
          <h2 className="text-sm font-black uppercase tracking-widest text-[#2d3436]">Scheduled Academic Exams</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#f5f8f5]/50 text-[10px] font-black uppercase tracking-widest text-[#6a9570]">
              <tr>
                <th className="px-6 py-4">Exam Date</th>
                <th className="px-6 py-4">Subject</th>
                <th className="px-6 py-4">Class</th>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ebe4d9]/40">
              {exams.map(ex => (
                <tr key={ex.id} className="group transition-colors hover:bg-white/40">
                  <td className="px-6 py-4">
                    <span className="font-black text-[#3498db]">{ex.examDate}</span>
                  </td>
                  <td className="px-6 py-4 font-bold text-[#2d3436]">{ex.subject}</td>
                  <td className="px-6 py-4 font-medium text-[#636e72]">{ex.className}</td>
                  <td className="px-6 py-4">
                    <span className="neo-inset px-3 py-1 text-[10px] font-black uppercase text-[#2d3436]">
                      {ex.examKey}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      className="rounded-full bg-white/80 px-4 py-1.5 text-xs font-black text-[#3498db] shadow-sm hover:bg-white transition active:scale-95"
                      title="Update the details of this scheduled examination"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
              {exams.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#ebe4d9]/30 text-[#636e72]">
                        <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <p className="text-sm font-bold text-[#636e72]">No exams scheduled yet.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function PromotionPage() {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 space-y-6 duration-700">
      <header className="flex flex-col justify-between gap-4 border-b border-[#ebe4d9]/80 pb-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-[#2d3436]">Promotion Engine</h1>
          <p className="mt-1 text-sm font-semibold text-[#636e72]">Manage bulk student promotions and graduation.</p>
        </div>
      </header>

      <div className="neo-card-elevated p-12 text-center">
        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-[#f1c40f]/10 text-[#f1c40f] ring-8 ring-[#f1c40f]/5">
          <svg className="h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
          </svg>
        </div>
        <h2 className="mt-8 text-2xl font-black text-[#2d3436]">Promotion Engine Locked</h2>
        <p className="mx-auto mt-3 max-w-lg text-sm font-medium text-[#636e72]">
          Promotion is typically available at the end of Term 3. Configure grading scales first to enable automatic promotion eligibility checks.
        </p>
        <div className="mt-10 flex justify-center gap-4">
          <button className="rounded-full bg-gradient-to-br from-[#3498db] to-[#2980b9] px-8 py-3 text-sm font-black text-white shadow-lg transition hover:brightness-110 active:scale-95">
            Check Eligibility (Simulate)
          </button>
          <button className="rounded-full bg-white px-8 py-3 text-sm font-black text-[#2d3436] shadow-md transition hover:bg-[#faf7f0] active:scale-95">
            View Requirements
          </button>
        </div>
      </div>
    </div>
  );
}

function LearnsReportPage() {
  const { viewingTerm, viewingAcademicYear } = useTermContext();
  const [classes, setClasses] = useState<
    Array<{ id: number; name: string; categoryId: number | null; categoryName: string | null }>
  >([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<string>("");
  const [examType, setExamType] = useState<ExamType>("");
  const [examTypes, setExamTypes] = useState<string[]>([]);
  const [subjectItems, setSubjectItems] = useState<SubjectAssignmentConfigRow[]>([]);
  const [marksheet, setMarksheet] = useState<GeneratedMarksheetPayload | null>(null);
  const [, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchResultEntryOptions();
        if (cancelled) return;
        setClasses(data.classes);
        const categoryIds = Array.from(
          new Set(data.classes.map((x) => x.categoryId).filter((x): x is number => x != null)),
        );
        setSelectedCategoryId(categoryIds[0] ?? null);
        const nonAssessmentTypes = data.examTypes.filter((x) => x !== "ASSESSMENT");
        setExamTypes(nonAssessmentTypes);
        setExamType(nonAssessmentTypes[0] ?? data.examTypes[0] ?? "");
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load class list");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const payload = await getSubjectConfigsCached();
        if (!cancelled) setSubjectItems(payload.items);
      } catch {
        if (!cancelled) setSubjectItems([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const categoryOptions = useMemo(
    () =>
      Array.from(
        new Map(
          classes
            .filter((x) => x.categoryId != null)
            .map((x) => [x.categoryId as number, x.categoryName ?? "Uncategorized"]),
        ).entries(),
      ).map(([id, name]) => ({ id, name })),
    [classes],
  );

  const classOptions = useMemo(
    () => classes.filter((x) => x.categoryId === selectedCategoryId),
    [classes, selectedCategoryId],
  );

  const selectedClassRow = useMemo(() => {
    if (selectedClassId == null) return null;
    return classes.find((c) => c.id === selectedClassId) ?? null;
  }, [classes, selectedClassId]);

  const marksheetSubjectNameOptions = useMemo(() => {
    const catId = selectedClassRow?.categoryId ?? null;
    if (catId == null) return [];
    const names = new Set<string>();
    for (const row of subjectItems) {
      if (row.classCategoryId === catId) names.add(row.subjectName);
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [selectedClassRow?.categoryId, subjectItems]);

  useEffect(() => {
    if (selectedCategoryId == null) {
      setSelectedClassId(null);
      return;
    }
    const stillValid = classOptions.some((x) => x.id === selectedClassId);
    if (!stillValid) setSelectedClassId(classOptions[0]?.id ?? null);
  }, [selectedCategoryId, classOptions, selectedClassId]);

  useEffect(() => {
    setSelectedSubject("");
  }, [selectedClassId]);

  const displaySubjects = useMemo(() => {
    if (!marksheet) return [];
    if (!selectedSubject.trim()) return marksheet.subjects;
    return marksheet.subjects.filter((s) => s === selectedSubject);
  }, [marksheet, selectedSubject]);

  async function onGenerateMarksheet() {
    if (!selectedClassId || !examType) return;
    setGenerating(true);
    setError(null);
    try {
      const item = await generateClassMarksheet({
        term: viewingTerm,
        examType,
        classRoomId: selectedClassId,
        academicYear: viewingAcademicYear,
      });
      setMarksheet(item);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate marksheet");
      setMarksheet(null);
    } finally {
      setGenerating(false);
    }
  }

  const systemFieldClass =
    "neo-inset-field flex w-full items-center justify-between rounded-xl px-3 py-3 text-sm font-bold text-[#2d3436] cursor-not-allowed opacity-90 select-none";

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 space-y-6 duration-700">
      <header className="flex flex-col justify-between gap-4 border-b border-[#ebe4d9]/80 pb-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-[#2d3436]">Learner Result Reports</h1>
          <p className="mt-1 text-sm font-semibold text-[#636e72]">Generate and view comprehensive class marksheets.</p>
        </div>
      </header>

      <div className="neo-card p-6">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-7 lg:items-end">
          <div className="space-y-2">
            <label htmlFor="learns-category" className="text-[10px] font-black uppercase tracking-widest text-[#636e72]">
              Category
            </label>
            <select
              id="learns-category"
              value={selectedCategoryId ?? ""}
              onChange={(e) => setSelectedCategoryId(e.target.value ? Number(e.target.value) : null)}
              className="neo-inset-field w-full rounded-xl px-4 py-3 text-sm font-bold text-[#2d3436] outline-none"
              aria-label="Category"
            >
              {categoryOptions.length === 0 ? <option value="">No categories</option> : null}
              {categoryOptions.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label htmlFor="learns-class" className="text-[10px] font-black uppercase tracking-widest text-[#636e72]">
              Class
            </label>
            <select
              id="learns-class"
              value={selectedClassId ?? ""}
              onChange={(e) => setSelectedClassId(e.target.value ? Number(e.target.value) : null)}
              className="neo-inset-field w-full rounded-xl px-4 py-3 text-sm font-bold text-[#2d3436] outline-none"
              aria-label="Class"
            >
              {classOptions.length === 0 ? <option value="">No classes</option> : null}
              {classOptions.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-[#636e72]">Term</span>
            <div className={systemFieldClass} role="group" aria-label="Term (from system)">
              <span className="flex items-center gap-1.5">
                <svg className="h-3.5 w-3.5 shrink-0 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                {viewingTerm}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">System</span>
            </div>
          </div>
          <div className="space-y-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-[#636e72]">Academic Year</span>
            <div className={systemFieldClass} role="group" aria-label="Academic year (from system)">
              <span className="flex items-center gap-1.5">
                <svg className="h-3.5 w-3.5 shrink-0 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                {viewingAcademicYear}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">System</span>
            </div>
          </div>
          <div className="space-y-2">
            <label htmlFor="learns-exam-type" className="text-[10px] font-black uppercase tracking-widest text-[#636e72]">
              Exam Type
            </label>
            <select
              id="learns-exam-type"
              value={examType}
              onChange={(e) => setExamType(e.target.value as ExamType)}
              className="neo-inset-field w-full rounded-xl px-3 py-3 text-sm font-bold text-[#2d3436] outline-none"
              aria-label="Exam type"
            >
              {examTypes.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label htmlFor="learns-subject" className="text-[10px] font-black uppercase tracking-widest text-[#636e72]">
              Subject
            </label>
            <select
              id="learns-subject"
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="neo-inset-field w-full rounded-xl px-3 py-3 text-sm font-bold text-[#2d3436] outline-none"
              aria-label="Subject filter"
              disabled={!selectedClassId}
            >
              <option value="">All Subjects</option>
              {marksheetSubjectNameOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end sm:col-span-2 lg:col-span-1">
            <button
              type="button"
              onClick={() => void onGenerateMarksheet()}
              disabled={generating || !selectedClassId || !examType}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-[#3498db] to-[#2980b9] px-6 py-3.5 text-sm font-black text-white shadow-lg transition hover:brightness-110 active:scale-95 disabled:opacity-50"
              aria-label="Generate marksheet"
            >
              {generating ? (
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              )}
              <span>{generating ? "Generating..." : "Generate Marksheet"}</span>
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <div className="neo-card border-l-4 border-red-500 p-4 text-sm font-bold text-red-700">{error}</div>
      ) : null}

      {marksheet ? (
        <div className="neo-card-elevated overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#ebe4d9]/80 bg-[#faf7f0]/60 px-6 py-4">
            <div>
              <h2 className="text-sm font-black uppercase tracking-widest text-[#2d3436]">
                {marksheet.className} · {marksheet.term} · {marksheet.examType}
              </h2>
              <p className="mt-0.5 text-xs font-bold text-[#3498db]">{marksheet.rows.length} Learners Ranked</p>
            </div>
            <button type="button" className="flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 text-xs font-black text-[#2d3436] shadow-sm hover:bg-white transition">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#f5f8f5]/50 text-[10px] font-black uppercase tracking-widest text-[#6a9570]">
                <tr>
                  <th className="px-6 py-4">Rank</th>
                  <th className="px-6 py-4">Learner</th>
                  {displaySubjects.map((subject) => (
                    <th key={subject} className="px-6 py-4 text-right">
                      {subject}
                    </th>
                  ))}
                  <th className="px-6 py-4 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ebe4d9]/40">
                {marksheet.rows.map((row) => (
                  <tr key={row.studentId} className="group transition-colors hover:bg-white/40">
                    <td className="px-6 py-4">
                      <div
                        className={`flex h-7 w-7 items-center justify-center rounded-full font-black text-xs ${
                          row.position === 1
                            ? "bg-yellow-100 text-yellow-700"
                            : row.position === 2
                              ? "bg-slate-100 text-slate-600"
                              : row.position === 3
                                ? "bg-orange-100 text-orange-700"
                                : "text-[#636e72]"
                        }`}
                      >
                        {row.position}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-bold text-[#2d3436]">{row.fullName}</td>
                    {displaySubjects.map((subject) => (
                      <td key={`${row.studentId}-${subject}`} className="px-6 py-4 text-right font-black text-[#2d3436]">
                        {row.marksBySubject[subject] ?? "-"}
                      </td>
                    ))}
                    <td className="px-6 py-4 text-right">
                      <span
                        className="rounded-lg bg-[#3498db]/10 px-3 py-1.5 font-black text-[#3498db]"
                        title="Total from full marksheet; may not match visible columns when a subject filter is applied."
                      >
                        {row.totalMarks}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="neo-card border-dashed border-2 border-[#ebe4d9] p-20 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#ebe4d9]/30 text-[#636e72]">
            <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <p className="font-black text-[#2d3436]">Ready to Generate</p>
          <p className="mt-1 text-sm font-medium text-[#636e72]">Select a class and exam type above to view the performance marksheet.</p>
        </div>
      )}
    </div>
  );
}

export function CurriculumSectionPage({ section }: { section: CurriculumSection }) {
  if (section === "exams_dashboard") return <ExamsDashboardPage />;
  if (section === "result_entry") return <ResultEntryPage mode="exams" />;
  if (section === "assessment_tests") return <ResultEntryPage mode="assessments" />;
  if (section === "grading_standards") return <GradingStandardsPage />;
  if (section === "report_remarks") return <ReportRemarksPage />;
  if (section === "exam_schedule") return <ExamSchedulePage />;
  if (section === "promotion_engine") return <PromotionPage />;
  if (section === "learns_report") return <LearnsReportPage />;
  if (section === "blank_page") return <SubjectsConfigPage />;
  return <PerformanceStatsPage section={section} />;
}
