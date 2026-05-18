import { apiUrl, authHeaders } from "./baseUrl";

async function readJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text.trim()) throw new Error("Empty response");
  return JSON.parse(text) as T;
}

export type ResultEntryOptions = {
  authority: "full" | "restricted";
  terms: string[];
  examTypes: string[];
  classes: Array<{
    id: number;
    name: string;
    categoryId: number | null;
    categoryName: string | null;
    studentCount?: number;
  }>;
  sections: Array<{ id: number; classRoomId: number; name: string }>;
};

export type ExamTypeConfigRow = {
  id: number;
  examKey: string;
  displayName: string;
  isSystem: boolean;
  isActive: boolean;
};

export async function fetchExamTypeConfigs(): Promise<ExamTypeConfigRow[]> {
  const res = await fetch(apiUrl("/api/me/academics/config/exam-types"), {
    headers: { ...authHeaders() },
  });
  if (res.status === 401) throw new Error("Unauthorized");
  if (!res.ok) {
    const err = await readJson<{ error?: string }>(res).catch(() => null);
    throw new Error(err?.error ?? "Request failed");
  }
  const data = await readJson<{ items: ExamTypeConfigRow[] }>(res);
  return data.items;
}

export async function createExamTypeConfig(body: {
  examKey: string;
  displayName: string;
}): Promise<ExamTypeConfigRow> {
  const res = await fetch(apiUrl("/api/me/academics/config/exam-types"), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body),
  });
  if (res.status === 401) throw new Error("Unauthorized");
  if (!res.ok) {
    const err = await readJson<{ error?: string }>(res).catch(() => null);
    throw new Error(err?.error ?? "Request failed");
  }
  const data = await readJson<{ item: ExamTypeConfigRow }>(res);
  return data.item;
}

export async function deleteExamTypeConfig(id: number): Promise<void> {
  const res = await fetch(apiUrl(`/api/me/academics/config/exam-types/${id}`), {
    method: "DELETE",
    headers: { ...authHeaders() },
  });
  if (res.status === 401) throw new Error("Unauthorized");
  if (!res.ok && res.status !== 204) {
    const err = await readJson<{ error?: string }>(res).catch(() => null);
    throw new Error(err?.error ?? "Request failed");
  }
}

export type SubjectAssignmentConfigRow = {
  id: number;
  classCategoryId: number;
  sectionName: string | null;
  subjectName: string;
  shortForm?: string | null;
};

export type SubjectConfigPayload = {
  categories: Array<{ id: number; name: string }>;
  items: SubjectAssignmentConfigRow[];
};

export async function fetchSubjectConfigs(): Promise<SubjectConfigPayload> {
  const res = await fetch(apiUrl("/api/me/academics/config/subjects"), {
    headers: { ...authHeaders() },
  });
  if (res.status === 401) throw new Error("Unauthorized");
  if (!res.ok) {
    const err = await readJson<{ error?: string }>(res).catch(() => null);
    throw new Error(err?.error ?? "Request failed");
  }
  return readJson<SubjectConfigPayload>(res);
}

export async function createSubjectConfig(body: {
  classCategoryId: number;
  sectionName?: string;
  subjectName: string;
  shortForm: string;
}): Promise<SubjectAssignmentConfigRow> {
  const res = await fetch(apiUrl("/api/me/academics/config/subjects"), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body),
  });
  if (res.status === 401) throw new Error("Unauthorized");
  if (!res.ok) {
    const err = await readJson<{ error?: string }>(res).catch(() => null);
    throw new Error(err?.error ?? "Request failed");
  }
  const data = await readJson<{ item: SubjectAssignmentConfigRow }>(res);
  return data.item;
}

export async function updateSubjectConfig(
  id: number,
  body: {
    classCategoryId: number;
    sectionName?: string;
    subjectName: string;
    shortForm: string;
  },
): Promise<SubjectAssignmentConfigRow> {
  const res = await fetch(apiUrl(`/api/me/academics/config/subjects/${id}`), {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body),
  });
  if (res.status === 401) throw new Error("Unauthorized");
  if (!res.ok) {
    const err = await readJson<{ error?: string }>(res).catch(() => null);
    throw new Error(err?.error ?? "Request failed");
  }
  const data = await readJson<{ item: SubjectAssignmentConfigRow }>(res);
  return data.item;
}

export async function deleteSubjectConfig(id: number): Promise<void> {
  const res = await fetch(apiUrl(`/api/me/academics/config/subjects/${id}`), {
    method: "DELETE",
    headers: { ...authHeaders() },
  });
  if (res.status === 401) throw new Error("Unauthorized");
  if (!res.ok && res.status !== 204) {
    const err = await readJson<{ error?: string }>(res).catch(() => null);
    throw new Error(err?.error ?? "Request failed");
  }
}

export async function fetchSubjectAssignmentUsage(id: number): Promise<{ marksCount: number; examsCount: number }> {
  const res = await fetch(apiUrl(`/api/me/academics/config/subjects/${id}/usage`), {
    headers: { ...authHeaders() },
  });
  if (res.status === 401) throw new Error("Unauthorized");
  if (!res.ok) {
    const err = await readJson<{ error?: string }>(res).catch(() => null);
    throw new Error(err?.error ?? "Request failed");
  }
  const data = await readJson<{ marksCount: number; examsCount: number }>(res);
  return { marksCount: Number(data.marksCount) || 0, examsCount: Number(data.examsCount) || 0 };
}

export async function fetchResultEntryOptions(): Promise<ResultEntryOptions> {
  const res = await fetch(apiUrl("/api/me/academics/result-entry/options"), {
    headers: { ...authHeaders() },
  });
  if (res.status === 401) throw new Error("Unauthorized");
  if (!res.ok) {
    const err = await readJson<{ error?: string }>(res).catch(() => null);
    throw new Error(err?.error ?? "Request failed");
  }
  return readJson<ResultEntryOptions>(res);
}

export type PerformanceSummaryRow = {
  classRoomId: number;
  className: string;
  sectionName: string;
  totalStudents: number;
  resultsEntered: number;
  avgScore: number | null;
  passRate: number | null;
  topScore: number | null;
};

export async function fetchPerformanceSummary(
  term: string,
  examType: string,
  academicYear: string,
): Promise<PerformanceSummaryRow[]> {
  const q = new URLSearchParams({ term, examType, academicYear });
  const res = await fetch(apiUrl(`/api/me/academics/performance-summary?${q.toString()}`), {
    headers: { ...authHeaders() },
  });
  if (res.status === 401) throw new Error("Unauthorized");
  if (!res.ok) {
    const err = await readJson<{ error?: string }>(res).catch(() => null);
    throw new Error(err?.error ?? "Request failed");
  }
  const data = await readJson<{ rows: PerformanceSummaryRow[] }>(res);
  return (data.rows ?? []).map((r) => ({
    classRoomId: Number((r as any).classRoomId) || 0,
    className: String((r as any).className ?? ""),
    sectionName: String((r as any).sectionName ?? ""),
    totalStudents: Number((r as any).totalStudents) || 0,
    resultsEntered: Number((r as any).resultsEntered) || 0,
    avgScore: (r as any).avgScore == null ? null : Number((r as any).avgScore),
    passRate: (r as any).passRate == null ? null : Number((r as any).passRate),
    topScore: (r as any).topScore == null ? null : Number((r as any).topScore),
  }));
}

export type ResultEntryStudentRow = {
  studentId: number;
  admissionNumber: string;
  fullName: string;
  classRoomId: number | null;
  sectionName: string | null;
  hasResults: boolean;
};

export async function fetchResultEntryStudents(params: {
  term: string;
  examType: string;
  classRoomId: number;
  academicYear: string;
  sectionName?: string;
}): Promise<ResultEntryStudentRow[]> {
  const q = new URLSearchParams({
    term: params.term,
    examType: params.examType,
    classRoomId: String(params.classRoomId),
    academicYear: params.academicYear,
  });
  if (params.sectionName?.trim()) q.set("sectionName", params.sectionName.trim());
  const res = await fetch(apiUrl(`/api/me/academics/result-entry/students?${q.toString()}`), {
    headers: { ...authHeaders() },
  });
  if (res.status === 401) throw new Error("Unauthorized");
  if (!res.ok) {
    const err = await readJson<{ error?: string }>(res).catch(() => null);
    throw new Error(err?.error ?? "Request failed");
  }
  const data = await readJson<{ items: ResultEntryStudentRow[] }>(res);
  return data.items;
}

export type GeneratedMarksheetRow = {
  studentId: number;
  admissionNumber: string;
  fullName: string;
  sectionName: string | null;
  gender?: string | null;
  hasPassportPhoto?: boolean;
  marksBySubject: Record<string, number | null>;
  totalMarks: number;
  position: number;
};

export type GeneratedMarksheetPayload = {
  classRoomId: number;
  className: string;
  categoryId: number | null;
  categoryName: string | null;
  term: string;
  academicYear?: string;
  examType: string;
  subjects: string[];
  subjectsMeta?: Array<{ name: string; shortForm: string | null }>;
  hasMissingSubjectShortForms?: boolean;
  rows: GeneratedMarksheetRow[];
};

export async function generateClassMarksheet(params: {
  term: string;
  examType: string;
  classRoomId: number;
  academicYear: string;
}): Promise<GeneratedMarksheetPayload> {
  const q = new URLSearchParams({
    term: params.term,
    examType: params.examType,
    classRoomId: String(params.classRoomId),
    academicYear: params.academicYear,
  });
  const res = await fetch(apiUrl(`/api/me/academics/result-entry/marksheet?${q.toString()}`), {
    headers: { ...authHeaders() },
  });
  if (res.status === 401) throw new Error("Unauthorized");
  if (!res.ok) {
    const err = await readJson<{ error?: string }>(res).catch(() => null);
    throw new Error(err?.error ?? "Request failed");
  }
  const data = await readJson<{ item: GeneratedMarksheetPayload }>(res);
  return data.item;
}

export type PendingResultEntryStudentRow = {
  studentId: number;
  admissionNumber: string;
  fullName: string;
  className: string;
  sectionName: string;
  classRoomId: number | null;
  hasResults: boolean;
};

export async function fetchPendingResultEntryStudents(params: {
  term: string;
  examType: string;
  academicYear: string;
  includeSaved?: boolean;
}): Promise<PendingResultEntryStudentRow[]> {
  const q = new URLSearchParams({
    term: params.term,
    examType: params.examType,
    academicYear: params.academicYear,
  });
  if (params.includeSaved) q.set("includeSaved", "true");
  const res = await fetch(apiUrl(`/api/me/academics/result-entry/pending-students?${q.toString()}`), {
    headers: { ...authHeaders() },
  });
  if (res.status === 401) throw new Error("Unauthorized");
  if (!res.ok) {
    const err = await readJson<{ error?: string }>(res).catch(() => null);
    throw new Error(err?.error ?? "Request failed");
  }
  const data = await readJson<{ items: PendingResultEntryStudentRow[] }>(res);
  return data.items;
}

export type StudentSubjectMarkRow = {
  subject: string;
  score: number | null;
};

export type StudentMarkEntryPayload = {
  studentId: number;
  admissionNumber: string;
  fullName: string;
  classRoomId: number;
  className: string;
  sectionName: string | null;
  term: string;
  academicYear?: string;
  examType: string;
  subjects: StudentSubjectMarkRow[];
};

export async function fetchStudentMarkEntry(params: {
  studentId: number;
  term: string;
  examType: string;
  academicYear: string;
}): Promise<StudentMarkEntryPayload> {
  const q = new URLSearchParams({
    term: params.term,
    examType: params.examType,
    academicYear: params.academicYear,
  });
  const res = await fetch(
    apiUrl(`/api/me/academics/result-entry/student/${params.studentId}?${q.toString()}`),
    { headers: { ...authHeaders() } },
  );
  if (res.status === 401) throw new Error("Unauthorized");
  if (!res.ok) {
    const err = await readJson<{ error?: string }>(res).catch(() => null);
    throw new Error(err?.error ?? "Request failed");
  }
  const data = await readJson<{ item: StudentMarkEntryPayload }>(res);
  return data.item;
}

export async function saveStudentMarkEntry(body: {
  studentId: number;
  term: string;
  examType: string;
  academicYear?: string;
  marks: Array<{ subject: string; score: number }>;
}): Promise<{ ok: boolean; saved: number }> {
  const res = await fetch(apiUrl(`/api/me/academics/result-entry/student/${body.studentId}/marks`), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({
      term: body.term,
      examType: body.examType,
      academicYear: body.academicYear,
      marks: body.marks,
    }),
  });
  if (res.status === 401) throw new Error("Unauthorized");
  if (!res.ok) {
    const err = await readJson<{ error?: string }>(res).catch(() => null);
    throw new Error(err?.error ?? "Request failed");
  }
  return readJson<{ ok: boolean; saved: number }>(res);
}

export type UpcomingExamRow = {
  id: number;
  examKey: string;
  className: string;
  subject: string;
  examDate: string;
};

export async function fetchUpcomingExams(): Promise<UpcomingExamRow[]> {
  const res = await fetch(apiUrl("/api/me/exams/upcoming"), {
    headers: { ...authHeaders() },
  });
  if (res.status === 401) throw new Error("Unauthorized");
  if (!res.ok) {
    const err = await readJson<{ error?: string }>(res).catch(() => null);
    throw new Error(err?.error ?? "Request failed");
  }
  const data = await readJson<{ items: UpcomingExamRow[] }>(res);
  return data.items;
}

export type ExamPerformanceSummaryRow = {
  classRoomId: number;
  className: string;
  avgScore: string;
};

export async function fetchExamsPerformanceSummary(
  term: string,
  academicYear: string,
): Promise<ExamPerformanceSummaryRow[]> {
  const q = new URLSearchParams({ term, academicYear });
  const res = await fetch(apiUrl(`/api/me/exams/performance-summary?${q.toString()}`), {
    headers: { ...authHeaders() },
  });
  if (res.status === 401) throw new Error("Unauthorized");
  if (!res.ok) {
    const err = await readJson<{ error?: string }>(res).catch(() => null);
    throw new Error(err?.error ?? "Request failed");
  }
  const data = await readJson<{ items: ExamPerformanceSummaryRow[] }>(res);
  return data.items;
}

export type GradingScaleRow = {
  id: number;
  name: string;
  thresholds: any;
};

export async function fetchGradingScales(): Promise<GradingScaleRow[]> {
  const res = await fetch(apiUrl("/api/me/academics/config/grading-scale"), {
    headers: { ...authHeaders() },
  });
  if (res.status === 401) throw new Error("Unauthorized");
  if (!res.ok) {
    const err = await readJson<{ error?: string }>(res).catch(() => null);
    throw new Error(err?.error ?? "Failed to load grading scale");
  }
  const data = await readJson<{ items: any[] }>(res);
  return [
    {
      id: 1,
      name: "Global Scale",
      thresholds: data.items ?? [],
    },
  ];
}

export async function saveGradingScale(body: any): Promise<GradingScaleRow> {
  const res = await fetch(apiUrl("/api/me/academics/config/grading-scale"), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ items: body.thresholds ?? [] }),
  });
  if (res.status === 401) throw new Error("Unauthorized");
  if (!res.ok) {
    const err = await readJson<{ error?: string }>(res).catch(() => null);
    throw new Error(err?.error ?? "Failed to save grading scale");
  }
  const data = await readJson<{ items: any[] }>(res);
  return {
    id: Number(body.id ?? 1),
    name: String(body.name ?? "Global Scale"),
    thresholds: data.items ?? [],
  };
}

export type ReportCommentRow = {
  id: number;
  studentId: number;
  term: string;
  comment: string;
};

export async function fetchReportComments(studentId: number): Promise<ReportCommentRow[]> {
  const res = await fetch(apiUrl(`/api/me/exams/comments/${studentId}`), {
    headers: { ...authHeaders() },
  });
  return readJson<{ items: ReportCommentRow[] }>(res).then(d => d.items);
}

export async function saveReportComment(body: any): Promise<ReportCommentRow> {
  const res = await fetch(apiUrl("/api/me/exams/comments"), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body),
  });
  return readJson<{ item: ReportCommentRow }>(res).then(d => d.item);
}

export async function fetchExams(classRoomId?: number): Promise<UpcomingExamRow[]> {
  const q = classRoomId ? `?classRoomId=${classRoomId}` : "";
  const res = await fetch(apiUrl(`/api/me/exams/list${q}`), {
    headers: { ...authHeaders() },
  });
  return readJson<{ items: UpcomingExamRow[] }>(res).then(d => d.items);
}

export async function fetchAssessmentExamTypesForPeriod(params: {
  term: string;
  academicYear: string;
}): Promise<string[]> {
  const q = new URLSearchParams({ term: params.term, academicYear: params.academicYear });
  const res = await fetch(apiUrl(`/api/me/academics/historical/assessment-exam-types?${q.toString()}`), {
    headers: { ...authHeaders() },
  });
  if (res.status === 401) throw new Error("Unauthorized");
  if (!res.ok) {
    const err = await readJson<{ error?: string }>(res).catch(() => null);
    throw new Error(err?.error ?? "Request failed");
  }
  const data = await readJson<{ examTypes: string[] }>(res);
  return (data.examTypes ?? []).map((x) => String(x).trim()).filter(Boolean);
}

export async function createExam(body: any): Promise<UpcomingExamRow> {
  const res = await fetch(apiUrl("/api/me/exams/create"), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body),
  });
  return readJson<{ item: UpcomingExamRow }>(res).then(d => d.item);
}
