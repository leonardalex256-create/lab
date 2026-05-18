import { useCallback, useEffect, useState } from "react";
import { fetchRecordsSearch, type RecordsSearchPayload } from "../../api/recordsSearch";
import { useTermContext } from "../../context/TermContext";
import { TermYearPicker } from "../admin/TermYearPicker";

export function RecordsSearchPage() {
  const { viewingTerm, viewingAcademicYear } = useTermContext();
  const [q, setQ] = useState("");
  const [submittedQ, setSubmittedQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<RecordsSearchPayload | null>(null);

  const runSearch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchRecordsSearch({
        term: viewingTerm,
        academicYear: viewingAcademicYear,
        q: submittedQ || undefined,
        limit: 40,
      });
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [viewingTerm, viewingAcademicYear, submittedQ]);

  useEffect(() => {
    void runSearch();
  }, [runSearch]);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 space-y-6 duration-500">
      <header className="border-b border-[#ebe4d9]/80 pb-4">
        <h1 className="text-2xl font-black tracking-tight text-[#2d3436]">Search records</h1>
        <p className="mt-1 text-sm font-semibold text-[#636e72]">
          Finance assignments, payments, receipts, and assessment marks for the selected term and year.
        </p>
      </header>

      <div className="neo-card-elevated flex flex-col gap-4 p-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-[#636e72]">Viewing period</p>
          <div className="mt-2">
            <TermYearPicker />
          </div>
        </div>
        <form
          className="flex w-full max-w-xl flex-col gap-2 sm:flex-row sm:items-center"
          onSubmit={(e) => {
            e.preventDefault();
            setSubmittedQ(q.trim());
          }}
        >
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Name or admission number (optional)"
            className="neo-input flex-1 rounded-xl border border-[#ebe4d9] bg-white px-3 py-2 text-sm font-semibold text-[#2d3436]"
          />
          <button
            type="submit"
            className="rounded-xl bg-[#2d3436] px-5 py-2 text-sm font-black text-white shadow-sm transition hover:brightness-110"
          >
            Search
          </button>
        </form>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-900">
          {error}
        </div>
      ) : null}

      {loading && !data ? (
        <p className="text-sm font-semibold text-[#636e72]">Loading…</p>
      ) : data ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="neo-card-elevated overflow-hidden">
            <div className="border-b border-[#ebe4d9]/80 bg-[#faf7f0]/60 px-4 py-3">
              <h2 className="text-sm font-black uppercase tracking-widest text-[#2d3436]">Finance</h2>
            </div>
            <div className="max-h-[28rem] space-y-4 overflow-y-auto p-4 text-sm">
              <div>
                <h3 className="text-xs font-black uppercase tracking-wide text-[#636e72]">Assignments</h3>
                <ul className="mt-2 space-y-1">
                  {data.finance.assignments.length === 0 ? (
                    <li className="text-[#636e72]">No rows</li>
                  ) : (
                    data.finance.assignments.map((x) => (
                      <li key={x.id} className="rounded-lg border border-[#ebe4d9]/80 bg-white/80 px-2 py-1.5">
                        <span className="font-bold text-[#2d3436]">{x.studentName}</span>
                        <span className="text-[#636e72]"> · {x.admissionNumber ?? "—"} · UGX {x.amountDueUgx.toLocaleString()}</span>
                      </li>
                    ))
                  )}
                </ul>
              </div>
              <div>
                <h3 className="text-xs font-black uppercase tracking-wide text-[#636e72]">Payments</h3>
                <ul className="mt-2 space-y-1">
                  {data.finance.payments.length === 0 ? (
                    <li className="text-[#636e72]">No rows</li>
                  ) : (
                    data.finance.payments.map((x) => (
                      <li key={x.id} className="rounded-lg border border-[#ebe4d9]/80 bg-white/80 px-2 py-1.5">
                        <span className="font-bold text-[#2d3436]">{x.studentName}</span>
                        <span className="text-[#636e72]">
                          {" "}
                          · UGX {x.amountPaidUgx.toLocaleString()} · {x.paymentMethod}
                        </span>
                      </li>
                    ))
                  )}
                </ul>
              </div>
              <div>
                <h3 className="text-xs font-black uppercase tracking-wide text-[#636e72]">Receipts</h3>
                <ul className="mt-2 space-y-1">
                  {data.finance.receipts.length === 0 ? (
                    <li className="text-[#636e72]">No rows</li>
                  ) : (
                    data.finance.receipts.map((x) => (
                      <li key={x.id} className="rounded-lg border border-[#ebe4d9]/80 bg-white/80 px-2 py-1.5">
                        <span className="font-bold text-[#2d3436]">{x.receiptNo}</span>
                        <span className="text-[#636e72]">
                          {" "}
                          · {x.studentName} · UGX {x.amountPaidUgx.toLocaleString()}
                        </span>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            </div>
          </section>

          <section className="neo-card-elevated overflow-hidden">
            <div className="border-b border-[#ebe4d9]/80 bg-[#faf7f0]/60 px-4 py-3">
              <h2 className="text-sm font-black uppercase tracking-widest text-[#2d3436]">Academics</h2>
            </div>
            <div className="max-h-[28rem] overflow-y-auto p-4 text-sm">
              <ul className="space-y-1">
                {data.academics.results.length === 0 ? (
                  <li className="text-[#636e72]">No assessment rows</li>
                ) : (
                  data.academics.results.map((x) => (
                    <li key={x.id} className="rounded-lg border border-[#ebe4d9]/80 bg-white/80 px-2 py-1.5">
                      <span className="font-bold text-[#2d3436]">{x.studentName}</span>
                      <span className="text-[#636e72]">
                        {" "}
                        · {x.className ?? "Class"} · {x.examType} · {x.subject}: {x.score}
                      </span>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
