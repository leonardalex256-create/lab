import { apiUrl, authHeaders } from "./baseUrl";

async function readJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text.trim()) throw new Error("Empty response");
  return JSON.parse(text) as T;
}

export type StudentStatusRow = {
  id: number;
  name: string;
  code: string;
  description: string | null;
  colorHex: string;
  sortOrder: number;
  archivedAt: string | null;
  studentCount: number;
};

export async function fetchStudentStatusCount(): Promise<number> {
  const res = await fetch(apiUrl("/api/me/student-statuses/count"), {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to load status count");
  const data = await readJson<{ count: number }>(res);
  return data.count;
}

export async function fetchStudentStatuses(includeArchived = false): Promise<StudentStatusRow[]> {
  const q = includeArchived ? "?includeArchived=1" : "";
  const res = await fetch(apiUrl(`/api/me/student-statuses${q}`), {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to load statuses");
  const data = await readJson<{ items: StudentStatusRow[] }>(res);
  return data.items;
}

export async function createStudentStatus(body: {
  name: string;
  code: string;
  description?: string | null;
  colorHex?: string;
  sortOrder?: number;
}): Promise<StudentStatusRow> {
  const res = await fetch(apiUrl("/api/me/student-statuses"), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await readJson<{ error?: string }>(res).catch(() => null);
    throw new Error(err?.error ?? "Create failed");
  }
  const data = await readJson<{ item: StudentStatusRow }>(res);
  return data.item;
}

export async function updateStudentStatus(
  id: number,
  body: Partial<{ name: string; code: string; description: string | null; colorHex: string; sortOrder: number }>,
): Promise<void> {
  const res = await fetch(apiUrl(`/api/me/student-statuses/${id}`), {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await readJson<{ error?: string }>(res).catch(() => null);
    throw new Error(err?.error ?? "Update failed");
  }
}

export async function archiveStudentStatus(id: number): Promise<{ studentCount: number }> {
  const res = await fetch(apiUrl(`/api/me/student-statuses/${id}/archive`), {
    method: "POST",
    headers: authHeaders(),
  });
  if (!res.ok) {
    const err = await readJson<{ error?: string }>(res).catch(() => null);
    throw new Error(err?.error ?? "Archive failed");
  }
  const data = await readJson<{ studentCount: number }>(res);
  return { studentCount: data.studentCount };
}

export async function fetchMissingStatusCount(): Promise<number> {
  const res = await fetch(apiUrl("/api/me/students/missing-status/count"), {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed");
  const data = await readJson<{ count: number }>(res);
  return data.count;
}

export async function fetchStudentsMissingStatus(limit = 50, offset = 0) {
  const q = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  const res = await fetch(apiUrl(`/api/me/students/missing-status?${q}`), {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed");
  return readJson<{
    total: number;
    items: Array<{
      id: number;
      admissionNumber: string;
      fullName: string;
      classRoomId: number | null;
    }>;
  }>(res);
}

export async function bulkAssignStudentStatus(
  updates: Array<{ studentId: number; studentStatusId: number }>,
): Promise<number> {
  const res = await fetch(apiUrl("/api/me/students/bulk-status"), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ updates }),
  });
  if (!res.ok) throw new Error("Bulk update failed");
  const data = await readJson<{ updated: number }>(res);
  return data.updated;
}
