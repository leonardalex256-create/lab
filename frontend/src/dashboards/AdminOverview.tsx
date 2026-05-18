import { useEffect, useMemo, useState } from "react";
import { type DashboardPayload } from "../api/dashboard";
import { fetchFinanceDashboard } from "../api/financeDashboard";
import { fetchMessages, type InboxMessageApiItem } from "../api/inbox";
import { type FinanceDashboardPayload } from "../components/finance/shared/financeTypes";
import { formatCurrencyUGX } from "../components/finance/shared/financeFormat";
import { EventScheduleCard, LiveClock, OverviewErrorBanner, StatCard } from "./OverviewShared";

function TreasuryFlowChart({ transactions, net }: { transactions: FinanceDashboardPayload["recentTransactions"]; net: number }) {
  const { earningsSeries, expenditureSeries, earningsTotal, expenditureTotal } = useMemo(() => {
    const ordered = [...transactions].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );

    const earnings: number[] = [0];
    const expenditures: number[] = [0];
    let runningEarnings = 0;
    let runningExpenditure = 0;

    for (const item of ordered) {
      if (item.type === "income") {
        runningEarnings += item.amount;
      } else {
        runningExpenditure += item.amount;
      }
      earnings.push(runningEarnings);
      expenditures.push(runningExpenditure);
    }

    if (earnings.length < 2) {
      earnings.push(0, 0, 0, 0);
      expenditures.push(0, 0, 0, 0);
    }

    return {
      earningsSeries: earnings,
      expenditureSeries: expenditures,
      earningsTotal: runningEarnings,
      expenditureTotal: runningExpenditure,
    };
  }, [transactions]);

  const max = Math.max(...earningsSeries, ...expenditureSeries, 1) * 1.1;
  const min = 0;
  const range = max - min || 1;
  const width = 800;
  const height = 240;

  const stepX = width / Math.max(earningsSeries.length - 1, 1);
  const earningsCoords = earningsSeries.map((val, i) => [
    i * stepX,
    height - ((val - min) / range) * height,
  ]);
  const expenditureCoords = expenditureSeries.map((val, i) => [
    i * stepX,
    height - ((val - min) / range) * height,
  ]);

  const earningsLinePath = earningsCoords
    .map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x} ${y}`)
    .join(" ");
  const expenditureLinePath = expenditureCoords
    .map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x} ${y}`)
    .join(" ");
  const earningsAreaPath = `${earningsLinePath} L ${width} ${height} L 0 ${height} Z`;
  const expenditureAreaPath = `${expenditureLinePath} L ${width} ${height} L 0 ${height} Z`;

  const netDelta = earningsTotal - expenditureTotal;
  const isUp = netDelta >= 0;
  const trendPct = Math.abs((netDelta / Math.max(earningsTotal, 1)) * 100);

  return (
    <section className="flex h-full flex-col rounded-3xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md sm:p-5">
      <div className="flex justify-between items-start mb-2">
        <div>
          <h2 className="border-b border-slate-100 pb-2 text-sm font-semibold text-slate-800">Treasury Flow</h2>
          <p className="mt-2 text-2xl font-black text-slate-800 tracking-tight">{formatCurrencyUGX(net)}</p>
          <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-wide">
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">
              Earnings: {formatCurrencyUGX(earningsTotal)}
            </span>
            <span className="rounded-full bg-rose-50 px-2.5 py-1 text-rose-700">
              Expenditures: {formatCurrencyUGX(expenditureTotal)}
            </span>
          </div>
        </div>
        <div className={`text-xs font-bold ${isUp ? "text-emerald-600" : "text-amber-600"}`}>
          {isUp ? "▲+" : "▼-"}
          {trendPct.toFixed(1)}%
        </div>
      </div>

      <div className="mt-4 flex min-h-[160px] flex-1 items-end justify-center rounded-2xl border border-slate-100 bg-slate-50 p-4 overflow-hidden relative">
        <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="w-full h-[180px] mt-auto">
          <defs>
            <linearGradient id="earnings-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.02" />
            </linearGradient>
            <linearGradient id="expenses-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          <path d={earningsAreaPath} fill="url(#earnings-fill)" />
          <path d={expenditureAreaPath} fill="url(#expenses-fill)" />
          <path
            d={earningsLinePath}
            fill="none"
            stroke="#10b981"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="drop-shadow-sm transition-all duration-300"
          />
          <path
            d={expenditureLinePath}
            fill="none"
            stroke="#f59e0b"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="drop-shadow-sm transition-all duration-300"
          />
          {earningsCoords.map(([x, y], i) => (
            <circle key={`e-${i}`} cx={x} cy={y} r="3.5" fill="#ffffff" stroke="#10b981" strokeWidth="2" />
          ))}
          {expenditureCoords.map(([x, y], i) => (
            <circle key={`x-${i}`} cx={x} cy={y} r="3.5" fill="#ffffff" stroke="#f59e0b" strokeWidth="2" />
          ))}
        </svg>
      </div>
    </section>
  );
}

export function AdminOverview({
  dash,
  loading,
  onOpenRecordsSearch,
  onOpenHistoricalRecords,
}: {
  dash: DashboardPayload | null;
  loading: boolean;
  onOpenRecordsSearch?: () => void;
  onOpenHistoricalRecords?: () => void;
}) {
  const [fin, setFin] = useState<FinanceDashboardPayload | null>(null);
  const [messages, setMessages] = useState<InboxMessageApiItem[]>([]);
  const [finError, setFinError] = useState<string | null>(null);
  const [messagesError, setMessagesError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setFinError(null);
    setMessagesError(null);

    void fetchFinanceDashboard()
      .then((data) => {
        if (!cancelled) setFin(data);
      })
      .catch((e) => {
        if (!cancelled) setFinError(e instanceof Error ? e.message : "Failed to load financial summary");
      });

    void fetchMessages()
      .then((data) => {
        if (!cancelled) setMessages(data);
      })
      .catch((e) => {
        if (!cancelled) setMessagesError(e instanceof Error ? e.message : "Failed to load inbox messages");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading && !dash) {
    return (
      <div className="p-8 text-center animate-pulse text-[#636e72] font-semibold">Loading Admin's Dashboard...</div>
    );
  }

  const s = dash?.stats;
  const today = fin?.today;
  const recentTransactions = fin?.recentTransactions ?? [];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {finError ? (
        <div className="mb-4">
          <OverviewErrorBanner message={finError} />
        </div>
      ) : null}
      {messagesError ? (
        <div className="mb-4">
          <OverviewErrorBanner message={messagesError} />
        </div>
      ) : null}

      {/* Header Area */}
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-800">
            Admin's Dashboard
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-500">
            Administrator's Oversight Terminal
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {onOpenRecordsSearch ? (
            <button
              type="button"
              onClick={onOpenRecordsSearch}
              className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-black text-indigo-950 shadow-sm transition hover:bg-indigo-100"
            >
              Search records
            </button>
          ) : null}
          {onOpenHistoricalRecords ? (
            <button
              type="button"
              onClick={onOpenHistoricalRecords}
              className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-2.5 text-sm font-black text-sky-950 shadow-sm transition hover:bg-sky-100"
            >
              Historical records
            </button>
          ) : null}
          <LiveClock />
        </div>
      </header>

      {/* Primary KPI Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Students"
          value={String(s?.totalStudents ?? "—")}
          className="border-l-4 border-l-blue-500"
          iconTint="bg-blue-50 text-blue-600"
          icon={<span className="text-xl">🎓</span>}
        />
        <StatCard
          title="Total Staff"
          value={String(s?.totalTeachers ?? "—")}
          className="border-l-4 border-l-emerald-500"
          iconTint="bg-emerald-50 text-emerald-600"
          icon={<span className="text-xl">👨‍🏫</span>}
        />
        <StatCard
          title="Today's Income"
          value={formatCurrencyUGX(today?.feesReceived ?? 0)}
          className="border-l-4 border-l-indigo-500"
          iconTint="bg-indigo-50 text-indigo-600"
          icon={<span className="text-xl">💰</span>}
        />
        <StatCard
          title="Today's Expenses"
          value={formatCurrencyUGX(today?.expenses ?? 0)}
          className="border-l-4 border-l-rose-500"
          iconTint="bg-rose-50 text-rose-600"
          icon={<span className="text-xl">🧾</span>}
        />
      </div>

      {/* Main Grid Floor */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left Column: Chart & Messages */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <TreasuryFlowChart transactions={recentTransactions} net={fin?.month?.net ?? 0} />

          {/* Notifications Feed */}
          <div className="flex min-h-[250px] flex-1 flex-col rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
            <h3 className="border-b border-slate-100 pb-2 text-sm font-semibold text-slate-800 mb-4 uppercase tracking-wider">
              Feed
            </h3>

            <div className="flex-1 overflow-y-auto pr-2 space-y-3">
              {messages.map((m) => (
                <div key={m.id} className={`p-4 rounded-2xl border transition-all ${m.read ? "bg-slate-50/50 border-slate-100" : "bg-indigo-50/50 shadow-sm border-indigo-100 relative"}`}>
                  {!m.read && <div className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 bg-indigo-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(99,102,241,0.8)]"></div>}
                  <div className="flex justify-between items-start mb-1 gap-2">
                    <h4 className={`text-sm font-bold ${m.read ? "text-slate-500" : "text-slate-800"}`}>{m.title}</h4>
                    <span className="text-[10px] text-slate-400 font-mono tracking-wider whitespace-nowrap">{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">{m.body}</p>
                </div>
              ))}
              {messages.length === 0 && (
                <div className="h-full flex items-center justify-center text-slate-500 italic text-sm py-10">
                  No active secured messages.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Ledger Summary & Calendar */}
        <div className="flex flex-col gap-6">

          {/* Daily Ledger Status */}
          <div className="flex flex-col rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
            <h3 className="border-b border-slate-100 pb-2 text-sm font-semibold text-slate-800 mb-4 uppercase tracking-wider flex items-center gap-2">
              <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              Ledger View
            </h3>

            <div className="space-y-4">
              <div className="flex justify-between items-end border-b border-slate-100 pb-3">
                <span className="text-xs font-bold tracking-widest text-slate-500 uppercase">Closing Net</span>
                <span className={`text-xl font-black ${today && today.net >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                  {formatCurrencyUGX(today?.net ?? 0)}
                </span>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block mb-2">Vault Status</span>
                {today?.reportStatus === "verified_and_banked" ? (
                  <div className="bg-emerald-50 text-emerald-800 text-xs font-bold px-3 py-2 rounded-xl border border-emerald-200 shadow-sm flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_5px_currentColor]"></span> BANKED & SECURED
                  </div>
                ) : today?.reportStatus === "submitted_for_verification" ? (
                  <div className="bg-indigo-50 text-indigo-800 text-xs font-bold px-3 py-2 rounded-xl border border-indigo-200 shadow-sm flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_5px_currentColor]"></span> AWAITING ADMIN REVIEW
                  </div>
                ) : (
                  <div className="bg-amber-50 text-amber-800 text-xs font-bold px-3 py-2 rounded-xl border border-amber-200 shadow-sm flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_5px_currentColor]"></span> UNRESOLVED OPEN BALANCE
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex-1 min-h-[280px]">
            <EventScheduleCard calendar={dash?.calendar ?? null} />
          </div>
        </div>

      </div>
    </div>
  );
}
