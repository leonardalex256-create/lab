import { useCallback, useEffect, useMemo, useState } from "react";
import {
  markAllMessagesRead,
  markAllNotificationsRead,
  fetchMessages,
  fetchNotifications,
} from "../api/inbox";
import {
  fetchDashboard,
  type DashboardPayload,
} from "../api/dashboard";
import { AdminLayout, type AdminUser } from "../components/admin/AdminLayout";
import { ViewingContextBanner } from "../components/admin/ViewingContextBanner";
import { useTermContext } from "../context/TermContext";
import { InboxDetailView } from "../components/inbox/InboxDetailView";
import { InboxListView } from "../components/inbox/InboxListView";
import type { InboxItem } from "../components/admin/headerInboxDemo";
import { SettingsModesPanel } from "../components/settings/SettingsModesPanel";
import { SettingsGeneralPanel } from "../components/settings/SettingsGeneralPanel";
import { SettingsFeesStructurePanel } from "../components/settings/SettingsFeesStructurePanel";
import { SettingsClassStructurePanel } from "../components/settings/SettingsClassStructurePanel";
import { SettingsAcademicPanel } from "../components/settings/SettingsAcademicPanel";
import { SettingsUsersRolesPanel } from "../components/settings/SettingsUsersRolesPanel";
import { ExpensesAllPage } from "../components/expenses/ExpensesAllPage";
import {
  FinanceSectionPage,
  type FinanceSection,
} from "../components/finance/FinanceSectionPage";
import {
  StudentsSectionPage,
  type StudentNavSection,
} from "../components/students/StudentsSectionPage";
import {
  StaffSectionPage,
  type StaffNavSection,
  type TeachingSection,
  type NonTeachingCategory,
} from "../components/staff/StaffSectionPage";
import {
  ClassesSectionPage,
  type ClassesSection,
} from "../components/classes/ClassesSectionPage";
import {
  CurriculumSectionPage,
  CURRICULUM_OPEN_SUBJECTS_SCHEDULE_EVENT,
  type CurriculumSection,
} from "../components/curriculum/CurriculumSectionPage";
import { NoticeBoardPage } from "../components/communication/NoticeBoardPage";
import { AttendanceSectionPage } from "../components/attendance/AttendanceSectionPage";
import { ResultsSectionPage } from "../components/results/ResultsSectionPage";
import { SettingsNotificationsPanel } from "../components/settings/SettingsNotificationsPanel";
import { SettingsAuditLogPanel } from "../components/settings/SettingsAuditLogPanel";
import { formatShortAgo } from "../utils/formatShortAgo";
import { DOSOverview } from "./DOSOverview";
import { AccountantOverview } from "./AccountantOverview";
import { AdminOverview } from "./AdminOverview";
import { TeacherOverview } from "./TeacherOverview";
import { RecordsSearchPage } from "../components/search/RecordsSearchPage";
import { HistoricalRecordsPage } from "../components/historical/HistoricalRecordsPage";
import { RegistrarOverview } from "../overviews/RegistrarOverview";
import { StaffOverview } from "../overviews/StaffOverview";
import { StudentOverview } from "../overviews/StudentOverview";
import { ParentOverview } from "../overviews/ParentOverview";

type DashboardProps = {
  user: AdminUser | null;
  profileLoading: boolean;
  profileError: string | null;
  onRetryProfile?: () => void | Promise<void>;
  onLogout: () => void;
  onAccountUpdated?: () => void;
};

const DASHBOARD_VIEW_STATE_KEY = "junior_school_dashboard_view_state";

type InboxScreen =
  | { screen: "home" }
  | { screen: "list"; kind: "notifications" | "messages" }
  | { screen: "detail"; kind: "notifications" | "messages"; id: number };

type PersistedViewState = {
  settingsPanel: string | null;
  inboxScreen: InboxScreen;
  mainView:
    | "dashboard"
    | "expenses"
    | "students"
    | "staff"
    | "finance"
    | "classes"
    | "curriculum"
    | "communication"
    | "attendance"
    | "results"
    | "search"
    | "historical";
  studentSection: StudentNavSection;
  staffSection: StaffNavSection;
  teachingSection: TeachingSection;
  nonTeachingCategory: NonTeachingCategory;
  financeSection: FinanceSection;
  classesSection: ClassesSection;
  classesRosterClassId: number | null;
  curriculumSection: CurriculumSection;
  attendanceSection: "list" | "take" | "reports";
  resultsSection: "list" | "entry" | "transcript" | "report_cards";
  selectedClassName: string | null;
};

function viewStateStorageKey(userSub?: string | null): string {
  return `${DASHBOARD_VIEW_STATE_KEY}:${userSub ?? "guest"}`;
}

function readPersistedViewState(userSub?: string | null): PersistedViewState | null {
  try {
    const raw =
      sessionStorage.getItem(viewStateStorageKey(userSub)) ??
      (userSub ? null : sessionStorage.getItem(DASHBOARD_VIEW_STATE_KEY));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedViewState>;
    const mainView =
      parsed.mainView === "expenses" ||
      parsed.mainView === "students" ||
      parsed.mainView === "staff" ||
      parsed.mainView === "finance" ||
      parsed.mainView === "classes" ||
      parsed.mainView === "curriculum" ||
      parsed.mainView === "communication" ||
      parsed.mainView === "attendance" ||
      parsed.mainView === "results" ||
      parsed.mainView === "search" ||
      parsed.mainView === "historical"
        ? parsed.mainView
        : "dashboard";
    const studentSection =
      parsed.studentSection === "overview" ||
      parsed.studentSection === "admissions" ||
      parsed.studentSection === "profiles" ||
      parsed.studentSection === "import" ||
      parsed.studentSection === "parents"
        ? parsed.studentSection
        : "all";
    const staffSection =
      parsed.staffSection === "nonTeaching" || parsed.staffSection === "teaching"
        ? parsed.staffSection
        : "teaching";
    const teachingSection =
      parsed.teachingSection === "kindergarten" ||
      parsed.teachingSection === "lower_primary" ||
      parsed.teachingSection === "upper_primary" ||
      parsed.teachingSection === "all"
        ? parsed.teachingSection
        : "all";
    const nonTeachingCategory =
      parsed.nonTeachingCategory === "administration" ||
      parsed.nonTeachingCategory === "finance" ||
      parsed.nonTeachingCategory === "library" ||
      parsed.nonTeachingCategory === "health" ||
      parsed.nonTeachingCategory === "operations" ||
      parsed.nonTeachingCategory === "all"
        ? parsed.nonTeachingCategory
        : "all";
    const financeSection =
      parsed.financeSection === "daily_report" ||
      parsed.financeSection === "debtors_report" ||
      parsed.financeSection === "assign_fees" ||
      parsed.financeSection === "record_payment" ||
      parsed.financeSection === "receipts" ||
      parsed.financeSection === "expenses" ||
      parsed.financeSection === "bursary" ||
      parsed.financeSection === "bursary_assignment" ||
      parsed.financeSection === "staff_payment" ||
      parsed.financeSection === "finance_summary" ||
      parsed.financeSection === "overview"
        ? parsed.financeSection
        : parsed.financeSection === "busery"
          ? "bursary"
          : parsed.financeSection === "bursery"
            ? "expenses"
            : "overview";
    const classesSection: ClassesSection =
      parsed.classesSection === "all_classes" ||
      parsed.classesSection === "sections_streams" ||
      parsed.classesSection === "class_students" ||
      parsed.classesSection === "class_students_roster" ||
      parsed.classesSection === "class_teachers" ||
      parsed.classesSection === "class_categories" ||
      parsed.classesSection === "class_reports"
        ? parsed.classesSection
        : "all_classes";
    const classesRosterClassId =
      typeof parsed.classesRosterClassId === "number" &&
      Number.isFinite(parsed.classesRosterClassId) &&
      parsed.classesRosterClassId > 0
        ? parsed.classesRosterClassId
        : null;
    const curriculumSection: CurriculumSection =
      parsed.curriculumSection === "exams_dashboard" ||
      parsed.curriculumSection === "exam_bot" ||
      parsed.curriculumSection === "exam_mid" ||
      parsed.curriculumSection === "exam_eot" ||
      parsed.curriculumSection === "assessment_tests" ||
      parsed.curriculumSection === "result_entry" ||
      parsed.curriculumSection === "learns_report" ||
      parsed.curriculumSection === "blank_page" ||
      (typeof parsed.curriculumSection === "string" &&
        parsed.curriculumSection.startsWith("exam_type:"))
        ? parsed.curriculumSection
        : "exams_dashboard";
    const inboxScreen: InboxScreen =
      parsed.inboxScreen?.screen === "list" &&
      (parsed.inboxScreen.kind === "notifications" || parsed.inboxScreen.kind === "messages")
        ? { screen: "list", kind: parsed.inboxScreen.kind }
        : parsed.inboxScreen?.screen === "detail" &&
            (parsed.inboxScreen.kind === "notifications" ||
              parsed.inboxScreen.kind === "messages") &&
            Number.isFinite(parsed.inboxScreen.id)
          ? { screen: "detail", kind: parsed.inboxScreen.kind, id: Number(parsed.inboxScreen.id) }
          : { screen: "home" };
    return {
      settingsPanel: typeof parsed.settingsPanel === "string" ? parsed.settingsPanel : null,
      inboxScreen,
      mainView,
      studentSection,
      staffSection,
      teachingSection,
      nonTeachingCategory,
      financeSection,
      classesSection,
      classesRosterClassId,
      curriculumSection,
      attendanceSection: (parsed.attendanceSection === "list" || parsed.attendanceSection === "take" || parsed.attendanceSection === "reports") ? parsed.attendanceSection : "list",
      resultsSection: (parsed.resultsSection === "list" || parsed.resultsSection === "entry" || parsed.resultsSection === "transcript" || parsed.resultsSection === "report_cards") ? parsed.resultsSection : "list",
      selectedClassName:
        typeof parsed.selectedClassName === "string" ? parsed.selectedClassName : null,
    };
  } catch {
    return null;
  }
}

function overviewKindForRole(
  role: string | undefined,
  permissions: string[] | undefined,
): "admin" | "dos" | "accountant" | "teacher" {
  const normalizedRole = (role ?? "").toLowerCase();
  switch (normalizedRole) {
    case "super_admin":
    case "admin":
    case "director":
    case "head_teacher":
    case "head teacher":
    case "deputy_head_teacher":
    case "deputy head teacher":
      return "admin";
    case "accountant":
    case "bursar":
    case "finance":
    case "finance_officer":
    case "accounts":
      return "accountant";
    case "dos":
    case "director_of_studies":
    case "registrar":
    case "curriculum_manager":
    case "asst_dos":
    case "asst. dos":
    case "assistant dos":
      return "dos";
    case "teacher":
    case "class_teacher":
    case "class teacher":
    case "staff":
      return "teacher";
    default:
      break;
  }
  if (permissions?.includes("nav_operations")) {
    return "accountant";
  }
  if (permissions?.includes("nav_curriculum")) {
    return "dos";
  }
  return "teacher";
}

type OverviewKind =
  | "admin"
  | "dos"
  | "accountant"
  | "teacher"
  | "registrar"
  | "staff"
  | "student"
  | "parent";

function resolveOverviewKind(role: string | undefined | null): OverviewKind {
  switch (role) {
    case "admin":
      return "admin";
    case "head_teacher":
      return "dos";
    case "accountant":
      return "accountant";
    case "teacher":
      return "teacher";
    case "registrar":
      return "registrar";
    case "staff":
      return "staff";
    case "student":
      return "student";
    case "parent":
      return "parent";
    default:
      return "teacher";
  }
}

function hasPermission(
  role: string | undefined,
  permissions: string[] | undefined,
  key: string,
): boolean {
  const normalizedRole = (role ?? "").toLowerCase();
  if (normalizedRole === "admin" || normalizedRole === "super_admin") {
    return true;
  }
  return Boolean(permissions?.includes(key));
}

function canAccessMainView(
  role: string | undefined,
  permissions: string[] | undefined,
  view: PersistedViewState["mainView"],
): boolean {
  if (view === "dashboard") return true;
  if (view === "search" || view === "historical") {
    const r = (role ?? "").toLowerCase();
    return r === "admin" || r === "super_admin";
  }
  const broadMapping: Record<Exclude<PersistedViewState["mainView"], "dashboard" | "search" | "historical">, string> = {
    expenses: "nav_operations",
    students: "nav_students",
    staff: "nav_staff",
    finance: "nav_operations",
    classes: "nav_classes",
    curriculum: "nav_curriculum",
    communication: "nav_communication",
    attendance: "attendance_view",
    results: "results_view",
  };
  if (hasPermission(role, permissions, broadMapping[view])) return true;

  // Allow module access when at least one child permission is granted.
  const childByView: Record<Exclude<PersistedViewState["mainView"], "dashboard" | "search" | "historical">, string[]> = {
    expenses: [
      "finance_reports",
      "finance_assign_fees",
      "finance_record_payments",
      "finance_bursary",
      "finance_staff_pay",
      "finance_summaries",
    ],
    finance: [
      "finance_reports",
      "finance_assign_fees",
      "finance_record_payments",
      "finance_bursary",
      "finance_staff_pay",
      "finance_summaries",
    ],
    students: ["students_all", "students_admissions", "students_import", "students_parents"],
    staff: ["staff_teaching", "staff_non_teaching"],
    classes: [
      "classes_all",
      "classes_sections_streams",
      "classes_students",
      "classes_teachers",
      "classes_categories",
      "classes_reports",
    ],
    curriculum: [
      "curriculum_exams_dashboard",
      "curriculum_exam_bot",
      "curriculum_exam_mid",
      "curriculum_exam_eot",
      "curriculum_assessment_tests",
      "curriculum_result_entry",
      "curriculum_subjects",
    ],
    communication: ["communication_notice", "communication_notifications", "communication_messages"],
    attendance: ["attendance_view", "attendance_mark"],
    results: ["results_view", "results_entry"],
  };
  return childByView[view].some((key) => hasPermission(role, permissions, key));
}

function canAccessSettingsPanel(
  role: string | undefined,
  permissions: string[] | undefined,
  panel: string | null,
): boolean {
  if (!panel) return true;
  const normalizedRole = (role ?? "").toLowerCase();
  if (panel === "users_roles") {
    return (
      (normalizedRole === "admin" || normalizedRole === "super_admin") &&
      hasPermission(role, permissions, "settings_users_roles")
    );
  }
  if (panel === "general") return hasPermission(role, permissions, "settings_general");
  if (panel === "modes") return hasPermission(role, permissions, "settings_modes");
  if (panel === "fees_structure") return hasPermission(role, permissions, "settings_fees_structure");
  if (panel === "class_structure") return hasPermission(role, permissions, "settings_general");
  if (panel === "academic_settings") return hasPermission(role, permissions, "settings_general");
  if (panel === "backup") return hasPermission(role, permissions, "settings_backup");
  if (panel === "restore") return hasPermission(role, permissions, "settings_restore");
  if (panel) {
    return hasPermission(role, permissions, "nav_settings");
  }
  return true;
}

function requiredPermissionForStudentSection(section: StudentNavSection): string | null {
  if (section === "admissions") return "students_admissions";
  if (section === "import") return "students_import";
  if (section === "parents") return "students_parents";
  if (section === "all" || section === "profiles" || section === "overview") return "students_all";
  return null;
}

function canAccessStudentSection(
  role: string | undefined,
  permissions: string[] | undefined,
  section: StudentNavSection,
): boolean {
  const required = requiredPermissionForStudentSection(section);
  if (!required) return true;
  return hasPermission(role, permissions, required);
}

function requiredPermissionForStaffSection(section: StaffNavSection): string | null {
  if (section === "teaching") return "staff_teaching";
  if (section === "nonTeaching") return "staff_non_teaching";
  return null;
}

function canAccessStaffSection(
  role: string | undefined,
  permissions: string[] | undefined,
  section: StaffNavSection,
): boolean {
  const required = requiredPermissionForStaffSection(section);
  if (!required) return true;
  return hasPermission(role, permissions, required);
}

function requiredPermissionForClassSection(section: ClassesSection): string | null {
  if (section === "all_classes") return "classes_all";
  if (section === "sections_streams") return "classes_sections_streams";
  if (section === "class_students") return "classes_students";
  if (section === "class_students_roster") return "classes_students";
  if (section === "class_teachers") return "classes_teachers";
  if (section === "class_categories") return "classes_categories";
  if (section === "class_reports") return "classes_reports";
  return null;
}

function canAccessClassSection(
  role: string | undefined,
  permissions: string[] | undefined,
  section: ClassesSection,
): boolean {
  const required = requiredPermissionForClassSection(section);
  if (!required) return true;
  return hasPermission(role, permissions, required);
}

function requiredPermissionForCurriculumSection(section: CurriculumSection): string | null {
  if (section === "exams_dashboard") return "curriculum_exams_dashboard";
  if (section === "exam_bot") return "curriculum_exam_bot";
  if (section === "exam_mid") return "curriculum_exam_mid";
  if (section === "exam_eot") return "curriculum_exam_eot";
  if (section.startsWith("exam_type:")) return "curriculum_exams_dashboard";
  if (section === "assessment_tests") return "curriculum_assessment_tests";
  if (section === "result_entry") return "curriculum_result_entry";
  if (section === "learns_report") return "curriculum_result_entry";
  if (section === "blank_page") return "curriculum_subjects";
  return null;
}

function canAccessCurriculumSection(
  role: string | undefined,
  permissions: string[] | undefined,
  section: CurriculumSection,
): boolean {
  const required = requiredPermissionForCurriculumSection(section);
  if (!required) return true;
  return hasPermission(role, permissions, required);
}

function requiredPermissionForFinanceSection(section: FinanceSection): string | null {
  if (section === "assign_fees") return "finance_assign_fees";
  if (section === "record_payment" || section === "receipts" || section === "expenses") return "finance_record_payments";
  if (section === "bursary" || section === "bursary_assignment") return "finance_bursary";
  if (section === "staff_payment") return "finance_staff_pay";
  if (section === "finance_summary") return "finance_summaries";
  if (section === "daily_report" || section === "debtors_report") return "finance_reports";
  return null;
}

function canAccessFinanceSection(
  role: string | undefined,
  permissions: string[] | undefined,
  section: FinanceSection,
): boolean {
  const required = requiredPermissionForFinanceSection(section);
  if (!required) return true;
  return hasPermission(role, permissions, required);
}

function isAccountantRole(role: string | undefined): boolean {
  const normalizedRole = (role ?? "").toLowerCase();
  return (
    normalizedRole === "accountant" ||
    normalizedRole === "bursar" ||
    normalizedRole === "finance" ||
    normalizedRole === "finance_officer" ||
    normalizedRole === "accounts"
  );
}

function mapToHeaderItems(rows: { id: number; title: string; body: string; read: boolean; createdAt: string }[]): InboxItem[] {
  return rows.map((x) => ({
    id: String(x.id),
    title: x.title,
    body: x.body,
    read: x.read,
    time: formatShortAgo(x.createdAt),
  }));
}

export function Dashboard({
  user,
  profileLoading,
  profileError,
  onRetryProfile,
  onLogout,
  onAccountUpdated,
}: DashboardProps) {
  const initialView = readPersistedViewState(user?.sub);
  const [settingsPanel, setSettingsPanel] = useState<string | null>(
    initialView?.settingsPanel ?? null,
  );
  const [inboxScreen, setInboxScreen] = useState<InboxScreen>(
    initialView?.inboxScreen ?? { screen: "home" },
  );
  const [headerNotifications, setHeaderNotifications] = useState<InboxItem[]>([]);
  const [headerMessages, setHeaderMessages] = useState<InboxItem[]>([]);
  const [dash, setDash] = useState<DashboardPayload | null>(null);
  const [dashLoading, setDashLoading] = useState(false);
  const [dashError, setDashError] = useState<string | null>(null);
  const [mainView, setMainView] = useState<
    | "dashboard"
    | "expenses"
    | "students"
    | "staff"
    | "finance"
    | "classes"
    | "curriculum"
    | "communication"
    | "attendance"
    | "results"
    | "search"
    | "historical"
  >(
    initialView?.mainView ?? "dashboard",
  );
  const [studentSection, setStudentSection] = useState<StudentNavSection>(
    initialView?.studentSection ?? "all",
  );
  const [staffSection, setStaffSection] = useState<StaffNavSection>(
    initialView?.staffSection ?? "teaching",
  );
  const [teachingSection, setTeachingSection] = useState<TeachingSection>(
    initialView?.teachingSection ?? "all",
  );
  const [nonTeachingCategory, setNonTeachingCategory] = useState<NonTeachingCategory>(
    initialView?.nonTeachingCategory ?? "all",
  );
  const [financeSection, setFinanceSection] = useState<FinanceSection>(
    initialView?.financeSection ?? "overview",
  );
  const [classesSection, setClassesSection] = useState<ClassesSection>(
    initialView?.classesSection ?? "all_classes",
  );
  const [classesRosterClassId, setClassesRosterClassId] = useState<number | null>(
    initialView?.classesRosterClassId ?? null,
  );
  const [curriculumSection, setCurriculumSection] = useState<CurriculumSection>(
    initialView?.curriculumSection ?? "exams_dashboard",
  );
  const [attendanceSection, setAttendanceSection] = useState<"list" | "take" | "reports">(
    initialView?.attendanceSection ?? "list",
  );
  const [resultsSection, setResultsSection] = useState<"list" | "entry" | "transcript" | "report_cards">(
    initialView?.resultsSection ?? "list",
  );
  const [selectedClassName] = useState<string | null>(
    initialView?.selectedClassName ?? null,
  );
  const overviewKind = useMemo(() => resolveOverviewKind(user?.role), [user?.role]);

  const termCtx = useTermContext();
  const dashboardCalendarMonth = useMemo(() => {
    const y = Number(termCtx.viewingAcademicYear);
    if (!Number.isFinite(y)) return "2026-04";
    const now = new Date();
    if (y === now.getFullYear()) {
      return `${y}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    }
    return `${y}-04`;
  }, [termCtx.viewingAcademicYear]);

  const refreshHeaderInbox = useCallback(async () => {
    try {
      const [n, m] = await Promise.all([
        fetchNotifications({ unreadOnly: true }),
        fetchMessages({ unreadOnly: true }),
      ]);
      setHeaderNotifications(mapToHeaderItems(n));
      setHeaderMessages(mapToHeaderItems(m));
    } catch {
      setHeaderNotifications([]);
      setHeaderMessages([]);
    }
  }, []);

  useEffect(() => {
    void refreshHeaderInbox();
  }, [refreshHeaderInbox]);

  useEffect(() => {
    if (termCtx.status !== "ready") return;
    if (settingsPanel === "modes") return;
    if (inboxScreen.screen !== "home") return;
    let cancelled = false;
    setDashLoading(true);
    setDashError(null);
    void fetchDashboard({
      calendarMonth: dashboardCalendarMonth,
      term: termCtx.viewingTerm,
      academicYear: termCtx.viewingAcademicYear,
    })
      .then((data) => {
        if (!cancelled) setDash(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setDashError(err instanceof Error ? err.message : "Failed to load dashboard");
        }
      })
      .finally(() => {
        if (!cancelled) setDashLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    inboxScreen.screen,
    settingsPanel,
    termCtx.status,
    termCtx.viewingTerm,
    termCtx.viewingAcademicYear,
    dashboardCalendarMonth,
  ]);

  useEffect(() => {
    if (!user?.sub) return;
    const restored = readPersistedViewState(user.sub);
    if (!restored) return;
    setSettingsPanel(restored.settingsPanel);
    setInboxScreen(restored.inboxScreen);
    setMainView(restored.mainView);
    setStudentSection(restored.studentSection);
    setStaffSection(restored.staffSection);
    setTeachingSection(restored.teachingSection);
    setNonTeachingCategory(restored.nonTeachingCategory);
    setFinanceSection(restored.financeSection);
    setClassesSection(restored.classesSection);
    setClassesRosterClassId(restored.classesRosterClassId);
    setCurriculumSection(restored.curriculumSection);
  }, [user?.sub]);

  useEffect(() => {
    const onOpenSubjectsSchedule = () => {
      const role = user?.role;
      const permissions = user?.permissions;
      if (!canAccessCurriculumSection(role, permissions, "blank_page")) return;
      setSettingsPanel(null);
      setInboxScreen({ screen: "home" });
      setMainView("curriculum");
      setCurriculumSection("blank_page");
    };
    window.addEventListener(CURRICULUM_OPEN_SUBJECTS_SCHEDULE_EVENT, onOpenSubjectsSchedule);
    return () => window.removeEventListener(CURRICULUM_OPEN_SUBJECTS_SCHEDULE_EVENT, onOpenSubjectsSchedule);
  }, [user?.role, user?.permissions]);

  useEffect(() => {
    const role = user?.role;
    const permissions = user?.permissions;
    if (settingsPanel && !canAccessSettingsPanel(role, permissions, settingsPanel)) {
      setSettingsPanel(null);
    }
    if (!canAccessMainView(role, permissions, mainView)) {
      setMainView("dashboard");
      setInboxScreen({ screen: "home" });
    }
    if (mainView === "finance" && !canAccessFinanceSection(role, permissions, financeSection)) {
      if (canAccessFinanceSection(role, permissions, "overview")) {
        setFinanceSection("overview");
      } else {
        setMainView("dashboard");
      }
      setInboxScreen({ screen: "home" });
    }
    if (mainView === "students" && !canAccessStudentSection(role, permissions, studentSection)) {
      setStudentSection("all");
      setInboxScreen({ screen: "home" });
    }
    if (mainView === "staff" && !canAccessStaffSection(role, permissions, staffSection)) {
      setStaffSection("teaching");
      setInboxScreen({ screen: "home" });
    }
    if (mainView === "classes" && !canAccessClassSection(role, permissions, classesSection)) {
      setClassesSection("all_classes");
      setInboxScreen({ screen: "home" });
    }
    if (mainView === "curriculum" && !canAccessCurriculumSection(role, permissions, curriculumSection)) {
      setCurriculumSection("exams_dashboard");
      setInboxScreen({ screen: "home" });
    }
    if (mainView === "communication" && !hasPermission(role, permissions, "communication_notice")) {
      setMainView("dashboard");
      setInboxScreen({ screen: "home" });
    }
  }, [
    user?.role,
    user?.permissions,
    settingsPanel,
    mainView,
    financeSection,
    studentSection,
    staffSection,
    classesSection,
    curriculumSection,
  ]);

  useEffect(() => {
    if (!isAccountantRole(user?.role)) return;
    if (!canAccessMainView(user?.role, user?.permissions, "finance")) return;
    if (mainView === "dashboard") {
      setMainView("finance");
      setFinanceSection("overview");
    }
  }, [user?.role, user?.permissions, mainView]);

  useEffect(() => {
    try {
      const value: PersistedViewState = {
        settingsPanel,
        inboxScreen,
        mainView,
        studentSection,
        staffSection,
        teachingSection,
        nonTeachingCategory,
        financeSection,
        classesSection,
        classesRosterClassId,
        curriculumSection,
        attendanceSection,
        resultsSection,
        selectedClassName,
      };
      sessionStorage.setItem(viewStateStorageKey(user?.sub), JSON.stringify(value));
    } catch {
      // Ignore storage failures (e.g. privacy mode/storage disabled).
    }
  }, [
    settingsPanel,
    inboxScreen,
    mainView,
    studentSection,
    staffSection,
    teachingSection,
    nonTeachingCategory,
    financeSection,
    classesSection,
    classesRosterClassId,
    curriculumSection,
    attendanceSection,
    resultsSection,
    selectedClassName,
    user?.sub,
  ]);
  return (
    <AdminLayout
      user={user}
      profileLoading={profileLoading}
      onLogout={onLogout}
      headerNotifications={headerNotifications}
      headerMessages={headerMessages}
      onMarkAllNotificationsRead={async () => {
        await markAllNotificationsRead();
        await refreshHeaderInbox();
      }}
      onMarkAllMessagesRead={async () => {
        await markAllMessagesRead();
        await refreshHeaderInbox();
      }}
      onOpenNotificationFromHeader={(id) => {
        setSettingsPanel(null);
        setInboxScreen({
          screen: "detail",
          kind: "notifications",
          id: Number.parseInt(id, 10),
        });
      }}
      onOpenMessageFromHeader={(id) => {
        setSettingsPanel(null);
        setInboxScreen({
          screen: "detail",
          kind: "messages",
          id: Number.parseInt(id, 10),
        });
      }}
      onReadMoreNotifications={() => {
        setSettingsPanel(null);
        setInboxScreen({ screen: "list", kind: "notifications" });
      }}
      onReadMoreMessages={() => {
        setSettingsPanel(null);
        setInboxScreen({ screen: "list", kind: "messages" });
      }}
      onOpenInboxList={(kind) => {
        setSettingsPanel(null);
        setInboxScreen({ screen: "list", kind });
      }}
      onDashboardHome={() => {
        if (isAccountantRole(user?.role) && canAccessMainView(user?.role, user?.permissions, "finance")) {
          setMainView("finance");
          setFinanceSection("overview");
        } else {
          setMainView("dashboard");
        }
        setSettingsPanel(null);
        setInboxScreen({ screen: "home" });
      }}
      onSelectSettingsPanel={(panel) => {
        if (!canAccessSettingsPanel(user?.role, user?.permissions, panel)) return;
        setInboxScreen({ screen: "home" });
        setSettingsPanel(panel);
      }}
      onSelectStudentSection={(section) => {
        if (!canAccessMainView(user?.role, user?.permissions, "students")) return;
        if (!canAccessStudentSection(user?.role, user?.permissions, section)) return;
        setSettingsPanel(null);
        setInboxScreen({ screen: "home" });
        setMainView("students");
        setStudentSection(section);
      }}
      onSelectStaffSection={(section) => {
        if (!canAccessMainView(user?.role, user?.permissions, "staff")) return;
        if (!canAccessStaffSection(user?.role, user?.permissions, section)) return;
        setSettingsPanel(null);
        setInboxScreen({ screen: "home" });
        setMainView("staff");
        setStaffSection(section);
      }}
      onSelectClassSection={(section) => {
        if (!canAccessMainView(user?.role, user?.permissions, "classes")) return;
        if (!canAccessClassSection(user?.role, user?.permissions, section)) return;
        setSettingsPanel(null);
        setInboxScreen({ screen: "home" });
        setMainView("classes");
        setClassesSection(section);
        if (section !== "class_students_roster") {
          setClassesRosterClassId(null);
        }
      }}
      onSelectFinanceSection={(section) => {
        if (!canAccessMainView(user?.role, user?.permissions, "finance")) return;
        if (!canAccessFinanceSection(user?.role, user?.permissions, section)) return;
        setSettingsPanel(null);
        setInboxScreen({ screen: "home" });
        setMainView("finance");
        setFinanceSection(section);
      }}
      onSelectCurriculumSection={(section) => {
        if (!canAccessMainView(user?.role, user?.permissions, "curriculum")) return;
        if (!canAccessCurriculumSection(user?.role, user?.permissions, section)) return;
        setSettingsPanel(null);
        setInboxScreen({ screen: "home" });
        setMainView("curriculum");
        setCurriculumSection(section);
      }}
      onSelectCommunicationSection={() => {
        if (!canAccessMainView(user?.role, user?.permissions, "communication")) return;
        if (!hasPermission(user?.role, user?.permissions, "communication_notice")) return;
        setSettingsPanel(null);
        setInboxScreen({ screen: "home" });
        setMainView("communication");
      }}
      onSelectAttendanceSection={(section) => {
        setSettingsPanel(null);
        setInboxScreen({ screen: "home" });
        setMainView("attendance");
        setAttendanceSection(section);
      }}
      onSelectResultsSection={(section) => {
        setSettingsPanel(null);
        setInboxScreen({ screen: "home" });
        setMainView("results");
        setResultsSection(section);
      }}
      onAccountUpdated={onAccountUpdated}
    >
      <main className="dashboard-main-padding">
        <ViewingContextBanner />
        {settingsPanel === "general" ? <SettingsGeneralPanel /> : null}
        {settingsPanel === "modes" ? <SettingsModesPanel /> : null}
        {settingsPanel === "fees_structure" ? <SettingsFeesStructurePanel /> : null}
        {settingsPanel === "class_structure" ? <SettingsClassStructurePanel /> : null}
        {settingsPanel === "academic_settings" ? <SettingsAcademicPanel /> : null}
        {settingsPanel === "users_roles" ? <SettingsUsersRolesPanel /> : null}
        {settingsPanel === "notifications" ? <SettingsNotificationsPanel /> : null}
        {settingsPanel === "audit_log" ? <SettingsAuditLogPanel /> : null}
        {settingsPanel === "general" ||
        settingsPanel === "modes" ||
        settingsPanel === "fees_structure" ||
        settingsPanel === "class_structure" ||
        settingsPanel === "academic_settings" ||
        settingsPanel === "notifications" ||
        settingsPanel === "audit_log" ||
        settingsPanel === "users_roles" ? null : inboxScreen.screen !== "home" ? (
          inboxScreen.screen === "list" ? (
            <InboxListView
              kind={inboxScreen.kind}
              onBack={() => setInboxScreen({ screen: "home" })}
              onSelectItem={(id) =>
                setInboxScreen({
                  screen: "detail",
                  kind: inboxScreen.kind,
                  id,
                })
              }
              onInboxChanged={refreshHeaderInbox}
            />
          ) : (
            <InboxDetailView
              kind={inboxScreen.kind}
              id={inboxScreen.id}
              onBack={() =>
                setInboxScreen({
                  screen: "list",
                  kind: inboxScreen.kind,
                })
              }
              onInboxChanged={refreshHeaderInbox}
            />
          )
        ) : mainView === "search" ? (
          <RecordsSearchPage />
        ) : mainView === "historical" ? (
          <HistoricalRecordsPage />
        ) : mainView === "expenses" ? (
          <ExpensesAllPage />
        ) : mainView === "students" ? (
          <StudentsSectionPage
            section={studentSection}
            classNameFilter={selectedClassName}
            onChangeSection={setStudentSection}
            permissions={
              overviewKind === "admin" ? undefined : user?.permissions
            }
          />
        ) : mainView === "staff" ? (
          <StaffSectionPage
            section={staffSection}
            teachingSection={teachingSection}
            nonTeachingCategory={nonTeachingCategory}
            onChangeTeachingSection={setTeachingSection}
            onChangeNonTeachingCategory={setNonTeachingCategory}
          />
        ) : mainView === "finance" ? (
          <FinanceSectionPage
            section={financeSection}
            onChangeSection={setFinanceSection}
            user={user}
          />
        ) : mainView === "classes" ? (
          <ClassesSectionPage
            section={classesSection}
            rosterClassId={classesRosterClassId}
            onOpenClassRoster={(classId) => {
              setClassesSection("class_students_roster");
              setClassesRosterClassId(classId);
            }}
            onCloseClassRoster={() => {
              setClassesSection("class_students");
              setClassesRosterClassId(null);
            }}
          />
        ) : mainView === "curriculum" ? (
          <CurriculumSectionPage section={curriculumSection} />
        ) : mainView === "communication" ? (
          <NoticeBoardPage user={user} />
        ) : mainView === "attendance" ? (
          <AttendanceSectionPage mode={attendanceSection === "take" ? "take" : "list"} />
        ) : mainView === "results" ? (
          <ResultsSectionPage
            viewMode={
              resultsSection === "entry"
                ? "entry"
                : resultsSection === "transcript"
                  ? "transcript"
                  : "list"
            }
            userRole={user?.role ?? null}
            userPermissions={user?.permissions ?? []}
          />
        ) : (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            {profileError || dashError ? (
              <div className="neo-card mb-6 px-4 py-3 text-sm text-[#2d3436]" role="alert">
                <p className="mb-2">{profileError || dashError}</p>
                {profileError && onRetryProfile ? (
                  <button
                    type="button"
                    className="rounded-md border border-[#dfe6e9] bg-white px-3 py-1.5 text-xs font-medium text-[#2d3436] hover:bg-[#f8f9fa]"
                    onClick={() => void onRetryProfile()}
                    title="Retry loading the user profile"
                  >
                    Retry
                  </button>
                ) : null}
              </div>
            ) : null}
            {overviewKind === "admin" ? (
              <AdminOverview
                dash={dash}
                loading={dashLoading}
                onOpenRecordsSearch={
                  canAccessMainView(user?.role, user?.permissions, "search")
                    ? () => {
                        setSettingsPanel(null);
                        setInboxScreen({ screen: "home" });
                        setMainView("search");
                      }
                    : undefined
                }
                onOpenHistoricalRecords={
                  canAccessMainView(user?.role, user?.permissions, "historical")
                    ? () => {
                        setSettingsPanel(null);
                        setInboxScreen({ screen: "home" });
                        setMainView("historical");
                      }
                    : undefined
                }
              />
            ) : overviewKind === "dos" ? (
              <DOSOverview dash={dash} loading={dashLoading} />
            ) : overviewKind === "accountant" ? (
              <AccountantOverview dash={dash} loading={dashLoading} />
            ) : overviewKind === "teacher" ? (
              <TeacherOverview dash={dash} loading={dashLoading} />
            ) : overviewKind === "registrar" ? (
              <RegistrarOverview dash={dash} loading={dashLoading} />
            ) : overviewKind === "staff" ? (
              <StaffOverview dash={dash} loading={dashLoading} />
            ) : overviewKind === "student" ? (
              <StudentOverview dash={dash} loading={dashLoading} />
            ) : overviewKind === "parent" ? (
              <ParentOverview dash={dash} loading={dashLoading} />
            ) : (
              <TeacherOverview dash={dash} loading={dashLoading} />
            )}
          </div>
        )}
      </main>
    </AdminLayout>
  );
}
