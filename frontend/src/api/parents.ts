import { apiUrl, authHeaders } from "./baseUrl";

async function readJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text.trim()) throw new Error("Empty response");
  return JSON.parse(text) as T;
}

export type ChildAcademicSummaryRow = {
  subject: string;
  score: number | null;
  grade: string | null;
};

export async function fetchChildAcademicSummary(
  studentId: number,
  term: string,
  academicYear: string,
): Promise<ChildAcademicSummaryRow[]> {
  const q = new URLSearchParams({ studentId: String(studentId), term, academicYear });
  const res = await fetch(apiUrl(`/api/me/parents/child-academic-summary?${q.toString()}`), {
    headers: { ...authHeaders() },
  });
  if (res.status === 401) throw new Error("Unauthorized");
  if (!res.ok) {
    const err = await readJson<{ error?: string }>(res).catch(() => null);
    throw new Error(err?.error ?? "Request failed");
  }
  const data = await readJson<{ items: ChildAcademicSummaryRow[] }>(res);
  return data.items;
}

export type ChildFinanceMiniStatement = {
  totalFees: number;
  amountPaid: number;
  balanceDue: number;
  termAverageScore: number | null;
  attendanceRate: number | null;
};

export async function fetchChildFinanceMiniStatement(
  studentId: number,
  term: string,
  academicYear: string,
): Promise<ChildFinanceMiniStatement> {
  const q = new URLSearchParams({ studentId: String(studentId), term, academicYear });
  const res = await fetch(apiUrl(`/api/me/parents/child-finance-mini?${q.toString()}`), {
    headers: { ...authHeaders() },
  });
  if (res.status === 401) throw new Error("Unauthorized");
  if (!res.ok) {
    const err = await readJson<{ error?: string }>(res).catch(() => null);
    throw new Error(err?.error ?? "Request failed");
  }
  const data = await readJson<{ item: ChildFinanceMiniStatement }>(res);
  return data.item;
}

