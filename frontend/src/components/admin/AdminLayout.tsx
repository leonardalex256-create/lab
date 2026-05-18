import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  confirmPasswordChange,
  confirmTwoFactor,
  requestPasswordChangeOtp,
  requestTwoFactorOtp,
} from "../../api/account";
import { fetchExamTypeConfigs, type ExamTypeConfigRow } from "../../api/academics";
import { fetchGeneralSettings } from "../../api/settingsGeneral";
import { useI18n } from "../../i18n/I18nProvider";
import { localeLabels, type Locale } from "../../i18n/messages";
import { useTheme } from "../../theme/ThemeProvider";
import type { InboxItem } from "./headerInboxDemo";
import { HeaderInboxDropdown } from "./HeaderInboxDropdown";
import { TermYearPicker } from "./TermYearPicker";
import type { ClassesSection } from "../classes/ClassesSectionPage";
import type { CurriculumSection } from "../curriculum/CurriculumSectionPage";

export type AdminUser = {
  sub: string;
  name?: string;
  role: string;
  email: string;
  twoFactorEnabled?: boolean;
  permissions?: string[];
};

type AdminLayoutProps = {
  user: AdminUser | null;
  profileLoading: boolean;
  children: ReactNode;
  onLogout: () => void;
  /** Unread-only lists for the header bell and mail (from API). */
  headerNotifications: InboxItem[];
  headerMessages: InboxItem[];
  onMarkAllNotificationsRead: () => void | Promise<void>;
  onMarkAllMessagesRead: () => void | Promise<void>;
  onOpenNotificationFromHeader: (id: string) => void;
  onOpenMessageFromHeader: (id: string) => void;
  onReadMoreNotifications: () => void;
  onReadMoreMessages: () => void;
  /** Communication sidebar: open full notifications or messages list. */
  onOpenInboxList?: (kind: "notifications" | "messages") => void;
  /** Clears settings sub-views (e.g. modes) when user opens Dashboard from the sidebar. */
  onDashboardHome?: () => void;
  /** Open a settings section from the sidebar (e.g. `modes`). */
  onSelectSettingsPanel?: (panel: string) => void;
  /** Students hub: open full-page list or admissions form. */
  onSelectStudentSection?: (
    section: "overview" | "all" | "admissions" | "profiles" | "import" | "parents",
  ) => void;
  /** Staff hub: open teaching or non-teaching pages. */
  onSelectStaffSection?: (section: "teaching" | "nonTeaching") => void;
  /** Classes hub: open a section tab (all classes, streams, etc.). */
  onSelectClassSection?: (section: ClassesSection) => void;
  /** Finance hub: open finance landing or a specific section page. */
  onSelectFinanceSection?: (
    section:
      | "overview"
      | "daily_report"
      | "debtors_report"
      | "assign_fees"
      | "record_payment"
      | "receipts"
      | "expenses"
      | "bursary"
      | "bursary_assignment"
      | "staff_payment"
      | "finance_summary",
  ) => void;
  /** Curriculum hub: open exam/test stats and result pages. */
  onSelectCurriculumSection?: (section: CurriculumSection) => void;
  /** Communication hub: open the notice board dashboard. */
  onSelectCommunicationSection?: () => void;
  /** Attendance hub: navigate to an attendance sub-page. */
  onSelectAttendanceSection?: (section: "list" | "take" | "reports") => void;
  /** Results hub: navigate to a results sub-page. */
  onSelectResultsSection?: (section: "list" | "entry" | "transcript" | "report_cards") => void;
  /** Refresh `/api/auth/me` after password or 2FA changes. */
  onAccountUpdated?: () => void;
};

function MenuIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="22" height="22" fill="none" viewBox="0 0 24 24" aria-hidden>
      <path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function IconHome({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" fill="none" viewBox="0 0 24 24" aria-hidden>
      <path stroke="currentColor" strokeWidth="1.7" d="M4 10.5L12 4l8 6.5V20a1 1 0 01-1 1h-5v-6H10v6H5a1 1 0 01-1-1v-9.5z" />
    </svg>
  );
}

function IconUsers({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" fill="none" viewBox="0 0 24 24" aria-hidden>
      <path stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" d="M17 20v-1a4 4 0 00-4-4H7a4 4 0 00-4 4v1M13 7a4 4 0 100-8 4 4 0 000 8z" />
    </svg>
  );
}

function IconUser({ className }: { className?: string }) {
  return (
    <svg className={className ?? "h-5 w-5"} fill="none" viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.8" />
      <path
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        d="M6 20v-1.2a4 4 0 014-3.8h4a4 4 0 014 3.8V20"
      />
    </svg>
  );
}

function IconBook({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" fill="none" viewBox="0 0 24 24" aria-hidden>
      <path stroke="currentColor" strokeWidth="1.7" d="M4 6.5A2.5 2.5 0 016.5 4H20v14H6.5A2.5 2.5 0 004 15.5V6.5zM20 18H6.5A2.5 2.5 0 004 20.5" />
    </svg>
  );
}

function IconGrid({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" fill="none" viewBox="0 0 24 24" aria-hidden>
      <path stroke="currentColor" strokeWidth="1.7" d="M4 4h7v7H4V4zm9 0h7v7h-7V4zM4 13h7v7H4v-7zm9 0h7v7h-7v-7z" />
    </svg>
  );
}

function IconBus({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" fill="none" viewBox="0 0 24 24" aria-hidden>
      <path stroke="currentColor" strokeWidth="1.7" d="M4 6h16v10H4V6zm2 14h2v2H6v-2zm10 0h2v2h-2v-2zM6 8h4M14 8h4" />
    </svg>
  );
}

function IconBell({ className }: { className?: string }) {
  return (
    <svg className={className} width="22" height="22" fill="none" viewBox="0 0 24 24" aria-hidden>
      <path stroke="currentColor" strokeWidth="1.7" d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m6 0a3 3 0 11-6 0h6z" />
    </svg>
  );
}

function IconMail({ className }: { className?: string }) {
  return (
    <svg className={className} width="22" height="22" fill="none" viewBox="0 0 24 24" aria-hidden>
      <path stroke="currentColor" strokeWidth="1.7" d="M4 6h16v12H4V6zm0 0l8 6 8-6" />
    </svg>
  );
}

function IconSearch({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" fill="none" viewBox="0 0 24 24" aria-hidden>
      <circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="2" />
      <path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M15 15l6 6" />
    </svg>
  );
}

function IconClipboard({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" fill="none" viewBox="0 0 24 24" aria-hidden>
      <path
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
        d="M9 4h6l1 2h3v14H5V6h3l1-2zm3 8v4m-2-2h4"
      />
    </svg>
  );
}

function IconGradCap({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" fill="none" viewBox="0 0 24 24" aria-hidden>
      <path
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
        d="M4.5 10.5L12 7l7.5 3.5L12 14 4.5 10.5zM9 12.3V16l3 1.5 3-1.5v-3.7"
      />
    </svg>
  );
}

function IconLayers({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" fill="none" viewBox="0 0 24 24" aria-hidden>
      <path
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
        d="M12 3l9 5-9 5-9-5 9-5zm0 9l9 5-9 5-9-5 9-5z"
      />
    </svg>
  );
}

function IconWallet({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" fill="none" viewBox="0 0 24 24" aria-hidden>
      <path
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
        d="M4 7a2 2 0 012-2h11a2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V7zm14 5h3v4h-3a2 2 0 100-4z"
      />
    </svg>
  );
}

function IconBuilding({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" fill="none" viewBox="0 0 24 24" aria-hidden>
      <path
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
        d="M4 21V8l8-4v17M4 13h4M4 17h4M20 21h-8V10h8v11zm-4-7h.01M16 14h.01"
      />
    </svg>
  );
}

function IconPromotion({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" fill="none" viewBox="0 0 24 24" aria-hidden>
      <path
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 20V9m0 0l-4 4m4-4l4 4M6 20h12"
      />
    </svg>
  );
}

function IconFileSpreadsheet({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" fill="none" viewBox="0 0 24 24" aria-hidden>
      <path
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z"
      />
      <path stroke="currentColor" strokeWidth="1.7" d="M14 2v6h6M8 13h8M8 17h8M8 9h2" />
    </svg>
  );
}

function IconSettings({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" fill="none" viewBox="0 0 24 24" aria-hidden>
      <path
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
        d="M12 15a3 3 0 100-6 3 3 0 000 6z"
      />
      <path
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
        d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"
      />
    </svg>
  );
}

function IconChartBars({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" fill="none" viewBox="0 0 24 24" aria-hidden>
      <path stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" d="M5 19V11M12 19V5M19 19v-8" />
    </svg>
  );
}

function IconInsights({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" fill="none" viewBox="0 0 24 24" aria-hidden>
      <path
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 3v2M4.5 7.5l1.4 1.4M3 14h2M4.5 20.5l1.4-1.4M12 21v-2M18.1 19.1l1.4-1.4M21 14h2M18.1 8.9l1.4-1.4M12 8a4 4 0 100 8 4 4 0 000-8z"
      />
    </svg>
  );
}

function IconGlobe({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" fill="none" viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" />
      <path stroke="currentColor" strokeWidth="1.5" d="M3 12h18M12 3a14 14 0 000 18M12 3a14 14 0 010 18" />
    </svg>
  );
}

function IconBackup({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" fill="none" viewBox="0 0 24 24" aria-hidden>
      <ellipse cx="12" cy="17" rx="7" ry="3" stroke="currentColor" strokeWidth="1.7" />
      <path
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5 17V9a7 7 0 0114 0v8M12 4v7m0 0l-2.5-2.5M12 11l2.5-2.5"
      />
    </svg>
  );
}

function IconRestore({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" fill="none" viewBox="0 0 24 24" aria-hidden>
      <ellipse cx="12" cy="17" rx="7" ry="3" stroke="currentColor" strokeWidth="1.7" />
      <path
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19 17V9a7 7 0 00-14 0v8M12 20v-7m0 0l-2.5 2.5M12 13l2.5 2.5"
      />
    </svg>
  );
}

function IconSunMoon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" fill="none" viewBox="0 0 24 24" aria-hidden>
      <path
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 3a6 6 0 109 9 9 9 0 01-9-9zM12 18a6 6 0 01-6-6 6 6 0 016-6"
      />
    </svg>
  );
}

type NavIcon = typeof IconHome;

type NavLeaf = {
  icon?: NavIcon;
  label: string;
  badge?: string;
  settingsPanel?: string;
  inboxList?: "notifications" | "messages";
  studentSection?: "overview" | "all" | "admissions" | "profiles" | "import" | "parents";
  staffSection?: "teaching" | "nonTeaching";
  attendanceSection?: "list" | "take" | "reports";
  resultsSection?: "list" | "entry" | "transcript" | "report_cards";
  financeSection?:
    | "overview"
    | "daily_report"
    | "debtors_report"
    | "assign_fees"
    | "record_payment"
    | "receipts"
    | "expenses"
    | "bursary"
    | "bursary_assignment"
    | "staff_payment"
    | "finance_summary";
  curriculumSection?: CurriculumSection;
  classSection?: ClassesSection;
  communicationSection?: "notice";
  requiredPermission?: string;
};

type NavGroup = { id: string; title: string; icon: NavIcon; items: NavLeaf[] };

function buildNavGroups(
  t: (key: string) => string,
  role: string,
  permissions: string[],
  sectionsStreamsEnabled: boolean,
): NavGroup[] {
  const r = role.toLowerCase();
  const hasPerm = (key?: string) =>
    !key || r === "super_admin" || r === "admin" || permissions.includes(key);
  const allGroups: NavGroup[] = [
    { id: "dashboard", title: t("nav.dashboard"), icon: IconHome, items: [] },
    {
      id: "student_hub",
      title: t("nav.students"),
      icon: IconUsers,
      items: [
        { icon: IconUsers, label: t("nav.students.all"), studentSection: "all", requiredPermission: "students_all" },
        { icon: IconClipboard, label: t("nav.students.admissions"), studentSection: "admissions", requiredPermission: "students_admissions" },
        { icon: IconClipboard, label: t("nav.students.import"), studentSection: "import", requiredPermission: "students_import" },
        { icon: IconUsers, label: t("nav.students.parents"), studentSection: "parents", requiredPermission: "students_parents" },
      ],
    },
    {
      id: "classes",
      title: t("nav.classes"),
      icon: IconGrid,
      items: [
        { icon: IconGrid, label: t("nav.classes.allClasses"), classSection: "all_classes", requiredPermission: "classes_all" },
        ...(sectionsStreamsEnabled
          ? [
              {
                icon: IconLayers,
                label: t("nav.classes.sectionsStreams"),
                classSection: "sections_streams" as const,
                requiredPermission: "classes_sections_streams",
              },
            ]
          : []),
        { icon: IconUsers, label: t("nav.classes.classStudents"), classSection: "class_students", requiredPermission: "classes_students" },
        { icon: IconGradCap, label: t("nav.classes.classTeachers"), classSection: "class_teachers", requiredPermission: "classes_teachers" },
        { icon: IconClipboard, label: t("nav.classes.classCategories"), classSection: "class_categories", requiredPermission: "classes_categories" },
        { icon: IconChartBars, label: t("nav.classes.classReports"), classSection: "class_reports", requiredPermission: "classes_reports" },
      ],
    },
    {
      id: "staff",
      title: t("nav.staff"),
      icon: IconUsers,
      items: [
        { icon: IconGradCap, label: t("nav.staff.teaching"), staffSection: "teaching", requiredPermission: "staff_teaching" },
        { icon: IconBuilding, label: t("nav.staff.nonTeaching"), staffSection: "nonTeaching", requiredPermission: "staff_non_teaching" },
      ],
    },
    {
      id: "curriculum",
      title: t("nav.curriculum"),
      icon: IconBook,
      items: [
        {
          icon: IconChartBars,
          label: t("nav.curriculum.examsDashboard"),
          curriculumSection: "exams_dashboard",
        },
        {
          icon: IconChartBars,
          label: "Exam Scheduling",
          curriculumSection: "exam_schedule",
        },
        {
          icon: IconGradCap,
          label: "Exam Performance",
          // This will be a header for sub-items like BOT, MID, EOT
          curriculumSection: "exam_bot", 
        },
        {
          icon: IconClipboard,
          label: t("nav.curriculum.resultsEntry"),
          curriculumSection: "result_entry",
        },
        {
          icon: IconClipboard,
          label: "Report Remarks",
          curriculumSection: "report_remarks",
        },
        {
          icon: IconSettings,
          label: "Grading Standards",
          curriculumSection: "grading_standards",
        },
        { 
          icon: IconGrid, 
          label: "Subjects & Settings", 
          curriculumSection: "blank_page" 
        },
        {
          icon: IconPromotion,
          label: "Promotion & Graduation",
          curriculumSection: "promotion_engine",
        },
        {
          icon: IconFileSpreadsheet,
          label: "Learner's Reports",
          curriculumSection: "learns_report",
        },
      ],
    },
    {
      id: "operations",
      title: t("nav.operations"),
      icon: IconWallet,
      items: [
        { icon: IconClipboard, label: t("nav.operations.library"), financeSection: "daily_report", requiredPermission: "finance_reports" },
        { icon: IconBook, label: t("nav.operations.store"), financeSection: "debtors_report", requiredPermission: "finance_reports" },
        { icon: IconWallet, label: t("nav.operations.assignFees"), financeSection: "assign_fees", requiredPermission: "finance_assign_fees" },
        { icon: IconWallet, label: t("nav.operations.accounts"), financeSection: "record_payment", requiredPermission: "finance_record_payments" },
        { icon: IconClipboard, label: t("nav.operations.receipts"), financeSection: "receipts", requiredPermission: "finance_record_payments" },
        { icon: IconBus, label: t("nav.operations.transport"), financeSection: "expenses", requiredPermission: "finance_record_payments" },
        { icon: IconUsers, label: t("nav.operations.hostel"), financeSection: "staff_payment", requiredPermission: "finance_staff_pay" },
        { icon: IconClipboard, label: t("nav.operations.busery"), financeSection: "bursary", requiredPermission: "finance_bursary" },
        { icon: IconChartBars, label: t("nav.operations.hostelManager"), financeSection: "finance_summary", requiredPermission: "finance_summaries" },
      ],
    },
    {
      id: "communication",
      title: t("nav.communication"),
      icon: IconMail,
      items: [
        { icon: IconBell, label: t("nav.communication.notice"), communicationSection: "notice", requiredPermission: "communication_notice" },
        {
          icon: IconBell,
          label: t("nav.communication.notificationsList"),
          inboxList: "notifications",
          requiredPermission: "communication_notifications",
        },
        {
          icon: IconMail,
          label: t("nav.communication.messages"),
          inboxList: "messages",
          requiredPermission: "communication_messages",
        },
      ],
    },
    {
      id: "statistics",
      title: t("nav.statistics"),
      icon: IconChartBars,
      items: [],
    },
    {
      id: "insights",
      title: t("nav.insights"),
      icon: IconInsights,
      items: [],
    },
    {
      id: "settings",
      title: t("nav.settings"),
      icon: IconSettings,
      items: [
        { icon: IconSunMoon, label: t("nav.settings.modes"), settingsPanel: "modes", requiredPermission: "settings_modes" },
        {
          icon: IconWallet,
          label: t("nav.settings.feesStructure"),
          settingsPanel: "fees_structure",
          requiredPermission: "settings_fees_structure",
        },
        {
          icon: IconLayers,
          label: t("nav.settings.classStructure"),
          settingsPanel: "class_structure",
          requiredPermission: "settings_general",
        },
        {
          icon: IconGradCap,
          label: t("nav.settings.academicSettings"),
          settingsPanel: "academic_settings",
          requiredPermission: "settings_general",
        },
        { icon: IconGrid, label: t("nav.settings.general"), settingsPanel: "general", requiredPermission: "settings_general" },
        { icon: IconBell, label: "Notifications", settingsPanel: "notifications" },
        { icon: IconClipboard, label: "Audit Log", settingsPanel: "audit_log", requiredPermission: "settings_users_roles" },
        { icon: IconUsers, label: t("nav.settings.users"), settingsPanel: "users_roles", requiredPermission: "settings_users_roles" },
        { icon: IconBackup, label: t("nav.settings.backup"), requiredPermission: "settings_backup" },
        { icon: IconRestore, label: t("nav.settings.restore"), requiredPermission: "settings_restore" },
      ],
    },
    {
      id: "attendance",
      title: "Attendance",
      icon: IconClipboard,
      items: [
        { icon: IconClipboard, label: "Today's Attendance", attendanceSection: "list", requiredPermission: "attendance_view" },
        { icon: IconGrid, label: "Take Attendance", attendanceSection: "take", requiredPermission: "attendance_mark" },
        { icon: IconChartBars, label: "Attendance Reports", attendanceSection: "reports", requiredPermission: "attendance_view" },
      ],
    },
    {
      id: "results",
      title: "Results",
      icon: IconGradCap,
      items: [
        { icon: IconChartBars, label: "View Results", resultsSection: "list", requiredPermission: "results_view" },
        { icon: IconClipboard, label: "Results Entry", resultsSection: "entry", requiredPermission: "results_entry" },
        { icon: IconFileSpreadsheet, label: "Transcript", resultsSection: "transcript", requiredPermission: "results_view" },
        { icon: IconGradCap, label: "Report Cards", resultsSection: "report_cards", requiredPermission: "results_view" },
      ],
    },
  ];

  if (r === "super_admin" || r === "admin") return allGroups;

  const mapping: Record<string, string> = {
    dashboard: "nav_dashboard",
    student_hub: "nav_students",
    classes: "nav_classes",
    staff: "nav_staff",
    curriculum: "nav_curriculum",
    operations: "nav_operations",
    communication: "nav_communication",
    statistics: "view_stats",
    insights: "view_insights",
    settings: "nav_settings",
  };

  return allGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => hasPerm(item.requiredPermission)),
    }))
    .filter((g) => {
      const requiredPerm = mapping[g.id];
      // Show group if:
      // 1) no broad gate is defined, OR
      // 2) user has broad gate, OR
      // 3) user has at least one child permission in that group.
      if (!requiredPerm) return true;
      if (permissions.includes(requiredPerm)) return true;
      return g.items.length > 0;
    });
}

const defaultOpenGroups: Record<string, boolean> = {
  dashboard: false,
  student_hub: false,
  classes: false,
  staff: false,
  curriculum: false,
  operations: false,
  communication: false,
  statistics: false,
  insights: false,
  settings: false,
};

function ChevronDown({ open, className }: { open: boolean; className?: string }) {
  return (
    <svg
      className={`shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""} ${className ?? ""}`}
      width="18"
      height="18"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M6 9l6 6 6-6" />
    </svg>
  );
}

export function AdminLayout({
  user,
  profileLoading,
  children,
  onLogout,
  headerNotifications,
  headerMessages,
  onMarkAllNotificationsRead,
  onMarkAllMessagesRead,
  onOpenNotificationFromHeader,
  onOpenMessageFromHeader,
  onReadMoreNotifications,
  onReadMoreMessages,
  onOpenInboxList,
  onDashboardHome,
  onSelectSettingsPanel,
  onSelectStudentSection,
  onSelectStaffSection,
  onSelectClassSection,
  onSelectFinanceSection,
  onSelectCurriculumSection,
  onSelectCommunicationSection,
  onSelectAttendanceSection,
  onSelectResultsSection,
  onAccountUpdated,
}: AdminLayoutProps) {
  const { t, locale, setLocale } = useI18n();
  const { resolvedTheme, density } = useTheme();
  const [sectionsStreamsEnabled, setSectionsStreamsEnabled] = useState(true);
  const navGroups = useMemo(
    () =>
      buildNavGroups(
        t,
        user?.role ?? "admin",
        user?.permissions ?? [],
        sectionsStreamsEnabled,
      ),
    [t, user?.role, user?.permissions, sectionsStreamsEnabled],
  );

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => ({ ...defaultOpenGroups }));
  const [curriculumExamOpen, setCurriculumExamOpen] = useState(false);
  const [curriculumTestsOpen, setCurriculumTestsOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [userMenuProfile, setUserMenuProfile] = useState(false);
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [notifPanelOpen, setNotifPanelOpen] = useState(false);
  const [msgPanelOpen, setMsgPanelOpen] = useState(false);
  const [curriculumExamTypes, setCurriculumExamTypes] = useState<ExamTypeConfigRow[]>([]);

  const [pwOtpSent, setPwOtpSent] = useState(false);
  const [pwBusy, setPwBusy] = useState(false);
  const [pwErr, setPwErr] = useState<string | null>(null);
  const [pwOk, setPwOk] = useState<string | null>(null);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [newPw2, setNewPw2] = useState("");
  const [pwOtp, setPwOtp] = useState("");

  const [tfPending, setTfPending] = useState<{ enable: boolean } | null>(null);
  const [tfOtp, setTfOtp] = useState("");
  const [tfBusy, setTfBusy] = useState(false);
  const [tfErr, setTfErr] = useState<string | null>(null);

  const userMenuRef = useRef<HTMLDivElement>(null);
  const langMenuRef = useRef<HTMLDivElement>(null);
  const notifWrapRef = useRef<HTMLDivElement>(null);
  const msgWrapRef = useRef<HTMLDivElement>(null);

  const unreadNotifCount = headerNotifications.filter((n) => !n.read).length;
  const unreadMsgCount = headerMessages.filter((m) => !m.read).length;

  const name = useMemo(() => {
    const email = user?.email ?? null;
    if (!email) return t("role.administrator");
    const local = email.split("@")[0] ?? email;
    return local.replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }, [user?.email, t]);

  const profileInitials = useMemo(() => {
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
    }
    const one = parts[0] ?? "?";
    return one.length >= 2 ? one.slice(0, 2).toUpperCase() : one.charAt(0).toUpperCase();
  }, [name]);

  const roleLabel = user?.role
    ? user.role.toLowerCase() === "admin"
      ? t("role.admin")
      : user.role.charAt(0).toUpperCase() + user.role.slice(1)
    : t("role.admin");

  const canAccess = (permissionKey?: string) => {
    if (!permissionKey) return true;
    const role = String(user?.role ?? "").toLowerCase();
    if (role === "admin" || role === "super_admin") return true;
    return Boolean(user?.permissions?.includes(permissionKey));
  };

  useEffect(() => {
    let cancelled = false;
    const applySectionsStreamsSetting = (settings: Record<string, string>) => {
      const enabled = (settings.classes_sections_streams_enabled ?? "yes") === "yes";
      setSectionsStreamsEnabled(enabled);
    };
    const loadSettings = async () => {
      try {
        const settings = await fetchGeneralSettings();
        if (cancelled) return;
        applySectionsStreamsSetting(settings);
      } catch {
        if (!cancelled) setSectionsStreamsEnabled(true);
      }
    };
    void loadSettings();

    const handleGeneralSettingsUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<Record<string, string>>;
      if (customEvent.detail && typeof customEvent.detail === "object") {
        applySectionsStreamsSetting(customEvent.detail);
        return;
      }
      void loadSettings();
    };
    window.addEventListener("settings:general-updated", handleGeneralSettingsUpdated);
    return () => {
      cancelled = true;
      window.removeEventListener("settings:general-updated", handleGeneralSettingsUpdated);
    };
  }, []);

  useEffect(() => {
    async function loadExamTypes() {
      try {
        const rows = await fetchExamTypeConfigs();
        setCurriculumExamTypes(rows.filter((row) => row.isActive));
      } catch {
        setCurriculumExamTypes([]);
      }
    }

    void loadExamTypes();
    function handleExamTypesChanged() {
      void loadExamTypes();
    }
    window.addEventListener("academics:exam-types-changed", handleExamTypesChanged);

    return () => {
      window.removeEventListener("academics:exam-types-changed", handleExamTypesChanged);
    };
  }, []);

  useEffect(() => {
    if (!userMenuOpen) return;
    function handlePointerDown(e: PointerEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
        setUserMenuProfile(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setUserMenuOpen(false);
        setUserMenuProfile(false);
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKey);
    };
  }, [userMenuOpen]);

  useEffect(() => {
    if (!langMenuOpen) return;
    function handlePointerDown(e: PointerEvent) {
      if (langMenuRef.current && !langMenuRef.current.contains(e.target as Node)) {
        setLangMenuOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setLangMenuOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKey);
    };
  }, [langMenuOpen]);

  useEffect(() => {
    if (!userMenuProfile) {
      setPwOtpSent(false);
      setPwBusy(false);
      setPwErr(null);
      setPwOk(null);
      setCurrentPw("");
      setNewPw("");
      setNewPw2("");
      setPwOtp("");
      setTfPending(null);
      setTfOtp("");
      setTfBusy(false);
      setTfErr(null);
    }
  }, [userMenuProfile]);

  useEffect(() => {
    if (!notifPanelOpen && !msgPanelOpen) return;
    function handleMouseDown(e: MouseEvent) {
      const target = e.target as Node;
      if (notifWrapRef.current?.contains(target)) return;
      if (msgWrapRef.current?.contains(target)) return;
      setNotifPanelOpen(false);
      setMsgPanelOpen(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setNotifPanelOpen(false);
        setMsgPanelOpen(false);
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKey);
    };
  }, [notifPanelOpen, msgPanelOpen]);

  function closeUserMenu() {
    setUserMenuOpen(false);
    setUserMenuProfile(false);
  }

  const themeClass = resolvedTheme === "tinted-dark" ? "theme-tinted-dark" : resolvedTheme === "dark" ? "theme-dark" : "";

  return (
    <div
      className={`neo-app-bg flex min-h-screen flex-col text-[#2d3436] lg:flex-row ${themeClass}`}
      data-density={density}
    >
      {sidebarOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-[#2d3436]/25 backdrop-blur-[3px] lg:hidden"
          aria-label={t("layout.closeMenu")}
          onClick={() => setSidebarOpen(false)}
          title="Close sidebar menu"
        />
      ) : null}

      <aside
        className={`neo-sidebar fixed inset-y-0 left-0 z-50 flex h-full min-h-0 w-[14rem] shrink-0 flex-col border-r border-white/40 text-[#2d3436] transition-transform duration-200 sm:w-[15rem] lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="relative flex flex-col items-center justify-center gap-2 border-b border-white/30 px-3 py-4 text-center">
          <button
            type="button"
            className="neo-icon-btn absolute left-2 top-2 rounded-lg p-1.5 text-[#636e72] lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label={t("layout.closeSidebar")}
            title="Close sidebar navigation"
          >
            <MenuIcon />
          </button>
          <div className="neo-logo flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/70 shadow-[inset_1px_1px_3px_rgba(0,0,0,0.08)]">
            <img
              src="/school-badge-v2.png"
              alt="School badge"
              className="h-full w-full object-contain"
            />
          </div>
          <div className="min-w-0">
            <p className="text-center text-[15px] font-bold leading-tight text-[#2f37a4] [font-size:clamp(16px,1.5vw,15px)]">
              Queens School Nursery & Primary School
            </p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto overflow-x-hidden px-1.5 py-2" aria-label={t("layout.mainNav")}>
          <div className="space-y-1">
            {navGroups.map((group) => {
              const open = openGroups[group.id] ?? false;
              const GroupIcon = group.icon;
              const isFlat = group.items.length === 0;

              if (isFlat) {
                return (
                  <div key={group.id} className="rounded-xl">
                    <button
                      type="button"
                      onClick={() => {
                        if (group.id === "dashboard") onDashboardHome?.();
                        setSidebarOpen(false);
                      }}
                      className="group flex w-full items-center gap-1.5 rounded-lg px-1.5 py-1 text-left neo-nav-group-idle rounded-xl"
                      title={group.title}
                    >
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/25 text-[#636e72] transition group-hover:bg-white/45 group-hover:text-[#2d3436]">
                        <GroupIcon className="h-[13px] w-[13px]" />
                      </span>
                      <span className="min-w-0 flex-1 text-xs font-semibold leading-tight text-[#2d3436]">
                        {group.title}
                      </span>
                    </button>
                  </div>
                );
              }

              return (
                <div key={group.id} className="rounded-xl">
                  <button
                    type="button"
                    onClick={() =>
                      setOpenGroups((prev) => {
                        if (group.id === "operations") onSelectFinanceSection?.("overview");
                        if (group.id === "student_hub") onSelectStudentSection?.("overview");
                        if (group.id === "curriculum") {
                          onSelectCurriculumSection?.("exams_dashboard");
                        }
                        if (prev[group.id]) {
                          return { ...prev, [group.id]: false };
                        }
                        const next: Record<string, boolean> = {};
                        for (const g of navGroups) {
                          next[g.id] = false;
                        }
                        next[group.id] = true;
                        return next;
                      })
                    }
                    aria-expanded={open}
                    className={`group flex w-full items-center gap-1.5 rounded-lg px-1.5 py-1 text-left ${
                      open ? "neo-nav-group-active" : "neo-nav-group-idle rounded-xl"
                    }`}
                    title={group.title}
                  >
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition ${
                        open
                          ? "bg-white/40 text-[#4a6b4e]"
                          : "bg-white/25 text-[#636e72] group-hover:bg-white/45 group-hover:text-[#2d3436]"
                      }`}
                    >
                      <GroupIcon className="h-[13px] w-[13px]" />
                    </span>
                    <span className="min-w-0 flex-1 text-xs font-semibold leading-tight">{group.title}</span>
                    <ChevronDown
                      open={open}
                      className={`h-4 w-4 shrink-0 ${open ? "text-[#4a6b4e]" : "text-[#636e72]"}`}
                    />
                  </button>
                  {open ? (
                    group.id === "curriculum" ? (
                      <ul className="neo-nav-sub mb-1 ml-3 mt-1 space-y-0.5 pb-0.5 pl-2.5">
                        {canAccess("curriculum_exams_dashboard") ? (
                        <li>
                          <button
                            type="button"
                            onClick={() => {
                              onSelectCurriculumSection?.("exams_dashboard");
                              setSidebarOpen(false);
                            }}
                            className="neo-nav-item flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-[11px] font-semibold leading-snug text-[#636e72]"
                            title={t("nav.curriculum.examsDashboard")}
                          >
                            <IconChartBars className="h-3.5 w-3.5 shrink-0 text-[#5a8faf] opacity-90" />
                            <span className="min-w-0 flex-1 truncate">
                              {t("nav.curriculum.examsDashboard")}
                            </span>
                          </button>
                        </li>
                        ) : null}
                        {canAccess("curriculum_exams_dashboard") ||
                        canAccess("curriculum_exam_bot") ||
                        canAccess("curriculum_exam_mid") ||
                        canAccess("curriculum_exam_eot") ? (
                        <li>
                          <button
                            type="button"
                            onClick={() => setCurriculumExamOpen((v) => !v)}
                            className="neo-nav-item flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-[11px] font-semibold leading-snug text-[#636e72]"
                            title={t("nav.curriculum.exams")}
                          >
                            <IconGradCap className="h-3.5 w-3.5 shrink-0 text-[#5a8faf] opacity-90" />
                            <span className="min-w-0 flex-1 truncate">{t("nav.curriculum.exams")}</span>
                            <ChevronDown open={curriculumExamOpen} className="h-3.5 w-3.5" />
                          </button>
                        </li>
                        ) : null}
                        {curriculumExamOpen ? (
                          <>
                            {curriculumExamTypes.map((row) => (
                              <li key={row.id}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    onSelectCurriculumSection?.(`exam_type:${row.examKey}`);
                                    setSidebarOpen(false);
                                  }}
                                  className="neo-nav-item ml-5 flex w-full rounded-md px-1.5 py-1 text-left text-[11px] text-[#636e72]"
                                >
                                  {row.displayName || row.examKey}
                                </button>
                              </li>
                            ))}
                            {curriculumExamTypes.length === 0 ? (
                              <li className="ml-5 px-1.5 py-1 text-[10px] text-[#8a9497]">
                                No exam types configured
                              </li>
                            ) : null}
                          </>
                        ) : null}
                        {canAccess("curriculum_assessment_tests") ? (
                        <li>
                          <button
                            type="button"
                            onClick={() => setCurriculumTestsOpen((v) => !v)}
                            className="neo-nav-item flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-[11px] font-semibold leading-snug text-[#636e72]"
                          >
                            <IconClipboard className="h-3.5 w-3.5 shrink-0 text-[#5a8faf] opacity-90" />
                            <span className="min-w-0 flex-1 truncate">{t("nav.curriculum.tests")}</span>
                            <ChevronDown open={curriculumTestsOpen} className="h-3.5 w-3.5" />
                          </button>
                        </li>
                        ) : null}
                        {curriculumTestsOpen ? (
                          canAccess("curriculum_assessment_tests") ? (
                          <li>
                            <button
                              type="button"
                              onClick={() => {
                                onSelectCurriculumSection?.("assessment_tests");
                                setSidebarOpen(false);
                              }}
                              className="neo-nav-item ml-5 flex w-full rounded-md px-1.5 py-1 text-left text-[11px] text-[#636e72]"
                            >
                              {t("nav.curriculum.tests.assessments")}
                            </button>
                          </li>
                          ) : null
                        ) : null}
                        {canAccess("curriculum_result_entry") ? (
                        <li>
                          <button
                            type="button"
                            onClick={() => {
                              onSelectCurriculumSection?.("result_entry");
                              setSidebarOpen(false);
                            }}
                            className="neo-nav-item flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-[11px] font-medium leading-snug text-[#636e72]"
                            title={t("nav.curriculum.resultsEntry")}
                          >
                            <IconClipboard className="h-3.5 w-3.5 shrink-0 text-[#5a8faf] opacity-90" />
                            <span className="min-w-0 flex-1 truncate">{t("nav.curriculum.resultsEntry")}</span>
                          </button>
                        </li>
                        ) : null}
                        {canAccess("curriculum_subjects") ? (
                        <li>
                          <button
                            type="button"
                            onClick={() => {
                              onSelectCurriculumSection?.("blank_page");
                              setSidebarOpen(false);
                            }}
                            className="neo-nav-item flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-[11px] font-medium leading-snug text-[#636e72]"
                          >
                            <IconPromotion className="h-3.5 w-3.5 shrink-0 text-[#5a8faf] opacity-90" />
                            <span className="min-w-0 flex-1 truncate">{t("nav.curriculum.blankPage")}</span>
                          </button>
                        </li>
                        ) : null}
                        {canAccess("curriculum_result_entry") ? (
                        <li>
                          <button
                            type="button"
                            onClick={() => {
                              onSelectCurriculumSection?.("learns_report");
                              setSidebarOpen(false);
                            }}
                            className="neo-nav-item flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-[11px] font-medium leading-snug text-[#636e72]"
                          >
                            <IconChartBars className="h-3.5 w-3.5 shrink-0 text-[#5a8faf] opacity-90" />
                            <span className="min-w-0 flex-1 truncate">{t("nav.curriculum.learnsReport")}</span>
                          </button>
                        </li>
                        ) : null}
                      </ul>
                    ) : (
                      <ul className="neo-nav-sub mb-1 ml-3 mt-1 space-y-0 pb-0.5 pl-2.5">
                        {group.items.map((item) => {
                          const ItemIcon = item.icon;
                          return (
                            <li key={item.label}>
                              <button
                                type="button"
                                onClick={() => {
                                  if (item.inboxList) {
                                    onOpenInboxList?.(item.inboxList);
                                  }
                                  if (item.settingsPanel) {
                                    onSelectSettingsPanel?.(item.settingsPanel);
                                  }
                                  if (item.studentSection) {
                                    onSelectStudentSection?.(item.studentSection);
                                  }
                                  if (item.staffSection) {
                                    onSelectStaffSection?.(item.staffSection);
                                  }
                                  if (item.financeSection) {
                                    onSelectFinanceSection?.(item.financeSection);
                                  }
                                  if (item.classSection) {
                                    onSelectClassSection?.(item.classSection);
                                  }
                                  if (item.curriculumSection) {
                                    onSelectCurriculumSection?.(item.curriculumSection);
                                  }
                                  if (item.communicationSection === "notice") {
                                    onSelectCommunicationSection?.();
                                  }
                                  if (item.attendanceSection) {
                                    onSelectAttendanceSection?.(item.attendanceSection);
                                  }
                                  if (item.resultsSection) {
                                    onSelectResultsSection?.(item.resultsSection);
                                  }
                                  setSidebarOpen(false);
                                }}
                                className="neo-nav-item flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-[11px] font-medium leading-snug text-[#636e72]"
                                title={item.label}
                              >
                                {ItemIcon ? (
                                  <ItemIcon className="h-3.5 w-3.5 shrink-0 text-[#5a8faf] opacity-90" />
                                ) : (
                                  <span className="h-3.5 w-3.5 shrink-0" aria-hidden />
                                )}
                                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                                {item.badge ? (
                                  <span className="shrink-0 rounded bg-[#b9d9eb]/60 px-1 py-px text-[9px] font-bold text-[#2d3436]">
                                    {item.badge}
                                  </span>
                                ) : null}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )
                  ) : null}
                </div>
              );
            })}
          </div>
        </nav>
      </aside>

      <div className="flex min-h-0 flex-1 flex-col self-stretch">
        <header className="neo-header sticky top-0 z-30 shrink-0 border-b border-white/50">
          <div className="flex flex-wrap items-center gap-1.5 px-2.5 py-1.5 sm:gap-2 sm:px-4">
            <button
              type="button"
              className="neo-icon-btn rounded-lg p-1.5 text-[#636e72] lg:hidden"
              onClick={() => setSidebarOpen(true)}
              aria-label={t("layout.openMenu")}
              title="Open sidebar navigation"
            >
              <MenuIcon />
            </button>
            <div className="hidden min-w-0 max-w-md flex-1 md:block lg:max-w-xl">
              <label className="relative block">
                <span className="sr-only">{t("layout.search")}</span>
                <IconSearch className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-[#636e72]" />
                <input
                  type="search"
                  placeholder={t("layout.searchPlaceholder")}
                  className="neo-inset w-full py-2 pl-9 pr-3 text-xs text-[#2d3436] outline-none transition placeholder:text-[#636e72]/80 focus:ring-2 focus:ring-[#b9d9eb]/60"
                />
              </label>
            </div>
            <div className="hidden min-w-0 flex-1 flex-col items-center justify-center px-1 lg:flex">
              <p className="truncate text-center text-[10px] font-bold uppercase tracking-[0.12em] text-[#b8682a] sm:text-[11px]">
                {t("layout.systemTitle")}
              </p>
            </div>
            <div className="ml-auto flex flex-wrap items-center gap-1 sm:gap-1.5">
              <div
                className="hidden items-center gap-1 border-r border-[#ebe4d9]/80 pr-2 text-[10px] md:flex md:text-[11px]"
                title={t("layout.runningSession")}
              >
                <span className="shrink-0 font-semibold text-[#b85c5c]">{t("layout.runningSession")}</span>
                <IconUser className="h-3.5 w-3.5 shrink-0 text-[#636e72]" />
                <span className="max-w-[6.5rem] truncate font-medium text-[#2d3436]">
                  {profileLoading ? "…" : name}
                </span>
              </div>
              <div className="relative" ref={langMenuRef}>
                <button
                  type="button"
                  onClick={() => {
                    setNotifPanelOpen(false);
                    setMsgPanelOpen(false);
                    setUserMenuOpen(false);
                    setUserMenuProfile(false);
                    setLangMenuOpen((o) => !o);
                  }}
                  aria-expanded={langMenuOpen}
                  aria-haspopup="listbox"
                  aria-label={t("layout.changeLanguage")}
                  className="flex items-center gap-1.5 rounded-full bg-gradient-to-br from-[#cde8cf] to-[#9dc6a0] px-2.5 py-1 text-[10px] font-semibold text-[#2d3436] shadow-[2px_2px_6px_rgba(120,150,125,0.35),-2px_-2px_5px_rgba(255,255,255,0.85)] transition hover:brightness-105 sm:text-[11px]"
                  title="Change system language"
                >
                  <IconGlobe className="shrink-0" />
                  {localeLabels[locale]}
                </button>
                {langMenuOpen ? (
                  <ul
                    role="listbox"
                    aria-label={t("layout.changeLanguage")}
                    className="neo-dropdown absolute right-0 top-full z-[60] mt-2 min-w-[10rem] overflow-hidden py-1"
                  >
                    {(["en", "sw"] as Locale[]).map((loc) => (
                      <li key={loc} role="presentation">
                        <button
                          type="button"
                          role="option"
                          aria-selected={loc === locale}
                          className={`flex w-full px-3 py-2 text-left text-sm font-medium transition hover:bg-[#b9d9eb]/35 ${
                            loc === locale ? "bg-[#cde8cf]/50 text-[#2d3436]" : "text-[#2d3436]"
                          }`}
                          onClick={() => {
                            setLocale(loc);
                            setLangMenuOpen(false);
                          }}
                        >
                          {localeLabels[loc]}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
              <TermYearPicker />
              <div className="relative" ref={notifWrapRef}>
                <button
                  type="button"
                  onClick={() => {
                    setLangMenuOpen(false);
                    closeUserMenu();
                    setMsgPanelOpen(false);
                    setNotifPanelOpen((o) => !o);
                  }}
                  aria-expanded={notifPanelOpen}
                  aria-haspopup="dialog"
                  aria-label={`${t("layout.notifications")}${unreadNotifCount > 0 ? `, ${unreadNotifCount} unread` : ""}`}
                  className={`neo-icon-btn relative p-2 text-[#636e72] ${notifPanelOpen ? "bg-[#b9d9eb]/40" : ""}`}
                  title="View notifications"
                >
                  <IconBell />
                  {unreadNotifCount > 0 ? (
                    <span className="absolute right-0 top-0 flex h-3.5 min-w-[0.875rem] items-center justify-center rounded-full bg-gradient-to-br from-[#f7d1cd] to-[#e8a8a2] px-0.5 text-[9px] font-bold text-[#2d3436] shadow-sm">
                      {unreadNotifCount > 9 ? "9+" : unreadNotifCount}
                    </span>
                  ) : null}
                </button>
                <HeaderInboxDropdown
                  open={notifPanelOpen}
                  title={t("header.notif.title")}
                  emptyLabel={t("header.notif.empty")}
                  markAllLabel={t("header.notif.markAll")}
                  readMoreLabel={t("header.readMore")}
                  timeSuffix={t("header.timeSuffix")}
                  items={headerNotifications}
                  variant="notification"
                  onMarkAllRead={async () => {
                    try {
                      await onMarkAllNotificationsRead();
                    } finally {
                      setNotifPanelOpen(false);
                    }
                  }}
                  onItemClick={(id) => {
                    setNotifPanelOpen(false);
                    onOpenNotificationFromHeader(id);
                  }}
                  onReadMore={() => {
                    setNotifPanelOpen(false);
                    onReadMoreNotifications();
                  }}
                />
              </div>
              <div className="relative" ref={msgWrapRef}>
                <button
                  type="button"
                  onClick={() => {
                    setLangMenuOpen(false);
                    closeUserMenu();
                    setNotifPanelOpen(false);
                    setMsgPanelOpen((o) => !o);
                  }}
                  aria-expanded={msgPanelOpen}
                  aria-haspopup="dialog"
                  aria-label={`${t("layout.messages")}${unreadMsgCount > 0 ? `, ${unreadMsgCount} unread` : ""}`}
                  className={`neo-icon-btn relative p-2 text-[#636e72] ${msgPanelOpen ? "bg-[#b9d9eb]/40" : ""}`}
                  title="View messages"
                >
                  <IconMail />
                  {unreadMsgCount > 0 ? (
                    <span className="absolute right-0 top-0 flex h-3.5 min-w-[0.875rem] items-center justify-center rounded-full bg-gradient-to-br from-[#b9d9eb] to-[#8bb8d4] px-0.5 text-[9px] font-bold text-[#2d3436] shadow-sm">
                      {unreadMsgCount > 9 ? "9+" : unreadMsgCount}
                    </span>
                  ) : null}
                </button>
                <HeaderInboxDropdown
                  open={msgPanelOpen}
                  title={t("header.msg.title")}
                  emptyLabel={t("header.msg.empty")}
                  markAllLabel={t("header.msg.markAll")}
                  readMoreLabel={t("header.readMore")}
                  timeSuffix={t("header.timeSuffix")}
                  items={headerMessages}
                  variant="message"
                  onMarkAllRead={async () => {
                    try {
                      await onMarkAllMessagesRead();
                    } finally {
                      setMsgPanelOpen(false);
                    }
                  }}
                  onItemClick={(id) => {
                    setMsgPanelOpen(false);
                    onOpenMessageFromHeader(id);
                  }}
                  onReadMore={() => {
                    setMsgPanelOpen(false);
                    onReadMoreMessages();
                  }}
                />
              </div>
              <div className="relative ml-0.5" ref={userMenuRef}>
                <button
                  type="button"
                  onClick={() => {
                    if (userMenuOpen) {
                      closeUserMenu();
                    } else {
                      setNotifPanelOpen(false);
                      setMsgPanelOpen(false);
                      setLangMenuOpen(false);
                      setUserMenuProfile(false);
                      setUserMenuOpen(true);
                    }
                  }}
                  aria-expanded={userMenuOpen}
                  aria-haspopup="menu"
                  aria-label={
                    profileLoading
                      ? `${t("layout.accountMenu")}, ${t("layout.loading")}`
                      : `${t("layout.accountMenu")}, ${t("layout.signedInAs")} ${name}`
                  }
                  className={`neo-icon-btn p-2 text-[#2d3436] ${
                    userMenuOpen
                      ? "bg-gradient-to-br from-[#cde8cf] to-[#b8d8ba] shadow-[inset_1px_1px_3px_rgba(0,0,0,0.06)]"
                      : ""
                  }`}
                  title="Account and profile settings"
                >
                  {profileLoading ? (
                    <span className="flex h-5 w-5 items-center justify-center text-[10px] text-[#636e72]">
                      …
                    </span>
                  ) : (
                    <IconUser />
                  )}
                </button>

                {userMenuOpen ? (
                  <div
                    role="menu"
                    aria-orientation="vertical"
                    className={`neo-dropdown absolute right-0 top-full z-[60] mt-3 overflow-hidden shadow-lg ${
                      userMenuProfile
                        ? "w-[min(100vw-2rem,22rem)] py-0"
                        : "w-[min(100vw-2rem,18rem)] py-2"
                    }`}
                  >
                    {!userMenuProfile ? (
                      <>
                        <div className="border-b border-[#ebe4d9] bg-gradient-to-br from-[#e8f4fc] to-[#f5f0e6] px-4 pb-3 pt-2">
                          <p className="truncate text-sm font-semibold text-[#2d3436]">{name}</p>
                          <p className="mt-0.5 truncate text-xs text-[#636e72]">{user?.email ?? "—"}</p>
                          <p className="mt-2 inline-flex rounded-full bg-[#b8d8ba] px-2.5 py-0.5 text-[11px] font-semibold text-[#2d3436] shadow-[2px_2px_4px_rgba(120,150,125,0.25)]">
                            {roleLabel}
                          </p>
                        </div>
                        <button
                          type="button"
                          role="menuitem"
                          className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-medium text-[#2d3436] transition hover:bg-[#b9d9eb]/35"
                          onClick={() => setUserMenuProfile(true)}
                        >
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#f0f4f2] text-[#4a6b4e] shadow-[inset_1px_1px_2px_rgba(0,0,0,0.04)]">
                            <IconSettings className="h-[15px] w-[15px]" />
                          </span>
                          <span className="min-w-0 flex-1 leading-snug">{t("layout.manageProfile")}</span>
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          className="flex w-full px-4 py-2.5 text-left text-sm font-semibold text-[#c0392b] transition hover:bg-[#f7d1cd]/50"
                          onClick={() => {
                            closeUserMenu();
                            onLogout();
                          }}
                        >
                          {t("layout.logOut")}
                        </button>
                      </>
                    ) : (
                      <div className="flex flex-col">
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 border-b border-[#ebe4d9]/80 bg-[#faf9f6]/90 px-3 py-2.5 text-left text-xs font-semibold text-[#5a8faf] transition hover:bg-[#b9d9eb]/20 hover:text-[#2d3436]"
                          onClick={() => setUserMenuProfile(false)}
                          title="Back to main account menu"
                        >
                          <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" aria-hidden>
                            <path
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M15 18l-6-6 6-6"
                            />
                          </svg>
                          {t("layout.profile.backToMenu")}
                        </button>

                        <div className="border-b border-[#ebe4d9]/80 bg-gradient-to-br from-[#eef6f2] via-[#e8f2fa] to-[#f5f0e6] px-4 py-4">
                          <div className="flex items-start gap-3">
                            <div
                              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#3d5a40] to-[#4a6b4e] text-[13px] font-bold tracking-tight text-white shadow-[2px_3px_8px_rgba(60,90,65,0.35)]"
                              aria-hidden
                            >
                              {profileInitials}
                            </div>
                            <div className="min-w-0 flex-1 pt-0.5">
                              <h2 className="text-sm font-bold leading-tight text-[#2d3436]">
                                {t("layout.profile.title")}
                              </h2>
                              <p className="mt-1 text-[11px] leading-snug text-[#636e72]">
                                {t("layout.profile.subtitle")}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="max-h-[min(70vh,26rem)] space-y-4 overflow-y-auto px-4 py-4">
                          <section aria-labelledby="profile-details-heading">
                            <h3
                              id="profile-details-heading"
                              className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#636e72]"
                            >
                              {t("layout.profile.sectionDetails")}
                            </h3>
                            <dl className="mt-2 divide-y divide-[#ebe4d9]/90 rounded-xl border border-[#ebe4d9]/80 bg-white/50 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]">
                              <div className="px-3 py-2.5">
                                <dt className="flex flex-wrap items-center gap-2">
                                  <span className="text-[10px] font-bold uppercase tracking-wide text-[#636e72]">
                                    {t("layout.profile.primaryEmail")}
                                  </span>
                                  <span className="rounded-md bg-[#cde8cf]/90 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#2d3436]">
                                    {t("layout.profile.badgePrimary")}
                                  </span>
                                </dt>
                                <dd className="mt-1.5 break-all text-sm font-semibold text-[#2d3436]">
                                  {user?.email ?? "—"}
                                </dd>
                              </div>
                              <div className="px-3 py-2.5">
                                <dt className="text-[10px] font-bold uppercase tracking-wide text-[#636e72]">
                                  {t("layout.profile.displayName")}
                                </dt>
                                <dd className="mt-1.5 text-sm font-semibold text-[#2d3436]">{name}</dd>
                              </div>
                              <div className="px-3 py-2.5">
                                <dt className="text-[10px] font-bold uppercase tracking-wide text-[#636e72]">
                                  {t("layout.profile.role")}
                                </dt>
                                <dd className="mt-1.5">
                                  <span className="inline-flex rounded-full bg-[#e8f2ec] px-2.5 py-0.5 text-xs font-semibold text-[#2d3436] ring-1 ring-[#b8d8ba]/50">
                                    {roleLabel}
                                  </span>
                                </dd>
                              </div>
                              <div className="px-3 py-2.5">
                                <dt className="text-[10px] font-bold uppercase tracking-wide text-[#636e72]">
                                  {t("layout.profile.accountId")}
                                </dt>
                                <dd className="mt-1.5 font-mono text-xs font-medium text-[#636e72]">
                                  {user?.sub ?? "—"}
                                </dd>
                              </div>
                            </dl>
                          </section>

                          <section aria-labelledby="profile-password-heading">
                            <h3
                              id="profile-password-heading"
                              className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#636e72]"
                            >
                              {t("layout.profile.changePasswordTitle")}
                            </h3>
                            <div className="mt-2 space-y-2 rounded-xl border border-[#ebe4d9]/80 bg-white/50 p-3">
                              {pwOk ? (
                                <p className="text-xs font-semibold text-[#4a6b4e]" role="status">
                                  {pwOk}
                                </p>
                              ) : null}
                              {pwErr ? (
                                <p className="text-xs font-medium text-[#c0392b]" role="alert">
                                  {pwErr}
                                </p>
                              ) : null}
                              {!pwOtpSent ? (
                                <button
                                  type="button"
                                  disabled={pwBusy}
                                  onClick={async () => {
                                    setPwErr(null);
                                    setPwOk(null);
                                    setPwBusy(true);
                                    try {
                                      await requestPasswordChangeOtp();
                                      setPwOtpSent(true);
                                    } catch (e) {
                                      setPwErr(
                                        e instanceof Error ? e.message : t("inbox.loadError"),
                                      );
                                    } finally {
                                      setPwBusy(false);
                                    }
                                  }}
                                  className="w-full rounded-xl bg-gradient-to-br from-[#b9d9eb]/50 to-[#cde8cf]/40 py-2 text-xs font-bold text-[#2d3436] transition hover:brightness-105 disabled:opacity-60"
                                  title="Request an OTP code to change your password"
                                >
                                  {pwBusy ? t("layout.profile.sending") : t("layout.profile.changePasswordSendCode")}
                                </button>
                              ) : (
                                <div className="space-y-2">
                                  <p className="text-[11px] leading-snug text-[#636e72]">
                                    {t("layout.profile.changePasswordCodeSent")}
                                  </p>
                                  <input
                                    type="password"
                                    autoComplete="current-password"
                                    placeholder={t("layout.profile.currentPassword")}
                                    value={currentPw}
                                    onChange={(e) => setCurrentPw(e.target.value)}
                                    disabled={pwBusy}
                                    className="neo-inset-field w-full px-3 py-2 text-xs text-[#2d3436] placeholder:text-[#636e72]/70"
                                  />
                                  <input
                                    type="password"
                                    autoComplete="new-password"
                                    placeholder={t("layout.profile.newPassword")}
                                    value={newPw}
                                    onChange={(e) => setNewPw(e.target.value)}
                                    disabled={pwBusy}
                                    className="neo-inset-field w-full px-3 py-2 text-xs text-[#2d3436] placeholder:text-[#636e72]/70"
                                  />
                                  <input
                                    type="password"
                                    autoComplete="new-password"
                                    placeholder={t("layout.profile.confirmNewPassword")}
                                    value={newPw2}
                                    onChange={(e) => setNewPw2(e.target.value)}
                                    disabled={pwBusy}
                                    className="neo-inset-field w-full px-3 py-2 text-xs text-[#2d3436] placeholder:text-[#636e72]/70"
                                  />
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    autoComplete="one-time-code"
                                    placeholder={t("layout.profile.otpCode")}
                                    value={pwOtp}
                                    onChange={(e) =>
                                      setPwOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                                    }
                                    disabled={pwBusy}
                                    className="neo-inset-field w-full px-3 py-2 text-center text-sm font-semibold tracking-widest text-[#2d3436] placeholder:tracking-normal placeholder:text-[#636e72]/70"
                                  />
                                  <button
                                    type="button"
                                    disabled={
                                      pwBusy ||
                                      !currentPw ||
                                      newPw.length < 8 ||
                                      pwOtp.length !== 6
                                    }
                                    onClick={async () => {
                                      setPwErr(null);
                                      setPwOk(null);
                                      if (newPw !== newPw2) {
                                        setPwErr(t("layout.profile.passwordsMismatch"));
                                        return;
                                      }
                                      setPwBusy(true);
                                      try {
                                        await confirmPasswordChange({
                                          currentPassword: currentPw,
                                          newPassword: newPw,
                                          otp: pwOtp,
                                        });
                                        setPwOk(t("layout.profile.passwordUpdated"));
                                        setCurrentPw("");
                                        setNewPw("");
                                        setNewPw2("");
                                        setPwOtp("");
                                        setPwOtpSent(false);
                                        onAccountUpdated?.();
                                      } catch (e) {
                                        setPwErr(
                                          e instanceof Error ? e.message : t("inbox.loadError"),
                                        );
                                      } finally {
                                        setPwBusy(false);
                                      }
                                    }}
                                    className="w-full rounded-xl bg-gradient-to-br from-[#cde8cf] to-[#8fb892] py-2 text-xs font-bold text-[#2d3436] shadow-sm transition hover:brightness-105 disabled:opacity-50"
                                  >
                                    {pwBusy ? t("layout.profile.working") : t("layout.profile.updatePassword")}
                                  </button>
                                </div>
                              )}
                            </div>
                          </section>

                          <section aria-labelledby="profile-2fa-heading">
                            <h3
                              id="profile-2fa-heading"
                              className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#636e72]"
                            >
                              {t("layout.profile.twoFactorTitle")}
                            </h3>
                            <div className="mt-2 space-y-2 rounded-xl border border-[#ebe4d9]/80 bg-white/50 p-3">
                              <p className="text-[11px] leading-snug text-[#636e72]">
                                {t("layout.profile.twoFactorDescription")}
                              </p>
                              <p className="text-xs font-semibold text-[#2d3436]">
                                {user?.twoFactorEnabled
                                  ? t("layout.profile.twoFactorStatusOn")
                                  : t("layout.profile.twoFactorStatusOff")}
                              </p>
                              {tfErr ? (
                                <p className="text-xs font-medium text-[#c0392b]" role="alert">
                                  {tfErr}
                                </p>
                              ) : null}
                              {!tfPending ? (
                                <div className="flex flex-wrap gap-2">
                                  {!user?.twoFactorEnabled ? (
                                    <button
                                      type="button"
                                      disabled={tfBusy}
                                      onClick={async () => {
                                        setTfErr(null);
                                        setTfBusy(true);
                                        try {
                                          await requestTwoFactorOtp(true);
                                          setTfPending({ enable: true });
                                        } catch (e) {
                                          setTfErr(
                                            e instanceof Error ? e.message : t("inbox.loadError"),
                                          );
                                        } finally {
                                          setTfBusy(false);
                                        }
                                      }}
                                      className="rounded-xl bg-gradient-to-br from-[#cde8cf] to-[#8fb892] px-4 py-2 text-xs font-bold text-[#2d3436] shadow-sm transition hover:brightness-105 disabled:opacity-50"
                                    >
                                      {tfBusy ? t("layout.profile.sending") : t("layout.profile.turnOn2fa")}
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      disabled={tfBusy}
                                      onClick={async () => {
                                        setTfErr(null);
                                        setTfBusy(true);
                                        try {
                                          await requestTwoFactorOtp(false);
                                          setTfPending({ enable: false });
                                        } catch (e) {
                                          setTfErr(
                                            e instanceof Error ? e.message : t("inbox.loadError"),
                                          );
                                        } finally {
                                          setTfBusy(false);
                                        }
                                      }}
                                      className="rounded-xl border border-[#ebe4d9] bg-[#faf7f0] px-4 py-2 text-xs font-bold text-[#c0392b] transition hover:bg-[#f7d1cd]/30 disabled:opacity-50"
                                    >
                                      {tfBusy ? t("layout.profile.sending") : t("layout.profile.turnOff2fa")}
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <div className="space-y-2 border-t border-[#ebe4d9]/60 pt-2">
                                  <p className="text-[11px] text-[#636e72]">
                                    {t("layout.profile.2faAwaitingCode")}
                                  </p>
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    autoComplete="one-time-code"
                                    placeholder={t("layout.profile.otpCode")}
                                    value={tfOtp}
                                    onChange={(e) =>
                                      setTfOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                                    }
                                    disabled={tfBusy}
                                    className="neo-inset-field w-full px-3 py-2 text-center text-sm font-semibold tracking-widest text-[#2d3436] placeholder:tracking-normal"
                                  />
                                  <div className="flex flex-wrap gap-2">
                                    <button
                                      type="button"
                                      disabled={tfBusy || tfOtp.length !== 6}
                                      onClick={async () => {
                                        setTfErr(null);
                                        setTfBusy(true);
                                        try {
                                          await confirmTwoFactor(tfPending.enable, tfOtp);
                                          setTfPending(null);
                                          setTfOtp("");
                                          onAccountUpdated?.();
                                        } catch (e) {
                                          setTfErr(
                                            e instanceof Error ? e.message : t("inbox.loadError"),
                                          );
                                        } finally {
                                          setTfBusy(false);
                                        }
                                      }}
                                      className="rounded-xl bg-gradient-to-br from-[#cde8cf] to-[#8fb892] px-4 py-2 text-xs font-bold text-[#2d3436] disabled:opacity-50"
                                    >
                                      {tfBusy ? t("layout.profile.working") : t("layout.profile.confirm2fa")}
                                    </button>
                                    <button
                                      type="button"
                                      disabled={tfBusy}
                                      onClick={() => {
                                        setTfPending(null);
                                        setTfOtp("");
                                        setTfErr(null);
                                      }}
                                      className="rounded-xl px-4 py-2 text-xs font-semibold text-[#5a8faf] hover:underline"
                                    >
                                      {t("layout.profile.cancelAction")}
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </section>

                          <section aria-labelledby="profile-security-heading">
                            <h3
                              id="profile-security-heading"
                              className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#636e72]"
                            >
                              {t("layout.profile.sectionSecurity")}
                            </h3>
                            <div className="mt-2 rounded-xl border border-[#ebe4d9]/80 bg-gradient-to-br from-[#faf9f6] to-[#f0f4f8] p-3">
                              <div className="flex gap-2">
                                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/80 text-[#5a8faf] shadow-sm ring-1 ring-[#ebe4d9]/60">
                                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" aria-hidden>
                                    <path
                                      stroke="currentColor"
                                      strokeWidth="1.7"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H10l-4-4V5a2 2 0 012-2h4a2 2 0 012 2v4"
                                    />
                                  </svg>
                                </span>
                                <p className="text-[11px] leading-relaxed text-[#636e72]">
                                  {t("layout.profile.securityIntro")}
                                </p>
                              </div>
                            </div>
                          </section>

                          <p className="border-t border-[#ebe4d9]/60 pt-3 text-[10px] leading-relaxed text-[#636e72]/90">
                            {t("layout.profile.footerNote")}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </header>

        <div className="relative min-h-0 flex-1 overflow-hidden">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-center bg-no-repeat"
            style={{
              backgroundImage: "url('/school-badge-v2.png')",
              backgroundSize: "min(52vw, 560px)",
              opacity: 0.06,
            }}
          />
          <div className="relative z-10 min-h-0 flex-1">{children}</div>
        </div>

        <footer className="neo-footer shrink-0 border-t border-white/40 py-3.5 text-center text-xs font-medium text-[#636e72]">
          © {new Date().getFullYear()} {t("layout.copyright")} · {t("layout.footer")}
        </footer>
      </div>
    </div>
  );
}
