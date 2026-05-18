import { useState } from "react";
import { BursaryPage, type BursaryRecord } from "./BursaryPage";
import { DailyExpensesPage } from "./expenses/DailyExpensesPage";
import { DailyLedgerPage } from "./ledger/DailyLedgerPage";
import { FinanceOverviewPage } from "./overview/FinanceOverviewPage";
import { AssignFeesPage } from "./payments/AssignFeesPage";
import { ReceiptsHistoryPage } from "./payments/ReceiptsHistoryPage";
import { RecordStudentPaymentPage } from "./payments/RecordStudentPaymentPage";
import { PayrollSummaryPage } from "./payroll/PayrollSummaryPage";
import { AdminDailyReportsPage } from "./reports/AdminDailyReportsPage";
import { DebtorsReportPage } from "./reports/DebtorsReportPage";
import { AssignBursaryPage } from "./AssignBursaryPage";
import { FeeComplianceBanner } from "./FeeComplianceBanner";

export type FinanceSection =
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

function hasFinancePermission(user: any, permissionKey: string): boolean {
  const role = String(user?.role ?? "").toLowerCase();
  if (role === "admin" || role === "super_admin") return true;
  return Array.isArray(user?.permissions) && user.permissions.includes(permissionKey);
}

function requiredPermissionForSection(section: FinanceSection): string | null {
  if (section === "assign_fees") return "finance_assign_fees";
  if (section === "record_payment" || section === "receipts" || section === "expenses") return "finance_record_payments";
  if (section === "bursary" || section === "bursary_assignment") return "finance_bursary";
  if (section === "staff_payment") return "finance_staff_pay";
  if (section === "finance_summary") return "finance_summaries";
  if (section === "daily_report" || section === "debtors_report") return "finance_reports";
  return null;
}

const sectionTitle: Record<FinanceSection, string> = {
  overview: "Financial Overview",
  daily_report: "Daily Ledger",
  debtors_report: "Debtors Report",
  assign_fees: "Assign Fees",
  record_payment: "Record Student Payment",
  receipts: "Receipts",
  expenses: "Record Expenses",
  bursary: "Bursary",
  bursary_assignment: "Assign Student Bursary",
  staff_payment: "Payroll Summary",
  finance_summary: "Admin Daily Reports",
};

export function FinanceSectionPage({
  section,
  onChangeSection,
  user,
}: {
  section: FinanceSection;
  onChangeSection: (value: FinanceSection) => void;
  user: any;
}) {
  const [ledgerDate, setLedgerDate] = useState<string | undefined>(undefined);
  const [selectedBursaryRecord, setSelectedBursaryRecord] = useState<BursaryRecord | null>(null);

  const navigateToLedger = (date: string) => {
    setLedgerDate(date);
    onChangeSection("daily_report");
  };

  const sectionRequiredPermission = requiredPermissionForSection(section);
  const sectionAllowed =
    section === "overview" ||
    !sectionRequiredPermission ||
    hasFinancePermission(user, sectionRequiredPermission);

  const renderHeader = (title: string, subtitle?: string) => (
    <header className="mb-8 flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-8">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-slate-800">{title}</h1>
        {subtitle && <p className="mt-1 text-sm font-medium text-slate-500">{subtitle}</p>}
      </div>
      {section !== "overview" && (
        <button
          onClick={() => onChangeSection("overview")}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-600 shadow-sm transition-all hover:bg-slate-50 hover:text-indigo-600 hover:border-indigo-200"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Overview
        </button>
      )}
    </header>
  );

  if (!sectionAllowed) {
    return (
      <div className="neo-card rounded-2xl border border-amber-200 bg-amber-50 px-5 py-6 text-sm font-semibold text-amber-900">
        You do not have permission to view this finance section. Contact admin to grant access.
      </div>
    );
  }

  if (section === "record_payment") {
    return (
      <div className="min-w-0 space-y-4">
        <FeeComplianceBanner />
        {renderHeader(sectionTitle.record_payment, "Capture fee payments and issue receipts.")}
        <RecordStudentPaymentPage generatedByName={user?.name || user?.email?.split("@")[0]} />
      </div>
    );
  }

  if (section === "assign_fees") {
    return (
      <div className="min-w-0 space-y-4">
        <FeeComplianceBanner />
        {renderHeader(sectionTitle.assign_fees, "Search students and assign term fee amounts.")}
        <AssignFeesPage />
      </div>
    );
  }

  if (section === "receipts") {
    return (
      <div className="min-w-0 space-y-4">
        {renderHeader(sectionTitle.receipts, "Review all generated receipts and reprint when needed.")}
        <ReceiptsHistoryPage generatedByName={user?.name || user?.email?.split("@")[0]} />
      </div>
    );
  }

  if (section === "daily_report") {
    const canViewPastRecords = hasFinancePermission(user, "finance_past_ledger");
    const isAdmin =
      String(user?.role ?? "").toLowerCase() === "admin" ||
      String(user?.role ?? "").toLowerCase() === "super_admin";
    return (
      <div className="min-w-0 space-y-4">
        {renderHeader(sectionTitle.daily_report, "Detailed tracking of daily income and expenses.")}
        <DailyLedgerPage
          initialDate={ledgerDate}
          canViewPastRecords={canViewPastRecords}
          isAdmin={isAdmin}
        />
      </div>
    );
  }


  if (section === "debtors_report") {
    return (
      <div className="min-w-0 space-y-4">
        <FeeComplianceBanner />
        {renderHeader(sectionTitle.debtors_report, "Monitor students with outstanding fee balances.")}
        <DebtorsReportPage />
      </div>
    );
  }

  if (section === "expenses") {
    return (
      <div className="min-w-0 space-y-4">
        {renderHeader(sectionTitle.expenses, "Log operational expenses into the system.")}
        <DailyExpensesPage />
      </div>
    );
  }

  if (section === "bursary") {
    return (
      <div className="min-w-0 space-y-4">
        {renderHeader(sectionTitle.bursary, "Track bursary awards and support records.")}
        <BursaryPage 
          isAdmin={user?.role === "admin"} 
          onAssignClick={() => {
            setSelectedBursaryRecord(null);
            onChangeSection("bursary_assignment");
          }}
          onEditRow={(row) => {
            setSelectedBursaryRecord(row);
            onChangeSection("bursary_assignment");
          }}
        />
      </div>
    );
  }

  if (section === "bursary_assignment") {
    return (
      <div className="min-w-0 space-y-4">
        {renderHeader(sectionTitle.bursary_assignment, "Assign percentage-based discounts to students.")}
        <AssignBursaryPage
          initialStudentId={selectedBursaryRecord?.id}
          initialTerm={selectedBursaryRecord?.term}
          initialPercentage={selectedBursaryRecord?.coverageLabel.replace("%", "")}
        />
      </div>
    );
  }

  if (section === "staff_payment") {
    return (
      <div className="min-w-0 space-y-4">
        {renderHeader(sectionTitle.staff_payment, "Management of staff salaries and payment history.")}
        <PayrollSummaryPage />
      </div>
    );
  }

  if (section === "finance_summary") {
    return (
      <div className="min-w-0 space-y-4">
        {renderHeader(sectionTitle.finance_summary, "Review and close daily financial records.")}
        <AdminDailyReportsPage onViewLedger={navigateToLedger} />
      </div>
    );
  }


  return (
    <div className="min-w-0 space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <FeeComplianceBanner />
      <div className="pt-4 border-t border-[#ebe4d9]/50">
        <FinanceOverviewPage />
      </div>
    </div>
  );
}
