import { apiUrl, authHeaders } from "./baseUrl";

// ─── Types ───

export type PaymentRecord = {
  paymentId: number;
  amount: number;
  date: string;
  method: string;
  note: string;
  appliedToOldBalance: boolean;
};

export type StudentFinanceRecord = {
  studentId: number;
  fullName: string;
  admissionNumber: string;
  className: string;
  totalFees: number;
  totalPaid: number;
  oldBalance: number;
  currentBalance: number;
  currency: string;
  payments: PaymentRecord[];
};

async function readJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text.trim()) throw new Error("Empty response");
  return JSON.parse(text) as T;
}

export async function fetchStudentFinanceRecords(params: {
  term: string;
  academicYear: string;
}): Promise<StudentFinanceRecord[]> {
  const q = new URLSearchParams({ term: params.term, academicYear: params.academicYear });
  const res = await fetch(apiUrl(`/api/me/finance/historical/student-records?${q.toString()}`), {
    headers: { ...authHeaders() },
  });
  if (res.status === 401) throw new Error("Unauthorized");
  if (!res.ok) {
    const err = await readJson<{ error?: string }>(res).catch(() => null);
    throw new Error(err?.error ?? "Request failed");
  }
  const data = await readJson<{ items: StudentFinanceRecord[] }>(res);
  return (data.items ?? []).map((s) => ({
    ...s,
    studentId: Number(s.studentId) || 0,
    totalFees: Number(s.totalFees) || 0,
    totalPaid: Number(s.totalPaid) || 0,
    oldBalance: Number(s.oldBalance) || 0,
    currentBalance: Number(s.currentBalance) || 0,
    currency: String(s.currency ?? "UGX"),
    payments: Array.isArray(s.payments)
      ? s.payments.map((p) => ({
          paymentId: Number(p.paymentId) || 0,
          amount: Number(p.amount) || 0,
          date: String(p.date ?? ""),
          method: String(p.method ?? ""),
          note: String(p.note ?? ""),
          appliedToOldBalance: Boolean(p.appliedToOldBalance),
        }))
      : [],
  }));
}

export async function recordStudentPayment(body: {
  studentId: number;
  term: string;
  academicYear: string;
  currentTermAmount: number;
  oldBalanceAmount: number;
  paymentMethod: string;
  paidBy: string;
  paymentDate: string; // YYYY-MM-DD
  note: string | null;
}): Promise<{
  receiptId: number;
  receiptNo: string;
}> {
  const res = await fetch(apiUrl("/api/me/finance/historical/payments"), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body),
  });
  if (res.status === 401) throw new Error("Unauthorized");
  if (!res.ok) {
    const err = await readJson<{ error?: string }>(res).catch(() => null);
    throw new Error(err?.error ?? "Request failed");
  }
  const data = await readJson<{ item: { id: number; receiptNo: string } }>(res);
  return { receiptId: Number(data.item.id) || 0, receiptNo: String(data.item.receiptNo ?? "") };
}

