import { useEffect, useMemo, useRef, useState } from "react";
import {
  applyFeeStructure,
  fetchFeeStructure,
  type FeeStructureRow,
} from "../../api/financeFeeStructure";
import { formatCurrencyUGX } from "../finance/shared/financeFormat";
import { Toast, UnsavedBar, LoadingSpinner } from "./shared";

/* ── local row state ────────────────────────────────────── */
type RowState = {
  status: string;
  label: string;
  amountDueUgx: string;
  notes: string;
};

const TERM_OPTIONS = ["Term 1", "Term 2", "Term 3"];

/* ── colour accents per card index ──────────────────────── */
const ACCENT_COLORS = [
  { gradient: "from-[#0ea5e9] to-[#2563eb]", bg: "bg-[#eff6ff]", ring: "ring-[#bfdbfe]", icon: "🏫" },
  { gradient: "from-[#f59e0b] to-[#d97706]", bg: "bg-[#fffbeb]", ring: "ring-[#fde68a]", icon: "☀️" },
  { gradient: "from-[#10b981] to-[#059669]", bg: "bg-[#ecfdf5]", ring: "ring-[#a7f3d0]", icon: "🌿" },
  { gradient: "from-[#8b5cf6] to-[#6d28d9]", bg: "bg-[#f5f3ff]", ring: "ring-[#c4b5fd]", icon: "🎓" },
  { gradient: "from-[#ec4899] to-[#be185d]", bg: "bg-[#fdf2f8]", ring: "ring-[#fbcfe8]", icon: "📋" },
  { gradient: "from-[#14b8a6] to-[#0d9488]", bg: "bg-[#f0fdfa]", ring: "ring-[#99f6e4]", icon: "📖" },
];

function accentFor(idx: number) {
  return ACCENT_COLORS[idx % ACCENT_COLORS.length];
}

function toSlug(name: string): string {
  return `custom_${name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/(^_|_$)/g, "")}`;
}

/** Internal row key stored as boarding_status — must match for student fee matching (e.g. day_half). */
function normalizeStatusKeyInput(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

function toRows(items: FeeStructureRow[]): RowState[] {
  return items.map((x) => ({
    status: x.status,
    label: x.label,
    amountDueUgx: String(x.amountDueUgx),
    notes: x.notes ?? "",
  }));
}


/* ── MAIN COMPONENT ─────────────────────────────────────── */
export function SettingsFeesStructurePanel() {
  const [term, setTerm] = useState("Term 1");
  const [rows, setRows] = useState<RowState[]>([]);
  const [deletedStatuses, setDeletedStatuses] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newStatusKey, setNewStatusKey] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [dirty, setDirty] = useState(false);
  const originalRef = useRef<string>("");

  /* fetch on term change */
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setToast(null);
    setDirty(false);
    setDeletedStatuses([]);
    void fetchFeeStructure(term)
      .then((items) => {
        if (!cancelled) {
          const r = toRows(items);
          setRows(r);
          originalRef.current = JSON.stringify(r);
        }
      })
      .catch((e) => {
        if (!cancelled) setToast({ message: e instanceof Error ? e.message : "Failed to load", type: "error" });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [term]);

  /* dirty tracking */
  useEffect(() => {
    if (!originalRef.current) return;
    if (JSON.stringify(rows) !== originalRef.current || deletedStatuses.length > 0) {
      setDirty(true);
    } else {
      setDirty(false);
    }
  }, [rows, deletedStatuses]);

  /* computed totals */
  const previewTotal = useMemo(
    () =>
      rows.reduce((sum, row) => {
        const n = Number(row.amountDueUgx);
        return Number.isFinite(n) && n > 0 ? sum + Math.round(n) : sum;
      }, 0),
    [rows],
  );

  const categoryCount = rows.length;

  /* row helpers */
  function updateRow(status: string, patch: Partial<RowState>) {
    setRows((prev) => prev.map((row) => (row.status === status ? { ...row, ...patch } : row)));
  }

  function removeFeeRow(status: string) {
    setRows((prev) => prev.filter((r) => r.status !== status));
    setDeletedStatuses((prev) => [...prev, status]);
    setDirty(true);
  }

  function addFeeCategory() {
    const name = newName.trim();
    if (!name && !newStatusKey.trim()) {
      setToast({ message: "Enter a display name or an internal status key.", type: "error" });
      return;
    }
    const slug = newStatusKey.trim() ? normalizeStatusKeyInput(newStatusKey) : toSlug(name);
    if (!slug) {
      setToast({ message: "Internal status key is invalid.", type: "error" });
      return;
    }
    const label = name || slug.replace(/_/g, " ");
    if (rows.some((r) => r.status === slug)) {
      setToast({ message: `A row with status "${slug}" already exists.`, type: "error" });
      return;
    }
    const amount = Number(newAmount) || 0;
    setRows((prev) => [
      ...prev,
      { status: slug, label, amountDueUgx: String(Math.round(amount)), notes: "" },
    ]);
    setNewName("");
    setNewStatusKey("");
    setNewAmount("");
    setShowAddForm(false);
    setDirty(true);
  }

  function discardChanges() {
    if (originalRef.current) {
      setRows(JSON.parse(originalRef.current) as RowState[]);
      setDeletedStatuses([]);
      setDirty(false);
    }
  }

  /* apply */
  async function onApply() {
    setSaving(true);
    setToast(null);
    try {
      const payloadItems = rows.map((row) => {
        const amount = Math.round(Number(row.amountDueUgx));
        if (!Number.isFinite(amount) || amount < 0) {
          throw new Error(`Enter a valid amount for "${row.label}"`);
        }
        return {
          status: row.status,
          label: row.label,
          amountDueUgx: amount,
          notes: row.notes.trim() || null,
        };
      });
      const res = await applyFeeStructure({
        term,
        items: payloadItems,
        deleteStatuses: deletedStatuses.join(","),
      });
      setToast({
        message: `Applied successfully. Updated ${res.updatedAssignments} student fee assignments for ${term}.`,
        type: "success",
      });
      originalRef.current = JSON.stringify(rows);
      setDirty(false);
      setDeletedStatuses([]);
    } catch (e) {
      setToast({ message: e instanceof Error ? e.message : "Failed to apply", type: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="relative space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-500">
      {/* ── HEADER ──────────────────────────────────────────── */}
      <header className="neo-card overflow-hidden">
        {/* gradient accent bar at top */}
        <div className="h-1.5 bg-gradient-to-r from-[#0ea5e9] via-[#8b5cf6] to-[#ec4899]" />
        <div className="p-6 sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="flex items-center gap-3 text-2xl font-black tracking-tight text-[#1e293b]">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#0ea5e9] to-[#6366f1] text-lg text-white shadow-lg">
                  💰
                </span>
                Fees Structure
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#64748b]">
                Add fee categories per term (nothing is pre-filled). Use internal keys such as{" "}
                <code className="rounded bg-slate-100 px-1 font-mono text-xs">day_half</code>,{" "}
                <code className="rounded bg-slate-100 px-1 font-mono text-xs">day_full</code>,{" "}
                <code className="rounded bg-slate-100 px-1 font-mono text-xs">day_full_p7</code>, or{" "}
                <code className="rounded bg-slate-100 px-1 font-mono text-xs">boarding</code> so amounts align with student boarding status.
              </p>
            </div>

            {/* term selector */}
            <div className="flex items-center gap-1 rounded-2xl bg-[#f1f5f9] p-1 ring-1 ring-[#e2e8ef]">
              {TERM_OPTIONS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTerm(t)}
                  className={`rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all duration-200 ${
                    term === t
                      ? "bg-white text-[#0ea5e9] shadow-md ring-1 ring-[#bfdbfe]"
                      : "text-[#64748b] hover:text-[#1e293b] hover:bg-white/50"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* stats row */}
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="flex items-center gap-3 rounded-2xl bg-gradient-to-br from-[#eff6ff] to-[#dbeafe] p-4 ring-1 ring-[#bfdbfe]/50">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm">
                <span className="text-lg">💵</span>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#3b82f6]">Total Configured</p>
                <p className="text-lg font-black text-[#1e40af]">{formatCurrencyUGX(previewTotal)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-2xl bg-gradient-to-br from-[#f0fdf4] to-[#dcfce7] p-4 ring-1 ring-[#bbf7d0]/50">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm">
                <span className="text-lg">🏷️</span>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#16a34a]">Categories</p>
                <p className="text-lg font-black text-[#166534]">{categoryCount}</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── CARDS GRID ──────────────────────────────────────── */}
      {loading ? (
        <LoadingSpinner label="Loading fee structure" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((row, idx) => {
            const accent = accentFor(idx);
            return (
              <div
                key={row.status}
                className={`neo-card group relative overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-xl animate-in fade-in slide-in-from-bottom-2`}
                style={{ animationDelay: `${idx * 60}ms`, animationFillMode: "backwards" }}
              >
                {/* accent strip */}
                <div className={`h-1.5 bg-gradient-to-r ${accent.gradient}`} />

                <div className="p-5">
                  {/* card header */}
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span
                        className={`flex h-9 w-9 items-center justify-center rounded-xl ${accent.bg} text-base ring-1 ${accent.ring}`}
                      >
                        {accent.icon}
                      </span>
                      <div>
                        <h3 className="text-sm font-bold text-[#1e293b]">{row.label}</h3>
                        <p className="mt-0.5 font-mono text-[10px] font-semibold text-slate-400">{row.status}</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeFeeRow(row.status)}
                      className="flex h-8 w-8 items-center justify-center rounded-xl bg-red-50 text-red-400 opacity-0 ring-1 ring-red-200 transition-all group-hover:opacity-100 hover:bg-red-100 hover:text-red-600"
                      title="Remove this category"
                    >
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>

                  {/* amount input */}
                  <label className="block">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#94a3b8]">Amount Due (UGX)</span>
                    <div className="relative mt-1">
                      <input
                        type="number"
                        min={0}
                        step={1000}
                        value={row.amountDueUgx}
                        onChange={(e) => updateRow(row.status, { amountDueUgx: e.target.value })}
                        className="neo-inset-field w-full rounded-xl px-4 py-2.5 pr-16 text-sm font-semibold text-[#1e293b] focus:outline-none focus:ring-2 focus:ring-[#93c5fd] transition"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-[#94a3b8]">
                        UGX
                      </span>
                    </div>
                    {Number(row.amountDueUgx) > 0 && (
                      <p className="mt-1 text-xs font-medium text-[#64748b]">
                        {formatCurrencyUGX(Number(row.amountDueUgx))}
                      </p>
                    )}
                  </label>

                  {/* notes input */}
                  <label className="mt-3 block">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#94a3b8]">Notes</span>
                    <input
                      value={row.notes}
                      onChange={(e) => updateRow(row.status, { notes: e.target.value })}
                      placeholder="Optional note..."
                      className="neo-inset-field mt-1 w-full rounded-xl px-4 py-2 text-xs text-[#475569] placeholder:text-[#cbd5e1] focus:outline-none focus:ring-2 focus:ring-[#93c5fd] transition"
                    />
                  </label>
                </div>
              </div>
            );
          })}

          {/* ── ADD NEW CARD ────────────────────────────────── */}
          {showAddForm ? (
            <div className="neo-card overflow-hidden animate-in fade-in zoom-in-95 duration-300">
              <div className="h-1.5 bg-gradient-to-r from-[#a78bfa] to-[#c084fc]" />
              <div className="p-5">
                <h3 className="mb-4 text-sm font-bold text-[#1e293b]">New Fee Category</h3>
                <label className="block">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#94a3b8]">Display name</span>
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Day Half Day, Boarding..."
                    className="neo-inset-field mt-1 w-full rounded-xl px-4 py-2.5 text-sm font-medium text-[#1e293b] placeholder:text-[#cbd5e1] focus:outline-none focus:ring-2 focus:ring-[#c4b5fd] transition"
                    autoFocus
                    onKeyDown={(e) => e.key === "Enter" && addFeeCategory()}
                  />
                </label>
                <label className="mt-3 block">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#94a3b8]">
                    Internal status key <span className="font-normal text-slate-400">(optional)</span>
                  </span>
                  <input
                    value={newStatusKey}
                    onChange={(e) => setNewStatusKey(e.target.value)}
                    placeholder="e.g. day_half, boarding — leave blank to auto-generate"
                    className="neo-inset-field mt-1 w-full rounded-xl px-4 py-2.5 font-mono text-sm text-[#1e293b] placeholder:text-[#cbd5e1] focus:outline-none focus:ring-2 focus:ring-[#c4b5fd] transition"
                    onKeyDown={(e) => e.key === "Enter" && addFeeCategory()}
                  />
                </label>
                <label className="mt-3 block">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#94a3b8]">Initial Amount (UGX)</span>
                  <input
                    type="number"
                    min={0}
                    step={1000}
                    value={newAmount}
                    onChange={(e) => setNewAmount(e.target.value)}
                    placeholder="0"
                    className="neo-inset-field mt-1 w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-[#1e293b] placeholder:text-[#cbd5e1] focus:outline-none focus:ring-2 focus:ring-[#c4b5fd] transition"
                    onKeyDown={(e) => e.key === "Enter" && addFeeCategory()}
                  />
                </label>
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={addFeeCategory}
                    disabled={!newName.trim() && !newStatusKey.trim()}
                    className="flex-1 rounded-xl bg-gradient-to-r from-[#8b5cf6] to-[#7c3aed] px-4 py-2 text-xs font-bold text-white shadow-lg shadow-purple-200 transition hover:shadow-xl hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Add Category
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddForm(false);
                      setNewName("");
                      setNewStatusKey("");
                      setNewAmount("");
                    }}
                    className="rounded-xl bg-[#f1f5f9] px-4 py-2 text-xs font-bold text-[#64748b] ring-1 ring-[#e2e8ef] transition hover:bg-[#e2e8ef]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              className="neo-card group flex min-h-[200px] flex-col items-center justify-center gap-3 border-2 border-dashed border-[#cbd5e1]/60 bg-transparent transition-all duration-300 hover:border-[#8b5cf6]/40 hover:bg-[#faf5ff]/50 hover:-translate-y-1"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f1f5f9] text-[#94a3b8] ring-1 ring-[#e2e8ef] transition-all group-hover:bg-[#ede9fe] group-hover:text-[#7c3aed] group-hover:ring-[#c4b5fd] group-hover:shadow-lg">
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-[#94a3b8] group-hover:text-[#7c3aed] transition-colors">
                Add Fee Category
              </span>
            </button>
          )}
        </div>
      )}

      <UnsavedBar
        dirty={dirty}
        saving={saving}
        onSave={() => void onApply()}
        onDiscard={discardChanges}
        saveLabel="Apply Fee Structure"
      >
        <span className="text-xs font-semibold text-slate-500">
          {rows.length} {rows.length === 1 ? "category" : "categories"} · Total: {formatCurrencyUGX(previewTotal)}
        </span>
      </UnsavedBar>

      {/* ── TOAST ────────────────────────────────────────────── */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </section>
  );
}
