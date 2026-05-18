import { useCallback, useEffect, useMemo, useState } from "react";
import { apiUrl } from "../../api/baseUrl";
import {
  fetchExamTypeConfigs,
  fetchGradingScales,
  generateClassMarksheet,
  saveStudentMarkEntry,
  fetchStudentMarkEntry,
  type GeneratedMarksheetPayload,
  type GradingScaleRow,
} from "../../api/academics";
import { fetchClassCategories, fetchClassrooms, fetchClassSections, type ClassCategoryOption, type ClassRoomOption, type ClassSectionOption } from "../../api/students";
import { useTermContext } from "../../context/TermContext";

type ViewMode = "list" | "entry" | "transcript";

type Props = {
  viewMode: ViewMode;
  userRole: string | null;
  userPermissions: string[];
};

type ToastMessage = { type: "success" | "error"; message: string };

function Toast({ toast, onClose }: { toast: ToastMessage; onClose: () => void }) {
  return (
    <div
      className={`fixed top-4 right-4 z-50 max-w-[92vw] rounded-xl px-4 py-3 shadow-lg ring-1 backdrop-blur ${
        toast.type === "success"
          ? "bg-emerald-50/90 text-emerald-800 ring-emerald-200"
          : "bg-red-50/90 text-red-800 ring-red-200"
      }`}
      role="status"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 text-sm">{toast.type === "success" ? "✅" : "❌"}</div>
        <div className="text-sm font-semibold">{toast.message}</div>
        <button
          type="button"
          className="ml-1 rounded-full p-1 opacity-70 hover:bg-black/5 hover:opacity-100 transition"
          onClick={onClose}
          aria-label="Dismiss"
          title="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

type GradingBand = { grade: string; minScore: number; maxScore: number; aggregate: number };

function parseGradingThresholds(scale: GradingScaleRow | null): GradingBand[] {
  const raw = (scale?.thresholds ?? []) as any[];
  if (!Array.isArray(raw)) return [];
  const out: GradingBand[] = [];
  for (const r of raw) {
    const grade = String(r?.grade ?? "").trim();
    const minScore = Number(r?.minScore);
    const maxScore = Number(r?.maxScore);
    const aggregate = Number(r?.aggregate);
    if (!grade) continue;
    if (!Number.isFinite(minScore) || !Number.isFinite(maxScore) || !Number.isFinite(aggregate)) continue;
    out.push({ grade, minScore, maxScore, aggregate: Math.trunc(aggregate) });
  }
  return out.sort((a, b) => b.minScore - a.minScore || a.aggregate - b.aggregate);
}

function gradeForScore(score: number, bands: GradingBand[]): GradingBand | null {
  if (!Number.isFinite(score)) return null;
  const s = Math.max(0, Math.min(100, score));
  for (const b of bands) {
    if (s >= b.minScore && s <= b.maxScore) return b;
  }
  return bands[bands.length - 1] ?? null;
}

function canAccessResultsEntry(userRole: string | null, permissions: string[]): boolean {
  const r = String(userRole ?? "").toLowerCase();
  if (r === "admin" || r === "super_admin") return true;
  return permissions.includes("results_entry");
}

function Spinner({ label }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-xs text-slate-500">
      <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-200 border-t-slate-500" />
      {label ?? "Loading"}
    </span>
  );
}

function Placeholder({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="bg-white rounded-2xl p-10 text-center text-slate-600 shadow-sm border border-slate-100">
      <div className="text-lg font-bold text-slate-800">{title}</div>
      {subtitle ? <div className="mt-1 text-sm text-slate-500">{subtitle}</div> : null}
    </div>
  );
}

function MarkEntryModal({
  open,
  onClose,
  onSaved,
  studentId,
  header,
  term,
  academicYear,
  examType,
  gradingBands,
  toast,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (marksBySubject: Record<string, number>) => void;
  studentId: number | null;
  header: {
    fullName: string;
    admissionNumber: string;
    className: string;
    sectionName: string | null;
    hasPassportPhoto?: boolean;
  } | null;
  term: string;
  academicYear: string;
  examType: string;
  gradingBands: GradingBand[];
  toast: (t: ToastMessage) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [subjects, setSubjects] = useState<Array<{ subject: string; score: number | null }>>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open || !studentId) return;
    let cancelled = false;
    setLoading(true);
    setErrors({});
    void fetchStudentMarkEntry({ studentId, term, examType, academicYear })
      .then((item) => {
        if (cancelled) return;
        const list = (item.subjects ?? []).map((s) => ({ subject: s.subject, score: s.score ?? null }));
        setSubjects(list);
        const next: Record<string, string> = {};
        for (const s of list) next[s.subject] = s.score == null ? "" : String(s.score);
        setValues(next);
      })
      .catch((e) => {
        if (cancelled) return;
        toast({ type: "error", message: e instanceof Error ? e.message : "Failed to load marks entry." });
        onClose();
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, studentId, term, examType, academicYear, toast, onClose]);

  const validate = useCallback((): boolean => {
    const nextErrors: Record<string, string> = {};
    for (const s of subjects) {
      const raw = (values[s.subject] ?? "").trim();
      if (!raw) {
        nextErrors[s.subject] = "Required";
        continue;
      }
      const n = Number(raw);
      if (!Number.isFinite(n)) {
        nextErrors[s.subject] = "Invalid number";
        continue;
      }
      if (n < 0 || n > 100) {
        nextErrors[s.subject] = "Must be 0–100";
        continue;
      }
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }, [subjects, values]);

  const save = useCallback(async () => {
    if (!studentId) return;
    if (!validate()) return;
    const marks = subjects.map((s) => ({ subject: s.subject, score: Number((values[s.subject] ?? "").trim()) }));
    setSaving(true);
    try {
      await saveStudentMarkEntry({
        studentId,
        term,
        examType,
        academicYear,
        marks,
      });
      const map: Record<string, number> = {};
      for (const m of marks) map[m.subject] = m.score;
      onSaved(map);
      toast({ type: "success", message: "Marks saved." });
      onClose();
    } catch (e) {
      toast({ type: "error", message: e instanceof Error ? e.message : "Failed to save marks." });
    } finally {
      setSaving(false);
    }
  }, [studentId, validate, subjects, values, term, examType, academicYear, onSaved, toast, onClose]);

  if (!open) return null;

  const photoUrl = studentId ? apiUrl(`/api/me/students/${studentId}/photo`) : "";

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div className="absolute inset-0 flex items-end sm:items-center justify-center p-3 sm:p-6">
        <div className="w-full max-w-4xl rounded-2xl bg-white shadow-xl border border-slate-100 overflow-hidden">
          <div className="p-5 sm:p-6 border-b border-slate-100">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                <div className="h-12 w-12 rounded-full bg-slate-100 overflow-hidden shrink-0 ring-1 ring-slate-200">
                  {header?.hasPassportPhoto && studentId ? (
                    <img
                      src={photoUrl}
                      alt=""
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = "none";
                      }}
                    />
                  ) : null}
                </div>
                <div className="min-w-0">
                  <div className="text-base sm:text-lg font-bold text-slate-800 truncate">
                    {header?.fullName ?? "Student"}
                  </div>
                  <div className="text-xs sm:text-sm text-slate-500">
                    Adm: <span className="font-semibold text-slate-700">{header?.admissionNumber ?? "—"}</span>
                    {" · "}
                    <span className="font-semibold text-slate-700">{header?.className ?? "—"}</span>
                    {header?.sectionName ? ` · ${header.sectionName}` : ""}
                    {" · "}
                    <span className="font-semibold text-slate-700">{examType}</span>
                    {" · "}
                    <span className="text-slate-500">{term} {academicYear}</span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 border border-slate-200"
              >
                Close
              </button>
            </div>
          </div>

          <div className="p-5 sm:p-6">
            {loading ? (
              <div className="h-40 bg-slate-100 rounded-xl animate-pulse" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[520px]">
                  <thead className="bg-slate-50 border border-slate-100">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Subject</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase w-[160px]">Marks</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase w-[120px]">Grade</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 border border-slate-100 border-t-0">
                    {subjects.map((s) => {
                      const raw = (values[s.subject] ?? "").trim();
                      const n = raw ? Number(raw) : NaN;
                      const band = Number.isFinite(n) ? gradeForScore(n, gradingBands) : null;
                      const err = errors[s.subject];
                      return (
                        <tr key={s.subject} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-semibold text-slate-800">{s.subject}</td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              inputMode="numeric"
                              min={0}
                              max={100}
                              value={values[s.subject] ?? ""}
                              onChange={(e) => {
                                const v = e.target.value;
                                setValues((p) => ({ ...p, [s.subject]: v }));
                                setErrors((p) => {
                                  if (!p[s.subject]) return p;
                                  const { [s.subject]: _, ...rest } = p;
                                  return rest;
                                });
                              }}
                              className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                                err
                                  ? "border-red-300 focus:ring-red-300"
                                  : "border-slate-200 focus:ring-blue-400"
                              }`}
                              placeholder="0–100"
                              required
                            />
                            {err ? <div className="mt-1 text-xs text-red-600 font-semibold">{err}</div> : null}
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-2">
                              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-700 ring-1 ring-slate-200">
                                {band?.grade ?? "—"}
                              </span>
                              {band ? (
                                <span className="text-xs text-slate-500">Agg {band.aggregate}</span>
                              ) : null}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {subjects.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-4 py-12 text-center text-slate-400">
                          No subjects configured for this class category.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-5 flex flex-col sm:flex-row gap-3 justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void save()}
                disabled={saving || loading || subjects.length === 0}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-500 text-white font-semibold shadow-sm"
              >
                {saving ? "Saving…" : "Save Marks"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ResultsEntryPage({
  userRole,
  userPermissions,
}: {
  userRole: string | null;
  userPermissions: string[];
}) {
  const termCtx = useTermContext();
  const [toastState, setToastState] = useState<ToastMessage | null>(null);
  const toast = useCallback((t: ToastMessage) => {
    setToastState(t);
    window.setTimeout(() => setToastState(null), 3500);
  }, []);

  const [categories, setCategories] = useState<ClassCategoryOption[]>([]);
  const [classes, setClasses] = useState<ClassRoomOption[]>([]);
  const [sections, setSections] = useState<ClassSectionOption[]>([]);
  const [examTypes, setExamTypes] = useState<Array<{ key: string; label: string }>>([]);
  const [gradingScale, setGradingScale] = useState<GradingScaleRow | null>(null);

  const [loadingCategories, setLoadingCategories] = useState(false);
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [loadingExamTypes, setLoadingExamTypes] = useState(false);
  const [loadingSections, setLoadingSections] = useState(false);
  const [loadingScale, setLoadingScale] = useState(false);

  const [categoryId, setCategoryId] = useState<number | "">("");
  const [classRoomId, setClassRoomId] = useState<number | "">("");
  const [sectionName, setSectionName] = useState<string>("");
  const [examType, setExamType] = useState<string>("");

  const [marksheet, setMarksheet] = useState<GeneratedMarksheetPayload | null>(null);
  const [fetching, setFetching] = useState(false);

  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState<10 | 25 | 50>(25);

  const [modalOpen, setModalOpen] = useState(false);
  const [activeStudentId, setActiveStudentId] = useState<number | null>(null);
  const [activeHeader, setActiveHeader] = useState<{
    fullName: string;
    admissionNumber: string;
    className: string;
    sectionName: string | null;
    hasPassportPhoto?: boolean;
  } | null>(null);

  const canAccess = useMemo(
    () => canAccessResultsEntry(userRole, userPermissions),
    [userRole, userPermissions],
  );

  useEffect(() => {
    let cancelled = false;
    setLoadingCategories(true);
    void fetchClassCategories()
      .then((items) => {
        if (cancelled) return;
        setCategories(items);
      })
      .catch((e) => {
        if (cancelled) return;
        toast({ type: "error", message: e instanceof Error ? e.message : "Failed to load categories." });
      })
      .finally(() => {
        if (cancelled) return;
        setLoadingCategories(false);
      });
    return () => {
      cancelled = true;
    };
  }, [toast]);

  useEffect(() => {
    let cancelled = false;
    setLoadingClasses(true);
    void fetchClassrooms()
      .then((items) => {
        if (cancelled) return;
        setClasses(items);
      })
      .catch((e) => {
        if (cancelled) return;
        toast({ type: "error", message: e instanceof Error ? e.message : "Failed to load classes." });
      })
      .finally(() => {
        if (cancelled) return;
        setLoadingClasses(false);
      });
    return () => {
      cancelled = true;
    };
  }, [toast]);

  useEffect(() => {
    let cancelled = false;
    setLoadingExamTypes(true);
    void fetchExamTypeConfigs()
      .then((items) => {
        if (cancelled) return;
        const active = items.filter((x) => x.isActive).map((x) => ({ key: x.examKey, label: x.displayName }));
        setExamTypes(active);
        if (!examType && active.length > 0) setExamType(active[0]!.key);
      })
      .catch((e) => {
        if (cancelled) return;
        toast({ type: "error", message: e instanceof Error ? e.message : "Failed to load exam types." });
      })
      .finally(() => {
        if (cancelled) return;
        setLoadingExamTypes(false);
      });
    return () => {
      cancelled = true;
    };
  }, [toast, examType]);

  useEffect(() => {
    let cancelled = false;
    setLoadingScale(true);
    void fetchGradingScales()
      .then((items) => {
        if (cancelled) return;
        setGradingScale(items[0] ?? null);
      })
      .catch((e) => {
        if (cancelled) return;
        toast({ type: "error", message: e instanceof Error ? e.message : "Failed to load grading scale." });
      })
      .finally(() => {
        if (cancelled) return;
        setLoadingScale(false);
      });
    return () => {
      cancelled = true;
    };
  }, [toast]);

  const classesForCategory = useMemo(() => {
    if (categoryId === "") return classes;
    return classes.filter((c) => (c.categoryId ?? null) === categoryId);
  }, [classes, categoryId]);

  const hasSectionsForSelectedClass = sections.length > 0;

  const fetchSections = useCallback(
    async (clsId: number) => {
      setLoadingSections(true);
      try {
        const items = await fetchClassSections(clsId);
        setSections(items);
      } catch (e) {
        toast({ type: "error", message: e instanceof Error ? e.message : "Failed to load sections." });
        setSections([]);
      } finally {
        setLoadingSections(false);
      }
    },
    [toast],
  );

  const onChangeCategory = useCallback(
    (raw: string) => {
      const id = raw ? Number(raw) : "";
      setCategoryId(Number.isFinite(id as number) ? (id as number) : "");
      setClassRoomId("");
      setSectionName("");
      setSections([]);
      setMarksheet(null);
      setQ("");
      setPage(1);
    },
    [],
  );

  const onChangeClass = useCallback(
    (raw: string) => {
      const id = raw ? Number(raw) : "";
      setClassRoomId(Number.isFinite(id as number) ? (id as number) : "");
      // Spec: selecting a class clears category + section.
      // If the user already chose a category (and therefore picked a class within it), keep it.
      if (categoryId === "") setCategoryId("");
      setSectionName("");
      setSections([]);
      setMarksheet(null);
      setQ("");
      setPage(1);
      if (Number.isFinite(id as number) && (id as number) > 0) {
        void fetchSections(id as number);
      }
    },
    [fetchSections, categoryId],
  );

  const canFetch =
    categoryId !== "" && classRoomId !== "" && Boolean(examType.trim());

  const fetchResults = useCallback(async () => {
    if (!canFetch) return;
    setFetching(true);
    try {
      const item = await generateClassMarksheet({
        term: termCtx.viewingTerm,
        academicYear: termCtx.viewingAcademicYear,
        examType,
        classRoomId: classRoomId as number,
      });
      setMarksheet(item);
      setPage(1);
      setQ("");
    } catch (e) {
      toast({ type: "error", message: e instanceof Error ? e.message : "Failed to fetch results." });
    } finally {
      setFetching(false);
    }
  }, [canFetch, termCtx.viewingTerm, termCtx.viewingAcademicYear, examType, classRoomId, toast]);

  const gradingBands = useMemo(() => parseGradingThresholds(gradingScale), [gradingScale]);

  const selectedClassName = useMemo(() => {
    const id = classRoomId === "" ? null : (classRoomId as number);
    return classes.find((c) => c.id === id)?.name ?? marksheet?.className ?? "—";
  }, [classes, classRoomId, marksheet?.className]);

  const filteredStudents = useMemo(() => {
    const rows = marksheet?.rows ?? [];
    const query = q.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((r) => {
      return (
        r.fullName.toLowerCase().includes(query) ||
        r.admissionNumber.toLowerCase().includes(query)
      );
    });
  }, [marksheet?.rows, q]);

  const summary = useMemo(() => {
    let total = 0;
    let males = 0;
    let females = 0;
    for (const r of filteredStudents) {
      total += 1;
      const g = String(r.gender ?? "").toLowerCase();
      if (g === "male" || g === "m") males += 1;
      else if (g === "female" || g === "f") females += 1;
    }
    return { total, males, females };
  }, [filteredStudents]);

  const totalPages = useMemo(() => {
    const t = Math.max(1, Math.ceil(filteredStudents.length / rowsPerPage));
    return t;
  }, [filteredStudents.length, rowsPerPage]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pageStudents = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return filteredStudents.slice(start, start + rowsPerPage);
  }, [filteredStudents, page, rowsPerPage]);

  const subjects = marksheet?.subjects ?? [];
  const subjectsMeta = useMemo(() => {
    const meta = marksheet?.subjectsMeta ?? null;
    if (meta && meta.length > 0) return meta;
    return subjects.map((name) => ({ name, shortForm: null as string | null }));
  }, [marksheet?.subjectsMeta, subjects]);

  const hasMissingShortForms = Boolean(
    marksheet?.hasMissingSubjectShortForms ??
      subjectsMeta.some((s) => !s.shortForm || !s.shortForm.trim()),
  );

  const pivotRows = useMemo(() => {
    return pageStudents.map((s) => {
      const anyMarks = subjectsMeta.some((sub) => s.marksBySubject[sub.name] != null);
      const complete =
        subjectsMeta.length > 0 && subjectsMeta.every((sub) => s.marksBySubject[sub.name] != null);
      const status: "complete" | "incomplete" = complete ? "complete" : "incomplete";
      const action: "enter" | "edit" = anyMarks ? "edit" : "enter";

      let totalAggregate = 0;
      let aggCount = 0;
      for (const sub of subjectsMeta) {
        const score = s.marksBySubject[sub.name];
        if (score == null) continue;
        const band = gradeForScore(score, gradingBands);
        if (band) {
          totalAggregate += band.aggregate;
          aggCount += 1;
        }
      }

      return {
        studentId: s.studentId,
        admissionNumber: s.admissionNumber,
        fullName: s.fullName,
        sectionName: s.sectionName ?? null,
        hasPassportPhoto: s.hasPassportPhoto,
        marksBySubject: s.marksBySubject,
        totalAggregate: aggCount > 0 ? totalAggregate : null,
        status,
        action,
      };
    });
  }, [pageStudents, subjectsMeta, gradingBands]);

  const onOpenEntry = useCallback(
    (studentId: number) => {
      const s = (marksheet?.rows ?? []).find((x) => x.studentId === studentId);
      if (!s) return;
      setActiveStudentId(studentId);
      setActiveHeader({
        fullName: s.fullName,
        admissionNumber: s.admissionNumber,
        className: marksheet?.className ?? selectedClassName,
        sectionName: s.sectionName ?? null,
        hasPassportPhoto: s.hasPassportPhoto,
      });
      setModalOpen(true);
    },
    [marksheet?.rows, marksheet?.className, selectedClassName],
  );

  const onSaved = useCallback(
    (updated: Record<string, number>) => {
      setMarksheet((prev) => {
        if (!prev || !activeStudentId) return prev;
        return {
          ...prev,
          rows: prev.rows.map((r) => {
            if (r.studentId !== activeStudentId) return r;
            const nextMarks = { ...r.marksBySubject };
            for (const [subject, score] of Object.entries(updated)) {
              nextMarks[subject] = score;
            }
            return { ...r, marksBySubject: nextMarks };
          }),
        };
      });
    },
    [activeStudentId],
  );

  if (!canAccess) {
    return (
      <Placeholder
        title="You don’t have access to Results Entry."
        subtitle="Ask an administrator to grant the results_entry permission (or sign in as admin)."
      />
    );
  }

  return (
    <div className="space-y-4">
      {toastState ? <Toast toast={toastState} onClose={() => setToastState(null)} /> : null}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
        <div className="flex flex-col lg:flex-row lg:items-end gap-3">
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Class</label>
              <div className="relative">
                <select
                  value={classRoomId === "" ? "" : String(classRoomId)}
                  onChange={(e) => onChangeClass(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loadingClasses}
                >
                  <option value="">{loadingClasses ? "Loading classes…" : "Select a class"}</option>
                  {classesForCategory.map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      {c.name}
                    </option>
                  ))}
                </select>
                {loadingClasses ? <div className="absolute right-3 top-3"><Spinner /></div> : null}
              </div>
              <div className="mt-1 text-[11px] text-slate-500">
                Selecting a class clears category & section.
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Category</label>
              <div className="relative">
                <select
                  value={categoryId === "" ? "" : String(categoryId)}
                  onChange={(e) => onChangeCategory(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loadingCategories}
                >
                  <option value="">{loadingCategories ? "Loading categories…" : "Select a category"}</option>
                  {categories.map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      {c.name}
                    </option>
                  ))}
                </select>
                {loadingCategories ? <div className="absolute right-3 top-3"><Spinner /></div> : null}
              </div>
              <div className="mt-1 text-[11px] text-slate-500">
                Selecting a category filters available classes.
              </div>
            </div>

            <div className={`${hasSectionsForSelectedClass ? "" : "hidden"}`}>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Section</label>
              <div className="relative">
                <select
                  value={sectionName}
                  onChange={(e) => setSectionName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loadingSections}
                >
                  <option value="">{loadingSections ? "Loading sections…" : "All sections"}</option>
                  {sections.map((s) => (
                    <option key={s.id} value={s.name}>
                      {s.name}
                    </option>
                  ))}
                </select>
                {loadingSections ? <div className="absolute right-3 top-3"><Spinner /></div> : null}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Exam Type</label>
              <div className="relative">
                <select
                  value={examType}
                  onChange={(e) => setExamType(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loadingExamTypes}
                >
                  <option value="">{loadingExamTypes ? "Loading exam types…" : "Select exam type"}</option>
                  {examTypes.map((t) => (
                    <option key={t.key} value={t.key}>
                      {t.label}
                    </option>
                  ))}
                </select>
                {loadingExamTypes ? <div className="absolute right-3 top-3"><Spinner /></div> : null}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between lg:justify-end gap-3">
            <div className="text-xs text-slate-500 hidden lg:block">
              Term: <span className="font-semibold text-slate-700">{termCtx.viewingTerm}</span>{" "}
              · Year: <span className="font-semibold text-slate-700">{termCtx.viewingAcademicYear}</span>
              {loadingScale ? <span className="ml-2"><Spinner label="Loading grades" /></span> : null}
            </div>
            <button
              type="button"
              onClick={() => void fetchResults()}
              disabled={!canFetch || fetching}
              className="w-full lg:w-auto px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-500 text-white font-semibold shadow-sm"
            >
              {fetching ? "Fetching…" : "Fetch Results"}
            </button>
          </div>
        </div>
      </div>

      {marksheet ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="text-sm font-semibold text-slate-700">
              Total Students: <span className="font-bold text-slate-900">{summary.total}</span>{" "}
              <span className="text-slate-400">·</span>{" "}
              Males: <span className="font-bold text-slate-900">{summary.males}</span>{" "}
              <span className="text-slate-400">|</span>{" "}
              Females: <span className="font-bold text-slate-900">{summary.females}</span>
              <span className="text-slate-400">·</span>{" "}
              Subjects: <span className="font-bold text-slate-900">{subjectsMeta.length}</span>
              <span className="text-slate-400">·</span>{" "}
              ✅ Complete:{" "}
              <span className="font-bold text-slate-900">
                {filteredStudents.filter((s) => subjectsMeta.length > 0 && subjectsMeta.every((sub) => s.marksBySubject[sub.name] != null)).length}
              </span>{" "}
              <span className="text-slate-400">|</span>{" "}
              ⚠️ Incomplete:{" "}
              <span className="font-bold text-slate-900">
                {filteredStudents.filter((s) => subjectsMeta.length === 0 || subjectsMeta.some((sub) => s.marksBySubject[sub.name] == null)).length}
              </span>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
              <input
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
                placeholder="Search name or admission no…"
                className="w-full sm:w-72 rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="text-xs text-slate-500">
                {selectedClassName} · {examType} · {termCtx.viewingTerm} {termCtx.viewingAcademicYear}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {marksheet ? (
        <>
          {hasMissingShortForms ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
              <div className="text-sm font-semibold">
                ⚠️ Some subjects are missing short forms. Please update subject configurations to display results correctly.
                <span className="ml-2 text-indigo-700 font-semibold">
                  Open Curriculum → Subject Assignment
                </span>
              </div>
            </div>
          ) : null}

          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-x-auto">
            <table className="w-full text-sm min-w-[1120px]">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="px-3 py-3 text-xs font-semibold text-slate-500 uppercase sticky left-0 z-20 bg-slate-50 w-[48px]">#</th>
                  <th className="px-3 py-3 text-xs font-semibold text-slate-500 uppercase sticky z-20 bg-slate-50 w-[56px]" style={{ left: 48 }}>Photo</th>
                  <th className="px-3 py-3 text-xs font-semibold text-slate-500 uppercase sticky z-20 bg-slate-50 w-[160px]" style={{ left: 48 + 56 }}>Adm. No.</th>
                  <th className="px-3 py-3 text-xs font-semibold text-slate-500 uppercase sticky z-20 bg-slate-50 w-[240px]" style={{ left: 48 + 56 + 160 }}>Student Name</th>

                  {subjectsMeta.map((s) => (
                    <th
                      key={s.name}
                      title={s.name}
                      className="px-3 py-3 text-xs font-bold uppercase text-slate-700 text-center bg-indigo-50/60 border-l border-indigo-100"
                    >
                      {(s.shortForm ?? "").trim() || "—"}
                    </th>
                  ))}

                  <th className="px-3 py-3 text-xs font-semibold text-slate-500 uppercase text-center bg-slate-50 border-l border-slate-100">AGG.</th>
                  <th className="px-3 py-3 text-xs font-semibold text-slate-500 uppercase text-center bg-slate-50">Status</th>
                  <th className="px-3 py-3 text-xs font-semibold text-slate-500 uppercase text-center bg-slate-50">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {pivotRows.map((r, i) => {
                  const imgUrl = apiUrl(`/api/me/students/${r.studentId}/photo`);
                  const rowIndex = (page - 1) * rowsPerPage + i + 1;
                  const baseBg = i % 2 === 0 ? "bg-white" : "bg-slate-50/40";
                  return (
                    <tr key={r.studentId} className={`${baseBg} hover:bg-blue-50/40`}>
                      <td className={`px-3 py-3 sticky left-0 z-10 ${baseBg} font-semibold text-slate-600`}>
                        {rowIndex}
                      </td>
                      <td className={`px-3 py-3 sticky z-10 ${baseBg}`} style={{ left: 48 }}>
                        <div className="h-9 w-9 rounded-full bg-slate-100 ring-1 ring-slate-200 overflow-hidden flex items-center justify-center text-xs font-bold text-slate-600">
                          {r.hasPassportPhoto ? (
                            <img
                              src={imgUrl}
                              alt=""
                              className="h-full w-full object-cover"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).style.display = "none";
                              }}
                            />
                          ) : (
                            <span>
                              {r.fullName
                                .split(" ")
                                .filter(Boolean)
                                .slice(0, 2)
                                .map((x) => x[0]?.toUpperCase())
                                .join("")}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className={`px-3 py-3 sticky z-10 ${baseBg} font-bold text-slate-900 font-mono`} style={{ left: 48 + 56 }}>
                        {r.admissionNumber}
                      </td>
                      <td className={`px-3 py-3 sticky z-10 ${baseBg} text-slate-900`} style={{ left: 48 + 56 + 160 }}>
                        <div className="font-semibold">{r.fullName}</div>
                        {r.sectionName ? <div className="text-xs text-slate-500">{r.sectionName}</div> : null}
                      </td>

                      {subjectsMeta.map((sub) => {
                        const score = r.marksBySubject[sub.name] ?? null;
                        const band = score == null ? null : gradeForScore(score, gradingBands);
                        if (score == null) {
                          return (
                            <td
                              key={sub.name}
                              className="px-3 py-3 text-center bg-red-50/40 text-red-600 font-bold border-l border-indigo-100"
                              title={sub.name}
                            >
                              —
                            </td>
                          );
                        }
                        return (
                          <td key={sub.name} className="px-3 py-3 text-center border-l border-indigo-100" title={sub.name}>
                            <div className="font-bold text-slate-900">{score}</div>
                            <div className="mt-1">
                              <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700 ring-1 ring-slate-200">
                                {band?.grade ?? "—"}
                              </span>
                            </div>
                          </td>
                        );
                      })}

                      <td className="px-3 py-3 text-center border-l border-slate-100">
                        <span className="font-bold text-slate-900">{r.totalAggregate == null ? "—" : r.totalAggregate}</span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        {r.status === "complete" ? (
                          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200">
                            ✅ Complete
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-800 ring-1 ring-amber-200">
                            ⚠️ Incomplete
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => onOpenEntry(r.studentId)}
                          className={
                            r.action === "enter"
                              ? "px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm"
                              : "px-3 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-sm"
                          }
                        >
                          {r.action === "enter" ? "Enter Marks" : "Edit Marks"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {pivotRows.length === 0 ? (
                  <tr>
                    <td colSpan={subjectsMeta.length + 7} className="px-4 py-14 text-center text-slate-400">
                      No students found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <Placeholder
          title="Select filters, then fetch results."
          subtitle="Choose category, class and exam type to load the marks table."
        />
      )}

      {marksheet ? (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="text-xs text-slate-500">
            Page <span className="font-semibold text-slate-700">{page}</span> of{" "}
            <span className="font-semibold text-slate-700">{totalPages}</span> · Showing{" "}
            <span className="font-semibold text-slate-700">{pageStudents.length}</span> students
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">Rows per page</span>
              <select
                value={rowsPerPage}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (v === 10 || v === 25 || v === 50) {
                    setRowsPerPage(v);
                    setPage(1);
                  }
                }}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </div>
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400 text-sm font-semibold"
            >
              Prev
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400 text-sm font-semibold"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}

      <MarkEntryModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={onSaved}
        studentId={activeStudentId}
        header={activeHeader}
        term={termCtx.viewingTerm}
        academicYear={termCtx.viewingAcademicYear}
        examType={examType}
        gradingBands={gradingBands}
        toast={toast}
      />
    </div>
  );
}

export function ResultsSectionPage({ viewMode, userRole, userPermissions }: Props) {
  if (viewMode === "entry") {
    return <ResultsEntryPage userRole={userRole} userPermissions={userPermissions} />;
  }
  return (
    <Placeholder
      title="Results view is not implemented here yet."
      subtitle="Open “Results Entry” to enter marks."
    />
  );
}
