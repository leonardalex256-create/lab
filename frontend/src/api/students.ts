import { apiUrl, authHeaders } from "./baseUrl";
import type {
  StudentCreateBodyInput,
  StudentListQueryInput,
  StudentUpdateBodyInput,
} from "../../../shared/schemas/students";

async function readJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text.trim()) throw new Error("Empty response");
  return JSON.parse(text) as T;
}

export type RecentAdmissionRow = {
  studentId: number;
  admissionNumber: string;
  studentName: string;
  className: string | null;
  sectionName: string | null;
  admittedAtLabel: string;
  status: "Active" | "Pending" | string;
};

export async function fetchRecentAdmissions(
  term: string,
  academicYear: string,
): Promise<RecentAdmissionRow[]> {
  const q = new URLSearchParams({ term, academicYear });
  const res = await fetch(apiUrl(`/api/me/students/recent-admissions?${q.toString()}`), {
    headers: { ...authHeaders() },
  });
  if (res.status === 401) throw new Error("Unauthorized");
  if (!res.ok) {
    const err = await readJson<{ error?: string }>(res).catch(() => null);
    throw new Error(err?.error ?? "Request failed");
  }
  const data = await readJson<{ items: RecentAdmissionRow[] }>(res);
  return data.items;
}

export type StudentApiRow = {
  id: number;
  admissionNumber: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  fullName: string;
  dateOfBirth: string | null;
  dateOfBirthFormatted: string | null;
  parentEmail: string | null;
  classRoomId: number | null;
  className: string | null;
  gender: string | null;
  sectionName: string | null;
  admittedAt: string;
  hasPassportPhoto: boolean;
  nationality: string | null;
  countryCode: string | null;
  countryName: string | null;
  district: string | null;
  registrationType: string;
  lastClassAttended: string | null;
  lastTermYear: string | null;
  previousReportCardFilename: string | null;
  previousGrades: string | null;
  transferReason: string | null;
  parentAliveStatus: string | null;
  parentFullName: string | null;
  parentPhone: string | null;
  parentAddress: string | null;
  religion: string | null;
  specialNeeds: string | null;
  boardingStatus: string | null;
  residenceAddress: string | null;
  medicalInfo: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
  bursaryPercentage: number;
  bursaryStartsAt: string | null;
  bursaryEndsAt: string | null;
};

export type ClassRoomOption = {
  id: number;
  name: string;
  categoryId?: number | null;
  categoryName?: string | null;
  description?: string | null;
  isActive?: boolean;
  academicYear: string;
};

export type ClassSectionOption = {
  id: number;
  classRoomId: number;
  name: string;
  classTeacherName?: string | null;
  academicYear: string;
};

export type ClassCategoryOption = {
  id: number;
  name: string;
  description: string | null;
  classesCount?: number;
};

export type TeacherOption = {
  id: number;
  displayName: string;
};

export type StudentSortBy = "date" | "id" | "name" | "class" | "boarding";
export type StudentSortDir = "asc" | "desc";

export async function fetchStudents(opts: StudentListQueryInput): Promise<{ items: StudentApiRow[]; total: number }> {
  const p = new URLSearchParams();
  const query = typeof opts.q === "string" ? opts.q.trim() : "";
  if (query) p.set("q", query);
  p.set("sortBy", opts.sortBy ?? "date");
  p.set("sortDir", opts.sortDir ?? "desc");
  if (opts.classRoomId != null) p.set("classRoomId", String(opts.classRoomId));
  if (
    opts.boardingStatus === "boarding" ||
    opts.boardingStatus === "day_half" ||
    opts.boardingStatus === "day_full"
  ) {
    p.set("boardingStatus", opts.boardingStatus);
  }
  if (opts.limit != null) p.set("limit", String(opts.limit));
  if (opts.offset != null) p.set("offset", String(opts.offset));
  const res = await fetch(apiUrl(`/api/me/students?${p.toString()}`), {
    headers: { ...authHeaders() },
  });
  if (res.status === 401) throw new Error("Unauthorized");
  if (!res.ok) {
    const err = await readJson<{ error?: string }>(res).catch(() => null);
    throw new Error(err?.error ?? "Request failed");
  }
  return readJson<{ items: StudentApiRow[]; total: number }>(res);
}

export async function fetchStudent(id: number): Promise<StudentApiRow> {
  const res = await fetch(apiUrl(`/api/me/students/${id}`), {
    headers: { ...authHeaders() },
  });
  if (res.status === 401) throw new Error("Unauthorized");
  if (!res.ok) {
    const err = await readJson<{ error?: string }>(res).catch(() => null);
    throw new Error(err?.error ?? "Request failed");
  }
  const data = await readJson<{ item: StudentApiRow }>(res);
  return data.item;
}

export async function fetchClassrooms(): Promise<ClassRoomOption[]> {
  const res = await fetch(apiUrl("/api/me/classrooms"), {
    headers: { ...authHeaders() },
  });
  if (res.status === 401) throw new Error("Unauthorized");
  if (!res.ok) {
    const err = await readJson<{ error?: string }>(res).catch(() => null);
    throw new Error(err?.error ?? "Request failed");
  }
  const data = await readJson<{ items: ClassRoomOption[] }>(res);
  return data.items;
}

export async function createClassroom(body: {
  name: string;
  categoryId: number;
  description?: string;
  academicYear?: string;
}): Promise<ClassRoomOption> {
  const res = await fetch(apiUrl("/api/me/classrooms"), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body),
  });
  if (res.status === 401) throw new Error("Unauthorized");
  if (!res.ok) {
    const err = await readJson<{ error?: string }>(res).catch(() => null);
    throw new Error(err?.error ?? "Request failed");
  }
  const data = await readJson<{ item: ClassRoomOption }>(res);
  return data.item;
}

export async function updateClassroom(
  id: number,
  body: { name?: string; categoryId?: number; description?: string },
): Promise<ClassRoomOption> {
  const res = await fetch(apiUrl(`/api/me/classrooms/${id}`), {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body),
  });
  if (res.status === 401) throw new Error("Unauthorized");
  if (!res.ok) {
    const err = await readJson<{ error?: string }>(res).catch(() => null);
    throw new Error(err?.error ?? "Request failed");
  }
  const data = await readJson<{ item: ClassRoomOption }>(res);
  return data.item;
}

export async function deleteClassroom(id: number): Promise<void> {
  const res = await fetch(apiUrl(`/api/me/classrooms/${id}`), {
    method: "DELETE",
    headers: { ...authHeaders() },
  });
  if (res.status === 401) throw new Error("Unauthorized");
  if (!res.ok && res.status !== 204) {
    const err = await readJson<{ error?: string }>(res).catch(() => null);
    throw new Error(err?.error ?? "Request failed");
  }
}

export async function disableClassroom(id: number): Promise<void> {
  const res = await fetch(apiUrl(`/api/me/classrooms/${id}/disable`), {
    method: "PATCH",
    headers: { ...authHeaders() },
  });
  if (res.status === 401) throw new Error("Unauthorized");
  if (!res.ok) {
    const err = await readJson<{ error?: string }>(res).catch(() => null);
    throw new Error(err?.error ?? "Request failed");
  }
}

export async function fetchClassSections(classRoomId?: number): Promise<ClassSectionOption[]> {
  const p = new URLSearchParams();
  if (classRoomId != null) p.set("classRoomId", String(classRoomId));
  const q = p.toString();
  const res = await fetch(apiUrl(`/api/me/class-sections${q ? `?${q}` : ""}`), {
    headers: { ...authHeaders() },
  });
  if (res.status === 401) throw new Error("Unauthorized");
  if (!res.ok) {
    const err = await readJson<{ error?: string }>(res).catch(() => null);
    throw new Error(err?.error ?? "Request failed");
  }
  const data = await readJson<{ items: ClassSectionOption[] }>(res);
  return data.items;
}

export async function createClassSection(body: {
  classRoomId: number;
  name: string;
  classTeacherName?: string;
  academicYear?: string;
}): Promise<ClassSectionOption> {
  const res = await fetch(apiUrl("/api/me/class-sections"), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body),
  });
  if (res.status === 401) throw new Error("Unauthorized");
  if (!res.ok) {
    const err = await readJson<{ error?: string }>(res).catch(() => null);
    throw new Error(err?.error ?? "Request failed");
  }
  const data = await readJson<{ item: ClassSectionOption }>(res);
  return data.item;
}

export async function updateClassSection(
  id: number,
  body: { classRoomId?: number; name?: string; classTeacherName?: string },
): Promise<ClassSectionOption> {
  const res = await fetch(apiUrl(`/api/me/class-sections/${id}`), {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body),
  });
  if (res.status === 401) throw new Error("Unauthorized");
  if (!res.ok) {
    const err = await readJson<{ error?: string }>(res).catch(() => null);
    throw new Error(err?.error ?? "Request failed");
  }
  const data = await readJson<{ item: ClassSectionOption }>(res);
  return data.item;
}

export async function deleteClassSection(id: number): Promise<void> {
  const res = await fetch(apiUrl(`/api/me/class-sections/${id}`), {
    method: "DELETE",
    headers: { ...authHeaders() },
  });
  if (res.status === 401) throw new Error("Unauthorized");
  if (!res.ok && res.status !== 204) {
    const err = await readJson<{ error?: string }>(res).catch(() => null);
    throw new Error(err?.error ?? "Request failed");
  }
}

export async function fetchClassCategories(): Promise<ClassCategoryOption[]> {
  const res = await fetch(apiUrl("/api/me/class-categories"), {
    headers: { ...authHeaders() },
  });
  if (res.status === 401) throw new Error("Unauthorized");
  if (!res.ok) {
    const err = await readJson<{ error?: string }>(res).catch(() => null);
    throw new Error(err?.error ?? "Request failed");
  }
  const data = await readJson<{ items: ClassCategoryOption[] }>(res);
  return data.items;
}

export async function fetchTeachers(): Promise<TeacherOption[]> {
  const res = await fetch(apiUrl("/api/me/teachers"), {
    headers: { ...authHeaders() },
  });
  if (res.status === 401) throw new Error("Unauthorized");
  if (!res.ok) {
    const err = await readJson<{ error?: string }>(res).catch(() => null);
    throw new Error(err?.error ?? "Request failed");
  }
  const data = await readJson<{ items: TeacherOption[] }>(res);
  return data.items;
}

export async function createClassCategory(body: {
  name: string;
  description?: string;
}): Promise<ClassCategoryOption> {
  const res = await fetch(apiUrl("/api/me/class-categories"), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body),
  });
  if (res.status === 401) throw new Error("Unauthorized");
  if (!res.ok) {
    const err = await readJson<{ error?: string }>(res).catch(() => null);
    throw new Error(err?.error ?? "Request failed");
  }
  const data = await readJson<{ item: ClassCategoryOption }>(res);
  return data.item;
}

export async function updateClassCategory(
  id: number,
  body: { name?: string; description?: string },
): Promise<ClassCategoryOption> {
  const res = await fetch(apiUrl(`/api/me/class-categories/${id}`), {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body),
  });
  if (res.status === 401) throw new Error("Unauthorized");
  if (!res.ok) {
    const err = await readJson<{ error?: string }>(res).catch(() => null);
    throw new Error(err?.error ?? "Request failed");
  }
  const data = await readJson<{ item: ClassCategoryOption }>(res);
  return data.item;
}

export async function deleteClassCategory(id: number): Promise<void> {
  const res = await fetch(apiUrl(`/api/me/class-categories/${id}`), {
    method: "DELETE",
    headers: { ...authHeaders() },
  });
  if (res.status === 401) throw new Error("Unauthorized");
  if (!res.ok && res.status !== 204) {
    const err = await readJson<{ error?: string }>(res).catch(() => null);
    throw new Error(err?.error ?? "Request failed");
  }
}

export type CreateStudentBody = StudentCreateBodyInput;

export async function createStudent(body: CreateStudentBody): Promise<StudentApiRow> {
  const res = await fetch(apiUrl("/api/me/students"), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body),
  });
  if (res.status === 401) throw new Error("Unauthorized");
  if (!res.ok) {
    const err = await readJson<{ error?: string }>(res).catch(() => null);
    throw new Error(err?.error ?? "Request failed");
  }
  const data = await readJson<{ item: StudentApiRow }>(res);
  return data.item;
}

export type UpdateStudentBody = StudentUpdateBodyInput;

export async function updateStudent(
  id: number,
  body: UpdateStudentBody,
): Promise<StudentApiRow> {
  const res = await fetch(apiUrl(`/api/me/students/${id}`), {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body),
  });
  if (res.status === 401) throw new Error("Unauthorized");
  if (!res.ok) {
    const err = await readJson<{ error?: string }>(res).catch(() => null);
    throw new Error(err?.error ?? "Request failed");
  }
  const data = await readJson<{ item: StudentApiRow }>(res);
  return data.item;
}

export async function deleteStudent(id: number): Promise<void> {
  const res = await fetch(apiUrl(`/api/me/students/${id}`), {
    method: "DELETE",
    headers: { ...authHeaders() },
  });
  if (res.status === 401) throw new Error("Unauthorized");
  if (res.status === 404) throw new Error("Not found");
  if (!res.ok) {
    const err = await readJson<{ error?: string }>(res).catch(() => null);
    throw new Error(err?.error ?? "Request failed");
  }
}

export async function uploadStudentPhoto(id: number, file: File): Promise<StudentApiRow> {
  const fd = new FormData();
  fd.append("photo", file);
  const res = await fetch(apiUrl(`/api/me/students/${id}/photo`), {
    method: "POST",
    headers: { ...authHeaders() },
    body: fd,
  });
  if (res.status === 401) throw new Error("Unauthorized");
  if (!res.ok) {
    const err = await readJson<{ error?: string }>(res).catch(() => null);
    throw new Error(err?.error ?? "Request failed");
  }
  const data = await readJson<{ item: StudentApiRow }>(res);
  return data.item;
}

export async function uploadStudentTransferReport(
  id: number,
  file: File,
): Promise<StudentApiRow> {
  const fd = new FormData();
  fd.append("report", file);
  const res = await fetch(apiUrl(`/api/me/students/${id}/transfer-report`), {
    method: "POST",
    headers: { ...authHeaders() },
    body: fd,
  });
  if (res.status === 401) throw new Error("Unauthorized");
  if (!res.ok) {
    const err = await readJson<{ error?: string }>(res).catch(() => null);
    throw new Error(err?.error ?? "Request failed");
  }
  const data = await readJson<{ item: StudentApiRow }>(res);
  return data.item;
}

export type StaffMemberApiRow = {
  id: number;
  userId: number | null;
  staffType: string;
  displayName: string;
  email: string | null;
  staffRole: string;
  phone: string | null;
  address: string | null;
  gender: string | null;
  dateOfBirth: string | null;
  nationality: string | null;
  maritalStatus: string | null;
  nationalId: string | null;
  qualification: string | null;
  languages: string | null;
  dateOfJoining: string | null;
  experience: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  refereeName: string | null;
  refereeContact: string | null;
  staffPhotoUrl: string | null;
  staffPhotoName: string | null;
  assignedClass: string | null;
  teachingSection: string | null;
  staffCategory: string | null;
  nationalIdPhotoUrl: string | null;
  nationalIdPhotoName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type StaffMemberWriteBody = {
  staffType: "teaching" | "non_teaching";
  displayName: string;
  email?: string;
  staffRole: string;
  phone?: string;
  address?: string;
  gender?: string;
  dateOfBirth?: string;
  nationality?: string;
  maritalStatus?: string;
  nationalId?: string;
  qualification?: string;
  languages?: string;
  dateOfJoining?: string;
  experience?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  refereeName?: string;
  refereeContact?: string;
  staffPhotoUrl?: string;
  staffPhotoName?: string;
  assignedClass?: string;
  teachingSection?: string;
  staffCategory?: string;
  nationalIdPhotoUrl?: string;
  nationalIdPhotoName?: string;
};

export async function fetchStaffMembers(type?: "teaching" | "non_teaching"): Promise<StaffMemberApiRow[]> {
  const q = type ? `?type=${encodeURIComponent(type)}` : "";
  const res = await fetch(apiUrl(`/api/me/staff-members${q}`), {
    headers: { ...authHeaders() },
  });
  if (res.status === 401) throw new Error("Unauthorized");
  if (!res.ok) {
    const err = await readJson<{ error?: string }>(res).catch(() => null);
    throw new Error(err?.error ?? "Request failed");
  }
  const data = await readJson<{ items: StaffMemberApiRow[] }>(res);
  return data.items;
}

export async function createStaffMember(body: StaffMemberWriteBody): Promise<StaffMemberApiRow> {
  const res = await fetch(apiUrl("/api/me/staff-members"), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body),
  });
  if (res.status === 401) throw new Error("Unauthorized");
  if (!res.ok) {
    const err = await readJson<{ error?: string }>(res).catch(() => null);
    throw new Error(err?.error ?? "Request failed");
  }
  const data = await readJson<{ item: StaffMemberApiRow }>(res);
  return data.item;
}

export async function updateStaffMember(id: number, body: Partial<StaffMemberWriteBody>): Promise<StaffMemberApiRow> {
  const res = await fetch(apiUrl(`/api/me/staff-members/${id}`), {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body),
  });
  if (res.status === 401) throw new Error("Unauthorized");
  if (!res.ok) {
    const err = await readJson<{ error?: string }>(res).catch(() => null);
    throw new Error(err?.error ?? "Request failed");
  }
  const data = await readJson<{ item: StaffMemberApiRow }>(res);
  return data.item;
}

export async function deleteStaffMember(id: number): Promise<void> {
  const res = await fetch(apiUrl(`/api/me/staff-members/${id}`), {
    method: "DELETE",
    headers: { ...authHeaders() },
  });
  if (res.status === 401) throw new Error("Unauthorized");
  if (res.status === 404) throw new Error("Not found");
  if (!res.ok && res.status !== 204) {
    const err = await readJson<{ error?: string }>(res).catch(() => null);
    throw new Error(err?.error ?? "Request failed");
  }
}

export type BulkUploadResult = {
  created: number;
  errors: { line: number; error: string }[];
};

export async function bulkUploadStudentsCsv(file: File): Promise<BulkUploadResult> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(apiUrl("/api/me/students/bulk"), {
    method: "POST",
    headers: { ...authHeaders() },
    body: fd,
  });
  if (res.status === 401) throw new Error("Unauthorized");
  if (!res.ok) {
    const err = await readJson<{ error?: string }>(res).catch(() => null);
    throw new Error(err?.error ?? "Request failed");
  }
  return readJson<BulkUploadResult>(res);
}

export async function bulkCreateStudentsJson(items: CreateStudentBody[]): Promise<{ created: number; results: { admissionNumber?: string; error?: string }[] }> {
  const res = await fetch(apiUrl("/api/me/students/bulk-json"), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ items }),
  });
  if (res.status === 401) throw new Error("Unauthorized");
  if (!res.ok) {
    const err = await readJson<{ error?: string }>(res).catch(() => null);
    throw new Error(err?.error ?? "Request failed");
  }
  return readJson(res);
}

