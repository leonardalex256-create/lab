import { apiUrl, authHeaders } from "./baseUrl";

async function readJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text.trim()) throw new Error("Empty response");
  return JSON.parse(text) as T;
}

export type FeeLineItemPreview = {
  feeCategoryId: number;
  feeCategoryCode: string;
  feeCategoryName: string;
  feeRuleId: number | null;
  amountUgx: number;
  notes: string | null;
};

export async function previewStudentFees(
  studentStatusId: number,
  term: string,
  academicYear: string,
) {
  const q = new URLSearchParams({
    studentStatusId: String(studentStatusId),
    term,
    academicYear,
  });
  const res = await fetch(apiUrl(`/api/me/finance/student-fees/preview?${q}`), {
    headers: authHeaders(),
  });
  if (!res.ok) {
    const err = await readJson<{ error?: string }>(res).catch(() => null);
    throw new Error(err?.error ?? "Preview failed");
  }
  return readJson<{ lineItems: FeeLineItemPreview[]; totalUgx: number }>(res);
}

export async function generateStudentLineItems(studentId: number, term?: string, academicYear?: string) {
  const res = await fetch(apiUrl("/api/me/finance/student-fees/generate-line-items"), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ studentId, term, academicYear }),
  });
  if (!res.ok) throw new Error("Generation failed");
  return readJson<{ lineItems: FeeLineItemPreview[]; totalUgx: number }>(res);
}

export async function fetchStudentLineItems(studentId: number, term: string, academicYear: string) {
  const q = new URLSearchParams({ term, academicYear });
  const res = await fetch(
    apiUrl(`/api/me/finance/student-fees/${studentId}/line-items?${q}`),
    { headers: authHeaders() },
  );
  if (!res.ok) throw new Error("Failed");
  return readJson<{
    items: Array<{
      id: number;
      feeCategoryId: number;
      feeCategoryCode: string;
      feeCategoryName: string;
      amountUgx: number;
      notes: string | null;
    }>;
    totalUgx: number;
  }>(res);
}
