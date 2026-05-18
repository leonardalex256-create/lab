import { useCallback, useEffect, useState } from "react";
import { fetchFeeComplianceViolations, type FeeComplianceIssueRow } from "../../api/financeStatements";
import { useTermContext } from "../../context/TermContext";

export function FeeComplianceBanner() {
  const { viewingTerm, viewingAcademicYear } = useTermContext();
  const [data, setData] = useState<{
    term: string;
    academicYear?: string;
    count: number;
    items: FeeComplianceIssueRow[];
  } | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const d = await fetchFeeComplianceViolations(viewingTerm, viewingAcademicYear);
      setData(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load fee compliance");
    }
  }, [viewingTerm, viewingAcademicYear]);

  useEffect(() => {
    void load();
    const t = window.setInterval(() => void load(), 45000);
    return () => window.clearInterval(t);
  }, [load]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [load]);

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-900">
        Fee compliance check: {error}
      </div>
    );
  }

  if (!data || data.count === 0) return null;

  const preview = data.items.slice(0, 12);
  const reasonLabel = (r: FeeComplianceIssueRow["reason"]) =>
    r === "missing_assignment" ? "No assignment" : "UGX 0";

  return (
    <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-black text-amber-950">
            {data.count} student{data.count === 1 ? "" : "s"} need a positive fee for {data.term}
            {data.academicYear ? ` (${data.academicYear})` : ""}
          </p>
          <p className="mt-1 text-xs font-semibold text-amber-900/90">
            School policy: every learner must have an amount greater than zero assigned for the current term
            (Settings → General → current term). Admins also receive an in-app notification with the full list.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="shrink-0 rounded-lg border border-amber-400 bg-white px-3 py-1.5 text-xs font-bold text-amber-950 hover:bg-amber-100"
        >
          {expanded ? "Hide list" : "Show list"}
        </button>
      </div>
      {expanded ? (
        <div className="mt-3 max-h-64 overflow-auto rounded-lg border border-amber-200/80 bg-white/90">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-amber-200 bg-amber-100/80 text-[0.65rem] font-bold uppercase tracking-wide text-amber-950">
                <th className="px-2 py-2">Admission</th>
                <th className="px-2 py-2">Name</th>
                <th className="px-2 py-2">Class</th>
                <th className="px-2 py-2">Issue</th>
              </tr>
            </thead>
            <tbody>
              {preview.map((row) => (
                <tr key={`${row.studentId}-${row.term}`} className="border-b border-amber-100">
                  <td className="px-2 py-1.5 font-mono font-semibold text-slate-800">{row.admissionNumber}</td>
                  <td className="px-2 py-1.5 font-medium text-slate-800">{row.fullName}</td>
                  <td className="px-2 py-1.5 text-slate-600">{row.className ?? "—"}</td>
                  <td className="px-2 py-1.5 text-slate-600">{reasonLabel(row.reason)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.items.length > preview.length ? (
            <p className="border-t border-amber-100 px-2 py-2 text-[0.7rem] font-semibold text-amber-900">
              … and {data.items.length - preview.length} more (see Notifications for the full list).
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
