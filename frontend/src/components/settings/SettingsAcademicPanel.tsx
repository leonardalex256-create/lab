import { useEffect, useState, useRef } from "react";
import { fetchGradingScales, saveGradingScale, type GradingScaleRow } from "../../api/academics";
import { Toast, UnsavedBar, PanelHeader, LoadingSpinner } from "./shared";

type ToastMessage = {
  message: string;
  type: "success" | "error";
};

type GradingThreshold = {
  uid: string;
  min: number;
  grade: string;
  agg: number;
};

function withUid(t: { min: number; grade: string; agg: number }): GradingThreshold {
  return { ...t, uid: crypto.randomUUID() };
}

function stripUid(t: GradingThreshold): { min: number; grade: string; agg: number } {
  const { uid: _uid, ...rest } = t;
  return rest;
}

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
            const raw = Array.isArray(first.thresholds)
              ? (first.thresholds as Array<{ min: number; grade: string; agg: number }>)
              : [];
            const sorted = [...raw].sort((a, b) => b.min - a.min).map(withUid);
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
    setLocalThresholds((prev) => [...prev, withUid({ min: 0, grade: "", agg: 1 })]);
  }

  function removeRule(index: number) {
    setLocalThresholds((prev) => prev.filter((_, i) => i !== index));
  }

  function updateRule(index: number, field: keyof GradingThreshold, value: string | number) {
    setLocalThresholds((prev) =>
      prev.map((r, i) => (i === index ? { ...r, [field]: value } : r))
    );
  }

  async function onSave() {
    if (!activeScaleId) return;
    setSaving(true);
    setToast(null);
    try {
      if (localThresholds.length === 0) {
        throw new Error("Add at least one grading rule.");
      }
      const invalid = localThresholds.some((t) => !t.grade.trim() || t.min < 0 || t.min > 100);
      if (invalid) {
        throw new Error("Please ensure all grades are entered and scores are between 0-100.");
      }

      const activeScale = scales.find((s) => s.id === activeScaleId);
      await saveGradingScale({
        id: activeScaleId,
        name: activeScale?.name || "Global Scale",
        thresholds: localThresholds.map(stripUid),
      });
      
      originalThresholdsRef.current = JSON.stringify(localThresholds);
      setDirty(false);
      setToast({ message: "Grading system updated successfully.", type: "success" });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save grading scale.";
      setToast({ message, type: "error" });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <LoadingSpinner label="Loading Academic Settings" />;
  }

  function discardChanges() {
    if (originalThresholdsRef.current) {
      setLocalThresholds(JSON.parse(originalThresholdsRef.current) as GradingThreshold[]);
      setDirty(false);
    }
  }

  return (
    <section className="mx-auto max-w-[860px] space-y-8 animate-in fade-in slide-in-from-bottom-3 duration-500 pb-24">
      <PanelHeader
        gradient
        icon={<span aria-hidden>🎓</span>}
        title="Academic Settings"
        description="Configure grading scales, thresholds, and academic policies."
        action={
          <button
            type="button"
            onClick={addRule}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-200 transition-all hover:bg-indigo-700 hover:shadow-indigo-300"
            title="Define a new grading threshold rule"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add New Rule
          </button>
        }
      />

      <section>
        <h2 className="mb-4 px-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">Grading Scale Definition</h2>
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <th scope="col" className="px-6 py-4">Minimum Mark (%)</th>
                  <th scope="col" className="px-6 py-4">Letter Grade</th>
                  <th scope="col" className="px-6 py-4">Aggregate Value</th>
                  <th scope="col" className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {localThresholds.length > 0 ? (
                  localThresholds.map((rule, idx) => (
                    <tr key={rule.uid} className="group hover:bg-slate-50 transition-colors">
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

      <UnsavedBar
        dirty={dirty}
        saving={saving}
        onSave={() => void onSave()}
        onDiscard={discardChanges}
        label="Unsaved grading changes"
        saveLabel="Save System"
      />

      {toast ? (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      ) : null}
    </section>
  );
}
