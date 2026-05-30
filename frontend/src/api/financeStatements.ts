import { apiUrl, authHeaders } from "./baseUrl";
import type { StudentStatementPayload } from "../components/finance/shared/financeTypes";

async function readJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text.trim()) throw new Error("Empty response");
  return JSON.parse(text) as T;
}

export async function assignStudentFee(body: {
  studentId: number;
  term: string;
  amountDueUgx: number;
  notes?: string;
}) {
  const res = await fetch(apiUrl("/api/me/finance/fees/assign"), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body),
  });
  if (res.status === 401) throw new Error("Unauthorized");
  if (!res.ok) {
    const err = await readJson<{ error?: string }>(res).catch(() => null);
    throw new Error(err?.error ?? "Request failed");
  }
  return readJson<{ item: { id: number } }>(res);
}

export type FeeComplianceIssueRow = {
  studentId: number;
  admissionNumber: string;
  fullName: string;
  className: string | null;
  term: string;
  reason: "missing_status" | "missing_assignment" | "zero_amount";
};

export async function fetchFeeComplianceViolations(
  term?: string,
  academicYear?: string,
): Promise<{
  term: string;
  academicYear?: string;
  count: number;
  items: FeeComplianceIssueRow[];
}> {
  const q = new URLSearchParams();
  if (term) q.set("term", term);
  if (academicYear) q.set("academicYear", academicYear);
  const qs = q.toString();
  const res = await fetch(apiUrl(`/api/me/finance/fees/compliance${qs ? `?${qs}` : ""}`), {
    headers: { ...authHeaders() },
  });
  if (res.status === 401) throw new Error("Unauthorized");
  if (!res.ok) {
    const err = await readJson<{ error?: string }>(res).catch(() => null);
    throw new Error(err?.error ?? "Request failed");
  }
  return readJson<{ term: string; academicYear?: string; count: number; items: FeeComplianceIssueRow[] }>(
    res,
  );
}

export async function fetchStudentStatement(
  studentId: number,
  term: string,
  academicYear: string,
): Promise<StudentStatementPayload> {
  const q = new URLSearchParams({ term, academicYear });
  const res = await fetch(apiUrl(`/api/me/finance/statements/${studentId}?${q.toString()}`), {
    headers: { ...authHeaders() },
  });
  if (res.status === 401) throw new Error("Unauthorized");
  if (!res.ok) {
    const err = await readJson<{ error?: string }>(res).catch(() => null);
    throw new Error(err?.error ?? "Request failed");
  }
  const data = await readJson<{ item: StudentStatementPayload }>(res);
  return data.item;
}
