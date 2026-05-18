import { useCallback, useEffect, useState } from "react";
import {
  markAllMessagesRead,
  markAllNotificationsRead,
  fetchMessages,
  fetchNotifications,
} from "./api/inbox";
import {
  fetchDashboard,
  type DashboardPayload,
} from "./api/dashboard";
import { AdminLayout, type AdminUser } from "./components/admin/AdminLayout";
import { InboxDetailView } from "./components/inbox/InboxDetailView";
import { InboxListView } from "./components/inbox/InboxListView";
import type { InboxItem } from "./components/admin/headerInboxDemo";
import { SettingsModesPanel } from "./components/settings/SettingsModesPanel";
import { SettingsGeneralPanel } from "./components/settings/SettingsGeneralPanel";
import { SettingsFeesStructurePanel } from "./components/settings/SettingsFeesStructurePanel";
import { SettingsClassStructurePanel } from "./components/settings/SettingsClassStructurePanel";
import { SettingsUsersRolesPanel } from "./components/settings/SettingsUsersRolesPanel";
import { ExpensesAllPage } from "./components/expenses/ExpensesAllPage";
import {
  FinanceSectionPage,
  type FinanceSection,
} from "./components/finance/FinanceSectionPage";
import {
  StudentsSectionPage,
  type StudentNavSection,
} from "./components/students/StudentsSectionPage";
import {
  StaffSectionPage,
  type StaffNavSection,
  type TeachingSection,
  type NonTeachingCategory,
} from "./components/staff/StaffSectionPage";
import {
  ClassesSectionPage,
  type ClassesSection,
} from "./components/classes/ClassesSectionPage";
import {
  CurriculumSectionPage,
  type CurriculumSection,
} from "./components/curriculum/CurriculumSectionPage";
import { NoticeBoardPage } from "./components/communication/NoticeBoardPage";
import { AttendanceSectionPage } from "./components/attendance/AttendanceSectionPage";
import { ResultsSectionPage } from "./components/results/ResultsSectionPage";
import { formatShortAgo } from "./utils/formatShortAgo";
import { TeacherOverview } from "./dashboards/TeacherOverview";
import { DOSOverview } from "./dashboards/DOSOverview";
import { AccountantOverview } from "./dashboards/AccountantOverview";
import { AdminOverview } from "./dashboards/AdminOverview";

type DashboardProps = {
  user: AdminUser | null;
  profileLoading: boolean;
  profileError: string | null;
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
    | "search";
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

function readPersistedViewState(): PersistedViewState | null {
  try {
    const raw = sessionStorage.getItem(DASHBOARD_VIEW_STATE_KEY);
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
      parsed.mainView === "search"
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
      parsed.curriculumSection === "blank_page" ||
      (typeof parsed.curriculumSection === "string" &&
        parsed.curriculumSection.startsWith("exam_type:"))
        ? parsed.curriculumSection
        : "exams_dashboard";

    const attendanceSection =
      parsed.attendanceSection === "take" ||
      parsed.attendanceSection === "reports" ||
      parsed.attendanceSection === "list"
        ? parsed.attendanceSection
        : "list";

    const resultsSection =
      parsed.resultsSection === "entry" ||
      parsed.resultsSection === "transcript" ||
      parsed.resultsSection === "report_cards" ||
      parsed.resultsSection === "list"
        ? parsed.resultsSection
        : "list";
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
      attendanceSection,
      resultsSection,
      selectedClassName:
        typeof parsed.selectedClassName === "string" ? parsed.selectedClassName : null,
    };
  } catch {
    return null;
  }
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

function overviewKindForRole(
  role: string | undefined,
  permissions: string[] | undefined,
): "admin" | "dos" | "accountant" | "head_teacher" {
  const normalizedRole = (role ?? "").toLowerCase();
  switch (normalizedRole) {
    case "super_admin":
    case "admin":
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
      return "dos";
    case "head_teacher":
    case "teacher":
    case "staff":
    case "student":
    case "parent":
      return "head_teacher";
    default:
      break;
  }
  if (permissions?.includes("nav_operations")) {
    return "accountant";
  }
  if (permissions?.includes("nav_curriculum")) {
    return "dos";
  }
  return "head_teacher";
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

function hasPermission(
  role: string | undefined,
  permissions: string[] | undefined,
  key: string,
): boolean {
  const normalizedRole = (role ?? "").toLowerCase();
  if (normalizedRole === "admin" || normalizedRole === "super_admin") return true;
  return Boolean(permissions?.includes(key));
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

function requiredPermissionForStudentSection(section: StudentNavSection): string | null {
  if (section === "admissions") return "students_admissions";
  if (section === "import") return "students_import";
  if (section === "parents") return "students_parents";
  if (section === "all" || section === "profiles" || section === "overview") return "students_all";
  return null;
}

function requiredPermissionForStaffSection(section: StaffNavSection): string | null {
  if (section === "teaching") return "staff_teaching";
  if (section === "nonTeaching") return "staff_non_teaching";
  return null;
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

function requiredPermissionForCurriculumSection(section: CurriculumSection): string | null {
  if (section === "exams_dashboard") return "curriculum_exams_dashboard";
  if (section === "exam_bot") return "curriculum_exam_bot";
  if (section === "exam_mid") return "curriculum_exam_mid";
  if (section === "exam_eot") return "curriculum_exam_eot";
  if (section.startsWith("exam_type:")) return "curriculum_exams_dashboard";
  if (section === "assessment_tests") return "curriculum_assessment_tests";
  if (section === "result_entry") return "curriculum_result_entry";
  if (section === "blank_page") return "curriculum_subjects";
  return null;
}

function requiredPermissionForSettingsPanel(panel: string | null): string | null {
  if (!panel) return null;
  if (panel === "modes") return "settings_modes";
  if (panel === "fees_structure") return "settings_fees_structure";
  if (panel === "class_structure") return "settings_general";
  if (panel === "general") return "settings_general";
  if (panel === "users_roles") return "settings_users_roles";
  if (panel === "backup") return "settings_backup";
  if (panel === "restore") return "settings_restore";
  return null;
}

export function Dashboard({
  user,
  profileLoading,
  profileError,
  onLogout,
  onAccountUpdated,
}: DashboardProps) {
  const initialView = readPersistedViewState();
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
  const [attendanceSection] = useState<"list" | "take" | "reports">(
    initialView?.attendanceSection ?? "list",
  );
  const [resultsSection] = useState<"list" | "entry" | "transcript" | "report_cards">(
    initialView?.resultsSection ?? "list",
  );
  const [selectedClassName] = useState<string | null>(
    initialView?.selectedClassName ?? null,
  );
  const overviewKind = overviewKindForRole(user?.role, user?.permissions);

  useEffect(() => {
    if (!isAccountantRole(user?.role)) return;
    if (mainView === "dashboard") {
      setMainView("finance");
      setFinanceSection("overview");
    }
  }, [user?.role, mainView]);

  useEffect(() => {
    if (mainView !== "finance") return;
    if (canAccessFinanceSection(user?.role, user?.permissions, financeSection)) return;
    setFinanceSection("overview");
  }, [mainView, user?.role, user?.permissions, financeSection]);

  useEffect(() => {
    if (mainView === "students") {
      const req = requiredPermissionForStudentSection(studentSection);
      if (req && !hasPermission(user?.role, user?.permissions, req)) {
        setStudentSection("all");
      }
    }
    if (mainView === "staff") {
      const req = requiredPermissionForStaffSection(staffSection);
      if (req && !hasPermission(user?.role, user?.permissions, req)) {
        setStaffSection("teaching");
      }
    }
    if (mainView === "classes") {
      const req = requiredPermissionForClassSection(classesSection);
      if (req && !hasPermission(user?.role, user?.permissions, req)) {
        setClassesSection("all_classes");
      }
    }
    if (mainView === "curriculum") {
      const req = requiredPermissionForCurriculumSection(curriculumSection);
      if (req && !hasPermission(user?.role, user?.permissions, req)) {
        setCurriculumSection("exams_dashboard");
      }
    }
  }, [mainView, user?.role, user?.permissions, studentSection, staffSection, classesSection, curriculumSection]);

  useEffect(() => {
    const req = requiredPermissionForSettingsPanel(settingsPanel);
    if (!req) return;
    if (!hasPermission(user?.role, user?.permissions, req)) {
      setSettingsPanel(null);
    }
  }, [settingsPanel, user?.role, user?.permissions]);

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
    if (settingsPanel === "modes") return;
    if (inboxScreen.screen !== "home") return;
    let cancelled = false;
    setDashLoading(true);
    setDashError(null);
    void fetchDashboard({ calendarMonth: "2026-04" })
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
  }, [inboxScreen.screen, settingsPanel]);

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
      sessionStorage.setItem(DASHBOARD_VIEW_STATE_KEY, JSON.stringify(value));
    } catch {
      // Ignore storage failures (e.g. privacy mode/storage disabled).
    }
  }, [settingsPanel, inboxScreen, mainView, studentSection, staffSection, teachingSection, nonTeachingCategory, financeSection, classesSection, classesRosterClassId, curriculumSection, attendanceSection, resultsSection, selectedClassName]);
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
        if (isAccountantRole(user?.role)) {
          setMainView("finance");
          setFinanceSection("overview");
        } else {
          setMainView("dashboard");
        }
        setSettingsPanel(null);
        setInboxScreen({ screen: "home" });
      }}
      onSelectSettingsPanel={(panel) => {
        const req = requiredPermissionForSettingsPanel(panel);
        if (req && !hasPermission(user?.role, user?.permissions, req)) return;
        setInboxScreen({ screen: "home" });
        setSettingsPanel(panel);
      }}
      onSelectStudentSection={(section) => {
        const req = requiredPermissionForStudentSection(section);
        if (req && !hasPermission(user?.role, user?.permissions, req)) return;
        setSettingsPanel(null);
        setInboxScreen({ screen: "home" });
        setMainView("students");
        setStudentSection(section);
      }}
      onSelectStaffSection={(section) => {
        const req = requiredPermissionForStaffSection(section);
        if (req && !hasPermission(user?.role, user?.permissions, req)) return;
        setSettingsPanel(null);
        setInboxScreen({ screen: "home" });
        setMainView("staff");
        setStaffSection(section);
      }}
      onSelectClassSection={(section) => {
        const req = requiredPermissionForClassSection(section);
        if (req && !hasPermission(user?.role, user?.permissions, req)) return;
        setSettingsPanel(null);
        setInboxScreen({ screen: "home" });
        setMainView("classes");
        setClassesSection(section);
        if (section !== "class_students_roster") {
          setClassesRosterClassId(null);
        }
      }}
      onSelectFinanceSection={(section) => {
        if (!canAccessFinanceSection(user?.role, user?.permissions, section)) return;
        setSettingsPanel(null);
        setInboxScreen({ screen: "home" });
        setMainView("finance");
        setFinanceSection(section);
      }}
      onSelectCurriculumSection={(section) => {
        const req = requiredPermissionForCurriculumSection(section);
        if (req && !hasPermission(user?.role, user?.permissions, req)) return;
        setSettingsPanel(null);
        setInboxScreen({ screen: "home" });
        setMainView("curriculum");
        setCurriculumSection(section);
      }}
      onSelectCommunicationSection={() => {
        if (!hasPermission(user?.role, user?.permissions, "communication_notice")) return;
        setSettingsPanel(null);
        setInboxScreen({ screen: "home" });
        setMainView("communication");
      }}
      onAccountUpdated={onAccountUpdated}
    >
      <main className="dashboard-main-padding">
        {settingsPanel === "general" ? <SettingsGeneralPanel /> : null}
        {settingsPanel === "modes" ? <SettingsModesPanel /> : null}
        {settingsPanel === "fees_structure" ? <SettingsFeesStructurePanel /> : null}
        {settingsPanel === "class_structure" ? <SettingsClassStructurePanel /> : null}
        {settingsPanel === "users_roles" ? <SettingsUsersRolesPanel /> : null}
        {settingsPanel === "general" ||
        settingsPanel === "modes" ||
        settingsPanel === "fees_structure" ||
        settingsPanel === "class_structure" ||
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
        ) : mainView === "expenses" ? (
          <ExpensesAllPage />
        ) : mainView === "students" ? (
          <StudentsSectionPage
            section={studentSection}
            classNameFilter={selectedClassName}
            onChangeSection={setStudentSection}
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
                {profileError || dashError}
              </div>
            ) : null}
            {overviewKind === "admin" ? (
              <AdminOverview dash={dash} loading={dashLoading} />
            ) : overviewKind === "dos" ? (
              <DOSOverview dash={dash} loading={dashLoading} />
            ) : overviewKind === "accountant" ? (
              <AccountantOverview dash={dash} loading={dashLoading} />
            ) : (
              <TeacherOverview dash={dash} loading={dashLoading} />
            )}
          </div>
        )}
      </main>
    </AdminLayout>
  );
}
