import { apiUrl, authHeaders } from "./baseUrl";

async function readJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text.trim()) throw new Error("Empty response");
  return JSON.parse(text) as T;
}

export type FeeRuleRow = {
  id: number;
  name: string;
  feeCategoryId: number;
  studentStatusId: number;
  baseAmountUgx: number;
  plainEnglishText: string | null;
  formulaText: string | null;
  inputMode: "plain" | "formula";
  priority: number;
  isActive: boolean;
};

export async function fetchFeeRules(filters?: {
  studentStatusId?: number;
  feeCategoryId?: number;
}): Promise<FeeRuleRow[]> {
  const q = new URLSearchParams();
  if (filters?.studentStatusId) q.set("studentStatusId", String(filters.studentStatusId));
  if (filters?.feeCategoryId) q.set("feeCategoryId", String(filters.feeCategoryId));
  const res = await fetch(apiUrl(`/api/me/finance/fee-rules?${q}`), {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed");
  const data = await readJson<{ items: FeeRuleRow[] }>(res);
  return data.items;
}

export async function deactivateFeeRule(id: number): Promise<void> {
  const res = await fetch(apiUrl(`/api/me/finance/fee-rules/${id}`), {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Deactivate failed");
}

export async function saveFeeRule(body: Record<string, unknown>, id?: number): Promise<void> {
  const url = id
    ? apiUrl(`/api/me/finance/fee-rules/${id}`)
    : apiUrl("/api/me/finance/fee-rules");
  const res = await fetch(url, {
    method: id ? "PATCH" : "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Save failed");
}

export async function parsePlainEnglishRule(text: string) {
  const res = await fetch(apiUrl("/api/me/finance/rules/parse"), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error("Parse failed");
  return readJson<{
    inputMode: "plain" | "formula";
    formulaText: string | null;
    plainEnglishText: string;
    interpretation: string;
  }>(res);
}

export async function validateFormula(formulaText: string) {
  const res = await fetch(apiUrl("/api/me/finance/rules/validate-formula"), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ formulaText }),
  });
  return readJson<{ valid: boolean; amountUgx?: number; error?: string; substituted?: string }>(
    res,
  );
}

export async function simulateFeeRule(body: Record<string, unknown>) {
  const res = await fetch(apiUrl("/api/me/finance/rules/simulate"), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await readJson<{ error?: string }>(res).catch(() => null);
    throw new Error(err?.error ?? "Simulation failed");
  }
  return readJson<{ amountUgx: number; formulaText: string | null }>(res);
}
