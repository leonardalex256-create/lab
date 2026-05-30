import { formatCurrencyUGX, formatYmdToLabel } from "../shared/financeFormat";
import type { StudentStatementPayload } from "../shared/financeTypes";
import { useTheme } from "../../../theme/ThemeProvider";

export function StudentStatementPage({ statement }: { statement: StudentStatementPayload }) {
  const { resolvedTheme } = useTheme();
  const isDarkUi = resolvedTheme === "dark" || resolvedTheme === "tinted-dark";

  return (
    <section className={`relative mx-auto max-w-5xl overflow-hidden rounded-[2.5rem] border p-8 shadow-2xl transition-all sm:p-12 print:shadow-none print:border-slate-200 print:rounded-none ${isDarkUi ? "bg-slate-900 border-slate-700 shadow-slate-950/50" : "bg-white border-slate-100 shadow-slate-200/50"
      }`}>
      {/* Premium Watermark */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.03] print:opacity-[0.05]">
        <div className="flex flex-col items-center">
          <span className="text-[8rem] font-black tracking-tighter [transform:rotate(-25deg)]">STATEMENT</span>
          <span className="text-[3rem] font-black uppercase tracking-[1.5em] mt-[-2rem] [transform:rotate(-25deg)] text-slate-500">OFFICIAL</span>
        </div>
      </div>

      <div className="relative z-10">
        {/* Document Header */}
        <header className="flex flex-col sm:flex-row items-start justify-between gap-8 border-b pb-10 border-dashed border-slate-200">
          <div className="flex items-center gap-6">
            <div className={`h-24 w-24 shrink-0 overflow-hidden rounded-3xl border p-2 shadow-sm ${isDarkUi ? "bg-slate-800 border-slate-700" : "bg-white border-slate-100"}`}>
              <img src="/school-badge-v2.png" alt="School Badge" className="h-full w-full object-contain" />
            </div>
            <div>
              <h1 className={`text-2xl font-black tracking-tight leading-none ${isDarkUi ? "text-white" : "text-[#0c2340]"}`}>
                QUEENS NURSERY & PRIMARY SCHOOL
              </h1>
              <p className="mt-2 text-xs font-bold uppercase tracking-widest text-teal-600">Financial Account Statement</p>
              <div className="mt-4 space-y-1 text-[11px] font-medium text-slate-500">
                <p>Kitebi Star, After Trading Centre, Kampala</p>
                <p>P.O. BOX 9107 | queensprimaryschool13@gmail.com</p>
                <p>+256 782 333 908 · +256 750 775 572</p>
              </div>
            </div>
          </div>

          <div className="text-right sm:w-48">
            <div className={`inline-block rounded-2xl px-5 py-3 border-2 ${isDarkUi ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-100"}`}>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Academic Cycle</p>
              <p className={`text-xl font-black tabular-nums ${isDarkUi ? "text-teal-400" : "text-teal-700"}`}>{statement.term}</p>
            </div>
            <p className="mt-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Report Generated: {new Date().toLocaleDateString("en-UG", { day: '2-digit', month: 'short', year: 'numeric' })}
            </p>
          </div>
        </header>

        {/* Account Holder Profile */}
        <div className={`mt-10 rounded-3xl p-6 border flex flex-col sm:flex-row items-center gap-6 ${isDarkUi ? "bg-slate-800/30 border-slate-700" : "bg-slate-50/50 border-slate-100"}`}>
          <div className={`h-14 w-14 rounded-2xl flex items-center justify-center text-2xl shadow-sm ${isDarkUi ? "bg-slate-800 text-teal-400" : "bg-white text-teal-600"}`}>👤</div>
          <div className="flex-1 text-center sm:text-left">
            <h3 className={`text-lg font-black ${isDarkUi ? "text-white" : "text-[#0c2340]"}`}>{statement.student.fullName}</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Admission Registry: {statement.student.admissionNumber}</p>
          </div>
        </div>

        {statement.lineItems && statement.lineItems.length > 0 ? (
          <div className={`mt-8 overflow-hidden rounded-[2rem] border ${isDarkUi ? "border-slate-800" : "border-slate-100 shadow-sm"}`}>
            <div className={`px-8 py-4 text-[10px] font-black uppercase tracking-[0.2em] border-b ${isDarkUi ? "bg-slate-800/50 text-slate-400 border-slate-700" : "bg-slate-50 text-slate-500 border-slate-100"}`}>
              Fee breakdown by category
            </div>
            <table className="w-full text-sm">
              <tbody>
                {statement.lineItems.map((li) => (
                  <tr key={li.feeCategoryId} className={`border-b ${isDarkUi ? "border-slate-800" : "border-slate-100"}`}>
                    <td className="px-8 py-2 font-medium">{li.feeCategoryName}</td>
                    <td className="px-8 py-2 text-right font-mono text-xs text-slate-500">{li.feeCategoryCode}</td>
                    <td className="px-8 py-2 text-right font-bold">{formatCurrencyUGX(li.amountUgx)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {/* Financial Dashboard */}
        <div className="mt-8 grid gap-4 sm:grid-cols-4">
          <SummaryCard label="Assigned Fees" value={formatCurrencyUGX(statement.assignedAmount)} type="base" isDarkUi={isDarkUi} />
          <SummaryCard label="Total Settlements" value={formatCurrencyUGX(statement.totalPaid)} type="success" isDarkUi={isDarkUi} />
          <SummaryCard label="Arrears Balance" value={formatCurrencyUGX(statement.outstandingAmount)} type="danger" isDarkUi={isDarkUi} />
          <SummaryCard label="Account Credit" value={formatCurrencyUGX(statement.creditAmount)} type="warning" isDarkUi={isDarkUi} />
        </div>

        {/* Transaction History */}
        <div className={`mt-10 overflow-hidden rounded-[2rem] border ${isDarkUi ? "border-slate-800" : "border-slate-100 shadow-sm"}`}>
          <div className={`px-8 py-4 text-[10px] font-black uppercase tracking-[0.2em] border-b ${isDarkUi ? "bg-slate-800/50 text-slate-400 border-slate-700" : "bg-slate-50 text-slate-500 border-slate-100"
            }`}>
            Transaction History Ledger
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className={`${isDarkUi ? "bg-slate-800/20 text-slate-500" : "bg-slate-50/30 text-slate-400"}`}>
                  <th className="px-8 py-3 text-[9px] font-black uppercase tracking-widest">Date</th>
                  <th className="px-8 py-3 text-[9px] font-black uppercase tracking-widest">Doc Ref</th>
                  <th className="px-8 py-3 text-[9px] font-black uppercase tracking-widest">Method</th>
                  <th className="px-8 py-3 text-[9px] font-black uppercase tracking-widest">Paid By</th>
                  <th className="px-8 py-3 text-[9px] font-black uppercase tracking-widest text-right">Amount Paid</th>
                  <th className="px-8 py-3 text-[9px] font-black uppercase tracking-widest text-right">Balance</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDarkUi ? "divide-slate-800" : "divide-slate-50"}`}>
                {statement.transactions.map((tx) => (
                  <tr key={tx.id} className="group transition-colors hover:bg-slate-50/5">
                    <td className="px-8 py-4 font-semibold text-slate-500 tabular-nums">
                      {formatYmdToLabel(String(tx.date).slice(0, 10))}
                    </td>
                    <td className={`px-8 py-4 font-black tabular-nums ${isDarkUi ? "text-teal-400" : "text-teal-700"}`}>
                      #{tx.receiptNo}
                    </td>
                    <td className="px-8 py-4 text-xs font-medium text-slate-400 italic">{tx.method}</td>
                    <td className="px-8 py-4 text-xs font-bold text-slate-500">{tx.paidBy}</td>
                    <td className="px-8 py-4 text-right font-black tabular-nums text-emerald-600">
                      {formatCurrencyUGX(tx.amountPaid)}
                    </td>
                    <td className={`px-8 py-4 text-right font-black tabular-nums ${isDarkUi ? "text-slate-200" : "text-[#0c2340]"}`}>
                      {formatCurrencyUGX(tx.runningBalance)}
                    </td>
                  </tr>
                ))}
                {statement.transactions.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-8 py-12 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <span className="text-2xl opacity-20">📭</span>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No transaction flow recorded for this term</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-16 pt-10 border-t border-slate-200 text-center">
          <p className="text-sm font-black tracking-tight text-slate-400 italic">
            "Build For The Future"
          </p>
          <p className="mt-3 text-[9px] font-medium text-slate-400 uppercase tracking-[0.4em]">
            This statement shows your transaction history and account balance as of this date.
          </p>
        </footer>
      </div>
    </section>
  );
}

function SummaryCard({ label, value, type, isDarkUi }: {
  label: string;
  value: string;
  type: 'success' | 'danger' | 'warning' | 'base';
  isDarkUi: boolean;
}) {
  const styles = {
    base: isDarkUi ? "bg-slate-800/40 border-slate-700 text-slate-400" : "bg-slate-50 border-slate-100 text-slate-500",
    success: isDarkUi ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" : "bg-emerald-50 border-emerald-100 text-emerald-600",
    danger: isDarkUi ? "bg-rose-500/10 border-rose-500/20 text-rose-500" : "bg-rose-50 border-rose-100 text-rose-600",
    warning: isDarkUi ? "bg-amber-500/10 border-amber-500/20 text-amber-500" : "bg-amber-50 border-amber-100 text-amber-600",
  };

  return (
    <div className={`rounded-3xl border px-6 py-5 flex flex-col justify-between h-full transition-all hover:-translate-y-1 ${styles[type]}`}>
      <p className="text-[9px] font-black uppercase tracking-widest opacity-70 mb-2">{label}</p>
      <p className="text-base font-black tabular-nums tracking-tight leading-none">{value}</p>
    </div>
  );
}
