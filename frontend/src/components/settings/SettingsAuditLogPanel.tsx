import { Fragment, useState, useEffect, useRef } from "react";
import { apiUrl, authHeaders } from "../../api/baseUrl";
import { PanelHeader, LoadingSpinner } from "./shared";

interface AuditLogRow {
  id: number;
  created_at: string;
  action: string;
  entity: string;
  entity_id?: number;
  entity_label?: string;
  severity: "info" | "warning" | "critical";
  channel: "web" | "api" | "import" | "system";
  session_id?: string;
  ip_address?: string;
  duration_ms?: number;
  old_value?: unknown;
  new_value?: unknown;
  metadata?: unknown;
  user_id?: number;
  user_email: string;
  user_display: string;
  user_role?: string;
}

const SEVERITY_STYLES: Record<string, string> = {
  info: "bg-blue-100 text-blue-700",
  warning: "bg-amber-100 text-amber-700",
  critical: "bg-red-100 text-red-700",
};

const CHANNEL_STYLES: Record<string, string> = {
  web: "bg-slate-100 text-slate-600",
  api: "bg-purple-100 text-purple-700",
  import: "bg-teal-100 text-teal-700",
  system: "bg-orange-100 text-orange-700",
};

function JsonBlock({ label, value }: { label: string; value: unknown }) {
  const [open, setOpen] = useState(false);
  if (!value) return null;
  const str = JSON.stringify(value, null, 2);
  return (
    <div className="text-xs">
      <button onClick={() => setOpen((v) => !v)} className="font-semibold text-slate-600 underline decoration-dotted hover:text-blue-600">
        {open ? "▾" : "▸"} {label}
      </button>
      {open && (
        <pre className="mt-1 bg-slate-900 text-emerald-300 rounded-lg p-3 overflow-x-auto text-xs whitespace-pre-wrap max-h-48 overflow-y-auto">
          {str}
        </pre>
      )}
    </div>
  );
}

export function SettingsAuditLogPanel() {
  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 50, total: 0, pages: 1 });
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [filters, setFilters] = useState({
    date_from: new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10),
    date_to: new Date().toISOString().slice(0, 10),
    severity: "",
    channel: "",
    action: "",
    search: "",
    session_id: "",
  });
  const [page, setPage] = useState(1);
  const [availableActions, setAvailableActions] = useState<string[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    let cancelled = false;
    debounceRef.current = window.setTimeout(() => {
      void (async () => {
        setLoading(true);
        const params = new URLSearchParams({ page: String(page), limit: "50" });
        for (const [k, v] of Object.entries(filters)) {
          if (v) params.set(k, v);
        }
        try {
          const res = await fetch(apiUrl(`/api/me/settings/audit-log?${params}`), { headers: authHeaders() });
          const json = await res.json();
          if (!cancelled && json.success) {
            setRows(json.data ?? []);
            setMeta(json.meta ?? { page: 1, limit: 50, total: 0, pages: 1 });
            if (json.filters?.actions?.length) {
              setAvailableActions((json.filters.actions as Array<{ action: string }>).map((a) => a.action));
            }
          }
        } catch {
          /* ignore */
        }
        if (!cancelled) setLoading(false);
      })();
    }, 400);
    return () => {
      cancelled = true;
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [filters, page]);

  const toggleExpand = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const filterBySession = (sessionId: string) => {
    setFilters((f) => ({ ...f, session_id: sessionId }));
  };

  return (
    <div className="space-y-5">
      <PanelHeader
        icon={<span aria-hidden>📋</span>}
        title="Audit Log"
        description={`All system activity — ${meta.total.toLocaleString()} events`}
        action={
          <button
            type="button"
            disabled
            title="Export coming soon"
            className="cursor-not-allowed rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-400 opacity-60 shadow-sm"
          >
            Export Excel
          </button>
        }
      />

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
        <div className="flex flex-wrap gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">From</label>
            <input type="date" value={filters.date_from}
              onChange={(e) => setFilters((f) => ({ ...f, date_from: e.target.value }))}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">To</label>
            <input type="date" value={filters.date_to}
              onChange={(e) => setFilters((f) => ({ ...f, date_to: e.target.value }))}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Severity</label>
            <select value={filters.severity} onChange={(e) => setFilters((f) => ({ ...f, severity: e.target.value }))}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">All</option>
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="critical">Critical</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Channel</label>
            <select value={filters.channel} onChange={(e) => setFilters((f) => ({ ...f, channel: e.target.value }))}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">All</option>
              <option value="web">Web</option>
              <option value="api">API</option>
              <option value="import">Import</option>
              <option value="system">System</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Action</label>
            <select value={filters.action} onChange={(e) => setFilters((f) => ({ ...f, action: e.target.value }))}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">All actions</option>
              {availableActions.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-semibold text-slate-500 mb-1">Search</label>
            <input placeholder="User, entity, action…" value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          {filters.session_id && (
            <div className="flex items-end">
              <button onClick={() => setFilters((f) => ({ ...f, session_id: "" }))}
                className="px-3 py-1.5 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg text-xs font-medium">
                Session: {filters.session_id.slice(0, 8)}… ✕
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <LoadingSpinner label="Loading audit log" />
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                {["Timestamp", "User", "Action", "Entity", "Severity", "Channel", "IP", ""].map((h) => (
                  <th key={h} scope="col" className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <Fragment key={row.id}>
                  <tr className={`hover:bg-slate-50 transition-colors border-b border-slate-50 ${expanded.has(row.id) ? "bg-blue-50/50" : ""}`}>
                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                      {new Date(row.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800 text-xs">{row.user_display}</div>
                      <div className="text-xs text-slate-400">{row.user_role ?? ""}</div>
                    </td>
                    <td className="px-4 py-3 text-xs font-mono font-medium text-slate-700">{row.action}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      <div>{row.entity}</div>
                      {row.entity_label && <div className="text-slate-400 truncate max-w-[120px]">{row.entity_label}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${SEVERITY_STYLES[row.severity] ?? ""}`}>
                        {row.severity}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${CHANNEL_STYLES[row.channel] ?? ""}`}>
                        {row.channel}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400 font-mono">{row.ip_address ?? "—"}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => toggleExpand(row.id)}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium whitespace-nowrap">
                        Details {expanded.has(row.id) ? "▲" : "▶"}
                      </button>
                    </td>
                  </tr>
                  {expanded.has(row.id) ? (
                    <tr className="bg-blue-50/30 border-b border-slate-100">
                      <td colSpan={8} className="px-6 py-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <JsonBlock label="Old Value" value={row.old_value} />
                          <JsonBlock label="New Value" value={row.new_value} />
                          <JsonBlock label="Metadata" value={row.metadata} />
                        </div>
                        <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-500">
                          {row.session_id && (
                            <button onClick={() => filterBySession(row.session_id!)}
                              className="underline decoration-dotted hover:text-blue-600">
                              Session: {row.session_id.slice(0, 12)}…
                            </button>
                          )}
                          {row.duration_ms != null && <span>Duration: {row.duration_ms}ms</span>}
                          {row.entity_id && <span>Entity ID: {row.entity_id}</span>}
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={8} className="py-12 text-center text-slate-400">No audit events found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {meta.pages > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>Showing {((page - 1) * meta.limit) + 1}–{Math.min(page * meta.limit, meta.total)} of {meta.total.toLocaleString()}</span>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50">← Prev</button>
            <button disabled={page >= meta.pages} onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50">Next →</button>
          </div>
        </div>
      )}
    </div>
  );
}
