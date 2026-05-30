import { useCallback, useEffect, useState } from "react";
import { fetchFeeCategories } from "../../../../api/feeCategories";
import {
  deactivateFeeRule,
  fetchFeeRules,
  saveFeeRule,
  type FeeRuleRow,
} from "../../../../api/feeRules";
import { useFeeConfigStore } from "../../../../store/feeConfigStore";
import { FeeSimulator } from "../../../fees/FeeSimulator";
import { RuleLogicInput } from "../../../fees/RuleLogicInput";
import { DangerConfirmDialog } from "../shared/DangerConfirmDialog";
import { InstructionBlock } from "../shared/InstructionBlock";
import { SetupSectionCard } from "../shared/SetupSectionCard";
import { btnDanger, btnPrimary, btnSecondary, fieldClass, selectClass } from "../shared/fieldStyles";

type SubStep = "configure" | "test" | "review";

export function FeeRulesStep({
  onDataChange,
  onSubStepChange,
}: {
  onDataChange?: () => void;
  onSubStepChange?: () => void;
}) {
  const { statuses, loadStatuses } = useFeeConfigStore();
  const [categories, setCategories] = useState<{ id: number; name: string; code: string }[]>([]);
  const [rules, setRules] = useState<FeeRuleRow[]>([]);
  const [subStep, setSubStep] = useState<SubStep>("configure");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<FeeRuleRow | null>(null);

  const [studentStatusId, setStudentStatusId] = useState<number | "">("");
  const [feeCategoryId, setFeeCategoryId] = useState<number | "">("");
  const [name, setName] = useState("");
  const [baseAmountUgx, setBaseAmountUgx] = useState(500_000);
  const [inputMode, setInputMode] = useState<"plain" | "formula">("formula");
  const [plainEnglishText, setPlainEnglishText] = useState("");
  const [formulaText, setFormulaText] = useState("{baseAmount}");

  const reloadRules = useCallback(async () => {
    try {
      const items = await fetchFeeRules();
      setRules(items.filter((r) => r.isActive));
      onDataChange?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load rules");
    }
  }, [onDataChange]);

  useEffect(() => {
    void loadStatuses();
    void fetchFeeCategories()
      .then((rows) => {
        setCategories(rows.filter((r) => r.isActive).map((r) => ({ id: r.id, name: r.name, code: r.code })));
      })
      .finally(() => setLoading(false));
    void reloadRules();
  }, [loadStatuses, reloadRules]);

  function resetForm() {
    setEditingId(null);
    setName("");
    setStudentStatusId("");
    setFeeCategoryId("");
    setBaseAmountUgx(500_000);
    setInputMode("formula");
    setPlainEnglishText("");
    setFormulaText("{baseAmount}");
    setSubStep("configure");
  }

  function startEdit(rule: FeeRuleRow) {
    setEditingId(rule.id);
    setName(rule.name);
    setStudentStatusId(rule.studentStatusId);
    setFeeCategoryId(rule.feeCategoryId);
    setBaseAmountUgx(rule.baseAmountUgx);
    setInputMode(rule.inputMode);
    setPlainEnglishText(rule.plainEnglishText ?? "");
    setFormulaText(rule.formulaText ?? "{baseAmount}");
    setSubStep("configure");
  }

  async function handleSave() {
    if (!name.trim() || !studentStatusId || !feeCategoryId) return;
    setBusy(true);
    setError(null);
    try {
      await saveFeeRule(
        {
          name: name.trim(),
          studentStatusId: Number(studentStatusId),
          feeCategoryId: Number(feeCategoryId),
          baseAmountUgx,
          inputMode,
          plainEnglishText: plainEnglishText || null,
          formulaText: formulaText || null,
        },
        editingId ?? undefined,
      );
      resetForm();
      await reloadRules();
      setSubStep("review");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  const statusLabel = (id: number) => statuses.find((s) => s.id === id)?.code ?? `#${id}`;
  const categoryLabel = (id: number) => categories.find((c) => c.id === id)?.code ?? `#${id}`;

  if (!loading && categories.length === 0) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
        No fee categories found. Go back to step 2 and add at least one category before creating rules.
      </div>
    );
  }

  const SUB_LABELS: { id: SubStep; label: string }[] = [
    { id: "configure", label: "1. Configure" },
    { id: "test", label: "2. Test" },
    { id: "review", label: "3. Review list" },
  ];

  return (
    <div className="space-y-6">
      <InstructionBlock
        steps={[
          "Pick student status and fee category, then enter base amount (UGX).",
          "Choose plain English or formula logic; run the simulator to verify amounts.",
          "Save the rule and repeat for each status + category pair you need.",
          "Use Assign fees or New admission when setup is complete.",
        ]}
      />

      <div className="flex flex-wrap gap-2">
        {SUB_LABELS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => {
              setSubStep(s.id);
              onSubStepChange?.();
            }}
            className={`rounded-full px-4 py-1.5 text-xs font-bold ${
              subStep === s.id
                ? "bg-indigo-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {subStep === "configure" || subStep === "test" ? (
        <SetupSectionCard
          stepNum={3}
          title="Fee rules"
          hint="Set the amount logic for each student status + fee category combination."
        >
          {error ? <p className="mb-3 text-sm text-rose-600">{error}</p> : null}

          <div className="grid gap-8 lg:grid-cols-2">
            <div className="space-y-4">
              <label className="block text-sm font-medium text-slate-700">
                Rule name
                <input
                  className={`${fieldClass} mt-1`}
                  placeholder="Boarder tuition — Term 1"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Student status
                <select
                  className={`${selectClass} mt-1`}
                  value={studentStatusId}
                  onChange={(e) =>
                    setStudentStatusId(e.target.value ? Number(e.target.value) : "")
                  }
                >
                  <option value="">Select status…</option>
                  {statuses.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code} — {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Fee category
                <select
                  className={`${selectClass} mt-1`}
                  value={feeCategoryId}
                  onChange={(e) =>
                    setFeeCategoryId(e.target.value ? Number(e.target.value) : "")
                  }
                >
                  <option value="">Select category…</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} — {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Base amount (UGX)
                <input
                  type="number"
                  min={0}
                  className={`${fieldClass} mt-1`}
                  value={baseAmountUgx}
                  onChange={(e) => setBaseAmountUgx(Number(e.target.value))}
                />
              </label>
              <RuleLogicInput
                inputMode={inputMode}
                plainEnglishText={plainEnglishText}
                formulaText={formulaText}
                onChange={(v) => {
                  setInputMode(v.inputMode);
                  setPlainEnglishText(v.plainEnglishText);
                  setFormulaText(v.formulaText);
                }}
              />
              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  type="button"
                  className={btnPrimary}
                  disabled={busy || !name.trim() || !studentStatusId || !feeCategoryId}
                  onClick={() => void handleSave()}
                >
                  {editingId ? "Update rule" : "Save rule"}
                </button>
                {studentStatusId && feeCategoryId ? (
                  <button
                    type="button"
                    className={btnSecondary}
                    onClick={() => {
                      setSubStep("test");
                      onSubStepChange?.();
                    }}
                  >
                    Test in simulator →
                  </button>
                ) : null}
                {editingId ? (
                  <button type="button" className={btnSecondary} onClick={resetForm}>
                    Cancel edit
                  </button>
                ) : null}
              </div>
            </div>

            {subStep === "test" && studentStatusId && feeCategoryId ? (
              <div>
                <p className="mb-3 text-sm font-semibold text-slate-700">Simulator</p>
                <FeeSimulator
                  studentStatusId={Number(studentStatusId)}
                  feeCategoryId={Number(feeCategoryId)}
                  baseAmountUgx={baseAmountUgx}
                />
              </div>
            ) : subStep === "configure" && studentStatusId && feeCategoryId ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-sm text-slate-500">
                Switch to <strong>2. Test</strong> to run the fee simulator for the selected status
                and category.
              </div>
            ) : null}
          </div>
        </SetupSectionCard>
      ) : null}

      {subStep === "review" ? (
        <SetupSectionCard
          stepNum={3}
          title="Saved fee rules"
          hint="Review, edit, or deactivate rules. Deactivating affects future fee calculations."
        >
          {rules.length === 0 ? (
            <p className="text-sm text-slate-500">No rules saved yet. Configure and save your first rule.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Rule</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Base (UGX)</th>
                    <th className="px-4 py-3">Mode</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rules.map((r) => (
                    <tr key={r.id} className="border-t border-slate-100">
                      <td className="px-4 py-3 font-medium">{r.name}</td>
                      <td className="px-4 py-3">{statusLabel(r.studentStatusId)}</td>
                      <td className="px-4 py-3">{categoryLabel(r.feeCategoryId)}</td>
                      <td className="px-4 py-3">{r.baseAmountUgx.toLocaleString()}</td>
                      <td className="px-4 py-3 capitalize">{r.inputMode}</td>
                      <td className="px-4 py-3 text-right space-x-2">
                        <button
                          type="button"
                          className="text-sm font-semibold text-indigo-600 hover:underline"
                          onClick={() => startEdit(r)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className={btnDanger}
                          onClick={() => setDeactivateTarget(r)}
                        >
                          Deactivate
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50/80 px-5 py-4">
            <p className="font-bold text-emerald-900">Setup complete</p>
            <p className="mt-1 text-sm text-emerald-800">
              Fee rules are ready. New admissions and assign-fees will use these automatically.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                className={btnSecondary}
                onClick={() => {
                  setSubStep("configure");
                  onSubStepChange?.();
                }}
              >
                Add another rule
              </button>
            </div>
          </div>
        </SetupSectionCard>
      ) : null}

      <DangerConfirmDialog
        open={!!deactivateTarget}
        title="Deactivate this fee rule?"
        message={
          deactivateTarget
            ? `Deactivate "${deactivateTarget.name}"?\n\nStudents assigned fees under this rule may show incorrect amounts until a new rule is created. Historical receipts are not changed, but future term assignments may fail or use fallback amounts.`
            : ""
        }
        confirmLabel="Deactivate rule"
        busy={busy}
        onCancel={() => setDeactivateTarget(null)}
        onConfirm={() => {
          if (!deactivateTarget) return;
          setBusy(true);
          void deactivateFeeRule(deactivateTarget.id)
            .then(() => {
              setDeactivateTarget(null);
              return reloadRules();
            })
            .catch((e) => setError(e instanceof Error ? e.message : "Deactivate failed"))
            .finally(() => setBusy(false));
        }}
      />
    </div>
  );
}
