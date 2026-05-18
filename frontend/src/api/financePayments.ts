import { apiUrl, authHeaders } from "./baseUrl";
import type { StudentPaymentReceipt } from "../components/finance/shared/financeTypes";

type ReceiptApiRow = {
  id: number;
  receiptNo: string;
  issuedAt: string;
  generatedByName?: string;
  term: string;
  academicYear?: string;
  paymentMethod: string;
  paidBy: string;
  amountPaid: number;
  previousPaid: number;
  totalFeesDue: number;
  outstandingAfter: number;
  creditAmount: number;
  student: StudentPaymentReceipt["student"];
  changeReason?: string | null;
};

async function readJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text.trim()) throw new Error("Empty response");
  return JSON.parse(text) as T;
}

function mapReceipt(x: ReceiptApiRow): StudentPaymentReceipt {
  return {
    id: x.id,
    receiptNo: x.receiptNo,
    issuedAt: new Date(x.issuedAt),
    generatedByName: typeof x.generatedByName === "string" ? x.generatedByName : undefined,
    term: x.term,
    paymentMethod: x.paymentMethod,
    paidBy: x.paidBy,
    amountPaid: x.amountPaid,
    previousPaid: x.previousPaid,
    totalFeesDue: x.totalFeesDue,
    outstandingAfter: x.outstandingAfter,
    creditAmount: x.creditAmount,
    student: x.student,
    changeReason: x.changeReason,
  };
}

export async function createFinancePayment(body: {
  studentId: number;
  term: string;
  paymentMethod: string;
  paidBy: string;
  amountPaid: number;
  amountDueUgx?: number;
  changeReason?: string | null;
}): Promise<StudentPaymentReceipt> {
  const res = await fetch(apiUrl("/api/me/finance/payments"), {

    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body),
  });
  if (res.status === 401) throw new Error("Unauthorized");
  if (!res.ok) {
    const err = await readJson<{ error?: string }>(res).catch(() => null);
    throw new Error(err?.error ?? "Request failed");
  }
  const data = await readJson<{ item: ReceiptApiRow }>(res);
  return mapReceipt(data.item);
}

export async function fetchFinanceReceipt(id: number): Promise<StudentPaymentReceipt> {
  const res = await fetch(apiUrl(`/api/me/finance/receipts/${id}`), {
    headers: { ...authHeaders() },
  });
  if (res.status === 401) throw new Error("Unauthorized");
  if (!res.ok) {
    const err = await readJson<{ error?: string }>(res).catch(() => null);
    throw new Error(err?.error ?? "Request failed");
  }
  const data = await readJson<{ item: ReceiptApiRow }>(res);
  return mapReceipt(data.item);
}

export async function fetchReceiptsByDate(date: string): Promise<
  Array<{
    id: number;
    receiptNo: string;
    term: string;
    amountPaid: number;
    paymentMethod: string;
    paidBy: string;
    studentId: number;
    issuedAt: string;
  }>
> {
  const res = await fetch(apiUrl(`/api/me/finance/receipts/by-date?date=${encodeURIComponent(date)}`), {
    headers: { ...authHeaders() },
  });
  if (res.status === 401) throw new Error("Unauthorized");
  if (!res.ok) {
    const err = await readJson<{ error?: string }>(res).catch(() => null);
    throw new Error(err?.error ?? "Request failed");
  }
  const data = await readJson<{
    items: Array<{
      id: number;
      receiptNo: string;
      term: string;
      amountPaid: number;
      paymentMethod: string;
      paidBy: string;
      studentId: number;
      issuedAt: string;
    }>;
  }>(res);
  return data.items;
}

export type FinanceReceiptListItem = {
  id: number;
  receiptNo: string;
  term: string;
  academicYear: string;
  amountPaid: number;
  paymentMethod: string;
  paidBy: string;
  studentId: number;
  issuedAt: string;
  studentName: string;
  className: string | null;
  isVoided?: boolean;
};

export async function fetchFinanceReceipts(
  limit = 200,
  opts?: { term?: string; academicYear?: string; studentId?: number; offset?: number },
): Promise<{ items: FinanceReceiptListItem[]; total: number }> {
  const q = new URLSearchParams({ limit: String(limit) });
  if (opts?.term) q.set("term", opts.term);
  if (opts?.academicYear) q.set("academicYear", opts.academicYear);
  if (opts?.studentId != null) q.set("studentId", String(opts.studentId));
  if (opts?.offset != null) q.set("offset", String(opts.offset));
  const res = await fetch(apiUrl(`/api/me/finance/receipts?${q.toString()}`), {
    headers: { ...authHeaders() },
  });
  if (res.status === 401) throw new Error("Unauthorized");
  if (!res.ok) {
    const err = await readJson<{ error?: string }>(res).catch(() => null);
    throw new Error(err?.error ?? "Request failed");
  }
  const data = await readJson<{ items: FinanceReceiptListItem[]; total?: number }>(res);
  return { items: data.items ?? [], total: Number(data.total) || 0 };
}

export async function deleteFinanceReceipt(id: number): Promise<void> {
  const res = await fetch(apiUrl(`/api/me/finance/receipts/${id}`), {
    method: "DELETE",
    headers: { ...authHeaders() },
  });
  if (res.status === 401) throw new Error("Unauthorized");
  if (!res.ok) {
    const err = await readJson<{ error?: string }>(res).catch(() => null);
    throw new Error(err?.error ?? "Request failed");
  }
}
