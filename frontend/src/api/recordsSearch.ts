import { apiUrl, authHeaders } from "./baseUrl";

async function readJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text.trim()) throw new Error("Empty response");
  return JSON.parse(text) as T;
}

export type RecordsSearchPayload = {
  term: string;
  academicYear: string;
  finance: {
    assignments: Array<{
      id: number;
      studentId: number;
      studentName: string;
      admissionNumber: string | null;
      term: string;
      academicYear: string;
      amountDueUgx: number;
      notes: string | null;
    }>;
    payments: Array<{
      id: number;
      studentId: number;
      studentName: string;
      admissionNumber: string | null;
      term: string;
      academicYear: string;
      amountPaidUgx: number;
      paymentMethod: string;
      paidBy: string;
      receiptId: number | null;
    }>;
    receipts: Array<{
      id: number;
      studentId: number;
      studentName: string;
      admissionNumber: string | null;
      receiptNo: string;
      term: string;
      academicYear: string;
      amountPaidUgx: number;
      paymentMethod: string;
    }>;
  };
  academics: {
    results: Array<{
      id: number;
      studentId: number;
      studentName: string;
      admissionNumber: string | null;
      classRoomId: number;
      className: string | null;
      term: string;
      academicYear: string;
      examType: string;
      subject: string;
      score: number;
    }>;
  };
};

export async function fetchRecordsSearch(params: {
  term: string;
  academicYear: string;
  q?: string;
  limit?: number;
}): Promise<RecordsSearchPayload> {
  const q = new URLSearchParams({
    term: params.term,
    academicYear: params.academicYear,
  });
  if (params.q?.trim()) q.set("q", params.q.trim());
  if (params.limit != null) q.set("limit", String(params.limit));
  const res = await fetch(apiUrl(`/api/me/records/search?${q.toString()}`), {
    headers: { ...authHeaders() },
  });
  if (res.status === 401) throw new Error("Unauthorized");
  if (res.status === 403) throw new Error("Admin only");
  if (!res.ok) {
    const err = await readJson<{ error?: string }>(res).catch(() => null);
    throw new Error(err?.error ?? "Request failed");
  }
  return readJson<RecordsSearchPayload>(res);
}
