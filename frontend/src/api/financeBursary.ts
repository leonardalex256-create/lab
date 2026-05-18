import { apiUrl, authHeaders } from "./baseUrl";
import { fetchStudents } from "./students";

async function readJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text.trim()) throw new Error("Empty response");
  return JSON.parse(text) as T;
}

export type BursaryRecord = {
  id: number;
  studentName: string;
  awardType: string;
  coverageLabel: string;
  amountCovered: number;
  term: string;
  status: "Approved" | "Pending";
};

export interface BursaryRow {
  studentId: number;
  admissionNumber: string;
  fullName: string;
  className: string;
  boardingStatus: string;
  termFee: number;
  bursaryPercentage: number;
  discountAmount: number;
  currentBalance: number;
  startsAt: string;
  endsAt: string;
  daysRemaining: number;
}

export async function fetchBursaryRecords(term: string, academicYear: string): Promise<BursaryRecord[]> {
  // There is currently no dedicated bursary registry endpoint.
  // We derive the registry from student bursary fields.
  const { items } = await fetchStudents({
    q: "",
    sortBy: "name",
    sortDir: "asc",
    limit: 2000,
    offset: 0,
  });

  return items
    .filter((s) => (Number(s.bursaryPercentage) || 0) > 0)
    .map((s) => ({
      id: s.id,
      studentName: s.fullName,
      awardType: "Bursary (percentage discount)",
      coverageLabel: `${Number(s.bursaryPercentage) || 0}%`,
      amountCovered: 0,
      term,
      status: "Approved" as const,
    }));
}

export async function assignBursary(body: {
  studentId: number;
  percentage: number;
  term: string;
  startsAt?: string | null;
  endsAt?: string | null;
}): Promise<{ ok: boolean }> {
  // Backend route currently uses "bursery" spelling.
  const res = await fetch(apiUrl("/api/me/finance/bursery"), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body),
  });
  if (res.status === 401) throw new Error("Unauthorized");
  if (!res.ok) {
    const err = await readJson<{ error?: string }>(res).catch(() => null);
    throw new Error(err?.error ?? "Request failed");
  }
  return readJson<{ ok: boolean }>(res);
}

export async function revokeBursary(studentId: number, term: string): Promise<{ ok: boolean }> {
  // Term lives in the query string now: some HTTP clients/proxies strip the
  // body of a DELETE request, so the backend reads it from `req.query.term`.
  const url = apiUrl(
    `/api/me/finance/bursery/${studentId}?term=${encodeURIComponent(term)}`,
  );
  const res = await fetch(url, {
    method: "DELETE",
    headers: { ...authHeaders() },
  });
  if (res.status === 401) throw new Error("Unauthorized");
  if (!res.ok) {
    const err = await readJson<{ error?: string }>(res).catch(() => null);
    throw new Error(err?.error ?? "Request failed");
  }
  return readJson<{ ok: boolean }>(res);
}

export async function fetchActiveBursaries(_term: string, _academicYear: string): Promise<BursaryRow[]> {
  // TODO: implement endpoint
  return [];
}
