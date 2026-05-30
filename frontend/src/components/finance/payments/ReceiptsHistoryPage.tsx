import { useCallback, useEffect, useMemo, useState } from "react";
import {
  deleteFinanceReceipt,
  fetchFinanceReceipt,
  fetchFinanceReceipts,
  type FinanceReceiptListItem,
} from "../../../api/financePayments";
import { fetchStudentStatement } from "../../../api/financeStatements";
import type { StudentPaymentReceipt, StudentStatementPayload } from "../shared/financeTypes";
import { StudentReceiptPage } from "./StudentReceiptPage";
import { StudentStatementPage } from "../statements/StudentStatementPage";
import { formatCurrencyUGX } from "../shared/financeFormat";
import { ConfirmModal } from "../shared/ConfirmModal";
import { useTheme } from "../../../theme/ThemeProvider";
import { useTermContext } from "../../../context/TermContext";

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-UG", { day: "2-digit", month: "short", year: "numeric" });
}

export function ReceiptsHistoryPage({ generatedByName }: { generatedByName?: string }) {
  const { viewingTerm, viewingAcademicYear } = useTermContext();
  const { resolvedTheme } = useTheme();
  const isDarkUi = resolvedTheme === "dark" || resolvedTheme === "tinted-dark";

  const [rows, setRows] = useState<FinanceReceiptListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeReceipt, setActiveReceipt] = useState<StudentPaymentReceipt | null>(null);
  const [activeStatement, setActiveStatement] = useState<StudentStatementPayload | null>(null);
  const [openingId, setOpeningId] = useState<number | null>(null);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const PAGE_SIZE = 50;
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    description: string;
    variant: "danger" | "warning" | "info";
    onConfirm: () => void;
  } | null>(null);

  const loadRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchFinanceReceipts(PAGE_SIZE, {
        offset: (page - 1) * PAGE_SIZE,
        term: viewingTerm,
        academicYear: viewingAcademicYear,
      });
      setRows(res.items);
      setTotalCount(res.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load receipts.");
    } finally {
      setLoading(false);
    }
  }, [PAGE_SIZE, page, viewingTerm, viewingAcademicYear]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

   useEffect(() => {
    // If the header global search asked to open a specific receipt, do it once on mount.
    try {
      const raw = sessionStorage.getItem("globalSearch.openReceiptId");
      if (!raw) return;
      const id = Number(raw);
      if (!Number.isFinite(id) || id <= 0) return;
      sessionStorage.removeItem("globalSearch.openReceiptId");
      void openReceipt(id, false);
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setPage(1);
  }, [viewingTerm, viewingAcademicYear]);

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      return (
        row.studentName.toLowerCase().includes(q) ||
        row.receiptNo.toLowerCase().includes(q) ||
        (row.className ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, searchQuery]);

  const hasRows = useMemo(() => rows.length > 0, [rows.length]);
  const totalPages = Math.max(1, Math.ceil((totalCount || 0) / PAGE_SIZE));

  const openReceipt = async (id: number, shouldPrint = false) => {
    setOpenMenuId(null);
    setOpeningId(id);
    try {
      const receipt = await fetchFinanceReceipt(id);
      setActiveReceipt(receipt);
      if (shouldPrint) window.setTimeout(() => window.print(), 150);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open receipt.");
    } finally {
      setOpeningId(null);
    }
  };

  const openStatement = async (row: FinanceReceiptListItem) => {
    setOpenMenuId(null);
    setOpeningId(row.id);
    try {
      const statement = await fetchStudentStatement(row.studentId, row.term, row.academicYear);
      setActiveStatement(statement);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open statement.");
    } finally {
      setOpeningId(null);
    }
  };

  const deleteReceiptRow = async (row: FinanceReceiptListItem) => {
    setOpenMenuId(null);
    setConfirmModal({
      title: "Delete receipt",
      description: `Delete receipt ${row.receiptNo} for ${row.studentName}? This will remove the saved payment record.`,
      variant: "danger",
      onConfirm: () => {
        setConfirmModal(null);
        void (async () => {
          setOpeningId(row.id);
          try {
            await deleteFinanceReceipt(row.id);
            await loadRows();
          } catch (e) {
            setError(e instanceof Error ? e.message : "Could not delete receipt.");
          } finally {
            setOpeningId(null);
          }
        })();
      },
    });
  };

  if (activeReceipt) {
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="flex flex-wrap items-center justify-between gap-4 print:hidden">
          <button
            type="button"
            onClick={() => setActiveReceipt(null)}
            className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-black transition-all hover:-translate-x-1 ${
              isDarkUi ? "border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700" : "border-slate-100 bg-white text-slate-500 hover:bg-slate-50"
            }`}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Registry
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#0c2340] to-[#1a3a5c] px-6 py-2.5 text-xs font-black text-white shadow-xl shadow-[#0c2340]/20 transition-all hover:-translate-y-0.5 active:translate-y-0"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print Receipt
          </button>
        </div>
        <StudentReceiptPage
          receipt={{
            ...activeReceipt,
            generatedByName:
              (activeReceipt.generatedByName ??
              generatedByName?.trim()) ||
              "Account User",
          }}
        />
      </div>
    );
  }

  if (activeStatement) {
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="flex flex-wrap items-center justify-between gap-4 print:hidden">
          <button
            type="button"
            onClick={() => setActiveStatement(null)}
            className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-black transition-all hover:-translate-x-1 ${
              isDarkUi ? "border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700" : "border-slate-100 bg-white text-slate-500 hover:bg-slate-50"
            }`}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Registry
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#0c2340] to-[#1a3a5c] px-6 py-2.5 text-xs font-black text-white shadow-xl shadow-[#0c2340]/20 transition-all hover:-translate-y-0.5 active:translate-y-0"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print Statement
          </button>
        </div>
        <StudentStatementPage statement={activeStatement} />
      </div>
    );
  }

  return (
    <div className={`neo-card overflow-hidden rounded-3xl border shadow-sm transition-all duration-500 ${
      isDarkUi ? "bg-slate-900 border-slate-700" : "bg-white border-slate-100"
    }`}>
      <div className={`border-b px-8 py-6 flex items-center justify-between ${isDarkUi ? "border-slate-800" : "border-slate-50"}`}>
        <div>
          <h3 className={`text-lg font-black ${isDarkUi ? "text-white" : "text-[#0c2340]"}`}>Payment History Registry</h3>
          <p className="mt-1 text-xs font-medium text-slate-500 uppercase tracking-widest">
            Digital Audit Trail · Showing {filteredRows.length} of {rows.length} receipts
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search receipts..."
              className="neo-inset-field w-full max-w-sm rounded-xl pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-[#5a8faf]/50"
            />
          </div>
          <div className="h-10 w-10 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center text-xl">🧾</div>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
           <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-500 border-t-transparent" />
           <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Loading Secure Records</p>
        </div>
      ) : error ? (
        <div className="px-8 py-12 text-center">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center text-2xl mb-4">⚠️</div>
          <p className="text-sm font-bold text-rose-500">{error}</p>
        </div>
      ) : !hasRows ? (
        <div className="px-8 py-24 text-center">
          <div className="mx-auto h-16 w-16 rounded-3xl bg-slate-50 flex items-center justify-center text-3xl mb-6">📭</div>
          <p className="text-sm font-bold text-slate-400">No payment receipts found in the current registry.</p>
        </div>
      ) : (
        <div className="overflow-x-auto custom-scrollbar">
          <table className="min-w-full border-collapse text-left">
            <thead>
              <tr className={`${isDarkUi ? "bg-slate-800/50 text-slate-400" : "bg-slate-50/50 text-slate-500"}`}>
                <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest">Receipt No.</th>
                <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest">Student / Payer</th>
                <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-right">Amount</th>
                <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest">Status</th>
                <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest">Issue Date</th>
                <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-center">Actions</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDarkUi ? "divide-slate-800" : "divide-slate-50"}`}>
              {filteredRows.map((row) => {
                const busy = openingId === row.id;
                return (
                  <tr key={row.id} className="group transition-colors hover:bg-slate-50/50">
                    <td className={`px-8 py-5 font-black text-xs tabular-nums ${isDarkUi ? "text-teal-400" : "text-teal-700"}`}>
                      #{row.receiptNo}
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex flex-col">
                        <span className={`text-sm font-bold ${isDarkUi ? "text-slate-200" : "text-[#0c2340]"}`}>{row.studentName}</span>
                        <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">{row.className || "—"}</span>
                      </div>
                    </td>
                    <td className={`px-8 py-5 text-sm font-black tabular-nums text-right ${isDarkUi ? "text-slate-200" : "text-[#0c2340]"}`}>
                      {formatCurrencyUGX(row.amountPaid)}
                    </td>
                    <td className="px-8 py-5">
                      {row.isVoided === true ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-rose-700">
                          <span className="h-1 w-1 rounded-full bg-rose-500" />
                          Voided
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-700">
                          <span className="h-1 w-1 rounded-full bg-emerald-500" />
                          Settled
                        </span>
                      )}
                    </td>
                    <td className="px-8 py-5 text-xs font-semibold text-slate-500 tabular-nums">
                      {formatDate(row.issuedAt)}
                    </td>
                    <td className="px-8 py-5">
                      <div className="relative flex justify-center">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => setOpenMenuId((current) => (current === row.id ? null : row.id))}
                          className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 ${
                            isDarkUi ? "border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700" : "border-slate-100 bg-white text-slate-500 hover:bg-slate-50 shadow-sm"
                          }`}
                        >
                          {busy ? "Opening..." : "Manage"}
                          <svg className={`h-3 w-3 transition-transform duration-300 ${openMenuId === row.id ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        
                        {openMenuId === row.id && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
                            <div className={`absolute right-0 top-full z-20 mt-2 w-48 overflow-hidden rounded-2xl border p-1 shadow-2xl animate-in zoom-in-95 duration-200 ${
                              isDarkUi ? "bg-slate-900 border-slate-700 shadow-slate-950" : "bg-white border-slate-100 shadow-slate-200"
                            }`}>
                              <MenuBtn icon="👁️" label="View Receipt" onClick={() => void openReceipt(row.id, false)} isDarkUi={isDarkUi} />
                              <MenuBtn icon="🖨️" label="Print Document" onClick={() => void openReceipt(row.id, true)} isDarkUi={isDarkUi} />
                              <MenuBtn icon="📜" label="Account Statement" onClick={() => void openStatement(row)} isDarkUi={isDarkUi} />
                              <div className="my-1 border-t border-slate-100" />
                              <MenuBtn icon="🗑️" label="Revoke Receipt" onClick={() => void deleteReceiptRow(row)} danger isDarkUi={isDarkUi} />
                            </div>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !error && hasRows ? (
        <div className="flex items-center justify-between px-8 py-4 border-t border-slate-50">
          <div className="text-xs font-bold text-slate-400">
            Page {page} of {totalPages} · {totalCount} receipts total
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-xl border border-slate-100 bg-white px-5 py-2 text-xs font-black text-slate-500 hover:bg-slate-50 disabled:opacity-40"
            >
              Prev
            </button>
            <button
              type="button"
              disabled={page * PAGE_SIZE >= totalCount}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-xl border border-slate-100 bg-white px-5 py-2 text-xs font-black text-slate-500 hover:bg-slate-50 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}

      <ConfirmModal
        open={!!confirmModal}
        title={confirmModal?.title ?? ""}
        description={confirmModal?.description ?? ""}
        variant={confirmModal?.variant ?? "danger"}
        loading={openingId != null}
        onConfirm={confirmModal?.onConfirm ?? (() => undefined)}
        onCancel={() => setConfirmModal(null)}
      />
    </div>
  );
}

function MenuBtn({ icon, label, onClick, danger = false, isDarkUi }: { 
  icon: string; 
  label: string; 
  onClick: () => void; 
  danger?: boolean;
  isDarkUi: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[11px] font-bold transition-all ${
        danger 
          ? "text-rose-500 hover:bg-rose-50" 
          : isDarkUi ? "text-slate-300 hover:bg-slate-800" : "text-slate-600 hover:bg-slate-50"
      }`}
    >
      <span className="text-sm">{icon}</span>
      {label}
    </button>
  );
}
