import { apiUrl, authHeaders } from "./baseUrl";
import type { FinanceDashboardPayload } from "../components/finance/shared/financeTypes";

async function readJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text.trim()) throw new Error("Empty response");
  return JSON.parse(text) as T;
}

export async function fetchFinanceDashboard(
  termOrMonth?: string,
  academicYear?: string,
  month?: string,
): Promise<FinanceDashboardPayload> {
  const params = new URLSearchParams();
  // Backwards compatible: previously (month?: YYYY-MM).
  const inferredMonth =
    termOrMonth?.trim() && /^\d{4}-\d{2}$/.test(termOrMonth.trim()) ? termOrMonth.trim() : null;
  const term =
    termOrMonth?.trim() && termOrMonth.trim().startsWith("Term ") ? termOrMonth.trim() : null;

  if (term) params.set("term", term);
  if (academicYear?.trim() && /^\d{4}$/.test(academicYear.trim())) {
    params.set("academicYear", academicYear.trim());
  }

  const m = month?.trim() && /^\d{4}-\d{2}$/.test(month.trim()) ? month.trim() : inferredMonth;
  if (m) params.set("month", m);
  const query = params.toString();
  const res = await fetch(apiUrl(`/api/me/finance/dashboard${query ? `?${query}` : ""}`), {
    headers: { ...authHeaders() },
  });
  if (res.status === 401) throw new Error("Unauthorized");
  if (!res.ok) {
    const err = await readJson<{ error?: string }>(res).catch(() => null);
    throw new Error(err?.error ?? "Request failed");
  }
  return readJson<FinanceDashboardPayload>(res);
}
