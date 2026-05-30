import { Fragment, type ReactNode, useEffect, useMemo, useState } from "react";
import {
  createClassCategory,
  createClassroom,
  createClassSection,
  fetchClassCategories,
  fetchClassrooms,
  fetchClassSections,
  fetchStaffMembers,
  updateStaffMember,
  type ClassCategoryOption,
  type ClassRoomOption,
  type ClassSectionOption,
  type StaffMemberApiRow,
} from "../../api/students";
import { useTheme } from "../../theme/ThemeProvider";
import { Toast } from "./shared";

export function SettingsClassStructurePanel() {
  const { resolvedTheme } = useTheme();
  const isDarkUi = resolvedTheme === "dark" || resolvedTheme === "tinted-dark";

  const [classrooms, setClassrooms] = useState<ClassRoomOption[]>([]);
  const [categories, setCategories] = useState<ClassCategoryOption[]>([]);
  const [sections, setSections] = useState<ClassSectionOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [createClassOpen, setCreateClassOpen] = useState(false);
  const [createCategoryOpen, setCreateCategoryOpen] = useState(false);
  const [createSectionOpen, setCreateSectionOpen] = useState(false);
  const [assignTeachersOpen, setAssignTeachersOpen] = useState(false);

  const [className, setClassName] = useState("");
  const [classCategoryId, setClassCategoryId] = useState("");
  const [classDescription, setClassDescription] = useState("");
  const [classAcademicYear, setClassAcademicYear] = useState(String(new Date().getFullYear()));

  const [categoryName, setCategoryName] = useState("");
  const [categoryDescription, setCategoryDescription] = useState("");

  const [classRoomId, setClassRoomId] = useState("");
  const [sectionName, setSectionName] = useState("");
  const [classTeacherName, setClassTeacherName] = useState("");
  const [teacherCategoryId, setTeacherCategoryId] = useState("");
  const [staffRows, setStaffRows] = useState<StaffMemberApiRow[]>([]);
  const [teacherClassDrafts, setTeacherClassDrafts] = useState<Record<number, string>>({});
  const [teacherSectionDrafts, setTeacherSectionDrafts] = useState<Record<number, string>>({});
  const [linkingTeacherId, setLinkingTeacherId] = useState<number | null>(null);

  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadData = async () => {
    setLoading(true);
    setToast(null);
    try {
      const [rooms, secs, cats] = await Promise.all([
        fetchClassrooms(),
        fetchClassSections(),
        fetchClassCategories(),
      ]);
      setClassrooms(rooms);
      setSections(secs);
      setCategories(cats);
    } catch (e) {
      setToast({
        type: "error",
        text: e instanceof Error ? e.message : "Failed to load class structure.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData().catch(() => undefined);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const classGroups = useMemo(() => {
    const groups = categories
      .map((category) => ({
        categoryId: category.id,
        categoryName: category.name,
        classes: classrooms
          .filter((room) => room.categoryId === category.id)
          .slice()
          .sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .filter((group) => group.classes.length > 0);

    const uncategorized = classrooms
      .filter((room) => !room.categoryId || !categories.some((c) => c.id === room.categoryId))
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name));
    if (uncategorized.length > 0) {
      groups.push({ categoryId: -1, categoryName: "Uncategorized", classes: uncategorized });
    }
    return groups;
  }, [categories, classrooms]);

  async function handleCreateCategory() {
    if (!categoryName.trim()) {
      setToast({ type: "error", text: "Category name is required." });
      return;
    }
    setSaving(true);
    setToast(null);
    try {
      const created = await createClassCategory({
        name: categoryName.trim(),
        description: categoryDescription.trim() || undefined,
      });
      setCreateCategoryOpen(false);
      setCategoryName("");
      setCategoryDescription("");
      await loadData();
      setClassCategoryId(String(created.id));
      setToast({ type: "success", text: "Category created successfully." });
    } catch (e) {
      setToast({
        type: "error",
        text: e instanceof Error ? e.message : "Failed to create category.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateClass() {
    if (!className.trim()) {
      setToast({ type: "error", text: "Class name is required." });
      return;
    }
    const parsedCategoryId = Number(classCategoryId);
    if (!Number.isFinite(parsedCategoryId) || parsedCategoryId < 1) {
      setToast({ type: "error", text: "Please select a class category." });
      return;
    }
    setSaving(true);
    setToast(null);
    try {
      const created = await createClassroom({
        name: className.trim(),
        categoryId: parsedCategoryId,
        description: classDescription.trim() || undefined,
        academicYear: classAcademicYear.trim() || String(new Date().getFullYear()),
      });
      setCreateClassOpen(false);
      setClassName("");
      setClassCategoryId("");
      setClassDescription("");
      setClassAcademicYear(String(new Date().getFullYear()));
      await loadData();
      setClassRoomId(String(created.id));
      setToast({ type: "success", text: "Class created successfully." });
    } catch (e) {
      setToast({
        type: "error",
        text: e instanceof Error ? e.message : "Failed to create class.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateSection() {
    const parsedClassRoomId = Number(classRoomId);
    if (!Number.isFinite(parsedClassRoomId) || parsedClassRoomId < 1) {
      setToast({ type: "error", text: "Please select a class." });
      return;
    }
    if (!sectionName.trim()) {
      setToast({ type: "error", text: "Section name is required." });
      return;
    }
    setSaving(true);
    setToast(null);
    try {
      await createClassSection({
        classRoomId: parsedClassRoomId,
        name: sectionName.trim(),
        classTeacherName: classTeacherName.trim() || undefined,
      });
      setCreateSectionOpen(false);
      setClassRoomId("");
      setSectionName("");
      setClassTeacherName("");
      await loadData();
      setToast({ type: "success", text: "Section created successfully." });
    } catch (e) {
      setToast({
        type: "error",
        text: e instanceof Error ? e.message : "Failed to create section.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function openAssignTeachers() {
    setAssignTeachersOpen(true);
    setTeacherCategoryId("");
    setTeacherClassDrafts({});
    setTeacherSectionDrafts({});
    try {
      // #region agent log
      void fetch('http://127.0.0.1:7413/ingest/299b84ae-e9b2-45ce-b53d-28789819d44d', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Debug-Session-Id': 'b215a2',
        },
        body: JSON.stringify({
          sessionId: 'b215a2',
          runId: 'pre_debug',
          hypothesisId: 'H1_fetchStaffMembers',
          location: 'SettingsClassStructurePanel.tsx:openAssignTeachers:start',
          message: 'Opening assign-teachers modal; fetching teaching staff',
          data: { teacherCategoryId: '' },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
      const rows = await fetchStaffMembers("teaching");
      // #region agent log
      void fetch('http://127.0.0.1:7413/ingest/299b84ae-e9b2-45ce-b53d-28789819d44d', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Debug-Session-Id': 'b215a2',
        },
        body: JSON.stringify({
          sessionId: 'b215a2',
          runId: 'pre_debug',
          hypothesisId: 'H1_fetchStaffMembers',
          location: 'SettingsClassStructurePanel.tsx:openAssignTeachers:fetched',
          message: 'Fetched teaching staff rows',
          data: { fetchedCount: rows.length, firstIds: rows.slice(0, 5).map((r) => r.id) },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
      setStaffRows(rows);
    } catch (e) {
      setToast({
        type: "error",
        text: e instanceof Error ? e.message : "Failed to load teachers.",
      });
    }
  }

  const selectedCategoryName = useMemo(() => {
    const id = Number.parseInt(teacherCategoryId, 10);
    if (!Number.isFinite(id) || id < 1) return "";
    return categories.find((c) => c.id === id)?.name ?? "";
  }, [teacherCategoryId, categories]);

  const categoryClasses = useMemo(() => {
    const id = Number.parseInt(teacherCategoryId, 10);
    if (!Number.isFinite(id) || id < 1) return [];
    return classrooms.filter((room) => room.categoryId === id);
  }, [teacherCategoryId, classrooms]);

  const categoryTeachers = useMemo(() => {
    if (!selectedCategoryName.trim()) return [];
    const needle = selectedCategoryName.trim().toLowerCase();
    const classNames = new Set(categoryClasses.map((room) => room.name.trim().toLowerCase()));
    return staffRows.filter((row) => {
      const savedCategory = (row.staffCategory ?? "").trim().toLowerCase();
      if (savedCategory === needle) return true;
      const assignedClass = (row.assignedClass ?? "").trim().toLowerCase();
      return assignedClass ? classNames.has(assignedClass) : false;
    });
  }, [staffRows, selectedCategoryName, categoryClasses]);

  // #region agent log
  useEffect(() => {
    if (!assignTeachersOpen) return;
    // #region agent log
    void fetch('http://127.0.0.1:7413/ingest/299b84ae-e9b2-45ce-b53d-28789819d44d', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Debug-Session-Id': 'b215a2',
      },
      body: JSON.stringify({
        sessionId: 'b215a2',
        runId: 'pre_debug',
        hypothesisId: 'H2_filterMismatch',
        location: 'SettingsClassStructurePanel.tsx:assignTeachers:categoryTeachersEffect',
        message: 'Computed categoryTeachers after filter logic',
        data: {
          teacherCategoryId,
          selectedCategoryName,
          staffRowsCount: staffRows.length,
          categoryTeachersCount: categoryTeachers.length,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
  }, [assignTeachersOpen, teacherCategoryId, selectedCategoryName, staffRows.length, categoryTeachers.length]);
  // #endregion

  async function linkTeacherToClass(teacher: StaffMemberApiRow) {
    const chosenClass = (teacherClassDrafts[teacher.id] ?? "").trim();
    // #region agent log
    void fetch('http://127.0.0.1:7413/ingest/299b84ae-e9b2-45ce-b53d-28789819d44d', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Debug-Session-Id': 'b215a2',
      },
      body: JSON.stringify({
        sessionId: 'b215a2',
        runId: 'pre_debug',
        hypothesisId: 'H3_chosenClassValidation',
        location: 'SettingsClassStructurePanel.tsx:linkTeacherToClass:beforeUpdate',
        message: 'Link teacher invoked; chosen class/section values',
        data: {
          teacherId: teacher.id,
          chosenClass,
          chosenSection: (teacherSectionDrafts[teacher.id] ?? "").trim(),
          selectedCategoryName: selectedCategoryName || null,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    if (!chosenClass) {
      setToast({ type: "error", text: "Select a class before linking teacher." });
      return;
    }
    const chosenSection = (teacherSectionDrafts[teacher.id] ?? "").trim();
    setLinkingTeacherId(teacher.id);
    try {
      const updated = await updateStaffMember(teacher.id, {
        assignedClass: chosenClass,
        teachingSection: chosenSection || undefined,
        staffCategory: selectedCategoryName || undefined,
      });
      setStaffRows((prev) => prev.map((row) => (row.id === teacher.id ? updated : row)));
      setToast({ type: "success", text: `Linked ${updated.displayName} successfully.` });
    } catch (e) {
      // #region agent log
      void fetch('http://127.0.0.1:7413/ingest/299b84ae-e9b2-45ce-b53d-28789819d44d', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Debug-Session-Id': 'b215a2',
        },
        body: JSON.stringify({
          sessionId: 'b215a2',
          runId: 'pre_debug',
          hypothesisId: 'H4_backendUpdateFailure',
          location: 'SettingsClassStructurePanel.tsx:linkTeacherToClass:catch',
          message: 'Failed to link teacher (backend/updateStaffMember error)',
          data: {
            teacherId: teacher.id,
            error: e instanceof Error ? e.message : String(e),
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
      setToast({
        type: "error",
        text: e instanceof Error ? e.message : "Failed to link teacher.",
      });
    } finally {
      setLinkingTeacherId(null);
    }
  }

  const baseInputClass = `neo-inset-field w-full rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all outline-none focus:ring-2 ${
    isDarkUi 
      ? "bg-[#1e293b] border-slate-700 text-white focus:ring-sky-500/20 focus:border-sky-500" 
      : "bg-white border-slate-200 text-slate-800 focus:ring-[#0c2340]/10 focus:border-[#0c2340]"
  }`;

  return (
    <section className="mx-auto max-w-[1000px] space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-24">
      {/* Premium Header */}
      <header className={`neo-card relative overflow-hidden rounded-3xl p-8 shadow-xl ${isDarkUi ? "bg-slate-900/50" : "bg-white"}`}>
        <div className="absolute top-0 left-0 h-2 w-full bg-gradient-to-r from-[#0c2340] via-[#0f766e] to-[#ea580c]" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0c2340] to-[#1a3a5c] text-3xl shadow-lg shadow-[#0c2340]/20">
              🏫
            </div>
            <div>
              <h1 className={`text-3xl font-black tracking-tight ${isDarkUi ? "text-white" : "text-[#0c2340]"}`}>
                Class Structure
              </h1>
              <p className={`mt-1 text-sm font-medium ${isDarkUi ? "text-slate-400" : "text-slate-500"}`}>
                Architect your school's academic hierarchy and organization.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
             <button
              type="button"
              onClick={() => setCreateCategoryOpen(true)}
              className={`flex items-center gap-2 rounded-xl border-2 px-5 py-2.5 text-sm font-bold transition-all hover:-translate-y-0.5 ${
                isDarkUi 
                  ? "border-slate-700 text-slate-300 hover:bg-slate-800" 
                  : "border-[#0c2340] text-[#0c2340] hover:bg-slate-50"
              }`}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Category
            </button>
            <button
              type="button"
              onClick={() => {
                setClassAcademicYear(String(new Date().getFullYear()));
                setCreateClassOpen(true);
              }}
              className="flex items-center gap-2 rounded-xl bg-[#0c2340] px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-[#0c2340]/20 transition-all hover:-translate-y-0.5 hover:shadow-xl active:translate-y-0"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              New Class
            </button>
          </div>
        </div>
      </header>

      {/* Stats Overview */}
      <div className="grid gap-6 sm:grid-cols-3">
        <StatCard
          label="Total Classes"
          value={classrooms.length}
          icon="📚"
          trend="+2 this year"
          color="from-sky-500 to-blue-600"
          isDarkUi={isDarkUi}
        />
        <StatCard
          label="Active Sections"
          value={sections.length}
          icon="🖇️"
          trend="Balanced across levels"
          color="from-teal-500 to-emerald-600"
          isDarkUi={isDarkUi}
        />
        <StatCard
          label="Categories"
          value={categories.length}
          icon="🏷️"
          trend="Organized structure"
          color="from-amber-500 to-orange-600"
          isDarkUi={isDarkUi}
        />
      </div>

      {/* Main Content Area */}
      <div className="grid gap-8 lg:grid-cols-12">
        {/* Left Column: Class List */}
        <div className="lg:col-span-8 space-y-8">
          <div className={`neo-card overflow-hidden rounded-3xl border border-slate-100 shadow-sm ${isDarkUi ? "bg-slate-900/50" : "bg-white"}`}>
            <div className="flex items-center justify-between border-b border-slate-100 px-8 py-6">
              <div>
                <h2 className={`text-lg font-black ${isDarkUi ? "text-white" : "text-[#0c2340]"}`}>Class Hierarchy</h2>
                <p className={`text-xs font-medium ${isDarkUi ? "text-slate-400" : "text-slate-500"}`}>Complete overview of levels and streams.</p>
              </div>
              <button
                type="button"
                onClick={() => setCreateSectionOpen(true)}
                className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100 transition-colors"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Add Stream
              </button>
            </div>

            <div className="p-0">
              {loading ? (
                <div className="flex h-64 items-center justify-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-500 border-t-transparent" />
                </div>
              ) : classGroups.length === 0 ? (
                <div className="flex h-64 flex-col items-center justify-center text-center p-8">
                  <div className="mb-4 text-4xl">📭</div>
                  <h3 className={`text-base font-bold ${isDarkUi ? "text-slate-300" : "text-slate-600"}`}>No classes found</h3>
                  <p className="mt-1 text-xs text-slate-400">Start by creating a category and adding your first class.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left">
                    <thead className={`${isDarkUi ? "bg-slate-800/50" : "bg-slate-50/50"}`}>
                      <tr>
                        <th className={`px-8 py-4 text-[10px] font-black uppercase tracking-widest ${isDarkUi ? "text-slate-400" : "text-slate-500"}`}>Class Name</th>
                        <th className={`px-8 py-4 text-[10px] font-black uppercase tracking-widest ${isDarkUi ? "text-slate-400" : "text-slate-500"}`}>Year</th>
                        <th className={`px-8 py-4 text-[10px] font-black uppercase tracking-widest ${isDarkUi ? "text-slate-400" : "text-slate-500"}`}>Streams</th>
                        <th className={`px-8 py-4 text-[10px] font-black uppercase tracking-widest ${isDarkUi ? "text-slate-400" : "text-slate-500"}`}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {classGroups.map((group) => (
                        <Fragment key={group.categoryId}>
                          <tr className={`${isDarkUi ? "bg-slate-800/30" : "bg-slate-50/30"}`}>
                            <td colSpan={4} className="px-8 py-3">
                              <div className="flex items-center gap-2">
                                <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
                                <span className={`text-[10px] font-black uppercase tracking-widest ${isDarkUi ? "text-teal-400" : "text-teal-700"}`}>
                                  {group.categoryName}
                                </span>
                              </div>
                            </td>
                          </tr>
                          {group.classes.map((room) => {
                            const roomSections = sections.filter(s => s.classRoomId === room.id);
                            return (
                              <tr key={room.id} className="group border-b border-slate-50 hover:bg-slate-50/50 transition-colors last:border-0">
                                <td className="px-8 py-5">
                                  <div className="flex flex-col">
                                    <span className={`text-sm font-bold ${isDarkUi ? "text-slate-200" : "text-[#0c2340]"}`}>{room.name}</span>
                                    <span className="text-[10px] font-medium text-slate-400">{room.description || "No description"}</span>
                                  </div>
                                </td>
                                <td className={`px-8 py-5 text-xs font-semibold ${isDarkUi ? "text-slate-400" : "text-slate-600"}`}>
                                  {room.academicYear}
                                </td>
                                <td className="px-8 py-5">
                                  <div className="flex flex-wrap gap-1.5">
                                    {roomSections.length > 0 ? (
                                      roomSections.map(s => (
                                        <span key={s.id} className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-bold ${
                                          isDarkUi ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-600"
                                        }`}>
                                          {s.name}
                                        </span>
                                      ))
                                    ) : (
                                      <span className="text-[10px] font-medium text-slate-400 italic">None</span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-8 py-5">
                                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ${
                                    room.isActive !== false 
                                      ? "bg-emerald-50 text-emerald-700" 
                                      : "bg-rose-50 text-rose-700"
                                  }`}>
                                    <span className={`h-1.5 w-1.5 rounded-full ${room.isActive !== false ? "bg-emerald-500" : "bg-rose-500"}`} />
                                    {room.isActive !== false ? "Active" : "Inactive"}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Quick Actions & Help */}
        <div className="lg:col-span-4 space-y-6">
          <div className={`neo-card rounded-3xl p-6 shadow-sm border border-slate-100 ${isDarkUi ? "bg-slate-900/50" : "bg-white"}`}>
            <h3 className={`text-base font-black ${isDarkUi ? "text-white" : "text-[#0c2340]"}`}>Quick Actions</h3>
            <div className="mt-6 grid gap-4">
               <ActionButton
                icon="🏷️"
                label="Manage Categories"
                description="Group classes by level or stage."
                onClick={() => setCreateCategoryOpen(true)}
                isDarkUi={isDarkUi}
              />
              <ActionButton
                icon="🔗"
                label="Assign Teachers"
                description="Link staff to classes and streams."
                onClick={() => void openAssignTeachers()}
                isDarkUi={isDarkUi}
              />
              <ActionButton
                icon="📊"
                label="Academic Sync"
                description="Update years across all levels."
                onClick={() => {}}
                isDarkUi={isDarkUi}
              />
            </div>
          </div>

          <div className={`neo-card rounded-3xl p-6 shadow-sm border border-slate-100 overflow-hidden relative ${
            isDarkUi ? "bg-slate-900/50" : "bg-gradient-to-br from-[#0c2340] to-[#1a3a5c]"
          }`}>
            <div className="absolute -right-4 -bottom-4 h-24 w-24 opacity-10 blur-xl bg-white rounded-full" />
            <h3 className={`text-base font-black ${isDarkUi ? "text-teal-400" : "text-white"}`}>Structure Guide</h3>
            <div className="mt-4 space-y-4">
              <div className="flex gap-3">
                <div className="h-6 w-6 shrink-0 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold text-white border border-white/20">1</div>
                <p className="text-xs font-medium text-slate-300 leading-relaxed">
                  Start by defining your **Categories** (e.g. Nursery, P1-P3).
                </p>
              </div>
              <div className="flex gap-3">
                <div className="h-6 w-6 shrink-0 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold text-white border border-white/20">2</div>
                <p className="text-xs font-medium text-slate-300 leading-relaxed">
                  Add **Classes** under each category.
                </p>
              </div>
              <div className="flex gap-3">
                <div className="h-6 w-6 shrink-0 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold text-white border border-white/20">3</div>
                <p className="text-xs font-medium text-slate-300 leading-relaxed">
                  Create **Streams/Sections** for each class to manage student distribution.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {createSectionOpen && (
        <Modal 
          title="Add Section / Stream" 
          onClose={() => setCreateSectionOpen(false)}
          isDarkUi={isDarkUi}
        >
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className={`text-[10px] font-black uppercase tracking-widest ${isDarkUi ? "text-slate-400" : "text-slate-500"}`}>Target Class</label>
              <select
                value={classRoomId}
                onChange={(e) => setClassRoomId(e.target.value)}
                className={baseInputClass}
              >
                <option value="">Select class</option>
                {classrooms.map((room) => (
                  <option key={room.id} value={room.id}>{room.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className={`text-[10px] font-black uppercase tracking-widest ${isDarkUi ? "text-slate-400" : "text-slate-500"}`}>Section Name</label>
              <input
                value={sectionName}
                onChange={(e) => setSectionName(e.target.value)}
                placeholder="e.g. North, Red, A"
                className={baseInputClass}
              />
            </div>
            <div className="space-y-1.5">
              <label className={`text-[10px] font-black uppercase tracking-widest ${isDarkUi ? "text-slate-400" : "text-slate-500"}`}>Class Teacher</label>
              <input
                value={classTeacherName}
                onChange={(e) => setClassTeacherName(e.target.value)}
                placeholder="Optional"
                className={baseInputClass}
              />
            </div>
          </div>
          <ModalFooter 
            onCancel={() => setCreateSectionOpen(false)} 
            onConfirm={handleCreateSection} 
            saving={saving} 
            isDarkUi={isDarkUi}
          />
        </Modal>
      )}

      {createClassOpen && (
        <Modal 
          title="Create New Class" 
          onClose={() => setCreateClassOpen(false)}
          isDarkUi={isDarkUi}
        >
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className={`text-[10px] font-black uppercase tracking-widest ${isDarkUi ? "text-slate-400" : "text-slate-500"}`}>Class Name</label>
              <input
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                placeholder="e.g. Primary 1"
                className={baseInputClass}
              />
            </div>
            <div className="space-y-1.5">
              <label className={`text-[10px] font-black uppercase tracking-widest ${isDarkUi ? "text-slate-400" : "text-slate-500"}`}>Category</label>
              <select
                value={classCategoryId}
                onChange={(e) => setClassCategoryId(e.target.value)}
                className={baseInputClass}
              >
                <option value="">Select category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className={`text-[10px] font-black uppercase tracking-widest ${isDarkUi ? "text-slate-400" : "text-slate-500"}`}>Description</label>
              <input
                value={classDescription}
                onChange={(e) => setClassDescription(e.target.value)}
                placeholder="Short description"
                className={baseInputClass}
              />
            </div>
            <div className="space-y-1.5">
              <label className={`text-[10px] font-black uppercase tracking-widest ${isDarkUi ? "text-slate-400" : "text-slate-500"}`}>Academic Year</label>
              <input
                value={classAcademicYear}
                onChange={(e) => setClassAcademicYear(e.target.value)}
                placeholder="e.g. 2026"
                className={baseInputClass}
              />
            </div>
          </div>
          <ModalFooter 
            onCancel={() => setCreateClassOpen(false)} 
            onConfirm={handleCreateClass} 
            saving={saving} 
            isDarkUi={isDarkUi}
          />
        </Modal>
      )}

      {createCategoryOpen && (
        <Modal 
          title="Create Category" 
          onClose={() => setCreateCategoryOpen(false)}
          isDarkUi={isDarkUi}
        >
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className={`text-[10px] font-black uppercase tracking-widest ${isDarkUi ? "text-slate-400" : "text-slate-500"}`}>Category Name</label>
              <input
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                placeholder="e.g. Lower Primary"
                className={baseInputClass}
              />
            </div>
            <div className="space-y-1.5">
              <label className={`text-[10px] font-black uppercase tracking-widest ${isDarkUi ? "text-slate-400" : "text-slate-500"}`}>Description</label>
              <input
                value={categoryDescription}
                onChange={(e) => setCategoryDescription(e.target.value)}
                placeholder="Optional details"
                className={baseInputClass}
              />
            </div>
          </div>
          <ModalFooter 
            onCancel={() => setCreateCategoryOpen(false)} 
            onConfirm={handleCreateCategory} 
            saving={saving} 
            isDarkUi={isDarkUi}
          />
        </Modal>
      )}

      {assignTeachersOpen && (
        <Modal
          title="Assign Teachers to Classes"
          onClose={() => setAssignTeachersOpen(false)}
          isDarkUi={isDarkUi}
        >
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className={`text-[10px] font-black uppercase tracking-widest ${isDarkUi ? "text-slate-400" : "text-slate-500"}`}>
                Category
              </label>
              <select
                value={teacherCategoryId}
                onChange={(e) => setTeacherCategoryId(e.target.value)}
                className={baseInputClass}
              >
                <option value="">Select category</option>
                {categories.map((category) => (
                  <option key={category.id} value={String(category.id)}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            {!teacherCategoryId ? (
              <p className="text-xs text-slate-500">Pick a category to view teachers registered under it.</p>
            ) : categoryTeachers.length === 0 ? (
              <p className="text-xs text-slate-500">No teachers are registered in this category.</p>
            ) : (
              <div className="max-h-[45vh] space-y-3 overflow-auto pr-1">
                {categoryTeachers.map((teacher) => {
                  const selectedClassName = teacherClassDrafts[teacher.id] ?? teacher.assignedClass ?? "";
                  const selectedClass = categoryClasses.find((room) => room.name === selectedClassName) ?? null;
                  const classSections = selectedClass
                    ? sections.filter((sec) => sec.classRoomId === selectedClass.id)
                    : [];
                  const selectedSection = teacherSectionDrafts[teacher.id] ?? teacher.teachingSection ?? "";

                  return (
                    <div
                      key={teacher.id}
                      className={`rounded-2xl border p-4 ${isDarkUi ? "border-slate-700 bg-slate-800/40" : "border-slate-200 bg-slate-50/50"}`}
                    >
                      <p className={`text-sm font-black ${isDarkUi ? "text-white" : "text-[#0c2340]"}`}>{teacher.displayName}</p>
                      <p className="mt-1 text-[11px] text-slate-500">
                        Current: {teacher.assignedClass || "Unassigned"}
                        {teacher.teachingSection ? ` · ${teacher.teachingSection}` : ""}
                        <span className="ml-2 font-semibold text-slate-400">ID: {teacher.id}</span>
                      </p>

                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <select
                          value={selectedClassName}
                          onChange={(e) => {
                            const value = e.target.value;
                            setTeacherClassDrafts((prev) => ({ ...prev, [teacher.id]: value }));
                            setTeacherSectionDrafts((prev) => ({ ...prev, [teacher.id]: "" }));
                          }}
                          className={baseInputClass}
                        >
                          <option value="">Select class</option>
                          {categoryClasses.map((room) => (
                            <option key={room.id} value={room.name}>
                              {room.name}
                            </option>
                          ))}
                        </select>

                        <select
                          value={selectedSection}
                          onChange={(e) =>
                            setTeacherSectionDrafts((prev) => ({ ...prev, [teacher.id]: e.target.value }))
                          }
                          className={baseInputClass}
                          disabled={!selectedClass || classSections.length === 0}
                        >
                          <option value="">
                            {!selectedClass
                              ? "Select class first"
                              : classSections.length === 0
                                ? "No sections"
                                : "Select section"}
                          </option>
                          {classSections.map((sec) => (
                            <option key={sec.id} value={sec.name}>
                              {sec.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="mt-3 flex justify-end">
                        <button
                          type="button"
                          onClick={() => void linkTeacherToClass(teacher)}
                          disabled={linkingTeacherId === teacher.id}
                          className="rounded-xl bg-gradient-to-r from-[#0c2340] to-[#1a3a5c] px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
                        >
                          {linkingTeacherId === teacher.id ? "Linking..." : "Link teacher"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Modal>
      )}

      {toast ? (
        <Toast
          message={toast.text}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      ) : null}
    </section>
  );
}

function StatCard({ label, value, icon, trend, color, isDarkUi }: { 
  label: string; 
  value: number; 
  icon: string; 
  trend: string;
  color: string;
  isDarkUi: boolean;
}) {
  return (
    <div className={`neo-card group relative overflow-hidden rounded-3xl p-6 shadow-sm border border-slate-100 transition-all hover:-translate-y-1 hover:shadow-xl ${isDarkUi ? "bg-slate-900/50" : "bg-white"}`}>
      <div className={`absolute top-0 right-0 h-24 w-24 translate-x-8 -translate-y-8 bg-gradient-to-br ${color} opacity-5 blur-2xl group-hover:opacity-10 transition-opacity`} />
      <div className="flex items-center justify-between">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-2xl group-hover:scale-110 transition-transform">
          {icon}
        </div>
        <span className={`text-[10px] font-black uppercase tracking-widest ${isDarkUi ? "text-slate-500" : "text-slate-400"}`}>Live</span>
      </div>
      <div className="mt-5">
        <h3 className={`text-xs font-black uppercase tracking-widest ${isDarkUi ? "text-slate-500" : "text-slate-400"}`}>{label}</h3>
        <p className={`mt-1 text-4xl font-black tracking-tighter ${isDarkUi ? "text-white" : "text-[#0c2340]"}`}>{value}</p>
        <p className="mt-2 text-[10px] font-bold text-teal-600">{trend}</p>
      </div>
    </div>
  );
}

function ActionButton({ icon, label, description, onClick, isDarkUi }: {
  icon: string;
  label: string;
  description: string;
  onClick: () => void;
  isDarkUi: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`group flex items-start gap-4 rounded-2xl p-4 text-left transition-all hover:-translate-x-1 ${
        isDarkUi ? "bg-slate-800/40 hover:bg-slate-800" : "bg-slate-50/50 hover:bg-slate-50"
      }`}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-xl shadow-sm border border-slate-100 group-hover:scale-110 transition-transform">
        {icon}
      </span>
      <div>
        <h4 className={`text-sm font-bold ${isDarkUi ? "text-slate-200" : "text-[#0c2340]"}`}>{label}</h4>
        <p className="mt-0.5 text-[10px] font-medium text-slate-500 leading-relaxed">{description}</p>
      </div>
    </button>
  );
}

function Modal({ title, children, onClose, isDarkUi }: {
  title: string;
  children: ReactNode;
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

function ModalFooter({ onCancel, onConfirm, saving, isDarkUi }: {
  onCancel: () => void;
  onConfirm: () => void;
  saving: boolean;
  isDarkUi: boolean;
}) {
  return (
    <div className="mt-10 flex gap-4">
      <button
        onClick={onCancel}
        className={`flex-1 rounded-2xl py-3 text-sm font-bold transition-all ${
          isDarkUi ? "bg-slate-800 text-slate-300 hover:bg-slate-700" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
        }`}
      >
        Cancel
      </button>
      <button
        onClick={onConfirm}
        disabled={saving}
        className="flex-1 rounded-2xl bg-gradient-to-r from-[#0c2340] to-[#1a3a5c] py-3 text-sm font-bold text-white shadow-lg shadow-[#0c2340]/20 transition-all hover:shadow-xl disabled:opacity-50"
      >
        {saving ? "Processing..." : "Confirm & Save"}
      </button>
    </div>
  );
}
