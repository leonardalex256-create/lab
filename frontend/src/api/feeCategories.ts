import { apiUrl, authHeaders } from "./baseUrl";

async function readJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text.trim()) throw new Error("Empty response");
  return JSON.parse(text) as T;
}

export type FeeCategoryRow = {
  id: number;
  name: string;
  code: string;
  billingFrequency: string;
  isMandatory: boolean;
  description: string | null;
  isActive: boolean;
  applicableStatuses: Array<{ id: number; code: string; name: string; colorHex: string }>;
};

export async function fetchFeeCategoriesExist(): Promise<boolean> {
  const res = await fetch(apiUrl("/api/me/fee-categories/exists"), { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed");
  const data = await readJson<{ exists: boolean }>(res);
  return data.exists;
}

export async function fetchFeeCategories(studentStatusId?: number): Promise<FeeCategoryRow[]> {
  const q = studentStatusId ? `?studentStatusId=${studentStatusId}` : "";
  const res = await fetch(apiUrl(`/api/me/fee-categories${q}`), { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed");
  const data = await readJson<{ items: FeeCategoryRow[] }>(res);
  return data.items;
}

export async function saveFeeCategory(
  body: Partial<FeeCategoryRow> & {
    name: string;
    code: string;
    applicableStatusIds?: number[];
  },
  id?: number,
): Promise<void> {
  const url = id
    ? apiUrl(`/api/me/fee-categories/${id}`)
    : apiUrl("/api/me/fee-categories");
  const res = await fetch(url, {
    method: id ? "PATCH" : "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await readJson<{ error?: string }>(res).catch(() => null);
    throw new Error(err?.error ?? "Save failed");
  }
}

export async function deactivateFeeCategory(id: number): Promise<void> {
  const res = await fetch(apiUrl(`/api/me/fee-categories/${id}`), {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) {
    const err = await readJson<{ error?: string }>(res).catch(() => null);
    throw new Error(err?.error ?? "Delete failed");
  }
}
