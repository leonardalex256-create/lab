import { apiUrl, authHeaders } from "./baseUrl";

export type DashboardStats = {
  totalStudents: number;
  totalTeachers: number;
  totalParents: number;
  totalLibrarians: number;
  totalAccountants: number;
  totalEnquiries: number;
  allMessages: number;
  presentToday: number;
  // Registrar / staff / student scoped stats (optional, role-specific)
  newAdmissionsThisTerm?: number;
  linkedParents?: number;
  incompleteProfiles?: number;
  activeNotices?: number;
  unreadMessages?: number;
  feeBalance?: number;
  attendanceRate?: number;
  mySubjectsCount?: number;
  lastExamAverage?: number;
};

export type DashboardKpis = {
  dueFees: string;
  upcomingExams: string;
  resultsPublished: string;
  termExpenses: string;
};

export type DashboardSnapshot = {
  activeStudents: number;
  classRooms: number;
};

export type DashboardCalendar = {
  yearMonth: string;
  monthLabel: string;
  highlightDays: number[];
  /** `date` is formatted DD/MM/YYYY for display */
  events: { date: string; day: number; title: string }[];
};

export type DashboardLearner = {
  title: string;
  name: string;
  gender: string;
  admissionId: string;
  /** DD/MM/YYYY */
  admissionDate: string;
  className: string;
  section: string;
};

export type DashboardNotice = {
  /** DD/MM/YYYY */
  date: string;
  author: string;
  text: string;
};

export type DashboardExpenseRow = {
  id: string;
  type: string;
  amount: string;
  amountUgx: string;
  status: "Paid" | "Due";
  email: string;
  /** DD/MM/YYYY */
  date: string;
  /** ISO time when the expense was recorded (optional for older API responses). */
  recordedAt?: string;
};

export type DashboardSocialTile = {
  platformKey: string;
  label: string;
  sub: string;
  className: string;
};

export type DashboardViewMeta = {
  term: string | null;
  academicYear: string | null;
  calendarMonth: string;
  kpisAreGlobal: boolean;
};

export type DashboardPayload = {
  meta?: DashboardViewMeta;
  stats: DashboardStats;
  kpis: DashboardKpis;
  snapshot: DashboardSnapshot;
  calendar: DashboardCalendar;
  chartPoints: [number, number][];
  social: DashboardSocialTile[];
  learners: DashboardLearner[];
  notices: DashboardNotice[];
  expenses: DashboardExpenseRow[];
  // role-scoped fields (optional)
  userName?: string;
  availableExamTypes?: string[];
  academicAlerts?: Array<{ level: "warning" | "danger" | "info"; message: string }>;
  registrarActions?: Array<{
    type: "missing_parent" | "incomplete_profile" | "pending_approval";
    studentName: string;
    detail: string;
  }>;
  learner?: {
    id: number;
    title: string;
    name: string;
    gender: string;
    admissionNumber: string;
    admissionDate: string;
    className: string;
    section: string;
  };
  linkedChildren?: Array<{
    id: number;
    name: string;
    className: string;
    admissionNumber: string;
  }>;
};

async function readJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text.trim()) throw new Error("Empty response");
  return JSON.parse(text) as T;
}

export async function fetchDashboard(opts?: {
  calendarMonth?: string;
  term?: string;
  academicYear?: string;
}): Promise<DashboardPayload> {
  const params = new URLSearchParams();
  if (opts?.calendarMonth && /^\d{4}-\d{2}$/.test(opts.calendarMonth)) {
    params.set("calendarMonth", opts.calendarMonth);
  }
  if (opts?.term?.trim()) params.set("term", opts.term.trim());
  if (opts?.academicYear?.trim() && /^\d{4}$/.test(opts.academicYear.trim())) {
    params.set("academicYear", opts.academicYear.trim());
  }
  const q = params.toString() ? `?${params.toString()}` : "";
  const res = await fetch(apiUrl(`/api/me/dashboard${q}`), {
    headers: { ...authHeaders() },
  });
  if (res.status === 401) throw new Error("Unauthorized");
  if (!res.ok) {
    const err = await readJson<{ error?: string; detail?: string }>(res).catch(
      () => null,
    );
    if (res.status === 503 && err?.error === "Database unavailable") {
      const tech =
        err.detail && import.meta.env.DEV
          ? `\n\nDetails (dev only): ${err.detail}`
          : "";
      throw new Error(
        "Could not load dashboard data — database unreachable or schema out of date. Start MySQL, run npm run db:sync in backend, then npm run seed:dashboard for sample rows." +
          tech,
      );
    }
    throw new Error(err?.error ?? "Request failed");
  }
  return readJson<DashboardPayload>(res);
}
