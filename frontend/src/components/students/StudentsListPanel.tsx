import { useEffect, useRef, useState } from "react";
import {
  deleteStudent,
  fetchStudent,
  fetchStudents,
  type StudentApiRow,
  type StudentSortBy,
  type StudentSortDir,
} from "../../api/students";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { useI18n } from "../../i18n/I18nProvider";
import { exportStudentsToXlsx } from "../../utils/exportStudentsXlsx";
import { AuthenticatedStudentPhoto } from "./AuthenticatedStudentPhoto";
import { StudentDetailModal } from "./StudentDetailModal";
import { StudentStatusBadge } from "../statuses/StudentStatusBadge";
import { useStudentStatuses } from "../../hooks/useStudentStatuses";
import { studentFeeStatusLabel } from "../../utils/studentStatusDisplay";

const selectClass =
  "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm outline-none transition-all focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 hover:border-slate-300";

const iconBtn =
  "inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition-all hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 active:scale-95";

type StudentsListPanelProps = {
  limit: number;
  title: string;
  refreshKey?: number;
  classNameFilter?: string | null;
  /** Directory pages: export + row actions */
  showDirectoryTools?: boolean;
  /** User permissions array — when provided, gates edit/delete/export. Admin roles should pass undefined to allow all. */
  permissions?: string[];
};

type StudentSortOption = StudentSortBy | "custom";
type CustomSortColumn =
  | "admissionNumber"
  | "fullName"
  | "className"
  | "sectionName"
  | "studentStatus"
  | "admittedAt";
type ExportFormat = "excel" | "pdf";

function customColumnValue(row: StudentApiRow, column: CustomSortColumn): string {
  switch (column) {
    case "admissionNumber":
      return row.admissionNumber ?? "";
    case "fullName":
      return row.fullName ?? "";
    case "className":
      return row.className ?? "";
    case "sectionName":
      return row.sectionName ?? "";
    case "studentStatus":
      return studentFeeStatusLabel(row);
    case "admittedAt":
      return row.admittedAt ?? "";
    default:
      return "";
  }
}

function applyCustomSort(
  rows: StudentApiRow[],
  dir: StudentSortDir,
  column: CustomSortColumn,
  query: string,
): StudentApiRow[] {
  const normalizedQuery = query.trim().toLowerCase();
  return [...rows].sort((a, b) => {
    const aValue = customColumnValue(a, column);
    const bValue = customColumnValue(b, column);
    if (normalizedQuery) {
      const aMatch = aValue.toLowerCase().includes(normalizedQuery) ? 0 : 1;
      const bMatch = bValue.toLowerCase().includes(normalizedQuery) ? 0 : 1;
      if (aMatch !== bMatch) return aMatch - bMatch;
    }
    const columnCmp = aValue.localeCompare(bValue);
    if (columnCmp !== 0) return dir === "asc" ? columnCmp : -columnCmp;
    const fallback = a.fullName.localeCompare(b.fullName);
    return dir === "asc" ? fallback : -fallback;
  });
}

function IconView({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" fill="none" viewBox="0 0 24 24" aria-hidden>
      <path
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z"
      />
      <circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function IconEdit({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" fill="none" viewBox="0 0 24 24" aria-hidden>
      <path
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 20h9M16.5 3.5a2.12 2.12 0 013 3L8 18l-4 1 1-4L16.5 3.5z"
      />
    </svg>
  );
}

function IconTrash({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" fill="none" viewBox="0 0 24 24" aria-hidden>
      <path
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        d="M4 7h16M10 11v6M14 11v6M6 7l1 12h10l1-12M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2"
      />
    </svg>
  );
}

export function StudentsListPanel({
  limit,
  title,
  refreshKey = 0,
  classNameFilter = null,
  showDirectoryTools = false,
  permissions,
}: StudentsListPanelProps) {
  const { t } = useI18n();
  const { statuses: feeStatuses } = useStudentStatuses();
  // Permission helpers — undefined means "all allowed" (admin)
  const canView = !permissions || permissions.includes("students_view") || permissions.includes("students_all");
  const canEdit = !permissions || permissions.includes("students_edit");
  const canDelete = !permissions || permissions.includes("students_delete");
  const canExport = !permissions || permissions.includes("students_export");
  const [draft, setDraft] = useState("");
  const [applied, setApplied] = useState("");
  const [missingStatusOnly, setMissingStatusOnly] = useState(false);
  const [sortBy, setSortBy] = useState<StudentSortOption>("date");
  const [sortDir, setSortDir] = useState<StudentSortDir>("desc");
  const [customSortColumn, setCustomSortColumn] = useState<CustomSortColumn>("fullName");
  const [customSortValue, setCustomSortValue] = useState("");
  const [exportFormat, setExportFormat] = useState<ExportFormat>("excel");
  const [items, setItems] = useState<StudentApiRow[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalId, setModalId] = useState<number | null>(null);
  const [modalInitialEdit, setModalInitialEdit] = useState(false);
  const [profileCard, setProfileCard] = useState<StudentApiRow | null>(null);
  const [pendingDelete, setPendingDelete] = useState<StudentApiRow | null>(null);
  const [confirmDeleteRow, setConfirmDeleteRow] = useState<StudentApiRow | null>(null);
  const [updatedStudentNotice, setUpdatedStudentNotice] = useState<string | null>(null);
  const deleteTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setApplied(draft.trim());
    }, 250);
    return () => window.clearTimeout(timer);
  }, [draft]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const q = classNameFilter ? `${classNameFilter} ${applied}`.trim() : applied;
    const apiSortBy: StudentSortBy = sortBy === "custom" ? "date" : sortBy;
    void fetchStudents({
      q,
      sortBy: apiSortBy,
      sortDir,
      limit,
      offset,
      missingStatus: missingStatusOnly ? true : undefined,
    })
      .then((data) => {
        if (!cancelled) {
          const filtered = classNameFilter
            ? data.items.filter(
                (r) => (r.className ?? "").trim().toLowerCase() === classNameFilter.trim().toLowerCase(),
              )
            : data.items;
          
          setItems(offset === 0 ? filtered : [...items, ...filtered]);
          setTotalItems(data.total);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load");
          setItems([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [applied, sortBy, sortDir, limit, offset, refreshKey, classNameFilter, missingStatusOnly]);

  const runSearch = () => {
    setApplied(draft.trim());
  };

  const openView = (id: number) => {
    setModalInitialEdit(false);
    setModalId(null);
    void fetchStudent(id)
      .then((row) => setProfileCard(row))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load profile"));
  };

  useEffect(() => {
    // If the header global search asked to open a specific student, do it once on mount.
    try {
      const raw = sessionStorage.getItem("globalSearch.openStudentId");
      if (!raw) return;
      const id = Number(raw);
      if (!Number.isFinite(id) || id <= 0) return;
      sessionStorage.removeItem("globalSearch.openStudentId");
      openView(id);
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openEdit = (id: number) => {
    setProfileCard(null);
    setError(null);
    setModalInitialEdit(true);
    setModalId(id);
  };

  const reloadList = async () => {
    const q = classNameFilter ? `${classNameFilter} ${applied}`.trim() : applied;
    try {
      const apiSortBy: StudentSortBy = sortBy === "custom" ? "date" : sortBy;
      const data = await fetchStudents({ q, sortBy: apiSortBy, sortDir, limit, offset: 0 });
      const filtered = classNameFilter
          ? data.items.filter(
              (r) => (r.className ?? "").trim().toLowerCase() === classNameFilter.trim().toLowerCase(),
            )
          : data.items;
      setItems(filtered);
      setTotalItems(data.total);
      setOffset(0);
    } catch {
      /* keep existing list on failure */
    }
  };

  const displayedItems =
    sortBy === "custom"
      ? applyCustomSort(items, sortDir, customSortColumn, customSortValue)
      : items;

  const handleExport = () => {
    const stamp = new Date().toISOString().slice(0, 10);
    if (exportFormat === "excel") {
      exportStudentsToXlsx(displayedItems, `students-${stamp}`, {
        admission: t("students.col.admission"),
        name: t("students.col.name"),
        class: t("students.col.class"),
        section: t("students.col.section"),
        dob: t("students.col.dob"),
        admitted: t("students.col.admitted"),
        nationality: t("students.col.nationality"),
        country: t("students.col.country"),
        district: t("students.col.district"),
        registrationType: t("students.col.registrationType"),
      });
      return;
    }

    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const generatedAt = new Date().toLocaleString();
    const q = (applied || draft).trim();
    doc.setFontSize(14);
    doc.text(title || "Students List", 40, 36);
    doc.setFontSize(10);
    doc.text(`Generated: ${generatedAt}`, 40, 54);
    if (q) {
      doc.text(`Filter: ${q}`, 40, 68);
    }
    autoTable(doc, {
      startY: q ? 80 : 66,
      head: [[
        t("students.col.admission"),
        t("students.col.name"),
        t("students.col.class"),
        t("students.col.section"),
        t("students.col.status"),
        t("students.col.dob"),
        t("students.col.admitted"),
      ]],
      body: displayedItems.map((row) => [
        row.admissionNumber,
        row.fullName,
        row.className ?? "—",
        row.sectionName ?? "—",
        studentFeeStatusLabel(row),
        row.dateOfBirthFormatted ?? "—",
        row.admittedAt,
      ]),
      styles: { fontSize: 9, cellPadding: 5 },
      headStyles: { fillColor: [79, 70, 229], textColor: 255 },
    });
    doc.save(`students-${stamp}.pdf`);
  };

  const exportDisabled = loading || displayedItems.length === 0;

  const exportLabel = exportFormat === "excel" ? t("students.exportExcel") : "Export PDF";

  const queueDelete = (row: StudentApiRow) => {
    if (deleteTimerRef.current != null) {
      window.clearTimeout(deleteTimerRef.current);
      deleteTimerRef.current = null;
    }
    setPendingDelete(row);
    setItems((prev) => prev.filter((x) => x.id !== row.id));
    if (modalId === row.id) setModalId(null);
    if (profileCard?.id === row.id) setProfileCard(null);
    deleteTimerRef.current = window.setTimeout(() => {
      void deleteStudent(row.id).catch((e) =>
        setError(e instanceof Error ? e.message : t("students.modal.deleteFailed")),
      );
      setPendingDelete(null);
      deleteTimerRef.current = null;
    }, 10000);
  };

  const undoDelete = () => {
    if (!pendingDelete) return;
    if (deleteTimerRef.current != null) {
      window.clearTimeout(deleteTimerRef.current);
      deleteTimerRef.current = null;
    }
    setItems((prev) => [pendingDelete, ...prev]);
    setPendingDelete(null);
  };

  useEffect(() => {
    return () => {
      if (deleteTimerRef.current != null) {
        window.clearTimeout(deleteTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!updatedStudentNotice) return;
    const timer = window.setTimeout(() => setUpdatedStudentNotice(null), 3000);
    return () => window.clearTimeout(timer);
  }, [updatedStudentNotice]);

  return (
    <>
      {updatedStudentNotice ? (
        <div className="fixed right-4 top-4 z-[80] flex max-w-md animate-in fade-in slide-in-from-top-4 items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-800 shadow-lg">
          <svg className="h-5 w-5 shrink-0 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p>
            <span className="font-bold">{updatedStudentNotice}</span> has been updated.
          </p>
        </div>
      ) : null}
      {confirmDeleteRow ? (
        <section className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
            onClick={() => setConfirmDeleteRow(null)}
            aria-label="Close warning dialog"
          />
          <div className="relative w-full max-w-md animate-in fade-in zoom-in-95 rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600">
                <IconTrash />
              </div>
              <h3 className="text-lg font-bold text-slate-800">Delete Student?</h3>
            </div>
            <p className="mt-4 text-sm text-slate-600">
              {t("students.deleteRowConfirm")} You will have 10 seconds to undo this action.
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmDeleteRow(null)}
                className="rounded-full bg-slate-100 px-5 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-200 focus:ring-4 focus:ring-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  queueDelete(confirmDeleteRow);
                  setConfirmDeleteRow(null);
                }}
                className="rounded-full bg-rose-600 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-rose-600/20 transition-colors hover:bg-rose-500 focus:ring-4 focus:ring-rose-600/20 active:scale-95"
              >
                Delete Student
              </button>
            </div>
          </div>
        </section>
      ) : null}
      {pendingDelete ? (
        <section className="flex animate-in fade-in items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 shadow-sm mb-6">
          <div className="flex items-center gap-3">
            <svg className="h-5 w-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-sm font-medium text-amber-800">Student deleted. Undo available for 10 seconds.</p>
          </div>
          <button
            type="button"
            onClick={undoDelete}
            className="rounded-full bg-amber-600 px-5 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-amber-500 active:scale-95"
          >
            Undo
          </button>
        </section>
      ) : null}
      {profileCard ? null : (
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
        {error ? (
          <div className="border-b border-rose-200 bg-rose-50 px-6 py-4 text-sm font-medium text-rose-800" role="alert">
            {error}
          </div>
        ) : null}
        <div className="flex flex-col gap-4 border-b border-slate-100 bg-slate-50/50 px-6 py-5 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
          <div className="min-w-0 shrink-0">
            {title.trim() ? (
              <h2 className="text-xl font-bold tracking-tight text-slate-800">{title}</h2>
            ) : null}
          </div>
          <div className="flex min-w-0 w-full flex-col gap-3 sm:max-w-none sm:flex-1 sm:flex-row sm:flex-wrap sm:items-end sm:justify-end">
            <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:max-w-md">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                {t("toolbar.filter")}
              </span>
              <label className="sr-only" htmlFor="student-search">
                {t("students.searchLabel")}
              </label>
              <div className="relative">
                <svg className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  id="student-search"
                  type="search"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={t("students.searchPlaceholder")}
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-800 shadow-sm outline-none transition-all placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 hover:border-slate-300"
                />
              </div>
              <label className="mt-2 flex items-center gap-2 text-xs font-medium text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={missingStatusOnly}
                  onChange={(e) => {
                    setMissingStatusOnly(e.target.checked);
                    setOffset(0);
                  }}
                />
                Missing student status only
              </label>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                {t("toolbar.sort")}
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  id="student-sort-by"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as StudentSortOption)}
                  className={selectClass}
                  aria-label={t("students.sortBy")}
                >
                  <option value="date">{t("students.sort.admitted")}</option>
                  <option value="id">{t("students.sort.id")}</option>
                  <option value="name">{t("students.sort.name")}</option>
                  <option value="class">{t("students.sort.class")}</option>
                  <option value="custom">Custom</option>
                </select>
                {sortBy === "custom" ? (
                  <>
                    <select
                      value={customSortColumn}
                      onChange={(e) => setCustomSortColumn(e.target.value as CustomSortColumn)}
                      className={selectClass}
                      aria-label="Custom sort column"
                    >
                      <option value="fullName">{t("students.col.name")}</option>
                      <option value="admissionNumber">{t("students.col.admission")}</option>
                      <option value="className">{t("students.col.class")}</option>
                      <option value="sectionName">{t("students.col.section")}</option>
                      <option value="studentStatus">{t("students.modal.studentStatus")}</option>
                      <option value="admittedAt">{t("students.col.admitted")}</option>
                    </select>
                    <input
                      type="text"
                      value={customSortValue}
                      onChange={(e) => setCustomSortValue(e.target.value)}
                      placeholder="Type value for custom sort"
                      className={selectClass}
                      aria-label="Custom sort value"
                    />
                  </>
                ) : null}
                <select
                  id="student-sort-dir"
                  value={sortDir}
                  onChange={(e) => setSortDir(e.target.value as StudentSortDir)}
                  className={selectClass}
                  aria-label={t("students.sortDirection")}
                >
                  <option value="asc">{t("dashboard.expense.sort.az")}</option>
                  <option value="desc">{t("dashboard.expense.sort.za")}</option>
                </select>
                <button
                  type="button"
                  onClick={runSearch}
                  className="rounded-full bg-gradient-to-r from-indigo-600 to-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow-md shadow-indigo-600/20 transition-all hover:from-indigo-500 hover:to-blue-500 hover:shadow-indigo-500/30 focus:ring-4 focus:ring-indigo-600/20 active:scale-95"
                >
                  {t("dashboard.search")}
                </button>
                {canExport ? (
                  <>
                    <select
                      value={exportFormat}
                      onChange={(e) => setExportFormat(e.target.value as ExportFormat)}
                      className={selectClass}
                      aria-label="Select export format"
                    >
                      <option value="excel">Excel</option>
                      <option value="pdf">PDF</option>
                    </select>
                    <button
                      type="button"
                      onClick={handleExport}
                      disabled={exportDisabled}
                      className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:text-indigo-600 focus:ring-4 focus:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-50 active:scale-95"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      {exportLabel}
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        </div>
        <div className="min-w-0 overflow-x-auto">
          <table className="table-fixed w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50/50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                {showDirectoryTools && (
                  <th className="w-14 px-3 py-4 sm:w-16 sm:px-4">{t("students.col.photo")}</th>
                )}
                <th className="w-[11%] px-2 py-4 sm:px-4">{t("students.col.admission")}</th>
                <th className="w-[18%] px-2 py-4 sm:px-4">{t("students.col.name")}</th>
                <th className="w-[12%] px-2 py-4 sm:px-4">{t("students.col.class")}</th>
                <th className="w-[9%] px-2 py-4 sm:px-4">{t("students.col.section")}</th>
                <th className="w-[10%] px-2 py-4 sm:px-4">{t("students.col.status")}</th>
                <th className="w-[11%] px-2 py-4 sm:px-4">{t("students.col.dob")}</th>
                <th className="w-[12%] px-2 py-4 sm:px-4">{t("students.col.admitted")}</th>
                {showDirectoryTools && (
                  <th className="w-[7.5rem] min-w-[7.5rem] px-2 py-4 text-center sm:px-4">
                    {t("students.col.actions")}
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {loading && (
                <tr>
                  <td
                    colSpan={showDirectoryTools ? 9 : 7}
                    className="px-6 py-12 text-center text-sm font-medium text-slate-500"
                  >
                    <div className="flex flex-col items-center justify-center gap-3">
                      <svg className="h-6 w-6 animate-spin text-indigo-500" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      {t("students.loading")}
                    </div>
                  </td>
                </tr>
              )}
              {!loading && items.length === 0 && (
                <tr>
                  <td
                    colSpan={showDirectoryTools ? 9 : 7}
                    className="px-6 py-12 text-center text-sm font-medium text-slate-500"
                  >
                    {t("students.noRecordFound")}
                  </td>
                </tr>
              )}
              {!loading && displayedItems.map((row) => (
                <tr
                  key={row.id}
                  className="group transition-colors hover:bg-slate-50"
                >
                  {showDirectoryTools && (
                    <td className="px-2 py-3 sm:px-4">
                      <div className="h-10 w-10 overflow-hidden rounded-full border-2 border-white bg-slate-100 shadow-sm ring-1 ring-slate-200">
                        <AuthenticatedStudentPhoto
                          studentId={row.id}
                          hasPhoto={row.hasPassportPhoto}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      </div>
                    </td>
                  )}
                  <td className="min-w-0 truncate px-2 py-3 font-mono text-xs font-semibold text-indigo-600 sm:px-4">
                    {row.admissionNumber}
                  </td>
                  <td className="min-w-0 truncate px-2 py-3 text-xs font-bold text-slate-800 sm:px-4 sm:text-sm">
                    {row.fullName}
                  </td>
                  <td className="min-w-0 truncate px-2 py-3 text-xs text-slate-600 sm:px-4 sm:text-sm">
                    {row.className ?? "—"}
                  </td>
                  <td className="min-w-0 truncate px-2 py-3 text-xs text-slate-500 sm:px-4 sm:text-sm">
                    {row.sectionName ?? "—"}
                  </td>
                  <td className="min-w-0 truncate px-2 py-3 text-xs font-medium sm:px-4">
                    {row.studentStatusCode || row.studentStatusName ? (
                      <StudentStatusBadge
                        code={row.studentStatusCode}
                        name={row.studentStatusName}
                        colorHex={
                          feeStatuses.find((s) => s.id === row.studentStatusId)?.colorHex
                        }
                      />
                    ) : (
                      <span className="text-slate-400">{t("students.modal.statusNotSet")}</span>
                    )}
                  </td>
                  <td className="min-w-0 truncate px-2 py-3 text-xs tabular-nums text-slate-500 sm:px-4 sm:text-sm">
                    {row.dateOfBirthFormatted ?? "—"}
                  </td>
                  <td className="min-w-0 truncate px-2 py-3 text-xs tabular-nums text-slate-500 sm:px-4 sm:text-sm">
                    {row.admittedAt}
                  </td>
                  {showDirectoryTools && (
                    <td className="px-2 py-3 sm:px-4">
                      <div className="flex min-w-[7.25rem] items-center justify-center gap-1 sm:gap-1.5">
                        {canView && (
                        <button
                          type="button"
                          className={iconBtn}
                          title={t("students.action.view")}
                          aria-label={t("students.action.view")}
                          onClick={() => openView(row.id)}
                        >
                          <IconView />
                        </button>
                        )}
                        {canEdit && (
                        <button
                          type="button"
                          className={iconBtn}
                          title={t("students.action.edit")}
                          aria-label={t("students.action.edit")}
                          onClick={() => openEdit(row.id)}
                        >
                          <IconEdit />
                        </button>
                        )}
                        {canDelete && (
                        <button
                          type="button"
                          className={`${iconBtn} hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600`}
                          title={t("students.action.delete")}
                          aria-label={t("students.action.delete")}
                          onClick={() => setConfirmDeleteRow(row)}
                        >
                          <IconTrash />
                        </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {items.length < totalItems && (
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={() => setOffset((prev) => prev + limit)}
              disabled={loading}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-8 py-2.5 text-sm font-bold text-slate-600 shadow-sm transition-all hover:bg-slate-50 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <svg className="h-4 w-4 animate-spin text-indigo-500" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Loading...
                </>
              ) : (
                "Load More Students"
              )}
            </button>
          </div>
        )}
      </section>
      )}

      {profileCard ? (
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm animate-in fade-in zoom-in-95">
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-6 py-4">
            <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-800">
              <svg className="h-5 w-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Student Profile Card
            </h3>
            <button
              type="button"
              onClick={() => setProfileCard(null)}
              className="rounded-full bg-slate-100 p-2 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700"
              aria-label="Close profile"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="p-6">
            <div className="flex items-center gap-5 rounded-2xl border border-slate-100 bg-gradient-to-r from-slate-50 to-white p-5 shadow-sm">
              <div className="h-20 w-20 overflow-hidden rounded-full border-4 border-white bg-slate-100 shadow-md">
                <AuthenticatedStudentPhoto
                  studentId={profileCard.id}
                  hasPhoto={profileCard.hasPassportPhoto}
                  alt="Student profile"
                  className="h-full w-full object-cover"
                />
              </div>
              <div>
                <p className="text-2xl font-extrabold text-slate-800">{profileCard.fullName}</p>
                <p className="mt-1 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-indigo-600">
                  <span className="flex h-2 w-2 rounded-full bg-indigo-500"></span>
                  {profileCard.className ?? "Unassigned"} {profileCard.sectionName ? `• ${profileCard.sectionName}` : ""}
                </p>
              </div>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <span className="block text-xs font-semibold uppercase tracking-wider text-slate-500">{t("students.col.admission")}</span>
                <span className="mt-1 block font-mono text-sm font-bold text-slate-800">{profileCard.admissionNumber}</span>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <span className="block text-xs font-semibold uppercase tracking-wider text-slate-500">{t("students.col.dob")}</span>
                <span className="mt-1 block text-sm font-bold text-slate-800">{profileCard.dateOfBirthFormatted ?? "—"}</span>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <span className="block text-xs font-semibold uppercase tracking-wider text-slate-500">{t("students.col.nationality")}</span>
                <span className="mt-1 block text-sm font-bold text-slate-800">{profileCard.nationality ?? "—"}</span>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <span className="block text-xs font-semibold uppercase tracking-wider text-slate-500">{t("students.col.district")}</span>
                <span className="mt-1 block text-sm font-bold text-slate-800">{profileCard.district ?? "—"}</span>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap gap-3 border-t border-slate-100 pt-6">
              {canEdit && (
              <button
                type="button"
                onClick={() => {
                  setModalInitialEdit(true);
                  setModalId(profileCard.id);
                }}
                className="flex items-center gap-2 rounded-full bg-indigo-50 px-6 py-2.5 text-sm font-bold text-indigo-700 transition-colors hover:bg-indigo-100"
              >
                <IconEdit className="h-4 w-4" />
                Edit Student Profile
              </button>
              )}
              {canDelete && (
              <button
                type="button"
                onClick={() => setConfirmDeleteRow(profileCard)}
                className="flex items-center gap-2 rounded-full bg-rose-50 px-6 py-2.5 text-sm font-bold text-rose-700 transition-colors hover:bg-rose-100"
              >
                <IconTrash className="h-4 w-4" />
                Delete Record
              </button>
              )}
            </div>
          </div>
        </section>
      ) : null}

      <StudentDetailModal
        studentId={modalId}
        initialEditing={modalInitialEdit}
        permissions={permissions}
        onClose={() => {
          setModalId(null);
          setModalInitialEdit(false);
        }}
        onChanged={reloadList}
        onSaved={(studentName) => {
          setUpdatedStudentNotice(studentName);
          if (modalId != null && profileCard?.id === modalId) {
            void fetchStudent(modalId).then((row) => setProfileCard(row));
          }
          setModalId(null);
          setModalInitialEdit(false);
        }}
      />
    </>
  );
}
