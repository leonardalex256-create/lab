import { apiUrl, authHeaders } from "./baseUrl";

export type FeeStructureRow = {
  status: string;
  label: string;
  amountDueUgx: number;
  notes: string | null;
  /** Deprecated: kept for older responses; fee rows are admin-defined only */
  isSystem?: boolean;
};

async function readJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text.trim()) throw new Error("Empty response");
  return JSON.parse(text) as T;
}

export async function fetchFeeStructure(term: string): Promise<FeeStructureRow[]> {
  const res = await fetch(apiUrl(`/api/me/finance/fees/structure?term=${encodeURIComponent(term)}`), {
    headers: { ...authHeaders() },
  });
  if (res.status === 401) throw new Error("Unauthorized");
  if (!res.ok) {
    const err = await readJson<{ error?: string }>(res).catch(() => null);
    throw new Error(err?.error ?? "Request failed");
  }
  const data = await readJson<{ items: FeeStructureRow[] }>(res);
  return data.items;
}

export async function applyFeeStructure(body: {
  term: string;
  items: Array<{ status: string; label: string; amountDueUgx: number; notes?: string | null }>;
  deleteStatuses?: string;
}): Promise<{ ok: boolean; updatedAssignments: number }> {
  const res = await fetch(apiUrl("/api/me/finance/fees/structure/apply"), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body),
  });
  if (res.status === 401) throw new Error("Unauthorized");
  if (!res.ok) {
    const err = await readJson<{ error?: string }>(res).catch(() => null);
    throw new Error(err?.error ?? "Request failed");
  }
  return readJson<{ ok: boolean; updatedAssignments: number }>(res);
}
