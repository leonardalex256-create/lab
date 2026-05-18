import { useEffect, useMemo, useState } from "react";
import { fetchFinanceDashboard } from "../../../api/financeDashboard";
import { useTermContext } from "../../../context/TermContext";
import { formatCurrencyUGX } from "../shared/financeFormat";
import { formatShortAgo } from "../../../utils/formatShortAgo";
import type { FinanceDashboardPayload } from "../shared/financeTypes";

export function FinanceOverviewPage() {
  const { viewingAcademicYear, systemAcademicYear } = useTermContext();
  const financeMonth = useMemo(() => {
    const y = Number(viewingAcademicYear);
    const sy = Number(systemAcademicYear);
    const now = new Date();
    if (Number.isFinite(y) && Number.isFinite(sy) && y === sy && y === now.getFullYear()) {
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    }
    if (Number.isFinite(y)) return `${y}-12`;
    return undefined;
  }, [viewingAcademicYear, systemAcademicYear]);

  const [data, setData] = useState<FinanceDashboardPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void fetchFinanceDashboard(financeMonth)
      .then((next) => {
        if (!cancelled) setData(next);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load dashboard");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [financeMonth]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#5a8faf] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {error ? (
        <div className="rounded-xl bg-red-50 p-4 border border-red-100">
          <p className="text-sm font-semibold text-[#b84040]">{error}</p>
        </div>
      ) : null}

      {/* Primary Metrics */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Fees Received Today"
          value={formatCurrencyUGX(data?.today.feesReceived ?? 0)}
          icon="💰"
          trend="Positive"
          color="blue"
        />
        <MetricCard
          label="Today's Expenses"
          value={formatCurrencyUGX(data?.today.expenses ?? 0)}
          icon="💸"
          trend="Neutral"
          color="orange"
        />
        <MetricCard
          label="Daily Net Balance"
          value={formatCurrencyUGX(data?.today.net ?? 0)}
          icon="📊"
          trend={ (data?.today.net ?? 0) >= 0 ? "Positive" : "Negative" }
          color={(data?.today.net ?? 0) >= 0 ? "green" : "red"}
        />
        <MetricCard
          label="Report Status"
          value={data?.today.reportStatus.replace("_", " ") ?? "Not Submitted"}
          icon="📄"
          color="purple"
          isStatus
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Monthly Summary & Arrears */}
        <div className="lg:col-span-1 space-y-6">
          <section className="flex flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4">Monthly Summary ({data?.month.key})</h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-500">Total Income</span>
                  <span className="font-bold text-slate-800">{formatCurrencyUGX(data?.month.totalIncome ?? 0)}</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: "100%" }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-500">Total Expenses</span>
                  <span className="font-bold text-slate-800">{formatCurrencyUGX(data?.month.totalExpenses ?? 0)}</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-rose-500 rounded-full" 
                    style={{ width: `${Math.min(((data?.month.totalExpenses ?? 0) / (data?.month.totalIncome || 1)) * 100, 100)}%` }} 
                  />
                </div>
              </div>
              <div className="pt-4 border-t border-slate-100 mt-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold text-slate-800">Net Profit</span>
                  <span className={`text-lg font-black ${ (data?.month.net ?? 0) >= 0 ? "text-emerald-600" : "text-rose-600" }`}>
                    {formatCurrencyUGX(data?.month.net ?? 0)}
                  </span>
                </div>
              </div>
            </div>
          </section>

          <section className="flex flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4 flex items-center gap-2">
              <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Payroll & Arrears
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-500">Monthly Payroll</span>
                <span className="text-sm font-bold text-slate-800">{formatCurrencyUGX(data?.payroll.totalPayroll ?? 0)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-500">Paid to Date</span>
                <span className="text-sm font-bold text-emerald-600">{formatCurrencyUGX(data?.payroll.paidToDate ?? 0)}</span>
              </div>
              <div className="flex justify-between items-center pt-3 border-t border-slate-100">
                <span className="text-sm font-bold text-slate-800">Unpaid Arrears</span>
                <span className="text-lg font-black text-rose-600">{formatCurrencyUGX(data?.payroll.arrears ?? 0)}</span>
              </div>
            </div>
          </section>

          <section className="flex flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4">Income by Method</h3>
            <div className="space-y-3">
              {(data?.month.methodBreakdown ?? []).map((mb) => (
                <div key={mb.method} className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-semibold text-slate-500">{mb.method}</span>
                      <span className="text-slate-800 font-bold">{formatCurrencyUGX(mb.amount)}</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full">
                      <div 
                        className="h-full bg-indigo-400 rounded-full" 
                        style={{ width: `${(mb.amount / (data?.month.totalIncome || 1)) * 100}%` }} 
                      />
                    </div>
                  </div>
                </div>
              ))}
              {(!data?.month.methodBreakdown || data.month.methodBreakdown.length === 0) && (
                <p className="text-xs text-slate-500 italic text-center py-2">No income recorded this month</p>
              )}
            </div>
          </section>
        </div>

        {/* Recent Transactions */}
        <div className="lg:col-span-2">
          <section className="flex flex-col h-full overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
            <header className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">Recent Financial Activities</h3>
              <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold uppercase ring-1 ring-indigo-200">Live Sync</span>
            </header>
            <div className="flex-1 overflow-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100">
                    <th className="px-6 py-3">Type</th>
                    <th className="px-6 py-3">Reference/Entity</th>
                    <th className="px-6 py-3">Method</th>
                    <th className="px-6 py-3">Time</th>
                    <th className="px-6 py-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data?.recentTransactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="px-6 py-4">
                        <span className={`inline-flex h-2 w-2 rounded-full mr-2 ${tx.type === "income" ? "bg-emerald-500" : "bg-rose-500"}`} />
                        <span className="text-[10px] font-bold uppercase text-slate-500">{tx.type}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-bold text-slate-800 truncate max-w-[180px]">{tx.label}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs text-slate-500">{tx.method}</span>
                      </td>
                      <td className="px-6 py-4 text-xs tabular-nums text-slate-500">
                        {formatShortAgo(tx.date)}
                      </td>
                      <td className={`px-6 py-4 text-right text-sm font-black tabular-nums ${tx.type === "income" ? "text-emerald-600" : "text-rose-600"}`}>
                        {tx.type === "income" ? "+" : "-"}{formatCurrencyUGX(tx.amount)}
                      </td>
                    </tr>
                  ))}
                  {(!data?.recentTransactions || data.recentTransactions.length === 0) && (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-sm text-slate-500 italic">
                        No recent transactions found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <footer className="px-6 py-3 bg-slate-50/50 border-t border-slate-100 text-center">
              <button 
                className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 hover:underline transition"
                title="Navigate to the complete financial ledger"
              >View Full Ledger</button>
            </footer>
          </section>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ 
  label, 
  value, 
  icon, 
  trend, 
  color,
  isStatus = false 
}: { 
  label: string; 
  value: string; 
  icon: string;
  trend?: "Positive" | "Negative" | "Neutral";
  color: "blue" | "orange" | "green" | "red" | "purple";
  isStatus?: boolean;
}) {
  const colorMap = {
    blue: "border-l-4 border-l-blue-500 bg-white hover:bg-blue-50/30",
    orange: "border-l-4 border-l-amber-500 bg-white hover:bg-amber-50/30",
    green: "border-l-4 border-l-emerald-500 bg-white hover:bg-emerald-50/30",
    red: "border-l-4 border-l-rose-500 bg-white hover:bg-rose-50/30",
    purple: "border-l-4 border-l-indigo-500 bg-white hover:bg-indigo-50/30",
  };

  return (
    <div className={`rounded-3xl border border-slate-200 ${colorMap[color]} p-5 relative overflow-hidden group shadow-sm hover:shadow-md transition-shadow`}>
      <div className="absolute top-[-10px] right-[-10px] opacity-10 text-6xl group-hover:scale-110 transition-transform grayscale">
        {icon}
      </div>
      <div className="flex items-center gap-3 mb-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-lg shadow-sm ring-1 ring-slate-100" role="img" aria-label={label}>{icon}</span>
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
      </div>
      <p className={`text-2xl font-black ${isStatus ? "text-slate-800" : "text-slate-800"}`}>{value}</p>
      
      {trend && (
        <div className="mt-3 flex items-center gap-1.5 overflow-hidden">
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
            trend === "Positive" ? "bg-emerald-100 text-emerald-700" : 
            trend === "Negative" ? "bg-rose-100 text-rose-700" : 
            "bg-slate-100 text-slate-700"
          }`}>
            {trend}
          </span>
          <div className="flex-1 h-[1px] bg-slate-100" />
        </div>
      )}
    </div>
  );
}
