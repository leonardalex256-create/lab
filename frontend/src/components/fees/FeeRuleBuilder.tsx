import { useCallback, useEffect, useState } from "react";
import { fetchFeeCategories } from "../../api/feeCategories";
import { fetchFeeRules, saveFeeRule } from "../../api/feeRules";
import { useFeeConfigStore } from "../../store/feeConfigStore";
import { FeeSimulator } from "./FeeSimulator";
import { RuleLogicInput } from "./RuleLogicInput";
import "../../styles/fee-config-theme.css";

export function FeeRuleBuilder() {
  const { statuses, loadStatuses } = useFeeConfigStore();
  const [categories, setCategories] = useState<{ id: number; name: string; code: string }[]>([]);
  const [rules, setRules] = useState<Awaited<ReturnType<typeof fetchFeeRules>>>([]);
  const [studentStatusId, setStudentStatusId] = useState<number | "">("");
  const [feeCategoryId, setFeeCategoryId] = useState<number | "">("");
  const [name, setName] = useState("");
  const [baseAmountUgx, setBaseAmountUgx] = useState(500_000);
  const [inputMode, setInputMode] = useState<"plain" | "formula">("formula");
  const [plainEnglishText, setPlainEnglishText] = useState("");
  const [formulaText, setFormulaText] = useState("{baseAmount}");

  const reloadRules = useCallback(async () => {
    setRules(
      await fetchFeeRules({
        studentStatusId: studentStatusId ? Number(studentStatusId) : undefined,
        feeCategoryId: feeCategoryId ? Number(feeCategoryId) : undefined,
      }),
    );
  }, [studentStatusId, feeCategoryId]);

  useEffect(() => {
    void loadStatuses();
    void fetchFeeCategories().then((rows) =>
      setCategories(rows.map((r) => ({ id: r.id, name: r.name, code: r.code }))),
    );
  }, [loadStatuses]);

  useEffect(() => {
    void reloadRules();
  }, [reloadRules]);

  if (categories.length === 0) {
    return (
      <div className="fee-config-theme fee-panel">
        <p>Add at least one fee category before creating rules.</p>
      </div>
    );
  }

  return (
    <div className="fee-config-theme max-w-5xl space-y-6">
      <h2 className="text-xl font-semibold">Fee Rules</h2>
      <div className="grid md:grid-cols-2 gap-6">
        <div className="fee-panel bg-white space-y-3">
          <input
            className="w-full border rounded px-2 py-1"
            placeholder="Rule name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <select
            className="w-full border rounded px-2 py-1"
            value={studentStatusId}
            onChange={(e) =>
              setStudentStatusId(e.target.value ? Number(e.target.value) : "")
            }
          >
            <option value="">Student status…</option>
            {statuses.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} — {s.name}
              </option>
            ))}
          </select>
          <select
            className="w-full border rounded px-2 py-1"
            value={feeCategoryId}
            onChange={(e) => setFeeCategoryId(e.target.value ? Number(e.target.value) : "")}
          >
            <option value="">Fee category…</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} — {c.name}
              </option>
            ))}
          </select>
          <label className="text-sm block">
            Base amount (UGX)
            <input
              type="number"
              className="w-full border rounded px-2 py-1 mt-1"
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
          <button
            type="button"
            className="fee-btn-primary"
            disabled={!name || !studentStatusId || !feeCategoryId}
            onClick={() => {
              void saveFeeRule({
                name,
                studentStatusId: Number(studentStatusId),
                feeCategoryId: Number(feeCategoryId),
                baseAmountUgx,
                inputMode,
                plainEnglishText: plainEnglishText || null,
                formulaText: formulaText || null,
              }).then(() => {
                setName("");
                return reloadRules();
              });
            }}
          >
            Save rule
          </button>
        </div>
        {studentStatusId && feeCategoryId ? (
          <FeeSimulator
            studentStatusId={Number(studentStatusId)}
            feeCategoryId={Number(feeCategoryId)}
            baseAmountUgx={baseAmountUgx}
          />
        ) : null}
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="py-2">Rule</th>
            <th>Base</th>
            <th>Mode</th>
          </tr>
        </thead>
        <tbody>
          {rules.map((r) => (
            <tr key={r.id} className="border-b">
              <td className="py-2">{r.name}</td>
              <td>{r.baseAmountUgx.toLocaleString()}</td>
              <td>{r.inputMode}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
