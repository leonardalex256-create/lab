import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  createClassCategory,
  createClassSection,
  createClassroom,
  deleteClassCategory,
  deleteClassSection,
  deleteClassroom,
  disableClassroom,
  fetchClassCategories,
  fetchClassrooms,
  fetchClassSections,
  fetchStudents,
  fetchTeachers,
  updateClassCategory,
  updateClassSection,
  updateClassroom,
  type ClassCategoryOption,
  type ClassRoomOption,
  type ClassSectionOption,
  type StudentApiRow,
  type TeacherOption,
} from "../../api/students";
import { useI18n } from "../../i18n/I18nProvider";
import { StudentDetailModal } from "../students/StudentDetailModal";
import { useTheme } from "../../theme/ThemeProvider";

export type ClassesSection =
  | "all_classes"
  | "sections_streams"
  | "class_students"
  | "class_students_roster"
  | "class_teachers"
  | "class_categories"
  | "class_reports";

type Props = {
  section: ClassesSection;
  /** When `section === "class_students_roster"`, which class roster to show. */
  rosterClassId?: number | null;
  onOpenClassRoster?: (classId: number) => void;
  onCloseClassRoster?: () => void;
};

function IconBtn({
  danger,
  label,
  onClick,
  icon,
  isDarkUi,
}: {
  danger?: boolean;
  label: string;
  onClick: () => void;
  icon: React.ReactNode;
  isDarkUi?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border transition-all hover:scale-105 active:scale-95 ${
        danger
          ? "border-rose-100 bg-rose-50 text-rose-600 hover:bg-rose-100 hover:border-rose-200"
          : isDarkUi
            ? "border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700"
            : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700"
      }`}
    >
      {icon}
    </button>
  );
}

export function ClassesSectionPage({
  section,
  rosterClassId = null,
  onOpenClassRoster,
  onCloseClassRoster,
}: Props) {
  const { t } = useI18n();
  const { resolvedTheme } = useTheme();
  const isDarkUi = resolvedTheme === "dark" || resolvedTheme === "tinted-dark";

  const cardClass = `neo-card overflow-hidden rounded-3xl border border-slate-100 p-8 shadow-sm ${isDarkUi ? "bg-slate-900/50" : "bg-white"}`;
  const inputClass = `neo-inset-field w-full rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all outline-none focus:ring-2 ${
    isDarkUi 
      ? "bg-[#1e293b] border-slate-700 text-white focus:ring-sky-500/20 focus:border-sky-50" 
      : "bg-white border-slate-200 text-slate-800 focus:ring-[#0c2340]/10 focus:border-[#0c2340]"
  }`;

  const [rooms, setRooms] = useState<ClassRoomOption[]>([]);
  const [categories, setCategories] = useState<ClassCategoryOption[]>([]);
  const [sections, setSections] = useState<ClassSectionOption[]>([]);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [students, setStudents] = useState<StudentApiRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [className, setClassName] = useState<string>("");
  const [classDesc, setClassDesc] = useState<string>("");
  const [classCategoryId, setClassCategoryId] = useState<string>("");
  const [showAddClassForm, setShowAddClassForm] = useState(false);
  const [showAddSectionForm, setShowAddSectionForm] = useState(false);
  const [showAddCategoryForm, setShowAddCategoryForm] = useState(false);
  const [classFilterCategoryId, setClassFilterCategoryId] = useState<string>("");
  const [sectionFilterClassId, setSectionFilterClassId] = useState<string>("");
  const [classRoomId, setClassRoomId] = useState("");
  const [sectionName, setSectionName] = useState("");
  const [sectionTeacher, setSectionTeacher] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [categoryDesc, setCategoryDesc] = useState("");
  const [editCategoryId, setEditCategoryId] = useState<number | null>(null);
  const [editClassId, setEditClassId] = useState<number | null>(null);
  const [editSectionId, setEditSectionId] = useState<number | null>(null);
  const [rosterSectionFilter, setRosterSectionFilter] = useState<string>("");
  const [rosterSortBy, setRosterSortBy] = useState<"name" | "stream">("name");
  const [rosterSortDir, setRosterSortDir] = useState<"asc" | "desc">("asc");
  const [reportClassId, setReportClassId] = useState<string>("");
  const [reportTerm, setReportTerm] = useState<string>("");
  const [reportType, setReportType] = useState<"PDF" | "Excel">("PDF");
  const [rosterStudentModal, setRosterStudentModal] = useState<{
    studentId: number;
    focusSection: boolean;
  } | null>(null);

  const classesViewRows = useMemo(() => {
    const filtered = classFilterCategoryId
      ? rooms.filter((x) => x.categoryId === Number(classFilterCategoryId))
      : rooms;
    return filtered.map((room) => {
      const sectionCount = sections.filter((x) => x.classRoomId === room.id).length;
      const totalStudents = students.filter((x) => x.classRoomId === room.id).length;
      return { room, sectionCount, totalStudents };
    });
  }, [classFilterCategoryId, rooms, sections, students]);

  const classStudentsSummaryRows = useMemo(() => {
    return rooms.map((room) => {
      const classSecs = sections.filter((x) => x.classRoomId === room.id);
      const streamCounts = classSecs.map((sec) => {
        const count = students.filter(
          (st) =>
            st.classRoomId === room.id && (st.sectionName ?? "").trim() === sec.name.trim(),
        ).length;
        return { name: sec.name, count };
      });
      const totalInClass = students.filter((st) => st.classRoomId === room.id).length;
      return { room, streamCounts, totalInClass };
    });
  }, [rooms, sections, students]);

  const classRosterRows = useMemo(() => {
    if (rosterClassId == null || rosterClassId < 1) return [];
    const filtered = students.filter((s) => {
      if (s.classRoomId !== rosterClassId) return false;
      if (rosterSectionFilter && s.sectionName !== rosterSectionFilter) return false;
      return true;
    });
    const collator = new Intl.Collator(undefined, { sensitivity: "base" });
    return [...filtered].sort((a, b) => {
      if (rosterSortBy === "name") {
        const c = collator.compare(a.fullName, b.fullName);
        return rosterSortDir === "asc" ? c : -c;
      }
      const sa = (a.sectionName ?? "").trim() || "\uffff";
      const sb = (b.sectionName ?? "").trim() || "\uffff";
      const c = collator.compare(sa, sb);
      return rosterSortDir === "asc" ? c : -c;
    });
  }, [rosterClassId, rosterSectionFilter, students, rosterSortBy, rosterSortDir]);

  const rosterRoom = useMemo(
    () => (rosterClassId != null && rosterClassId >= 1 ? rooms.find((r) => r.id === rosterClassId) ?? null : null),
    [rooms, rosterClassId],
  );

  const rosterStreamNames = useMemo(() => {
    if (rosterClassId == null || rosterClassId < 1) return [];
    const names = sections
      .filter((x) => x.classRoomId === rosterClassId)
      .map((x) => x.name.trim())
      .filter(Boolean);
    return [...new Set(names)].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  }, [sections, rosterClassId]);

  const selectedReportRoom = useMemo(() => {
    const id = Number.parseInt(reportClassId, 10);
    if (!Number.isFinite(id) || id < 1) return null;
    return rooms.find((r) => r.id === id) ?? null;
  }, [reportClassId, rooms]);

  const reportStats = useMemo(() => {
    if (!selectedReportRoom) return { students: 0, streams: 0 };
    const studentsInClass = students.filter((s) => s.classRoomId === selectedReportRoom.id).length;
    const streamsInClass = sections.filter((s) => s.classRoomId === selectedReportRoom.id).length;
    return { students: studentsInClass, streams: streamsInClass };
  }, [selectedReportRoom, students, sections]);

  const reportRows = useMemo(() => {
    if (!selectedReportRoom) return [];
    const collator = new Intl.Collator(undefined, { sensitivity: "base" });
    return students
      .filter((s) => s.classRoomId === selectedReportRoom.id)
      .slice()
      .sort((a, b) => collator.compare(a.fullName, b.fullName));
  }, [selectedReportRoom, students]);

  const handleGenerateReport = async () => {
    if (!selectedReportRoom) return;
    const className = selectedReportRoom.name;
    const term = reportTerm.trim() || t("classes.reports.termAny");
    const stamp = new Date().toISOString().slice(0, 10);

    if (reportType === "Excel") {
      const wb = XLSX.utils.book_new();
      const summarySheet = XLSX.utils.json_to_sheet([
        {
          Class: className,
          Term: term,
          Students: reportStats.students,
          Streams: reportStats.streams,
        },
      ]);
      const studentsSheet = XLSX.utils.json_to_sheet(
        reportRows.map((s) => ({
          Admission: s.admissionNumber,
          Name: s.fullName,
          Section: s.sectionName ?? "",
          Gender: s.gender ?? "",
        })),
      );
      XLSX.utils.book_append_sheet(wb, summarySheet, "Summary");
      XLSX.utils.book_append_sheet(wb, studentsSheet, "Students");
      XLSX.writeFile(wb, `class-report-${className.replace(/\s+/g, "-")}-${stamp}.xlsx`);
      return;
    }

    const badgeMark = `<svg xmlns='http://www.w3.org/2000/svg' width='90' height='90' viewBox='0 0 90 90'>
  <defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#6a9570'/><stop offset='1' stop-color='#3f6b5a'/></linearGradient></defs>
  <circle cx='45' cy='45' r='41' fill='url(#g)'/>
  <circle cx='45' cy='45' r='34' fill='none' stroke='white' stroke-opacity='0.7' stroke-width='2'/>
  <text x='45' y='51' text-anchor='middle' font-family='Arial' font-size='18' fill='white' font-weight='700'>QS</text>
</svg>`;
    const badgeUrl = `${window.location.origin}/school-badge-v2.png`;
    const teacherNames = [
      ...new Set(
        sections
          .filter((s) => s.classRoomId === selectedReportRoom.id)
          .map((s) => (s.classTeacherName ?? "").trim())
          .filter(Boolean),
      ),
    ];
    const teacherLabel = teacherNames.length > 0 ? teacherNames.join(", ") : "Not assigned";
    const year = new Date().getFullYear();
    const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();

    const drawWatermark = (dataUrl: string) => {
      const wmW = pageW * 0.58;
      const wmH = wmW;
      const x = (pageW - wmW) / 2;
      const y = (pageH - wmH) / 2 + 10;
      pdf.addImage(dataUrl, "PNG", x, y, wmW, wmH, undefined, "FAST", 0);
    };

    const fallbackBadgeDataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(badgeMark)}`;
    const loadImageDataUrl = async (src: string, alpha = 1): Promise<string> =>
      new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          const c = document.createElement("canvas");
          c.width = img.naturalWidth || 300;
          c.height = img.naturalHeight || 300;
          const ctx = c.getContext("2d");
          if (!ctx) return resolve(fallbackBadgeDataUrl);
          ctx.clearRect(0, 0, c.width, c.height);
          ctx.globalAlpha = alpha;
          ctx.drawImage(img, 0, 0, c.width, c.height);
          resolve(c.toDataURL("image/png"));
        };
        img.onerror = () => resolve(fallbackBadgeDataUrl);
        img.src = src;
      });

    const wm = await loadImageDataUrl(badgeUrl, 0.12).catch(() => fallbackBadgeDataUrl);
    const badge = await loadImageDataUrl(badgeUrl, 1).catch(() => fallbackBadgeDataUrl);
    drawWatermark(wm);

    pdf.addImage(badge, "PNG", 40, 26, 42, 42, undefined, "FAST");
    pdf.setFontSize(15);
    pdf.setTextColor(31, 63, 48);
    pdf.text("Queens Nursery and Primary School", 92, 50);
    pdf.setDrawColor(223, 232, 225);
    pdf.line(40, 74, pageW - 40, 74);

    autoTable(pdf, {
      startY: 84,
      theme: "grid",
      styles: { fontSize: 10, cellPadding: 6, lineColor: [226, 226, 226], lineWidth: 0.6 },
      body: [
        ["Class", className, "Term", term],
        ["Class Teacher(s)", teacherLabel, "Format", reportType],
        ["Students", String(reportStats.students), "Streams / Sections", String(reportStats.streams)],
      ],
      columnStyles: {
        0: { fontStyle: "bold", fillColor: [247, 247, 247], cellWidth: 120 },
        1: { cellWidth: 170 },
        2: { fontStyle: "bold", fillColor: [247, 247, 247], cellWidth: 130 },
        3: { cellWidth: 120 },
      },
    });

    autoTable(pdf, {
      startY: (pdf as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY
        ? ((pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 14)
        : 180,
      head: [["ADMISSION", "NAME", "SECTION", "GENDER"]],
      body:
        reportRows.length > 0
          ? reportRows.map((s) => [s.admissionNumber, s.fullName, s.sectionName ?? "-", s.gender ?? "-"])
          : [["-", "No students found", "-", "-"]],
      theme: "grid",
      headStyles: { fillColor: [239, 245, 241], textColor: [45, 52, 54], fontStyle: "bold", fontSize: 10 },
      styles: { fontSize: 10, cellPadding: 6, lineColor: [221, 221, 221], lineWidth: 0.6 },
    });

    const footer = `Copyright © ${year} Queens Nursery and Primary School, Bunamwaya. All rights reserved.`;
    pdf.setDrawColor(232, 232, 232);
    pdf.line(40, pageH - 34, pageW - 40, pageH - 34);
    pdf.setFontSize(9.5);
    pdf.setTextColor(95, 107, 103);
    pdf.text(footer, pageW / 2, pageH - 20, { align: "center" });
    pdf.save(`class-report-${className.replace(/\s+/g, "-")}-${stamp}.pdf`);
  };

  useEffect(() => {
    setRosterSectionFilter("");
  }, [rosterClassId]);

  const sectionsViewRows = useMemo(() => {
    const id = Number.parseInt(sectionFilterClassId, 10);
    const list =
      Number.isFinite(id) && id >= 1 ? sections.filter((x) => x.classRoomId === id) : sections;
    return list.map((sec) => {
      const room = rooms.find((r) => r.id === sec.classRoomId);
      const studentCount = students.filter(
        (st) =>
          st.classRoomId === sec.classRoomId &&
          (st.sectionName ?? "").trim() === sec.name.trim(),
      ).length;
      return { sec, room, studentCount };
    });
  }, [sectionFilterClassId, sections, rooms, students]);

  const loadDbData = async () => {
    setLoading(true);
    try {
      const [roomRows, categoryRows, sectionRows, studentRows, teacherRows] = await Promise.all([
        fetchClassrooms(),
        fetchClassCategories(),
        fetchClassSections(),
        fetchStudents({ limit: 200 }),
        fetchTeachers(),
      ]);
      setRooms(roomRows);
      setCategories(categoryRows);
      setSections(sectionRows);
      setStudents(studentRows.items);
      setTeachers(teacherRows);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load classes/sections");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDbData();
  }, []);

  useEffect(() => {
    if (section !== "sections_streams") {
      setShowAddSectionForm(false);
      setEditSectionId(null);
      setSectionName("");
      setSectionTeacher("");
      setClassRoomId("");
    }
    if (section !== "class_categories") {
      setShowAddCategoryForm(false);
      setEditCategoryId(null);
      setCategoryName("");
      setCategoryDesc("");
    }
  }, [section]);

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    const categoryId = Number.parseInt(classCategoryId, 10);
    if (!className.trim()) {
      setError("Class name cannot be empty.");
      return;
    }
    if (!Number.isFinite(categoryId)) {
      setError("Please select a class category.");
      return;
    }
    try {
      await createClassroom({
        name: className.trim(),
        categoryId,
        description: classDesc.trim() || undefined,
      });
      setClassName("");
      setClassDesc("");
      setClassCategoryId("");
      setShowAddClassForm(false);
      await loadDbData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create class");
    }
  };

  const confirmDelete = (entity: "class" | "section" | "category"): boolean => {
    const label = entity === "class" ? "class" : entity === "section" ? "section" : "category";
    return window.confirm(`Are you sure you want to delete this ${label}? This action cannot be undone.`);
  };

  const handleCreateSection = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = Number.parseInt(classRoomId, 10);
    if (!Number.isFinite(id) || id < 1) {
      setError("Please select a class before adding a section.");
      return;
    }
    if (!sectionName.trim()) {
      setError("Section name cannot be empty.");
      return;
    }
    try {
      if (editSectionId) {
        await updateClassSection(editSectionId, {
          classRoomId: id,
          name: sectionName.trim(),
          classTeacherName: sectionTeacher.trim() || undefined,
        });
      } else {
        await createClassSection({
          classRoomId: id,
          name: sectionName.trim(),
          classTeacherName: sectionTeacher.trim() || undefined,
        });
      }
      setSectionName("");
      setSectionTeacher("");
      setEditSectionId(null);
      setShowAddSectionForm(false);
      await loadDbData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save section");
    }
  };

  const handleSaveCategory = async (id?: number) => {
    if (!categoryName.trim()) {
      setError("Category name cannot be empty.");
      return;
    }
    try {
      if (id) await updateClassCategory(id, { name: categoryName.trim(), description: categoryDesc.trim() || undefined });
      else await createClassCategory({ name: categoryName.trim(), description: categoryDesc.trim() || undefined });
      setEditCategoryId(null);
      setCategoryName("");
      setCategoryDesc("");
      setShowAddCategoryForm(false);
      await loadDbData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save category");
    }
  };

  const handleCategoryFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void handleSaveCategory(editCategoryId ?? undefined);
  };

  const closeCategoryForm = () => {
    setShowAddCategoryForm(false);
    setEditCategoryId(null);
    setCategoryName("");
    setCategoryDesc("");
  };

  const titleKey =
    section === "sections_streams"
      ? "classes.page.sectionsStreamsTitle"
      : section === "class_students"
        ? "classes.page.classStudentsTitle"
        : section === "class_students_roster"
          ? "classes.page.classStudentsRosterTitle"
        : section === "class_teachers"
          ? "classes.page.classTeachersTitle"
          : section === "class_categories"
            ? "classes.page.classCategoriesTitle"
          : section === "class_reports"
            ? "classes.page.classReportsTitle"
            : "classes.page.allClassesTitle";

  const introKey =
    section === "sections_streams"
      ? "classes.page.sectionsStreamsIntro"
      : section === "class_students"
        ? "classes.page.classStudentsIntro"
        : section === "class_students_roster"
          ? "classes.page.classStudentsRosterIntro"
        : section === "class_teachers"
          ? "classes.page.classTeachersIntro"
          : section === "class_categories"
            ? "classes.page.classCategoriesIntro"
          : section === "class_reports"
            ? "classes.page.classReportsIntro"
            : "classes.page.allClassesIntro";

  return (
    <div className="min-w-0 space-y-6">
      {/* Redesigned content starts here */}

      <header className={`neo-card relative overflow-hidden rounded-3xl p-8 shadow-xl mb-8 ${isDarkUi ? "bg-slate-900/50" : "bg-white"}`}>
        <div className="absolute top-0 left-0 h-2 w-full bg-gradient-to-r from-teal-500 via-sky-500 to-indigo-600" />
        
        {section === "class_students_roster" ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <button
                type="button"
                onClick={() => onCloseClassRoster?.()}
                className={`flex h-12 w-12 items-center justify-center rounded-2xl border transition-all hover:-translate-x-1 ${
                  isDarkUi ? "border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700" : "border-slate-100 bg-slate-50 text-slate-500 hover:bg-slate-100"
                }`}
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h1 className={`text-3xl font-black tracking-tight ${isDarkUi ? "text-white" : "text-[#0c2340]"}`}>
                  {rosterRoom?.name ?? t("classes.classStudents.unknownClass")}
                </h1>
                <p className={`mt-1 text-sm font-medium ${isDarkUi ? "text-slate-400" : "text-slate-500"}`}>
                  {t("classes.page.classStudentsRosterTitleSuffix")}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0c2340] to-[#1a3a5c] text-3xl shadow-lg shadow-[#0c2340]/20">
                {section === "class_reports" ? "📊" : section === "class_teachers" ? "👨‍🏫" : "🏫"}
              </div>
              <div>
                <h1 className={`text-3xl font-black tracking-tight ${isDarkUi ? "text-white" : "text-[#0c2340]"}`}>
                  {t(titleKey)}
                </h1>
                <p className={`mt-1 text-sm font-medium ${isDarkUi ? "text-slate-400" : "text-slate-500"}`}>
                  {t(introKey)}
                </p>
              </div>
            </div>
            {section === "sections_streams" && (
               <button
                type="button"
                onClick={() => {
                  setEditSectionId(null);
                  setSectionName("");
                  setSectionTeacher("");
                  setClassRoomId(sectionFilterClassId.trim() ? sectionFilterClassId : "");
                  setShowAddSectionForm(true);
                }}
                className="flex items-center gap-2 rounded-xl bg-teal-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-teal-600/20 transition-all hover:-translate-y-0.5 hover:shadow-xl active:translate-y-0"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                {t("classes.action.addSection")}
              </button>
            )}
            {section === "class_categories" && (
               <button
                type="button"
                onClick={() => setShowAddCategoryForm(true)}
                className="flex items-center gap-2 rounded-xl bg-amber-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-amber-600/20 transition-all hover:-translate-y-0.5 hover:shadow-xl active:translate-y-0"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                {t("classes.action.addCategory")}
              </button>
            )}
          </div>
        )}
      </header>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-teal-500 border-t-transparent" />
        </div>
      )}

      {section === "all_classes" ? (
        <div className={cardClass}>
          <div className="flex items-center justify-between border-b border-slate-100 px-8 py-6 -mx-8 -mt-8 mb-8">
            <div>
              <h2 className={`text-lg font-black ${isDarkUi ? "text-white" : "text-[#0c2340]"}`}>Class Registry</h2>
              <p className={`text-xs font-medium ${isDarkUi ? "text-slate-400" : "text-slate-500"}`}>List of all active academic levels.</p>
            </div>
            <div className="flex items-center gap-4">
              <label htmlFor="classes-filter-category" className={`text-[10px] font-black uppercase tracking-widest ${isDarkUi ? "text-slate-400" : "text-slate-500"}`}>
                {t("toolbar.filter")}
              </label>
              <select
                id="classes-filter-category"
                value={classFilterCategoryId}
                onChange={(e) => setClassFilterCategoryId(e.target.value)}
                className={`${inputClass} !py-1.5 !px-3 !w-auto min-w-[180px]`}
              >
                <option value="">{t("classes.filter.allCategories")}</option>
                {categories.map((c) => (
                  <option key={c.id} value={String(c.id)}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto -mx-8">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className={`${isDarkUi ? "bg-slate-800/50" : "bg-slate-50/50"}`}>
                  <th className={`px-8 py-4 text-[10px] font-black uppercase tracking-widest ${isDarkUi ? "text-slate-400" : "text-slate-500"}`}>Class Name</th>
                  <th className={`px-8 py-4 text-[10px] font-black uppercase tracking-widest ${isDarkUi ? "text-slate-400" : "text-slate-500"}`}>Streams</th>
                  <th className={`px-8 py-4 text-[10px] font-black uppercase tracking-widest ${isDarkUi ? "text-slate-400" : "text-slate-500"}`}>Total Students</th>
                  <th className={`px-8 py-4 text-[10px] font-black uppercase tracking-widest ${isDarkUi ? "text-slate-400" : "text-slate-500"}`}>Category</th>
                  <th className={`px-8 py-4 text-right text-[10px] font-black uppercase tracking-widest ${isDarkUi ? "text-slate-400" : "text-slate-500"}`}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {classesViewRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-8 py-12 text-center text-slate-400 text-sm italic">
                      No classes found for the selected filter.
                    </td>
                  </tr>
                ) : (
                  classesViewRows.map(({ room, sectionCount, totalStudents }) => (
                    <tr key={room.id} className="group border-b border-slate-50 hover:bg-slate-50/50 transition-colors last:border-0">
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-3">
                          <span className={`text-sm font-bold ${isDarkUi ? "text-slate-200" : "text-[#0c2340]"}`}>{room.name}</span>
                          {room.isActive === false && (
                            <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-600 border border-rose-100">
                              Inactive
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold ${
                          isDarkUi ? "bg-slate-800 text-slate-300" : "bg-sky-50 text-sky-700"
                        }`}>
                          {sectionCount} {sectionCount === 1 ? 'Stream' : 'Streams'}
                        </span>
                      </td>
                      <td className="px-8 py-5">
                        <span className={`text-xs font-semibold ${isDarkUi ? "text-slate-400" : "text-slate-600"}`}>
                          {totalStudents} {totalStudents === 1 ? 'Student' : 'Students'}
                        </span>
                      </td>
                      <td className="px-8 py-5">
                        <span className={`text-xs font-medium ${isDarkUi ? "text-teal-400" : "text-teal-600"}`}>
                          {room.categoryName ?? "—"}
                        </span>
                      </td>
                      <td className="px-8 py-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <IconBtn
                            isDarkUi={isDarkUi}
                            label="Edit class"
                            onClick={() => {
                              setEditClassId(room.id);
                              setClassName(room.name);
                              setClassDesc(room.description ?? "");
                              setClassCategoryId(room.categoryId ? String(room.categoryId) : "");
                              setShowAddClassForm(true);
                            }}
                            icon={
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            }
                          />
                          <IconBtn
                            isDarkUi={isDarkUi}
                            danger
                            label="Delete class"
                            onClick={async () => {
                              if (!confirmDelete("class")) return;
                              try {
                                await deleteClassroom(room.id);
                                await loadDbData();
                              } catch (err) {
                                const msg = err instanceof Error ? err.message : "Delete failed";
                                if (/cannot be deleted|disable it instead|allocated/i.test(msg)) {
                                  const disableNow = window.confirm(
                                    "This class has allocated students and cannot be deleted. Disable it instead?",
                                  );
                                  if (disableNow) {
                                    await disableClassroom(room.id);
                                    await loadDbData();
                                    return;
                                  }
                                }
                                setError(msg);
                              }
                            }}
                            icon={
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            }
                          />
                        </div>
                      </td>
                    </tr>
                  )
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {section === "sections_streams" ? (
        <div className={cardClass}>
           <div className="flex items-center justify-between border-b border-slate-100 px-8 py-6 -mx-8 -mt-8 mb-8">
            <div>
              <h2 className={`text-lg font-black ${isDarkUi ? "text-white" : "text-[#0c2340]"}`}>Streams & Sections</h2>
              <p className={`text-xs font-medium ${isDarkUi ? "text-slate-400" : "text-slate-500"}`}>Manage individual classroom divisions.</p>
            </div>
            <div className="flex items-center gap-4">
              <label htmlFor="sections-filter-class" className={`text-[10px] font-black uppercase tracking-widest ${isDarkUi ? "text-slate-400" : "text-slate-500"}`}>
                {t("toolbar.filter")}
              </label>
              <select
                id="sections-filter-class"
                value={sectionFilterClassId}
                onChange={(e) => setSectionFilterClassId(e.target.value)}
                className={`${inputClass} !py-1.5 !px-3 !w-auto min-w-[200px]`}
              >
                <option value="">{t("classes.filter.classAll")}</option>
                {rooms.map((r) => (
                  <option key={r.id} value={String(r.id)}>{r.name} ({r.academicYear})</option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto -mx-8">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className={`${isDarkUi ? "bg-slate-800/50" : "bg-slate-50/50"}`}>
                  <th className={`px-8 py-4 text-[10px] font-black uppercase tracking-widest ${isDarkUi ? "text-slate-400" : "text-slate-500"}`}>{t("classes.sections.col.section")}</th>
                  <th className={`px-8 py-4 text-[10px] font-black uppercase tracking-widest ${isDarkUi ? "text-slate-400" : "text-slate-500"}`}>{t("classes.sections.col.class")}</th>
                  <th className={`px-8 py-4 text-[10px] font-black uppercase tracking-widest ${isDarkUi ? "text-slate-400" : "text-slate-500"}`}>{t("classes.sections.col.students")}</th>
                  <th className={`px-8 py-4 text-[10px] font-black uppercase tracking-widest ${isDarkUi ? "text-slate-400" : "text-slate-500"}`}>{t("classes.sections.col.teacher")}</th>
                  <th className={`px-8 py-4 text-right text-[10px] font-black uppercase tracking-widest ${isDarkUi ? "text-slate-400" : "text-slate-500"}`}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sectionsViewRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-8 py-12 text-center text-slate-400 text-sm italic">
                      {rooms.length === 0 ? t("classes.sections.emptyNeedClasses") : t("classes.sections.emptyFiltered")}
                    </td>
                  </tr>
                ) : (
                  sectionsViewRows.map(({ sec, room, studentCount }) => (
                    <tr key={sec.id} className="group border-b border-slate-50 hover:bg-slate-50/50 transition-colors last:border-0">
                      <td className="px-8 py-5">
                        <span className={`text-sm font-bold ${isDarkUi ? "text-slate-200" : "text-[#0c2340]"}`}>{sec.name}</span>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex flex-col">
                          <span className={`text-xs font-semibold ${isDarkUi ? "text-slate-300" : "text-slate-700"}`}>{room?.name ?? "—"}</span>
                          <span className="text-[10px] font-medium text-slate-400">{room?.categoryName}</span>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold ${
                          isDarkUi ? "bg-slate-800 text-slate-300" : "bg-teal-50 text-teal-700"
                        }`}>
                          {studentCount} Students
                        </span>
                      </td>
                      <td className="px-8 py-5">
                        <span className={`text-xs font-medium ${isDarkUi ? "text-slate-400" : "text-slate-600"}`}>
                          {sec.classTeacherName ?? "Unassigned"}
                        </span>
                      </td>
                      <td className="px-8 py-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                           <IconBtn
                            isDarkUi={isDarkUi}
                            label="Edit section"
                            onClick={() => {
                              setEditSectionId(sec.id);
                              setSectionName(sec.name);
                              setSectionTeacher(sec.classTeacherName ?? "");
                              setClassRoomId(String(sec.classRoomId));
                              setShowAddSectionForm(true);
                            }}
                            icon={
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            }
                          />
                          <IconBtn
                            isDarkUi={isDarkUi}
                            danger
                            label="Delete section"
                            onClick={async () => {
                              if (!confirmDelete("section")) return;
                              try {
                                await deleteClassSection(sec.id);
                                if (editSectionId === sec.id) {
                                  setEditSectionId(null);
                                  setSectionName("");
                                  setSectionTeacher("");
                                  setShowAddSectionForm(false);
                                }
                                await loadDbData();
                              } catch (err) {
                                setError(err instanceof Error ? err.message : "Delete failed");
                              }
                            }}
                            icon={
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            }
                          />
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {section === "class_students" ? (
        <div className={cardClass}>
           <div className="flex items-center justify-between border-b border-slate-100 px-8 py-6 -mx-8 -mt-8 mb-8">
            <div>
              <h2 className={`text-lg font-black ${isDarkUi ? "text-white" : "text-[#0c2340]"}`}>Class Enrollments</h2>
              <p className={`text-xs font-medium ${isDarkUi ? "text-slate-400" : "text-slate-500"}`}>Summary of students per class and stream.</p>
            </div>
          </div>

          <div className="overflow-x-auto -mx-8">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className={`${isDarkUi ? "bg-slate-800/50" : "bg-slate-50/50"}`}>
                  <th className={`px-8 py-4 text-[10px] font-black uppercase tracking-widest ${isDarkUi ? "text-slate-400" : "text-slate-500"}`}>{t("classes.classStudents.col.class")}</th>
                  <th className={`px-8 py-4 text-[10px] font-black uppercase tracking-widest ${isDarkUi ? "text-slate-400" : "text-slate-500"}`}>{t("classes.classStudents.col.total")}</th>
                  <th className={`px-8 py-4 text-[10px] font-black uppercase tracking-widest ${isDarkUi ? "text-slate-400" : "text-slate-500"}`}>{t("classes.classStudents.col.streams")}</th>
                  <th className={`px-8 py-4 text-right text-[10px] font-black uppercase tracking-widest ${isDarkUi ? "text-slate-400" : "text-slate-500"}`}>{t("students.col.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {classStudentsSummaryRows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-8 py-12 text-center text-slate-400 text-sm italic">
                       {t("classes.sections.emptyNeedClasses")}
                    </td>
                  </tr>
                ) : (
                  classStudentsSummaryRows.map(({ room, streamCounts, totalInClass }) => (
                    <tr key={room.id} className="group border-b border-slate-50 hover:bg-slate-50/50 transition-colors last:border-0">
                      <td className="px-8 py-5">
                         <span className={`text-sm font-bold ${isDarkUi ? "text-slate-200" : "text-[#0c2340]"}`}>{room.name}</span>
                      </td>
                      <td className="px-8 py-5">
                        <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold ${
                          isDarkUi ? "bg-slate-800 text-slate-300" : "bg-indigo-50 text-indigo-700"
                        }`}>
                          {totalInClass} Students
                        </span>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex flex-wrap gap-1.5">
                          {streamCounts.length > 0 ? (
                            streamCounts.map(s => (
                              <span key={s.name} className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-bold ${
                                isDarkUi ? "bg-slate-800 text-slate-400" : "bg-slate-100 text-slate-500"
                              }`}>
                                {s.name}: {s.count}
                              </span>
                            ))
                          ) : (
                            <span className="text-[10px] font-medium text-slate-400 italic">No streams</span>
                          )}
                        </div>
                      </td>
                      <td className="px-8 py-5 text-right">
                         <button
                            type="button"
                            className="rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 px-5 py-2 text-xs font-bold text-white shadow-lg shadow-teal-600/20 transition-all hover:-translate-y-0.5"
                            onClick={() => onOpenClassRoster?.(room.id)}
                          >
                            {t("classes.classStudents.viewAll")}
                          </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          <div className={`mt-8 rounded-2xl p-4 border border-dashed flex items-center gap-4 ${isDarkUi ? "bg-slate-800/30 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
            <span className="text-xl">💡</span>
            <p className="text-xs font-medium text-slate-500 leading-relaxed">
              {t("classes.classStudents.hintViewAll")} Bulk upload can be handled via the Admissions Import tool.
            </p>
          </div>
        </div>
      ) : null}

      {section === "class_students_roster" ? (
        <div className={cardClass}>
          {!rosterClassId || rosterClassId < 1 ? (
             <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="text-4xl mb-4">⚠️</div>
                <h3 className={`text-base font-bold ${isDarkUi ? "text-slate-300" : "text-slate-600"}`}>{t("classes.classStudents.rosterInvalid")}</h3>
             </div>
          ) : !rosterRoom ? (
             <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="text-4xl mb-4">❓</div>
                <h3 className={`text-base font-bold ${isDarkUi ? "text-slate-300" : "text-slate-600"}`}>{t("classes.classStudents.rosterMissingClass")}</h3>
             </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-6 mb-8 border-b border-slate-100 pb-8 -mx-8 px-8 -mt-8">
                <div className="flex-1 min-w-[200px] space-y-1.5">
                  <span className={`text-[10px] font-black uppercase tracking-widest ${isDarkUi ? "text-slate-500" : "text-slate-400"}`}>Filter by Stream</span>
                  <select
                    value={rosterSectionFilter}
                    onChange={(e) => setRosterSectionFilter(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">{t("classes.classStudents.allStreams")}</option>
                    {sections
                      .filter((x) => x.classRoomId === rosterClassId)
                      .map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
                  </select>
                </div>
                <div className="flex-1 min-w-[200px] space-y-1.5">
                   <span className={`text-[10px] font-black uppercase tracking-widest ${isDarkUi ? "text-slate-500" : "text-slate-400"}`}>Sort Criteria</span>
                   <select
                      value={rosterSortBy}
                      onChange={(e) => setRosterSortBy(e.target.value as "name" | "stream")}
                      className={inputClass}
                    >
                      <option value="name">{t("classes.classStudents.sortByName")}</option>
                      <option value="stream">{t("classes.classStudents.sortByStream")}</option>
                    </select>
                </div>
                 <div className="flex-1 min-w-[200px] space-y-1.5">
                   <span className={`text-[10px] font-black uppercase tracking-widest ${isDarkUi ? "text-slate-500" : "text-slate-400"}`}>Direction</span>
                    <select
                      value={rosterSortDir}
                      onChange={(e) => setRosterSortDir(e.target.value as "asc" | "desc")}
                      className={inputClass}
                    >
                      <option value="asc">A to Z</option>
                      <option value="desc">Z to A</option>
                    </select>
                </div>
              </div>

              <div className="overflow-x-auto -mx-8">
                 <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className={`${isDarkUi ? "bg-slate-800/50" : "bg-slate-50/50"}`}>
                      <th className={`px-8 py-4 text-[10px] font-black uppercase tracking-widest ${isDarkUi ? "text-slate-400" : "text-slate-500"}`}>{t("students.col.name")}</th>
                      <th className={`px-8 py-4 text-[10px] font-black uppercase tracking-widest ${isDarkUi ? "text-slate-400" : "text-slate-500"}`}>{t("students.col.class")}</th>
                      <th className={`px-8 py-4 text-[10px] font-black uppercase tracking-widest ${isDarkUi ? "text-slate-400" : "text-slate-500"}`}>{t("students.col.section")}</th>
                      <th className={`px-8 py-4 text-right text-[10px] font-black uppercase tracking-widest ${isDarkUi ? "text-slate-400" : "text-slate-500"}`}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {classRosterRows.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-8 py-12 text-center text-slate-400 text-sm italic">
                          {t("students.noMatches")}
                        </td>
                      </tr>
                    ) : (
                      classRosterRows.map((s) => (
                        <tr key={s.id} className="group border-b border-slate-50 hover:bg-slate-50/50 transition-colors last:border-0">
                          <td className="px-8 py-5">
                             <span className={`text-sm font-bold ${isDarkUi ? "text-slate-200" : "text-[#0c2340]"}`}>{s.fullName}</span>
                          </td>
                           <td className="px-8 py-5">
                             <span className={`text-xs font-semibold ${isDarkUi ? "text-slate-400" : "text-slate-600"}`}>{s.className ?? "—"}</span>
                          </td>
                           <td className="px-8 py-5">
                             <span className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-bold ${
                                isDarkUi ? "bg-slate-800 text-slate-400" : "bg-slate-100 text-slate-500"
                              }`}>
                                {s.sectionName ?? "Unassigned"}
                              </span>
                          </td>
                          <td className="px-8 py-5 text-right">
                             <button
                                type="button"
                                className={`rounded-xl border px-4 py-1.5 text-xs font-bold transition-all hover:-translate-y-0.5 ${
                                  isDarkUi ? "border-slate-700 text-slate-300 hover:bg-slate-800" : "border-[#0c2340] text-[#0c2340] hover:bg-slate-50"
                                }`}
                                onClick={() => setRosterStudentModal({ studentId: s.id, focusSection: true })}
                              >
                                {t("classes.classStudents.moveSection")}
                              </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      ) : null}

      {section === "class_teachers" ? (
        <div className={cardClass}>
           <div className="flex items-center justify-between border-b border-slate-100 px-8 py-6 -mx-8 -mt-8 mb-8">
            <div>
              <h2 className={`text-lg font-black ${isDarkUi ? "text-white" : "text-[#0c2340]"}`}>Teacher Assignments</h2>
              <p className={`text-xs font-medium ${isDarkUi ? "text-slate-400" : "text-slate-500"}`}>Link academic staff to specific streams.</p>
            </div>
          </div>
          
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sections.map((s) => {
              const room = rooms.find((r) => r.id === s.classRoomId);
              return (
                <div key={s.id} className={`rounded-2xl border p-5 transition-all hover:shadow-md ${isDarkUi ? "bg-slate-800/40 border-slate-700" : "bg-slate-50/50 border-slate-100"}`}>
                  <div className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isDarkUi ? "text-teal-400" : "text-teal-600"}`}>
                    {room?.name} · {s.name}
                  </div>
                  <div className={`text-sm font-bold ${isDarkUi ? "text-slate-200" : "text-[#0c2340]"}`}>
                    {s.classTeacherName ?? "Unassigned"}
                  </div>
                   <button
                    type="button"
                    className="mt-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-sky-500 transition-colors"
                    onClick={() => {
                      setEditSectionId(s.id);
                      setSectionName(s.name);
                      setSectionTeacher(s.classTeacherName ?? "");
                      setClassRoomId(String(s.classRoomId));
                      setShowAddSectionForm(true);
                    }}
                  >
                    Change Teacher →
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {section === "class_categories" ? (
        <div className={cardClass}>
           <div className="flex items-center justify-between border-b border-slate-100 px-8 py-6 -mx-8 -mt-8 mb-8">
            <div>
              <h2 className={`text-lg font-black ${isDarkUi ? "text-white" : "text-[#0c2340]"}`}>Level Categories</h2>
              <p className={`text-xs font-medium ${isDarkUi ? "text-slate-400" : "text-slate-500"}`}>Organizational stages for your school hierarchy.</p>
            </div>
          </div>

           <div className="overflow-x-auto -mx-8">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className={`${isDarkUi ? "bg-slate-800/50" : "bg-slate-50/50"}`}>
                  <th className={`px-8 py-4 text-[10px] font-black uppercase tracking-widest ${isDarkUi ? "text-slate-400" : "text-slate-500"}`}>Category</th>
                  <th className={`px-8 py-4 text-[10px] font-black uppercase tracking-widest ${isDarkUi ? "text-slate-400" : "text-slate-500"}`}>Description</th>
                  <th className={`px-8 py-4 text-[10px] font-black uppercase tracking-widest ${isDarkUi ? "text-slate-400" : "text-slate-500"}`}>Classes</th>
                  <th className={`px-8 py-4 text-right text-[10px] font-black uppercase tracking-widest ${isDarkUi ? "text-slate-400" : "text-slate-500"}`}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {categories.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-8 py-12 text-center text-slate-400 text-sm italic">
                      No categories defined yet.
                    </td>
                  </tr>
                ) : (
                  categories.map((c) => (
                    <tr key={c.id} className="group border-b border-slate-50 hover:bg-slate-50/50 transition-colors last:border-0">
                      <td className="px-8 py-5">
                         <span className={`text-sm font-bold ${isDarkUi ? "text-slate-200" : "text-[#0c2340]"}`}>{c.name}</span>
                      </td>
                       <td className="px-8 py-5">
                         <span className={`text-xs font-medium ${isDarkUi ? "text-slate-400" : "text-slate-600"}`}>{c.description ?? "—"}</span>
                      </td>
                       <td className="px-8 py-5">
                         <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold ${
                            isDarkUi ? "bg-slate-800 text-slate-300" : "bg-amber-50 text-amber-700"
                          }`}>
                            {c.classesCount ?? 0} Levels
                          </span>
                      </td>
                      <td className="px-8 py-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                           <IconBtn
                            isDarkUi={isDarkUi}
                            label="Edit category"
                            onClick={() => {
                              setEditCategoryId(c.id);
                              setCategoryName(c.name);
                              setCategoryDesc(c.description ?? "");
                              setShowAddCategoryForm(true);
                            }}
                            icon={
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            }
                          />
                          <IconBtn
                            isDarkUi={isDarkUi}
                            danger
                            label="Delete category"
                            onClick={async () => {
                              if (!confirmDelete("category")) return;
                              try {
                                await deleteClassCategory(c.id);
                                if (editCategoryId === c.id) closeCategoryForm();
                                await loadDbData();
                              } catch (err) {
                                setError(err instanceof Error ? err.message : "Delete failed");
                              }
                            }}
                            icon={
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            }
                          />
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {section === "class_reports" ? (
        <div className={cardClass}>
           <div className="flex items-center justify-between border-b border-slate-100 px-8 py-6 -mx-8 -mt-8 mb-8">
            <div>
              <h2 className={`text-lg font-black ${isDarkUi ? "text-white" : "text-[#0c2340]"}`}>{t("classes.reports.cardTitle")}</h2>
              <p className={`text-xs font-medium ${isDarkUi ? "text-slate-400" : "text-slate-500"}`}>Generate academic rosters and statistical records.</p>
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-3">
            <div className="space-y-1.5">
              <label className={`text-[10px] font-black uppercase tracking-widest ${isDarkUi ? "text-slate-500" : "text-slate-400"}`}>{t("classes.reports.fieldClass")} *</label>
              <select
                value={reportClassId}
                onChange={(e) => setReportClassId(e.target.value)}
                className={inputClass}
              >
                <option value="">{t("classes.reports.classPlaceholder")}</option>
                {rooms.map((r) => (
                  <option key={r.id} value={String(r.id)}>{r.name} ({r.academicYear})</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className={`text-[10px] font-black uppercase tracking-widest ${isDarkUi ? "text-slate-500" : "text-slate-400"}`}>{t("classes.reports.fieldTerm")}</label>
              <input
                value={reportTerm}
                onChange={(e) => setReportTerm(e.target.value)}
                className={inputClass}
                placeholder="e.g. Term 1"
              />
            </div>
            <div className="space-y-1.5">
              <label className={`text-[10px] font-black uppercase tracking-widest ${isDarkUi ? "text-slate-500" : "text-slate-400"}`}>{t("classes.reports.fieldFormat")}</label>
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value as "PDF" | "Excel")}
                className={inputClass}
              >
                <option value="PDF">Standard PDF</option>
                <option value="Excel">Data Sheet (Excel)</option>
              </select>
            </div>
          </div>

          <div className="mt-8 flex flex-col sm:flex-row gap-8">
            <div className="flex-1">
              <h4 className={`text-sm font-black mb-4 uppercase tracking-widest ${isDarkUi ? "text-slate-500" : "text-slate-400"}`}>Live Preview</h4>
              <div className={`rounded-[2rem] border p-8 relative overflow-hidden ${isDarkUi ? "bg-slate-800/30 border-slate-700" : "bg-slate-50 border-slate-100"}`}>
                {!selectedReportRoom ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <div className="text-3xl mb-3">📄</div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t("classes.reports.helperSelectClass")}</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex justify-between border-b border-slate-200/50 pb-2">
                       <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Target Level</span>
                       <span className={`text-xs font-bold ${isDarkUi ? "text-white" : "text-[#0c2340]"}`}>{selectedReportRoom.name}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-200/50 pb-2">
                       <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Year / Term</span>
                       <span className={`text-xs font-bold ${isDarkUi ? "text-white" : "text-[#0c2340]"}`}>{selectedReportRoom.academicYear} · {reportTerm || 'All'}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-200/50 pb-2">
                       <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Records</span>
                       <span className={`text-xs font-bold ${isDarkUi ? "text-white" : "text-[#0c2340]"}`}>{reportStats.students} Students</span>
                    </div>
                     <div className="flex justify-between">
                       <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Output Format</span>
                       <span className="text-xs font-bold text-teal-600">{reportType} Document</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <div className="sm:w-64 flex flex-col justify-end">
               <button
                type="button"
                disabled={!selectedReportRoom}
                onClick={handleGenerateReport}
                className="w-full rounded-2xl bg-gradient-to-r from-[#0c2340] to-[#1a3a5c] py-4 text-sm font-black text-white shadow-xl shadow-[#0c2340]/20 transition-all hover:-translate-y-1 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t("classes.reports.btnGenerate")}
              </button>
              <p className="mt-4 text-[10px] font-medium text-slate-500 text-center px-4 leading-relaxed">
                The generated document will contain admission numbers, full names, and stream assignments.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {/* Modals */}
      {showAddClassForm && (
        <Modal 
          title={editClassId ? "Update Class" : "Add New Class"} 
          onClose={() => {
            setShowAddClassForm(false);
            setEditClassId(null);
          }}
          isDarkUi={isDarkUi}
        >
          <form
            onSubmit={
              editClassId
                ? async (e) => {
                    e.preventDefault();
                    if (!className.trim()) {
                      setError("Class name cannot be empty.");
                      return;
                    }
                    if (!classCategoryId) {
                      setError("Please select a class category.");
                      return;
                    }
                    try {
                      await updateClassroom(editClassId, {
                        name: className.trim(),
                        categoryId: Number(classCategoryId),
                        description: classDesc.trim() || undefined,
                      });
                      setEditClassId(null);
                      setClassName("");
                      setClassDesc("");
                      setClassCategoryId("");
                      setShowAddClassForm(false);
                      await loadDbData();
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Failed to update class");
                    }
                  }
                : handleCreateClass
            }
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <label className={`text-[10px] font-black uppercase tracking-widest ${isDarkUi ? "text-slate-400" : "text-slate-500"}`}>Class Name</label>
              <input value={className} onChange={(e) => setClassName(e.target.value)} className={inputClass} placeholder="e.g. Primary 1" />
            </div>
            <div className="space-y-1.5">
              <label className={`text-[10px] font-black uppercase tracking-widest ${isDarkUi ? "text-slate-400" : "text-slate-500"}`}>Category</label>
              <select value={classCategoryId} onChange={(e) => setClassCategoryId(e.target.value)} className={inputClass}>
                <option value="">Select Category</option>
                {categories.map((c) => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className={`text-[10px] font-black uppercase tracking-widest ${isDarkUi ? "text-slate-400" : "text-slate-500"}`}>Description</label>
              <input value={classDesc} onChange={(e) => setClassDesc(e.target.value)} className={inputClass} placeholder="Optional" />
            </div>
            <ModalFooter 
               onCancel={() => { setShowAddClassForm(false); setEditClassId(null); }} 
               isDarkUi={isDarkUi}
               confirmLabel={editClassId ? "Update Class" : "Save Class"}
            />
          </form>
        </Modal>
      )}

      {showAddSectionForm && (
        <Modal 
          title={editSectionId ? t("classes.sections.formEditTitle") : t("classes.sections.formAddTitle")} 
          onClose={() => {
            setShowAddSectionForm(false);
            setEditSectionId(null);
            setSectionName("");
            setSectionTeacher("");
          }}
          isDarkUi={isDarkUi}
        >
          <form onSubmit={handleCreateSection} className="space-y-4">
            <div className="space-y-1.5">
              <label className={`text-[10px] font-black uppercase tracking-widest ${isDarkUi ? "text-slate-400" : "text-slate-500"}`}>{t("classes.sections.col.class")}</label>
              <select
                required
                value={classRoomId}
                onChange={(e) => setClassRoomId(e.target.value)}
                className={inputClass}
              >
                <option value="">{t("classes.sections.selectClass")}</option>
                {rooms.map((r) => (
                  <option key={r.id} value={String(r.id)}>
                    {r.name} ({r.academicYear})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className={`text-[10px] font-black uppercase tracking-widest ${isDarkUi ? "text-slate-400" : "text-slate-500"}`}>{t("classes.sections.col.section")}</label>
              <input
                required
                value={sectionName}
                onChange={(e) => setSectionName(e.target.value)}
                className={inputClass}
                placeholder={t("classes.sections.placeholderName")}
              />
            </div>
            <div className="space-y-1.5">
              <label className={`text-[10px] font-black uppercase tracking-widest ${isDarkUi ? "text-slate-400" : "text-slate-500"}`}>{t("classes.sections.col.teacher")}</label>
              <select
                value={sectionTeacher}
                onChange={(e) => setSectionTeacher(e.target.value)}
                className={inputClass}
              >
                <option value="">{t("classes.sections.placeholderTeacher")}</option>
                {sectionTeacher && !teachers.some((x) => x.displayName === sectionTeacher) ? (
                  <option value={sectionTeacher}>{sectionTeacher}</option>
                ) : null}
                {teachers.map((teacher) => (
                  <option key={teacher.id} value={teacher.displayName}>
                    {teacher.displayName}
                  </option>
                ))}
              </select>
            </div>
             <ModalFooter 
               onCancel={() => { setShowAddSectionForm(false); setEditSectionId(null); }} 
               isDarkUi={isDarkUi}
               confirmLabel={editSectionId ? t("classes.sections.btnUpdate") : t("classes.sections.btnSave")}
            />
          </form>
        </Modal>
      )}

      {showAddCategoryForm && (
        <Modal 
          title={editCategoryId ? t("classes.categories.formEditTitle") : t("classes.categories.formAddTitle")} 
          onClose={closeCategoryForm}
          isDarkUi={isDarkUi}
        >
          <form onSubmit={handleCategoryFormSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className={`text-[10px] font-black uppercase tracking-widest ${isDarkUi ? "text-slate-400" : "text-slate-500"}`}>{t("classes.categories.fieldName")}</label>
              <input
                required
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                className={inputClass}
                placeholder={t("classes.categories.placeholderName")}
              />
            </div>
            <div className="space-y-1.5">
              <label className={`text-[10px] font-black uppercase tracking-widest ${isDarkUi ? "text-slate-400" : "text-slate-500"}`}>{t("classes.categories.fieldDescription")}</label>
              <input
                value={categoryDesc}
                onChange={(e) => setCategoryDesc(e.target.value)}
                className={inputClass}
                placeholder={t("classes.categories.placeholderDesc")}
              />
            </div>
             <ModalFooter 
               onCancel={closeCategoryForm} 
               isDarkUi={isDarkUi}
               confirmLabel={editCategoryId ? t("classes.categories.btnUpdate") : t("classes.categories.btnSave")}
            />
          </form>
        </Modal>
      )}

      {/* Standard Error Modal */}
      {error && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
           <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-md" onClick={() => setError(null)} />
           <div className={`relative w-full max-w-sm rounded-[2rem] p-8 shadow-2xl border ${isDarkUi ? "bg-slate-900 border-rose-500/30" : "bg-white border-rose-100"}`}>
              <div className="flex flex-col items-center text-center">
                 <div className="h-16 w-16 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center text-3xl mb-4">⚠️</div>
                 <h3 className={`text-lg font-black mb-2 ${isDarkUi ? "text-white" : "text-[#0c2340]"}`}>Something went wrong</h3>
                 <p className="text-sm font-medium text-slate-500 leading-relaxed mb-8">{error}</p>
                 <button 
                  onClick={() => setError(null)}
                  className="w-full py-3 rounded-xl bg-rose-500 text-white font-bold shadow-lg shadow-rose-500/20 transition-all hover:brightness-105"
                 >
                   Dismiss
                 </button>
              </div>
           </div>
        </div>
      )}

      <StudentDetailModal
        studentId={rosterStudentModal?.studentId ?? null}
        initialEditing
        focusSectionField={rosterStudentModal?.focusSection ?? false}
        lockClassField={rosterStudentModal?.focusSection ?? false}
        streamOptions={
          rosterStudentModal?.focusSection && rosterStreamNames.length > 0 ? rosterStreamNames : null
        }
        onClose={() => setRosterStudentModal(null)}
        onChanged={() => void loadDbData()}
      />
    </div>
  );
}

function Modal({ title, children, onClose, isDarkUi }: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  isDarkUi: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-300" onClick={onClose} />
      <div className={`relative w-full max-w-lg animate-in zoom-in-95 fade-in duration-300 rounded-[2.5rem] p-8 shadow-2xl ${
        isDarkUi ? "bg-slate-900 border border-slate-700" : "bg-white"
      }`}>
        <div className="flex items-center justify-between mb-8">
          <h3 className={`text-xl font-black tracking-tight ${isDarkUi ? "text-white" : "text-[#0c2340]"}`}>{title}</h3>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-slate-100 transition-colors">
            <svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ModalFooter({ onCancel, isDarkUi, confirmLabel }: {
  onCancel: () => void;
  isDarkUi: boolean;
  confirmLabel: string;
}) {
  return (
    <div className="mt-10 flex gap-4">
      <button
        type="button"
        onClick={onCancel}
        className={`flex-1 rounded-2xl py-3 text-sm font-bold transition-all ${
          isDarkUi ? "bg-slate-800 text-slate-300 hover:bg-slate-700" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
        }`}
      >
        Cancel
      </button>
      <button
        type="submit"
        className="flex-1 rounded-2xl bg-gradient-to-r from-[#0c2340] to-[#1a3a5c] py-3 text-sm font-bold text-white shadow-lg shadow-[#0c2340]/20 transition-all hover:shadow-xl"
      >
        {confirmLabel}
      </button>
    </div>
  );
}
