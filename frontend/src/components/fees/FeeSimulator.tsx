import { useState } from "react";
import { simulateFeeRule } from "../../api/feeRules";
import { formatCurrencyUGX } from "../finance/shared/financeFormat";
import { RuleLogicInput } from "./RuleLogicInput";

export function FeeSimulator({
  studentStatusId,
  feeCategoryId,
  baseAmountUgx,
}: {
  studentStatusId: number;
  feeCategoryId: number;
  baseAmountUgx: number;
}) {
  const [inputMode, setInputMode] = useState<"plain" | "formula">("formula");
  const [plainEnglishText, setPlainEnglishText] = useState("");
  const [formulaText, setFormulaText] = useState("IF({baseAmount}>0, {baseAmount}, 0)");
  const [result, setResult] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="fee-panel space-y-3">
      <h3 className="font-semibold">Simulator</h3>
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
        onClick={() => {
          setError(null);
          void simulateFeeRule({
            studentStatusId,
            feeCategoryId,
            baseAmountUgx,
            inputMode,
            plainEnglishText: plainEnglishText || null,
            formulaText: formulaText || null,
          })
            .then((r) => setResult(r.amountUgx))
            .catch((e) => setError(e instanceof Error ? e.message : "Failed"));
        }}
      >
        Run simulation
      </button>
      {result != null ? (
        <p className="text-lg font-semibold">Result: {formatCurrencyUGX(result)}</p>
      ) : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
