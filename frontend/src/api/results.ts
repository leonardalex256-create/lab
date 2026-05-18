import { apiUrl, authHeaders } from "./baseUrl";

async function readJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text.trim()) throw new Error("Empty response");
  return JSON.parse(text) as T;
}

export type StudentResultSummaryRow = {
  subject: string;
  score: number | null;
  grade: string | null;
  status: string;
};

export async function fetchStudentResultSummary(studentId: number): Promise<StudentResultSummaryRow[]> {
  const q = new URLSearchParams({ studentId: String(studentId) });
  const res = await fetch(apiUrl(`/api/me/results/student-summary?${q.toString()}`), {
    headers: { ...authHeaders() },
  });
  if (res.status === 401) throw new Error("Unauthorized");
  if (!res.ok) {
    const err = await readJson<{ error?: string }>(res).catch(() => null);
    throw new Error(err?.error ?? "Request failed");
  }
  const data = await readJson<{ items: StudentResultSummaryRow[] }>(res);
  return data.items;
}

