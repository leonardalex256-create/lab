import { AND, IF, MAX, MIN, OR, ROUND } from "@formulajs/formulajs";

const FN_MAP = { IF, AND, OR, MAX, MIN, ROUND } as const;

const SAFE_EXPR =
  /^[\d\s+\-*/().,<>=!&|A-Za-z_]+$/;

export type FormulaContext = Record<string, number | string>;

export function substituteFormulaVars(template: string, ctx: FormulaContext): string {
  let out = template.trim();
  if (out.startsWith("=")) out = out.slice(1);
  for (const [key, raw] of Object.entries(ctx)) {
    const val = typeof raw === "number" ? String(raw) : JSON.stringify(String(raw));
    out = out.replace(new RegExp(`\\{${key}\\}`, "gi"), val);
  }
  return out;
}

export function evaluateFormulaExpression(expr: string): number {
  const trimmed = expr.trim();
  if (!trimmed) throw new Error("Empty formula");
  if (!SAFE_EXPR.test(trimmed)) {
    throw new Error("Formula contains disallowed characters");
  }
  const fn = new Function(
    ...Object.keys(FN_MAP),
  `return (${trimmed});`);
  const result = fn(...Object.values(FN_MAP));
  const n = Number(result);
  if (!Number.isFinite(n)) throw new Error("Formula did not return a number");
  return Math.round(n);
}

export function evaluateFeeFormula(
  formulaText: string | null | undefined,
  ctx: FormulaContext,
  baseAmountUgx: number,
): number {
  if (!formulaText?.trim()) return baseAmountUgx;
  const substituted = substituteFormulaVars(formulaText, {
    baseAmount: baseAmountUgx,
    ...ctx,
  });
  return evaluateFormulaExpression(substituted);
}
