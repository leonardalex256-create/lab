import { useEffect, useMemo, useState } from "react";
import { AdmissionImportTable } from "./AdmissionImportTable";
import { NewAdmissionForm } from "./NewAdmissionForm";
import { ParentsSectionPage } from "./ParentsSectionPage";
import { StudentsListPanel } from "./StudentsListPanel";
import { fetchStudents, type StudentApiRow } from "../../api/students";
import { useI18n } from "../../i18n/I18nProvider";

export type StudentNavSection =
  | "overview"
  | "all"
  | "admissions"
  | "profiles"
  | "import"
  | "parents";

export function StudentsSectionPage({
  section,
  classNameFilter = null,
  onChangeSection,
  permissions,
}: {
  section: StudentNavSection;
  classNameFilter?: string | null;
  onChangeSection?: (value: StudentNavSection) => void;
  /** User permissions array — when provided, gates edit/delete/export in child components. Omit for admin (all allowed). */
  permissions?: string[];
}) {
  const { t } = useI18n();
  const [listRefresh, setListRefresh] = useState(0);
  const [overviewRows, setOverviewRows] = useState<StudentApiRow[]>([]);
  const [overviewLoading, setOverviewLoading] = useState(false);

  useEffect(() => {
    if (section !== "overview") return;
    let cancelled = false;
    setOverviewLoading(true);
    void fetchStudents({ sortBy: "date", sortDir: "desc", limit: 200 })
      .then((data) => {
        if (!cancelled) {
          setOverviewRows(data.items);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setOverviewRows([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setOverviewLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [section, listRefresh]);

  const overviewStats = useMemo(() => {
    const rows = classNameFilter
      ? overviewRows.filter(
          (row) =>
            (row.className ?? "").trim().toLowerCase() ===
            classNameFilter.trim().toLowerCase(),
        )
      : overviewRows;
    const parentEmails = new Set(
      rows.map((row) => row.parentEmail?.trim().toLowerCase()).filter(Boolean),
    );
    const classNames = new Set(
      rows.map((row) => row.className?.trim()).filter(Boolean),
    );
    const newAdmissions = rows.filter((row) =>
      ["new_admission", "first"].includes(row.registrationType.toLowerCase()),
    ).length;
    return {
      totalStudents: rows.length,
      totalParents: parentEmails.size,
      totalClasses: classNames.size,
      newAdmissions,
      recentStudents: rows.slice(0, 6),
    };
  }, [overviewRows, classNameFilter]);

  if (section === "overview") {
    const cards: Array<{
      key: Exclude<StudentNavSection, "all">;
      title: string;
      desc: string;
      icon: string;
      color: string;
    }> = [
      {
        key: "admissions",
        title: t("students.page.admissionsTitle"),
        desc: "Register new learners and capture admission details.",
        icon: "📝",
        color: "from-[#eef2f7] to-[#e0e7f1]",
      },
      {
        key: "profiles",
        title: t("students.page.profilesTitle"),
        desc: "Open learner records and review individual profiles.",
        icon: "🎓",
        color: "from-[#f5fbf8] to-[#e8f5ed]",
      },
      {
        key: "import",
        title: t("students.page.importTitle"),
        desc: "Bulk import admissions into the student register.",
        icon: "📥",
        color: "from-[#fff9f4] to-[#ffeadb]",
      },
      {
        key: "parents",
        title: t("students.page.parentsTitle"),
        desc: "Review parents and guardians linked to each learner.",
        icon: "👨‍👩‍👧",
        color: "from-[#fff5f5] to-[#ffe8e8]",
      },
    ];

    return (
      <div className="min-w-0 space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
        <header className="flex flex-col gap-2 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-2xl text-indigo-600 shadow-inner ring-1 ring-indigo-100">
              🏫
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-800">
                Student Command Center
              </h1>
              <p className="mt-1 text-sm font-medium text-slate-500">
                Centralized hub for enrollment management, student profiles, and parent directory operations.
              </p>
            </div>
          </div>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StudentStatCard
            label="Total Students"
            value={overviewLoading ? "..." : String(overviewStats.totalStudents)}
            tone="blue"
          />
          <StudentStatCard
            label="Parents / Guardians"
            value={overviewLoading ? "..." : String(overviewStats.totalParents)}
            tone="green"
          />
          <StudentStatCard
            label="Active Classes"
            value={overviewLoading ? "..." : String(overviewStats.totalClasses)}
            tone="amber"
          />
          <StudentStatCard
            label="New Admissions"
            value={overviewLoading ? "..." : String(overviewStats.newAdmissions)}
            tone="rose"
          />
        </section>

        <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((card) => (
            <button
              key={card.key}
              type="button"
              onClick={() => onChangeSection?.(card.key)}
              className="group relative flex flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-2xl shadow-inner ring-1 ring-slate-100 transition-colors group-hover:bg-indigo-50 group-hover:ring-indigo-100">
                <span role="img" aria-label={card.title}>
                  {card.icon}
                </span>
              </div>
              <h2 className="text-base font-bold text-slate-800 transition-colors group-hover:text-indigo-600">
                {card.title}
              </h2>
              <p className="mt-2 text-xs leading-relaxed text-slate-500">
                {card.desc}
              </p>
              <div className="mt-4 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-indigo-600 opacity-0 transition-opacity group-hover:opacity-100">
                Open Module
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </div>
            </button>
          ))}
        </section>

        <section>
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
            <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">
                Recent Student Admissions
              </h2>
              <p className="mt-0.5 text-xs font-medium text-slate-500">
                Review and manage newly registered learner profiles.
              </p>
            </div>
            {overviewLoading ? (
              <div className="flex h-40 items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
              </div>
            ) : overviewStats.recentStudents.length === 0 ? (
              <div className="px-6 py-12 text-center text-sm text-slate-500 italic">
                No recent admissions records found.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {overviewStats.recentStudents.map((student) => (
                  <div
                    key={student.id}
                    className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 transition-colors hover:bg-slate-50/50 group"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">
                        {student.fullName}
                      </p>
                      <p className="mt-0.5 text-xs font-medium text-slate-500">
                        {student.admissionNumber} · {student.className || "No class"} ·{" "}
                        {student.sectionName || "No section"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onChangeSection?.("profiles")}
                      className="rounded-xl border border-slate-200 bg-white px-5 py-2 text-xs font-bold text-slate-600 shadow-sm transition-all hover:bg-slate-50 hover:text-indigo-600 hover:border-indigo-200"
                    >
                      Open Full Profile
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-6">
      {section === "admissions" ? (
        <NewAdmissionForm onCreated={() => setListRefresh((k) => k + 1)} />
      ) : section === "import" ? (
        <AdmissionImportTable onDone={() => setListRefresh((k) => k + 1)} />
      ) : section === "parents" ? (
        <ParentsSectionPage />
      ) : (
        <StudentsListPanel
          limit={500}
          showDirectoryTools
          refreshKey={listRefresh}
          classNameFilter={classNameFilter}
          title=""
          permissions={permissions}
        />
      )}
    </div>
  );
}

function StudentStatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "blue" | "green" | "amber" | "rose";
}) {
  const toneMap = {
    blue: "bg-blue-50 text-blue-600 ring-blue-100",
    green: "bg-emerald-50 text-emerald-600 ring-emerald-100",
    amber: "bg-amber-50 text-amber-600 ring-amber-100",
    rose: "bg-rose-50 text-rose-600 ring-rose-100",
  };

  return (
    <div className="flex items-center gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className={`flex h-12 w-12 items-center justify-center rounded-2xl text-xl shadow-inner ring-1 ${toneMap[tone]}`}>
        {tone === "blue" ? "👥" : tone === "green" ? "👨‍👩‍👧" : tone === "amber" ? "🏫" : "📝"}
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-black tracking-tight text-slate-800">
          {value}
        </p>
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</p>
      </div>
    </div>
  );
}

