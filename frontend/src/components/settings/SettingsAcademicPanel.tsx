import { useEffect, useState, useRef } from "react";
import { fetchGradingScales, saveGradingScale, type GradingScaleRow } from "../../api/academics";

type ToastMessage = {
  message: string;
  type: "success" | "error";
};

type GradingThreshold = {
  min: number;
  grade: string;
  agg: number;
};

export function SettingsAcademicPanel() {
  const [scales, setScales] = useState<GradingScaleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [activeScaleId, setActiveScaleId] = useState<number | null>(null);
  const [localThresholds, setLocalThresholds] = useState<GradingThreshold[]>([]);
  const [dirty, setDirty] = useState(false);
  const originalThresholdsRef = useRef<string>("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchGradingScales()
      .then((data) => {
        if (!cancelled) {
          setScales(data);
          if (data.length > 0) {
            const first = data[0];
            setActiveScaleId(first.id);
            const thresholds = Array.isArray(first.thresholds) ? (first.thresholds as GradingThreshold[]) : [];
            // Sort by min score descending like in the old project
            const sorted = [...thresholds].sort((a, b) => b.min - a.min);
            setLocalThresholds(sorted);
            originalThresholdsRef.current = JSON.stringify(sorted);
          }
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setToast({
            message: err instanceof Error ? err.message : "Failed to load grading scales.",
            type: "error",
          });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (originalThresholdsRef.current && JSON.stringify(localThresholds) !== originalThresholdsRef.current) {
      setDirty(true);
    } else {
      setDirty(false);
    }
  }, [localThresholds]);

  function addRule() {
    setLocalThresholds((prev) => [
      ...prev,
      { min: 0, grade: "", agg: 1 },
    ]);
  }

  function removeRule(index: number) {
    setLocalThresholds((prev) => prev.filter((_, i) => i !== index));
  }

  function updateRule(index: number, field: keyof GradingThreshold, value: any) {
    setLocalThresholds((prev) =>
      prev.map((r, i) => (i === index ? { ...r, [field]: value } : r))
    );
  }

  async function onSave() {
    if (!activeScaleId) return;
    setSaving(true);
    setToast(null);
    try {
      // Validate
      const invalid = localThresholds.some(t => !t.grade.trim() || t.min < 0 || t.min > 100);
      if (invalid) {
          throw new Error("Please ensure all grades are entered and scores are between 0-100.");
      }

      const activeScale = scales.find(s => s.id === activeScaleId);
      await saveGradingScale({
        id: activeScaleId,
        name: activeScale?.name || "Global Scale",
        thresholds: localThresholds
      });
      
      originalThresholdsRef.current = JSON.stringify(localThresholds);
      setDirty(false);
      setToast({ message: "Grading system updated successfully.", type: "success" });
    } catch (err: any) {
      setToast({ message: err.message || "Failed to save grading scale.", type: "error" });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center p-8">
        <div className="flex flex-col items-center gap-4 text-[#94a3b8]">
          <svg className="h-8 w-8 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm font-semibold uppercase tracking-widest text-[#636e72]">Loading Academic Settings</span>
        </div>
      </div>
    );
  }

  return (
    <section className="mx-auto max-w-[860px] space-y-8 animate-in fade-in slide-in-from-bottom-3 duration-500 pb-24">
      <header className="flex flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-2xl text-indigo-600 shadow-inner ring-1 ring-indigo-100">
              🎓
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-800">Academic Settings</h1>
              <p className="mt-1 text-sm font-medium text-slate-500">
                Configure grading scales, thresholds, and academic policies.
              </p>
            </div>
          </div>
          <button
            onClick={addRule}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-200 transition-all hover:bg-indigo-700 hover:shadow-indigo-300"
            title="Define a new grading threshold rule"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add New Rule
          </button>
        </div>
      </header>

      <section>
        <h2 className="mb-4 px-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">Grading Scale Definition</h2>
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="px-6 py-4">Minimum Mark (%)</th>
                  <th className="px-6 py-4">Letter Grade</th>
                  <th className="px-6 py-4">Aggregate Value</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {localThresholds.length > 0 ? (
                  localThresholds.map((rule, idx) => (
                    <tr key={idx} className="group hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={rule.min}
                          onChange={(e) => updateRule(idx, "min", parseInt(e.target.value) || 0)}
                          className="w-24 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none shadow-sm transition-all hover:border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <input
                          type="text"
                          placeholder="e.g. D1"
                          value={rule.grade}
                          onChange={(e) => updateRule(idx, "grade", e.target.value)}
                          className="w-32 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none shadow-sm transition-all hover:border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 uppercase"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <input
                          type="number"
                          min={1}
                          max={9}
                          value={rule.agg}
                          onChange={(e) => updateRule(idx, "agg", parseInt(e.target.value) || 1)}
                          className="w-24 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none shadow-sm transition-all hover:border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                        />
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => removeRule(idx)}
                          className="rounded-xl p-2 text-rose-500 opacity-0 transition-all hover:bg-rose-50 hover:opacity-100 group-hover:opacity-40"
                          title="Remove this grading rule"
                        >
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center gap-2 text-slate-400">
                        <svg className="h-10 w-10 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <p className="text-sm font-medium">No grading rules defined yet.</p>
                        <button onClick={addRule} className="mt-2 text-xs font-bold uppercase tracking-widest text-indigo-600 hover:underline" title="Initialize the grading scale with its first rule">Provision First Rule</button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        <p className="mt-4 flex items-center gap-2 px-2 text-[11px] font-bold text-slate-400">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Changes to the grading scale will reflect on all generated reports immediately.
        </p>
      </section>

      <div className={`fixed bottom-8 left-1/2 z-50 w-full max-w-lg -translate-x-1/2 px-4 transition-all duration-500 ${dirty ? "translate-y-0 opacity-100" : "translate-y-12 opacity-0 pointer-events-none"}`}>
        <div className="flex items-center justify-between rounded-3xl border border-indigo-200 bg-indigo-600 p-2 shadow-2xl shadow-indigo-200">
          <div className="flex items-center gap-3 pl-4">
            <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-wider text-white">Unsaved Grading Changes</span>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                if (originalThresholdsRef.current) {
                  setLocalThresholds(JSON.parse(originalThresholdsRef.current));
                  setDirty(false);
                }
              }}
              className="rounded-2xl bg-indigo-500/30 px-5 py-2.5 text-xs font-bold text-white hover:bg-indigo-500/50 transition-all"
              title="Discard all unsaved grading changes"
            >
              Discard
            </button>
            <button
              type="button"
              disabled={saving || localThresholds.length === 0}
              onClick={onSave}
              className="rounded-2xl bg-white px-6 py-2.5 text-xs font-bold text-indigo-600 shadow-sm hover:bg-indigo-50 disabled:opacity-50 transition-all"
              title="Finalize and save the grading system configuration"
            >
              {saving ? "Updating..." : "Save System"}
            </button>
          </div>
        </div>
      </div>

      {toast ? (
        <div className="fixed bottom-24 right-6 z-50 animate-in fade-in slide-in-from-bottom-4">
          <div className={`flex items-center gap-3 rounded-2xl px-5 py-3 text-sm font-semibold shadow-2xl backdrop-blur-md ${
            toast.type === "success" ? "bg-emerald-50/90 text-emerald-800 ring-1 ring-emerald-200" : "bg-red-50/90 text-red-800 ring-1 ring-red-200"
          }`}>
            <span>{toast.type === "success" ? "✅" : "❌"}</span>
            <span>{toast.message}</span>
            <button onClick={() => setToast(null)} className="ml-2 rounded-full p-1 opacity-70 hover:bg-black/5 hover:opacity-100 transition" title="Dismiss this notification">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
