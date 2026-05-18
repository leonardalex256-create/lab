import { useEffect, useState } from "react";
import { type DashboardPayload } from "../api/dashboard";
import { fetchFinanceDashboard } from "../api/financeDashboard";
import { type FinanceDashboardPayload } from "../components/finance/shared/financeTypes";
import { formatCurrencyUGX } from "../components/finance/shared/financeFormat";
import { useI18n } from "../i18n/I18nProvider";
import { useTermContext } from "../context/TermContext";
import { StatCard, DashboardSectionTitle } from "./OverviewShared";

export function AccountantOverview({ dash, loading }: { dash: DashboardPayload | null, loading: boolean }) {
  const { t } = useI18n();
  const { viewingTerm, viewingAcademicYear } = useTermContext();
  const [fin, setFin] = useState<FinanceDashboardPayload | null>(null);
  const [finLoading, setFinLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setFinLoading(true);
    setError(null);
    void fetchFinanceDashboard(viewingTerm, viewingAcademicYear)
      .then((data) => {
        if (!cancelled) setFin(data);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load financial data");
        }
      })
      .finally(() => {
        if (!cancelled) setFinLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [viewingTerm, viewingAcademicYear]);

  if (loading && !dash) {
    return <div className="p-8 text-center animate-pulse text-[#636e72] font-semibold">Loading Financial Dashboard...</div>;
  }

  const today = fin?.today;
  const month = fin?.month;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <DashboardSectionTitle 
        title={t("dashboard.accountantOverview")} 
        subtitle="Daily ledger, collections tracking, and expense summary" 
      />
      {error ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-bold text-amber-900">
          Financial data could not be loaded. {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Today's Income"
          value={formatCurrencyUGX(today?.feesReceived ?? 0)}
          className="bg-gradient-to-br from-[#e8f4e9] to-[#c5e3c8]"
          iconTint="bg-white/40 text-[#2d3436]"
          icon={<span className="text-xl">💰</span>}
        />
        <StatCard
          title="Today's Expenses"
          value={formatCurrencyUGX(today?.expenses ?? 0)}
          className="bg-gradient-to-br from-[#fce8e5] to-[#efd5d2]"
          iconTint="bg-white/40 text-[#2d3436]"
          icon={<span className="text-xl">🧾</span>}
        />
        <StatCard
          title="Daily Net"
          value={formatCurrencyUGX(today?.net ?? 0)}
          className="bg-gradient-to-br from-[#e8f2fa] to-[#c5dff0]"
          iconTint="bg-white/40 text-[#2d3436]"
          icon={<span className="text-xl">⚖️</span>}
        />
        <StatCard
          title="Monthly Net"
          value={formatCurrencyUGX(month?.net ?? 0)}
          className="bg-gradient-to-br from-[#dfe8f5] to-[#a8bdd9]"
          iconTint="bg-white/40 text-[#2d3436]"
          icon={<span className="text-xl">📅</span>}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <section className="neo-card p-5 h-full">
            <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-[#636e72]">Recent Transactions</h3>
            <div className="space-y-3">
              {(fin?.recentTransactions ?? []).map((tr) => (
                <div key={tr.id} className="flex items-center justify-between p-3 rounded-xl bg-[#faf7f0]/60 ring-1 ring-[#ebe4d9]/70 hover:shadow-sm transition">
                  <div className="flex items-center gap-3">
                    <div className={`h-8 w-8 flex items-center justify-center rounded-lg text-xs font-bold ${tr.type === "income" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                      {tr.type === "income" ? "+" : "-"}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[#2d3436]">{tr.label}</p>
                      <p className="text-[10px] font-semibold text-[#636e72]">{tr.method} • {new Date(tr.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
                    </div>
                  </div>
                  <p className={`text-sm font-bold ${tr.type === "income" ? "text-green-600" : "text-red-600"}`}>
                    {tr.type === "income" ? "+" : "-"}{formatCurrencyUGX(tr.amount)}
                  </p>
                </div>
              ))}
              {(fin?.recentTransactions.length === 0) && !finLoading && (
                <p className="text-sm text-[#636e72] italic text-center py-6">No transactions recorded today.</p>
              )}
            </div>
          </section>
        </div>
        
        <div className="space-y-6">
          <section className="neo-card p-5">
            <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-[#636e72]">Payment Methods (Month)</h3>
            <div className="space-y-3">
              {(fin?.month.methodBreakdown ?? []).map((mb) => (
                <div key={mb.method} className="space-y-1">
                  <div className="flex justify-between text-[11px] font-bold">
                    <span className="text-[#636e72] uppercase">{mb.method}</span>
                    <span className="text-[#2d3436]">{formatCurrencyUGX(mb.amount)}</span>
                  </div>
                  <div className="h-2 w-full bg-[#ebe4d9]/50 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-[#6a9570]" 
                      style={{ width: `${(mb.amount / (fin?.month.totalIncome || 1)) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="neo-card p-5 bg-gradient-to-br from-[#f7e8e5] to-[#f5d5cc]/40">
            <h3 className="text-sm font-bold text-[#2d3436] mb-3 uppercase tracking-tight">Accounts Notice</h3>
            <p className="text-xs font-semibold text-[#636e72] leading-relaxed">
              Report for {today?.date} is currently <strong>{today?.reportStatus.replace("_", " ")}</strong>. 
              {today?.reportStatus === "not_submitted" && " Please ensure daily ledger is balanced before submission."}
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
