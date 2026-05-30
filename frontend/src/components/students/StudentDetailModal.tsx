import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  fetchCountries,
  fetchDistricts,
  fetchNationalities,
  type CountryOption,
} from "../../api/geo";
import {
  deleteStudent,
  fetchClassSections,
  fetchClassrooms,
  fetchStudent,
  updateStudent,
  uploadStudentPhoto,
  type ClassRoomOption,
  type StudentApiRow,
} from "../../api/students";
import { useStudentStatuses } from "../../hooks/useStudentStatuses";
import { useTermContext } from "../../context/TermContext";
import { statusLabelFromRow } from "../../utils/studentStatusDisplay";
import { useI18n } from "../../i18n/I18nProvider";
import { AuthenticatedStudentPhoto } from "./AuthenticatedStudentPhoto";
import { StudentStatusBadge } from "../statuses/StudentStatusBadge";
import { StudentStatusChangeDialog, type StatusFeeRecalcScope } from "./StudentStatusChangeDialog";

import { useTheme } from "../../theme/ThemeProvider";

export type StudentDetailModalProps = {
  studentId: number | null;
  initialEditing?: boolean;
  focusSectionField?: boolean;
  lockClassField?: boolean;
  streamOptions?: string[] | null;
  onClose: () => void;
  onChanged: () => void | Promise<void>;
  onSaved?: (name: string) => void;
  /** User permissions array — when provided, gates edit/delete/photo. Omit for admin (all allowed). */
  permissions?: string[];
};

export function StudentDetailModal({
  studentId,
  initialEditing = false,
  focusSectionField = false,
  lockClassField = false,
  streamOptions = null,
  onClose,
  onChanged,
  onSaved,
  permissions,
}: StudentDetailModalProps) {
  const { t } = useI18n();
  const { viewingTerm, viewingAcademicYear } = useTermContext();
  const { resolvedTheme } = useTheme();
  const isDarkUi = resolvedTheme === "dark" || resolvedTheme === "tinted-dark";

  // Permission helpers — undefined means "all allowed" (admin)
  const canEdit = !permissions || permissions.includes("students_edit");
  const canDelete = !permissions || permissions.includes("students_delete");

  const [row, setRow] = useState<StudentApiRow | null>(null);
  const [editing, setEditing] = useState(initialEditing);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [districtsLoading, setDistrictsLoading] = useState(false);
  const [confirmSaveOpen, setConfirmSaveOpen] = useState(false);
  const [statusChangeOpen, setStatusChangeOpen] = useState(false);
  const { statuses: studentStatuses } = useStudentStatuses();
  const [studentStatusId, setStudentStatusId] = useState("");
  const [originalStudentStatusId, setOriginalStudentStatusId] = useState<number | null>(null);

  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [gender, setGender] = useState("");
  const [sectionName, setSectionName] = useState("");
  const [classRoomId, setClassRoomId] = useState("");
  const [nationality, setNationality] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [district, setDistrict] = useState("");
  
  const [emergencyContactName, setEmergencyContactName] = useState("");
  const [emergencyContactPhone, setEmergencyContactPhone] = useState("");
  const [guardianName, setGuardianName] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");

  const [nationalities, setNationalities] = useState<string[]>([]);
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [districts, setDistricts] = useState<string[]>([]);
  const [classrooms, setClassrooms] = useState<ClassRoomOption[]>([]);
  const [allSections, setAllSections] = useState<any[]>([]);

  const sectionSelectRef = useRef<HTMLSelectElement>(null);
  const sectionInputRef = useRef<HTMLInputElement>(null);

  const sortedRooms = useMemo(() => {
    return [...classrooms].sort((a, b) => a.name.localeCompare(b.name));
  }, [classrooms]);

  const resolvedStreamOptions = useMemo(() => {
    if (streamOptions) return streamOptions;
    const cid = Number(classRoomId);
    if (!cid) return null;
    const names = allSections
      .filter((s) => s.classRoomId === cid)
      .map((s) => s.name.trim())
      .filter(Boolean);
    if (names.length === 0) return null;
    return [...new Set(names)].sort();
  }, [classRoomId, allSections, streamOptions]);

  useEffect(() => {
    if (editing && focusSectionField) {
      setTimeout(() => {
        sectionSelectRef.current?.focus();
        sectionInputRef.current?.focus();
      }, 100);
    }
  }, [editing, focusSectionField]);

  useEffect(() => {
    if (studentId) {
      setLoading(true);
      setError(null);
      setEditing(initialEditing);
      void Promise.all([
        fetchStudent(studentId),
        fetchNationalities(),
        fetchCountries(),
        fetchClassrooms(),
        fetchClassSections(),
      ]).then(([s, nats, counts, rooms, secs]) => {
        setRow(s);
        setStudentStatusId(s.studentStatusId != null ? String(s.studentStatusId) : "");
        setOriginalStudentStatusId(s.studentStatusId);
        setFirstName(s.firstName);
        setMiddleName(s.middleName ?? "");
        setLastName(s.lastName);
        setDateOfBirth(s.dateOfBirth ?? "");
        setParentEmail(s.parentEmail ?? "");
        setGender(s.gender ?? "");
        setSectionName(s.sectionName ?? "");
        setClassRoomId(s.classRoomId != null ? String(s.classRoomId) : "");
        setNationality(s.nationality ?? "");
        setCountryCode(s.countryCode ?? "");
        setDistrict(s.district ?? "");
        setEmergencyContactName(s.emergencyContactName ?? "");
        setEmergencyContactPhone(s.emergencyContactPhone ?? "");
        setGuardianName(s.guardianName ?? "");
        setGuardianPhone(s.guardianPhone ?? "");

        setNationalities(nats);
        setCountries(counts);
        setClassrooms(rooms);
        setAllSections(secs);
        setLoading(false);
      }).catch(e => {
        setError(e instanceof Error ? e.message : "Failed to load student");
        setLoading(false);
      });
    }
  }, [studentId, initialEditing]);

  useEffect(() => {
    if (countryCode) {
      setDistrictsLoading(true);
      void fetchDistricts(countryCode).then(list => {
        setDistricts(list);
        setDistrictsLoading(false);
      }).catch(() => {
        setDistricts([]);
        setDistrictsLoading(false);
      });
    } else {
      setDistricts([]);
    }
  }, [countryCode]);

  useEffect(() => {
    setEditing(initialEditing);
  }, [initialEditing]);


  const fieldClass = `w-full rounded-xl border px-4 py-2.5 text-sm transition-all focus:ring-2 focus:ring-teal-500/20 outline-none ${
    isDarkUi 
      ? "bg-slate-800/50 border-slate-700 text-slate-200 placeholder-slate-500 focus:border-teal-500" 
      : "bg-slate-50 border-slate-200 text-[#0c2340] placeholder-slate-400 focus:border-teal-600"
  }`;

  if (studentId == null) return null;

  const resetUiSession = () => {
    setEditing(false);
    setSaving(false);
    setError(null);
    setDistrictsLoading(false);
  };

  const handleClosePanel = () => {
    resetUiSession();
    onClose();
  };

  const reload = async () => {
    const s = await fetchStudent(studentId);
    setRow(s);
    setFirstName(s.firstName);
    setMiddleName(s.middleName ?? "");
    setLastName(s.lastName);
    setDateOfBirth(s.dateOfBirth ?? "");
    setParentEmail(s.parentEmail ?? "");
    setGender(s.gender ?? "");
    setSectionName(s.sectionName ?? "");
    setClassRoomId(s.classRoomId != null ? String(s.classRoomId) : "");
    setNationality(s.nationality ?? "");
    setCountryCode(s.countryCode ?? "");
    setDistrict(s.district ?? "");
    setEmergencyContactName(s.emergencyContactName ?? "");
    setEmergencyContactPhone(s.emergencyContactPhone ?? "");
    setGuardianName(s.guardianName ?? "");
    setGuardianPhone(s.guardianPhone ?? "");
    setStudentStatusId(s.studentStatusId != null ? String(s.studentStatusId) : "");
    setOriginalStudentStatusId(s.studentStatusId);
    await onChanged();
    return s;
  };

  const selectedStatus = useMemo(
    () => studentStatuses.find((s) => String(s.id) === studentStatusId),
    [studentStatuses, studentStatusId],
  );

  const statusChanged = useMemo(() => {
    const next =
      studentStatusId.trim() === "" ? null : Number.parseInt(studentStatusId, 10);
    if (next != null && !Number.isFinite(next)) return false;
    return next !== originalStudentStatusId;
  }, [studentStatusId, originalStudentStatusId]);

  const termLabel = `${viewingTerm} (${viewingAcademicYear})`;

  function requestSave() {
    setError(null);
    if (studentStatuses.length > 0 && !studentStatusId.trim()) {
      setError(t("students.modal.statusRequired"));
      return;
    }
    if (statusChanged) {
      setConfirmSaveOpen(false);
      setStatusChangeOpen(true);
      return;
    }
    setStatusChangeOpen(false);
    setConfirmSaveOpen(true);
  }

  const handleSave = async (statusFeeRecalcScope?: StatusFeeRecalcScope) => {
    if (studentId == null) return;
    setSaving(true);
    setError(null);
    try {
      const cr =
        classRoomId.trim() === "" ? null : Number.parseInt(classRoomId, 10);
      const cc = countryCode.trim();
      const dist = district.trim();
      const statusIdParsed =
        studentStatusId.trim() === "" ? null : Number.parseInt(studentStatusId, 10);
      if (studentStatuses.length > 0) {
        if (statusIdParsed == null || !Number.isFinite(statusIdParsed) || statusIdParsed < 1) {
          setError(t("students.modal.statusRequired"));
          setSaving(false);
          return;
        }
      }
      await updateStudent(studentId, {
        firstName: firstName.trim(),
        middleName: middleName.trim() || null,
        lastName: lastName.trim(),
        dateOfBirth: dateOfBirth.trim() || null,
        parentEmail: parentEmail.trim() || null,
        gender: gender.trim() || null,
        sectionName: sectionName.trim() || null,
        classRoomId:
          cr != null && Number.isFinite(cr) && cr > 0 ? cr : null,
        nationality: nationality.trim() || null,
        countryCode: cc || null,
        district: dist || null,
        emergencyContactName: emergencyContactName.trim() || null,
        emergencyContactPhone: emergencyContactPhone.trim() || null,
        guardianName: guardianName.trim() || null,
        guardianPhone: guardianPhone.trim() || null,
        ...(statusIdParsed != null && Number.isFinite(statusIdParsed)
          ? { studentStatusId: statusIdParsed }
          : {}),
        ...(statusChanged
          ? { statusFeeRecalcScope: statusFeeRecalcScope ?? "current_term" }
          : {}),
      });
      const saved = await reload();
      setEditing(false);
      setConfirmSaveOpen(false);
      setStatusChangeOpen(false);
      setOriginalStudentStatusId(saved.studentStatusId);
      onSaved?.(saved.fullName);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("students.form.error"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(t("students.modal.deleteConfirm"))) return;
    try {
      await deleteStudent(studentId);
      await onChanged();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("students.modal.deleteFailed"));
    }
  };

  const handlePhoto = async (file: File | null) => {
    if (!file) return;
    setError(null);
    try {
      await uploadStudentPhoto(studentId, file);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("students.photo.uploadError"));
    }
  };

  const fromStatusRow = studentStatuses.find((s) => s.id === originalStudentStatusId);

  return (
    <>
      <StudentStatusChangeDialog
        open={statusChangeOpen}
        fromLabel={
          fromStatusRow
            ? statusLabelFromRow(fromStatusRow)
            : row?.studentStatusName
              ? `${row.studentStatusName} (${row.studentStatusCode ?? ""})`
              : t("students.modal.statusNotSet")
        }
        toLabel={statusLabelFromRow(selectedStatus, Number(studentStatusId) || null)}
        termLabel={termLabel}
        busy={saving}
        onCancel={() => setStatusChangeOpen(false)}
        onConfirm={(scope) => void handleSave(scope)}
      />

      {confirmSaveOpen ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
           <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setConfirmSaveOpen(false)} />
           <div className={`relative w-full max-w-sm rounded-[2rem] p-8 shadow-2xl border animate-in zoom-in-95 duration-300 ${isDarkUi ? "bg-slate-900 border-slate-700" : "bg-white border-slate-100"}`}>
              <div className="flex flex-col items-center text-center">
                 <div className="h-16 w-16 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center text-3xl mb-4">🛡️</div>
                 <h3 className={`text-lg font-black mb-2 ${isDarkUi ? "text-white" : "text-[#0c2340]"}`}>Confirm Changes</h3>
                 <p className="text-sm font-medium text-slate-500 leading-relaxed mb-8">Are you sure you want to update this student's information?</p>
                 <div className="flex w-full gap-3">
                   <button 
                    onClick={() => setConfirmSaveOpen(false)}
                    className={`flex-1 py-3 rounded-xl font-bold transition-all ${isDarkUi ? "bg-slate-800 text-slate-300 hover:bg-slate-700" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                   >
                     Go Back
                   </button>
                   <button 
                    disabled={saving}
                    onClick={() => void handleSave()}
                    className="flex-1 py-3 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 text-white font-bold shadow-lg shadow-teal-600/20 transition-all hover:brightness-105 disabled:opacity-50"
                   >
                     {saving ? "Saving..." : "Confirm"}
                   </button>
                 </div>
              </div>
           </div>
        </div>
      ) : null}

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
        <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-300" onClick={onClose} />
        <div className={`relative w-full max-w-2xl max-h-[90vh] overflow-hidden animate-in zoom-in-95 fade-in duration-300 rounded-[2.5rem] shadow-2xl flex flex-col ${
          isDarkUi ? "bg-slate-900 border border-slate-700 text-slate-200" : "bg-white text-[#0c2340]"
        }`}>
          {/* Header */}
          <div className={`flex items-center justify-between px-8 py-6 border-b shrink-0 ${isDarkUi ? "border-slate-800 bg-slate-900/50" : "border-slate-100 bg-slate-50/50"}`}>
            <div>
              <h2 className="text-lg font-black tracking-tight">{editing ? t("students.modal.editTitle") : t("students.modal.viewTitle")}</h2>
              <p className={`text-[10px] font-black uppercase tracking-widest ${isDarkUi ? "text-slate-500" : "text-slate-400"}`}>
                Student Management Profile
              </p>
            </div>
            <button onClick={handleClosePanel} className={`rounded-full p-2 transition-colors ${isDarkUi ? "hover:bg-slate-800 text-slate-500" : "hover:bg-slate-100 text-slate-400"}`}>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
            {error && (
              <div className="mb-6 rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4 flex items-center gap-3">
                 <span className="text-rose-500 text-xl">⚠️</span>
                 <p className="text-xs font-bold text-rose-500">{error}</p>
              </div>
            )}

            {row && !loading ? (
              <>
                {/* Profile Header Card */}
                <div className={`mb-8 flex items-center gap-6 p-6 rounded-[2rem] border ${isDarkUi ? "bg-slate-800/40 border-slate-700" : "bg-slate-50 border-slate-100"}`}>
                   <div className="relative group">
                     <div className="h-24 w-24 shrink-0 overflow-hidden rounded-[1.5rem] shadow-xl ring-4 ring-white/10">
                        <AuthenticatedStudentPhoto
                          studentId={row.id}
                          hasPhoto={row.hasPassportPhoto}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                     </div>
                     {canEdit && (
                     <label className="absolute -bottom-2 -right-2 h-8 w-8 bg-teal-600 rounded-xl flex items-center justify-center text-white cursor-pointer shadow-lg hover:scale-110 transition-transform">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <input type="file" className="hidden" accept="image/*" onChange={(e) => void handlePhoto(e.target.files?.[0] ?? null)} />
                     </label>
                     )}
                   </div>
                   <div className="flex-1 min-w-0">
                      <span className={`inline-block px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest mb-2 ${isDarkUi ? "bg-slate-900 text-teal-400" : "bg-teal-100 text-teal-700"}`}>
                        #{row.admissionNumber}
                      </span>
                      <h3 className="text-2xl font-black truncate leading-tight">{row.fullName}</h3>
                      <p className={`text-xs font-bold ${isDarkUi ? "text-slate-500" : "text-slate-400"}`}>
                        {row.className || "Unassigned"} · {row.sectionName || "No Stream"}
                      </p>
                   </div>
                </div>

                {!editing ? (
                  <div className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
                    <DetailRow label={t("students.col.nationality")} value={row.nationality} isDarkUi={isDarkUi} />
                    <DetailRow label={t("students.col.country")} value={row.countryName || row.countryCode} isDarkUi={isDarkUi} />
                    <DetailRow label={t("students.col.district")} value={row.district} isDarkUi={isDarkUi} />
                    <DetailRow
                      label={t("students.modal.studentStatus")}
                      value={
                        row.studentStatusCode || row.studentStatusName ? (
                          <StudentStatusBadge
                            code={row.studentStatusCode}
                            name={row.studentStatusName}
                            colorHex={
                              studentStatuses.find((s) => s.id === row.studentStatusId)?.colorHex
                            }
                          />
                        ) : (
                          t("students.modal.statusNotSet")
                        )
                      }
                      isDarkUi={isDarkUi}
                    />
                    <DetailRow label={t("students.col.registrationType")} value={row.registrationType === "continuing" ? "Continuing" : "First Registration"} isDarkUi={isDarkUi} />
                    <DetailRow label={t("learner.gender")} value={row.gender} isDarkUi={isDarkUi} />
                    <DetailRow label={t("students.col.dob")} value={row.dateOfBirthFormatted} isDarkUi={isDarkUi} />
                    <DetailRow label={t("students.col.parentEmail")} value={row.parentEmail} isDarkUi={isDarkUi} />
                    <DetailRow label="Guardian" value={row.guardianName} isDarkUi={isDarkUi} />
                    <DetailRow label="Guardian Phone" value={row.guardianPhone} isDarkUi={isDarkUi} />
                    <DetailRow label="Emergency Contact" value={row.emergencyContactName} isDarkUi={isDarkUi} />
                    <DetailRow label="Emergency Phone" value={row.emergencyContactPhone} isDarkUi={isDarkUi} />
                    <DetailRow label="Religion" value={row.religion} isDarkUi={isDarkUi} />
                  </div>
                ) : (
                  <div className="grid gap-6 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className={`text-[10px] font-black uppercase tracking-widest ${isDarkUi ? "text-slate-500" : "text-slate-400"}`}>{t("students.form.firstName")} *</label>
                      <input className={fieldClass} value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <label className={`text-[10px] font-black uppercase tracking-widest ${isDarkUi ? "text-slate-500" : "text-slate-400"}`}>{t("students.form.lastName")} *</label>
                      <input className={fieldClass} value={lastName} onChange={(e) => setLastName(e.target.value)} />
                    </div>
                    {studentStatuses.length > 0 ? (
                      <div className="space-y-1.5 sm:col-span-2">
                        <label
                          className={`text-[10px] font-black uppercase tracking-widest ${isDarkUi ? "text-slate-500" : "text-slate-400"}`}
                        >
                          {t("students.modal.studentStatus")} *
                        </label>
                        <select
                          className={fieldClass}
                          value={studentStatusId}
                          onChange={(e) => setStudentStatusId(e.target.value)}
                        >
                          <option value="">{t("students.modal.selectStatus")}</option>
                          {studentStatuses.map((s) => (
                            <option key={s.id} value={String(s.id)}>
                              {s.code} — {s.name}
                            </option>
                          ))}
                        </select>
                        {statusChanged ? (
                          <div className="mt-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
                            {t("students.modal.statusChangeHint")}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                    <div className="space-y-1.5">
                      <label className={`text-[10px] font-black uppercase tracking-widest ${isDarkUi ? "text-slate-500" : "text-slate-400"}`}>{t("students.form.gender")}</label>
                      <select className={fieldClass} value={gender} onChange={(e) => setGender(e.target.value)}>
                        <option value="">Select Gender</option>
                        <option value="Female">Female</option>
                        <option value="Male">Male</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className={`text-[10px] font-black uppercase tracking-widest ${isDarkUi ? "text-slate-500" : "text-slate-400"}`}>{t("students.form.dob")}</label>
                      <input type="date" className={fieldClass} value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <label className={`text-[10px] font-black uppercase tracking-widest ${isDarkUi ? "text-slate-500" : "text-slate-400"}`}>{t("students.form.classroom")}</label>
                      <select
                        className={fieldClass}
                        value={classRoomId}
                        onChange={(e) => setClassRoomId(e.target.value)}
                        disabled={lockClassField}
                      >
                        <option value="">Unassigned</option>
                        {sortedRooms.map((r) => <option key={r.id} value={String(r.id)}>{r.name} ({r.academicYear})</option>)}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className={`text-[10px] font-black uppercase tracking-widest ${isDarkUi ? "text-slate-500" : "text-slate-400"}`}>{t("students.form.section")}</label>
                      {resolvedStreamOptions ? (
                        <select ref={sectionSelectRef} className={fieldClass} value={sectionName} onChange={(e) => setSectionName(e.target.value)}>
                          <option value="">Pick Stream</option>
                          {resolvedStreamOptions.map((name) => <option key={name} value={name}>{name}</option>)}
                        </select>
                      ) : (
                        <input ref={sectionInputRef} className={fieldClass} value={sectionName} onChange={(e) => setSectionName(e.target.value)} />
                      )}
                    </div>
                     <div className="space-y-1.5">
                      <label className={`text-[10px] font-black uppercase tracking-widest ${isDarkUi ? "text-slate-500" : "text-slate-400"}`}>Nationality</label>
                      <select className={fieldClass} value={nationality} onChange={(e) => setNationality(e.target.value)}>
                        <option value="">Unset</option>
                        {nationalities.map((n) => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </div>
                     <div className="space-y-1.5">
                      <label className={`text-[10px] font-black uppercase tracking-widest ${isDarkUi ? "text-slate-500" : "text-slate-400"}`}>Parent Email</label>
                      <input type="email" className={fieldClass} value={parentEmail} onChange={(e) => setParentEmail(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <label className={`text-[10px] font-black uppercase tracking-widest ${isDarkUi ? "text-slate-500" : "text-slate-400"}`}>Country</label>
                      <select className={fieldClass} value={countryCode} onChange={(e) => setCountryCode(e.target.value)}>
                        <option value="">Select Country</option>
                        {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className={`text-[10px] font-black uppercase tracking-widest ${isDarkUi ? "text-slate-500" : "text-slate-400"}`}>District</label>
                      <select className={fieldClass} value={district} onChange={(e) => setDistrict(e.target.value)} disabled={districtsLoading}>
                        <option value="">{districtsLoading ? "Loading..." : "Select District"}</option>
                        {districts.map((d) => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className={`text-[10px] font-black uppercase tracking-widest ${isDarkUi ? "text-slate-500" : "text-slate-400"}`}>Guardian Name</label>
                      <input className={fieldClass} value={guardianName} onChange={(e) => setGuardianName(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <label className={`text-[10px] font-black uppercase tracking-widest ${isDarkUi ? "text-slate-500" : "text-slate-400"}`}>Guardian Phone</label>
                      <input className={fieldClass} value={guardianPhone} onChange={(e) => setGuardianPhone(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <label className={`text-[10px] font-black uppercase tracking-widest ${isDarkUi ? "text-slate-500" : "text-slate-400"}`}>Emergency Contact</label>
                      <input className={fieldClass} value={emergencyContactName} onChange={(e) => setEmergencyContactName(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <label className={`text-[10px] font-black uppercase tracking-widest ${isDarkUi ? "text-slate-500" : "text-slate-400"}`}>Emergency Phone</label>
                      <input className={fieldClass} value={emergencyContactPhone} onChange={(e) => setEmergencyContactPhone(e.target.value)} />
                    </div>
                  </div>
                )}
              </>
            ) : (
               <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mb-4" />
                  <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Loading Records...</p>
               </div>
            )}
          </div>

          {/* Footer */}
          <div className={`px-8 py-6 border-t shrink-0 flex items-center gap-4 ${isDarkUi ? "border-slate-800 bg-slate-900/50" : "border-slate-100 bg-slate-50/50"}`}>
             {!editing ? (
               <>
                 {canEdit && (
                 <button
                    onClick={() => setEditing(true)}
                    className="flex-1 rounded-2xl bg-gradient-to-r from-teal-600 to-emerald-600 py-3 text-sm font-black text-white shadow-lg shadow-teal-600/20 transition-all hover:-translate-y-1"
                  >
                    Edit Profile
                  </button>
                 )}
                 {canDelete && (
                  <button
                    onClick={() => void handleDelete()}
                    className={`px-6 py-3 rounded-2xl font-black text-sm transition-all hover:bg-rose-500/10 ${isDarkUi ? "text-rose-500" : "text-rose-600"}`}
                  >
                    Delete
                  </button>
                 )}
               </>
             ) : (
               <>
                  <button
                    type="button"
                    onClick={() => {
                       setEditing(false);
                       setConfirmSaveOpen(false);
                       setStatusChangeOpen(false);
                       if (row) void reload();
                    }}
                    className={`flex-1 py-3 rounded-2xl font-black text-sm transition-all ${isDarkUi ? "bg-slate-800 text-slate-300 hover:bg-slate-700" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={requestSave}
                    className="flex-[2] py-3 rounded-2xl bg-gradient-to-r from-[#0c2340] to-[#1a3a5c] text-white font-black text-sm shadow-xl shadow-[#0c2340]/20 transition-all hover:-translate-y-1"
                  >
                    {saving ? "Saving Changes..." : "Save Changes"}
                  </button>
               </>
             )}
          </div>
        </div>
      </div>
    </>
  );
}

function DetailRow({
  label,
  value,
  isDarkUi,
}: {
  label: string;
  value: ReactNode;
  isDarkUi: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-4 py-3 border-b border-dashed ${isDarkUi ? "border-slate-800" : "border-slate-100"}`}
    >
      <span
        className={`shrink-0 text-[10px] font-black uppercase tracking-widest ${isDarkUi ? "text-slate-500" : "text-slate-400"}`}
      >
        {label}
      </span>
      <span className={`text-right text-sm font-bold ${isDarkUi ? "text-slate-200" : "text-[#0c2340]"}`}>
        {value == null || value === "" ? "—" : value}
      </span>
    </div>
  );
}

