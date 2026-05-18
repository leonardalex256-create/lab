import { useEffect, useMemo, useState } from "react";
import { fetchStudents, type StudentApiRow } from "../../api/students";
import { useI18n } from "../../i18n/I18nProvider";

type ParentStudentRow = {
  key: string;
  childName: string;
  admissionNumber: string;
  className: string;
  sectionName: string;
  parentAliveStatus: string;
  parentFullName: string;
  parentPhone: string;
  parentEmail: string;
  parentAddress: string;
  guardianName: string;
  guardianPhone: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
};

export function ParentsSectionPage() {
  const { t } = useI18n();
  const [items, setItems] = useState<StudentApiRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetchStudents({ limit: 200, sortBy: "name", sortDir: "asc" })
      .then((response) => {
        if (!cancelled) setItems(response.items);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const rows = useMemo<ParentStudentRow[]>(() => {
    const statusLabel = (v: StudentApiRow["parentAliveStatus"]): string => {
      if (v === "both") return "Both parents alive";
      if (v === "one") return "One parent alive";
      if (v === "none") return "No parent alive (guardian care)";
      return "—";
    };
    return items.map((s) => ({
      key: String(s.id),
      childName: s.fullName,
      admissionNumber: s.admissionNumber,
      className: s.className ?? "—",
      sectionName: s.sectionName ?? "—",
      parentAliveStatus: statusLabel(s.parentAliveStatus),
      parentFullName: s.parentFullName ?? "—",
      parentPhone: s.parentPhone ?? "—",
      parentEmail: s.parentEmail ?? "—",
      parentAddress: s.parentAddress ?? "—",
      guardianName: s.guardianName ?? "—",
      guardianPhone: s.guardianPhone ?? "—",
      emergencyContactName: s.emergencyContactName ?? "—",
      emergencyContactPhone: s.emergencyContactPhone ?? "—",
    }));
  }, [items]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.childName.toLowerCase().includes(q) ||
        r.admissionNumber.toLowerCase().includes(q),
    );
  }, [rows, query]);

  return (
    <section className="neo-card overflow-hidden">
      <div className="border-b border-[#ebe4d9]/80 px-4 py-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-[#2d3436]">
          {t("students.parents.tableTitle")}
        </h2>
        <p className="mt-1 text-xs text-[#636e72]">{t("students.parents.tableHint")}</p>
        <div className="mt-3 max-w-md">
          <label htmlFor="parents-search" className="mb-1 block text-xs font-semibold text-[#636e72]">
            {t("students.parents.searchLabel")}
          </label>
          <input
            id="parents-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("students.parents.searchPlaceholder")}
            className="neo-inset-field w-full rounded-xl px-3 py-2 text-sm text-[#2d3436] placeholder:text-[#636e72]/80"
          />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1550px] text-left text-sm">
          <thead className="border-b border-[#ebe4d9]/80 bg-[#faf7f0]/80 text-xs uppercase tracking-wide text-[#636e72]">
            <tr>
              <th className="px-4 py-3">{t("students.parents.col.childName")}</th>
              <th className="px-4 py-3">{t("students.parents.col.admissionNumbers")}</th>
              <th className="px-4 py-3">{t("students.col.class")}</th>
              <th className="px-4 py-3">{t("students.col.section")}</th>
              <th className="px-4 py-3">{t("students.parents.col.parentStatus")}</th>
              <th className="px-4 py-3">{t("students.parents.col.parentName")}</th>
              <th className="px-4 py-3">{t("students.parents.col.phone")}</th>
              <th className="px-4 py-3">{t("students.col.parentEmail")}</th>
              <th className="px-4 py-3">{t("students.parents.col.parentAddress")}</th>
              <th className="px-4 py-3">{t("students.parents.col.guardianName")}</th>
              <th className="px-4 py-3">{t("students.parents.col.guardianPhone")}</th>
              <th className="px-4 py-3">{t("students.parents.col.emergencyName")}</th>
              <th className="px-4 py-3">{t("students.parents.col.emergencyPhone")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#ebe4d9]/70">
            {loading ? (
              <tr>
                <td colSpan={13} className="px-4 py-8 text-center text-sm text-[#636e72]">
                  {t("students.loading")}
                </td>
              </tr>
            ) : null}
            {!loading && error ? (
              <tr>
                <td colSpan={13} className="px-4 py-8 text-center text-sm text-rose-700">
                  {error}
                </td>
              </tr>
            ) : null}
            {!loading && !error && filteredRows.length === 0 ? (
              <tr>
                <td colSpan={13} className="px-4 py-8 text-center text-sm text-[#636e72]">
                  {query.trim() ? t("students.noMatches") : t("students.empty")}
                </td>
              </tr>
            ) : null}
            {!loading && !error
              ? filteredRows.map((row) => (
                  <tr key={row.key}>
                    <td className="px-4 py-3 text-xs font-semibold text-[#2d3436]">{row.childName}</td>
                    <td className="px-4 py-3 text-xs font-mono text-[#5a8faf]">
                      {row.admissionNumber}
                    </td>
                    <td className="px-4 py-3 text-xs text-[#636e72]">{row.className}</td>
                    <td className="px-4 py-3 text-xs text-[#636e72]">{row.sectionName}</td>
                    <td className="px-4 py-3 text-xs text-[#636e72]">{row.parentAliveStatus}</td>
                    <td className="px-4 py-3 text-xs text-[#2d3436]">{row.parentFullName}</td>
                    <td className="px-4 py-3 text-xs text-[#636e72]">{row.parentPhone}</td>
                    <td className="px-4 py-3 text-xs text-[#636e72]">{row.parentEmail}</td>
                    <td className="px-4 py-3 text-xs text-[#636e72]">{row.parentAddress}</td>
                    <td className="px-4 py-3 text-xs text-[#2d3436]">{row.guardianName}</td>
                    <td className="px-4 py-3 text-xs text-[#636e72]">{row.guardianPhone}</td>
                    <td className="px-4 py-3 text-xs text-[#2d3436]">{row.emergencyContactName}</td>
                    <td className="px-4 py-3 text-xs text-[#636e72]">{row.emergencyContactPhone}</td>
                  </tr>
                ))
              : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
