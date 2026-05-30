import { useEffect, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { parsePlainEnglishRule, validateFormula } from "../../api/feeRules";
import { FORMULA_VARIABLES, validateFormulaClient } from "../../utils/formulaParser";

export function RuleLogicInput({
  inputMode,
  plainEnglishText,
  formulaText,
  onChange,
}: {
  inputMode: "plain" | "formula";
  plainEnglishText: string;
  formulaText: string;
  onChange: (v: {
    inputMode: "plain" | "formula";
    plainEnglishText: string;
    formulaText: string;
  }) => void;
}) {
  const [mode, setMode] = useState<"plain" | "formula">(inputMode);
  const [plain, setPlain] = useState(plainEnglishText);
  const [formula, setFormula] = useState(formulaText);
  const [interpretation, setInterpretation] = useState<string | null>(null);
  const [validation, setValidation] = useState<string | null>(null);

  function emit(next: { mode: typeof mode; plain: string; formula: string }) {
    onChange({
      inputMode: next.mode,
      plainEnglishText: next.plain,
      formulaText: next.formula,
    });
  }

  useEffect(() => {
    if (mode !== "formula" || !formula.trim()) {
      setValidation(null);
      return;
    }
    const t = setTimeout(() => {
      const local = validateFormulaClient(formula);
      if (!local.valid) {
        setValidation(local.error ?? "Invalid");
        return;
      }
      void validateFormula(formula).then((r) => {
        setValidation(r.valid ? `OK — sample: UGX ${r.amountUgx?.toLocaleString()}` : r.error ?? "Invalid");
      });
    }, 400);
    return () => clearTimeout(t);
  }, [formula, mode]);

  return (
    <div className="space-y-3">
      <div className="inline-flex rounded-lg border overflow-hidden text-sm">
        <button
          type="button"
          className={`px-3 py-1.5 ${mode === "plain" ? "bg-amber-100 font-semibold" : ""}`}
          onClick={() => {
            setMode("plain");
            emit({ mode: "plain", plain, formula });
          }}
        >
          Plain English
        </button>
        <button
          type="button"
          className={`px-3 py-1.5 ${mode === "formula" ? "bg-amber-100 font-semibold" : ""}`}
          onClick={() => {
            setMode("formula");
            emit({ mode: "formula", plain, formula });
          }}
        >
          Formula
        </button>
      </div>

      {mode === "plain" ? (
        <>
          <textarea
            className="w-full rounded border px-3 py-2 min-h-[100px]"
            value={plain}
            onChange={(e) => {
              const v = e.target.value;
              setPlain(v);
              emit({ mode, plain: v, formula });
            }}
            placeholder='e.g. "Apply 10% discount on tuition"'
          />
          <button
            type="button"
            className="text-sm text-blue-600"
            onClick={() => {
              void parsePlainEnglishRule(plain).then((r) => {
                setInterpretation(r.interpretation);
                if (r.formulaText) {
                  setFormula(r.formulaText);
                  setMode("formula");
                }
              });
            }}
          >
            Interpret rule
          </button>
          {interpretation ? (
            <p className="text-sm text-slate-600 bg-slate-50 p-2 rounded">{interpretation}</p>
          ) : null}
        </>
      ) : (
        <>
          <CodeMirror
            value={formula}
            height="120px"
            extensions={[javascript({ jsx: false })]}
            onChange={(v) => {
              setFormula(v);
              emit({ mode, plain, formula: v });
            }}
            className="border rounded overflow-hidden font-mono text-sm"
          />
          {validation ? (
            <p className={`text-xs ${validation.startsWith("OK") ? "text-green-700" : "text-red-600"}`}>
              {validation}
            </p>
          ) : null}
          <aside className="text-xs text-slate-500 border rounded p-2">
            <p className="font-semibold mb-1">Variables</p>
            <ul>
              {FORMULA_VARIABLES.map((v) => (
                <li key={v.key}>
                  <code className="fee-code">{`{${v.key}}`}</code> — {v.desc}
                </li>
              ))}
            </ul>
          </aside>
        </>
      )}
    </div>
  );
}
