import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  createStaffMember,
  deleteStaffMember,
  fetchClassrooms,
  fetchStaffMembers,
  updateStaffMember,
  type ClassRoomOption,
  type StaffMemberApiRow,
} from "../../api/students";

export type StaffNavSection = "teaching" | "nonTeaching";
export type TeachingSection = "all" | "kindergarten" | "lower_primary" | "upper_primary";
export type NonTeachingCategory =
  | "all"
  | "administration"
  | "finance"
  | "library"
  | "health"
  | "operations";

type Teacher = {
  id: number;
  name: string;
  section: Exclude<TeachingSection, "all">;
  subjects: string;
};

type TeachingStaffRecord = Teacher & {
  phone?: string;
  email?: string;
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
};

type NonTeachingStaffRecord = {
  id: number;
  name: string;
  role: string;
  category: Exclude<NonTeachingCategory, "all">;
  email?: string;
  phone?: string;
  address?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  nationalIdNumber?: string;
  nationalIdPhotoUrl?: string;
  nationalIdPhotoName?: string;
};

const teachingSectionLabels: Record<TeachingSection, string> = {
  all: "All Teaching Staff",
  kindergarten: "Kindergarten Teachers",
  lower_primary: "Lower Primary Teachers",
  upper_primary: "Upper Primary Teachers",
};

const nonTeachingCategoryLabels: Record<NonTeachingCategory, string> = {
  all: "All Non-Teaching Staff",
  administration: "Administration Staff",
  finance: "Finance Staff",
  library: "Library Staff",
  health: "Health Staff",
  operations: "Operations Staff",
};

function asTeachingSection(raw?: string | null): Exclude<TeachingSection, "all"> {
  if (raw === "kindergarten" || raw === "lower_primary" || raw === "upper_primary") {
    return raw;
  }
  return "kindergarten";
}

function asNonTeachingCategory(raw?: string | null): Exclude<NonTeachingCategory, "all"> {
  if (
    raw === "administration" ||
    raw === "finance" ||
    raw === "library" ||
    raw === "health" ||
    raw === "operations"
  ) {
    return raw;
  }
  return "administration";
}

function mapTeachingStaff(row: StaffMemberApiRow): TeachingStaffRecord {
  return {
    id: row.id,
    name: row.displayName,
    section: asTeachingSection(row.teachingSection),
    subjects: row.staffRole,
    phone: row.phone ?? undefined,
    email: row.email ?? undefined,
    address: row.address ?? undefined,
    gender: row.gender ?? undefined,
    dateOfBirth: row.dateOfBirth ?? undefined,
    nationality: row.nationality ?? undefined,
    maritalStatus: row.maritalStatus ?? undefined,
    nationalId: row.nationalId ?? undefined,
    qualification: row.qualification ?? undefined,
    languages: row.languages ?? undefined,
    dateOfJoining: row.dateOfJoining ?? undefined,
    experience: row.experience ?? undefined,
    emergencyContactName: row.emergencyContactName ?? undefined,
    emergencyContactPhone: row.emergencyContactPhone ?? undefined,
    refereeName: row.refereeName ?? undefined,
    refereeContact: row.refereeContact ?? undefined,
    staffPhotoUrl: row.staffPhotoUrl ?? undefined,
    staffPhotoName: row.staffPhotoName ?? undefined,
    assignedClass: row.assignedClass ?? undefined,
  };
}

function mapNonTeachingStaff(row: StaffMemberApiRow): NonTeachingStaffRecord {
  return {
    id: row.id,
    name: row.displayName,
    role: row.staffRole,
    category: asNonTeachingCategory(row.staffCategory),
    email: row.email ?? undefined,
    phone: row.phone ?? undefined,
    address: row.address ?? undefined,
    emergencyContactName: row.emergencyContactName ?? undefined,
    emergencyContactPhone: row.emergencyContactPhone ?? undefined,
    nationalIdNumber: row.nationalId ?? undefined,
    nationalIdPhotoUrl: row.nationalIdPhotoUrl ?? undefined,
    nationalIdPhotoName: row.nationalIdPhotoName ?? undefined,
  };
}

function categoryNameForAssignedClass(
  assignedClass: string | undefined,
  classOptions: Array<{ id: number; name: string; academicYear?: string | null; categoryName?: string | null }>,
): string | undefined {
  const className = assignedClass?.trim();
  if (!className) return undefined;
  return classOptions.find((row) => row.name.trim() === className)?.categoryName?.trim() || undefined;
}

const inputClassName =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 shadow-sm outline-none transition-all placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 hover:border-slate-300";

function FieldLabel({
  htmlFor,
  required = false,
  children,
}: {
  htmlFor: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
      {children}
      {required ? <span className="text-rose-500"> *</span> : null}
    </label>
  );
}

const staffActionsMenuItemClass =
  "flex w-full items-center px-3 py-2 text-left text-xs font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-indigo-600";

function StaffTableRowActionsMenu({
  rowKey,
  openMenuKey,
  onOpenMenuChange,
  onProfile,
  onEdit,
  onDelete,
}: {
  rowKey: string;
  openMenuKey: string | null;
  onOpenMenuChange: (key: string | null) => void;
  onProfile: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const open = openMenuKey === rowKey;

  useEffect(() => {
    if (!open) return;
    function onDoc(e: PointerEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        onOpenMenuChange(null);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onOpenMenuChange(null);
    }
    document.addEventListener("pointerdown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onOpenMenuChange]);

  return (
    <td className="px-4 py-3">
      <div className="relative flex justify-center" ref={wrapRef}>
        <button
          type="button"
          aria-label="Open row actions"
          aria-expanded={open}
          aria-haspopup="menu"
          onClick={() => onOpenMenuChange(open ? null : rowKey)}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-xl font-bold leading-none text-slate-500 ring-1 ring-slate-200 shadow-sm transition hover:bg-slate-50 hover:text-indigo-600"
          title="View actions for this staff member"
        >
          <span className="block translate-y-px" aria-hidden>
            ⋮
          </span>
        </button>
        {open ? (
          <div
            role="menu"
            className="absolute right-0 top-full z-30 mt-1 min-w-[10rem] rounded-2xl border border-slate-200 bg-white py-1.5 shadow-lg"
          >
            <button
              type="button"
              role="menuitem"
              className={staffActionsMenuItemClass}
              onClick={() => {
                onProfile();
                onOpenMenuChange(null);
              }}
              title="View full staff profile"
            >
              Profile
            </button>
            <button
              type="button"
              role="menuitem"
              className={staffActionsMenuItemClass}
              onClick={() => {
                onEdit();
                onOpenMenuChange(null);
              }}
              title="Edit staff details"
            >
              Edit
            </button>
            <button
              type="button"
              role="menuitem"
              className={`${staffActionsMenuItemClass} text-[#a9332a]`}
              onClick={() => {
                onDelete();
                onOpenMenuChange(null);
              }}
              title="Delete staff record"
            >
              Delete
            </button>
          </div>
        ) : null}
      </div>
    </td>
  );
}

function TeachingStaffForm({
  onCancel,
  onSave,
  classOptions,
  classOptionsLoading,
  initialData,
}: {
  onCancel: () => void;
  onSave: (staff: TeachingStaffRecord) => void;
  classOptions: Array<{ id: number; name: string; academicYear?: string | null }>;
  classOptionsLoading: boolean;
  initialData?: TeachingStaffRecord | null;
}) {
  const [submitted, setSubmitted] = useState(false);
  const [selectedSection, setSelectedSection] =
    useState<Exclude<TeachingSection, "all"> | "">(initialData?.section ?? "");
  const [staffPhotoFile, setStaffPhotoFile] = useState<File | null>(null);

  useEffect(() => {
    setSelectedSection(initialData?.section ?? "");
    setStaffPhotoFile(null);
  }, [initialData]);

  return (
    <section className="flex flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
      <h2 className="text-sm font-bold uppercase tracking-wider text-indigo-900">
        {initialData ? "Edit Teaching Staff Registration" : "Teaching Staff Registration Form"}
      </h2>
      <p className="mt-1 text-xs text-slate-500">
        Fill in all required fields marked with an asterisk (*).
      </p>

      <form
        className="mt-4 space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          const section = form.get("staff-teaching-section") as Exclude<TeachingSection, "all">;
          const assignedClass = (form.get("staff-assigned-class") as string) ?? "";
          const fullName = ((form.get("staff-full-name") as string) ?? "").trim();
          const role = ((form.get("staff-role") as string) ?? "").trim();
          const staffPhotoUrl = staffPhotoFile ? URL.createObjectURL(staffPhotoFile) : undefined;
          onSave({
            id: initialData?.id ?? Math.floor(Math.random() * 900000 + 100000),
            name: fullName,
            section,
            assignedClass,
            subjects: role || "General Teacher",
            phone: ((form.get("staff-phone") as string) ?? "").trim(),
            email: ((form.get("staff-email") as string) ?? "").trim(),
            address: ((form.get("staff-address") as string) ?? "").trim(),
            gender: ((form.get("staff-gender") as string) ?? "").trim(),
            dateOfBirth: ((form.get("staff-dob") as string) ?? "").trim(),
            nationality: ((form.get("staff-nationality") as string) ?? "").trim(),
            maritalStatus: ((form.get("staff-marital-status") as string) ?? "").trim(),
            nationalId: ((form.get("staff-nin") as string) ?? "").trim(),
            qualification: ((form.get("staff-qualification") as string) ?? "").trim(),
            languages: ((form.get("staff-languages") as string) ?? "").trim(),
            dateOfJoining: ((form.get("staff-joining-date") as string) ?? "").trim(),
            experience: ((form.get("staff-experience") as string) ?? "").trim(),
            emergencyContactName: ((form.get("staff-emergency-name") as string) ?? "").trim(),
            emergencyContactPhone: ((form.get("staff-emergency-phone") as string) ?? "").trim(),
            refereeName: ((form.get("staff-referee-name") as string) ?? "").trim(),
            refereeContact: ((form.get("staff-referee-contact") as string) ?? "").trim(),
            staffPhotoName: staffPhotoFile?.name ?? initialData?.staffPhotoName,
            staffPhotoUrl: staffPhotoUrl ?? initialData?.staffPhotoUrl,
          });
          setSubmitted(true);
          e.currentTarget.reset();
          setSelectedSection(initialData?.section ?? "");
          setStaffPhotoFile(null);
        }}
      >
        <div>
          <h3 className="text-sm font-bold text-indigo-900">1. Personal Identification</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="sm:col-span-2">
              <FieldLabel htmlFor="staff-full-name" required>Full Name (As per ID)</FieldLabel>
              <input id="staff-full-name" name="staff-full-name" required className={inputClassName} defaultValue={initialData?.name ?? ""} />
            </div>
            <div>
              <FieldLabel htmlFor="staff-gender" required>Gender</FieldLabel>
              <select id="staff-gender" name="staff-gender" required className={inputClassName} defaultValue={initialData?.gender ?? ""}>
                <option value="" disabled>Select</option>
                <option>Female</option>
                <option>Male</option>
                <option>Other</option>
              </select>
            </div>
            <div>
              <FieldLabel htmlFor="staff-dob" required>Date of Birth</FieldLabel>
              <input id="staff-dob" name="staff-dob" type="date" required className={inputClassName} defaultValue={initialData?.dateOfBirth ?? ""} />
            </div>
            <div>
              <FieldLabel htmlFor="staff-nationality" required>Nationality</FieldLabel>
              <select id="staff-nationality" name="staff-nationality" required className={inputClassName} defaultValue={initialData?.nationality ?? ""}>
                <option value="" disabled>Select</option>
                <option>Ugandan</option>
                <option>Kenyan</option>
                <option>Tanzanian</option>
                <option>Other</option>
              </select>
            </div>
            <div>
              <FieldLabel htmlFor="staff-marital-status">Marital Status</FieldLabel>
              <select id="staff-marital-status" name="staff-marital-status" className={inputClassName} defaultValue={initialData?.maritalStatus ?? ""}>
                <option value="" disabled>Select</option>
                <option>Single</option>
                <option>Married</option>
                <option>Divorced</option>
                <option>Widowed</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <FieldLabel htmlFor="staff-nin" required>National ID Number (NIN)</FieldLabel>
              <input id="staff-nin" name="staff-nin" required  placeholder="Optional" className={inputClassName} defaultValue={initialData?.nationalId ?? ""} />
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-bold text-indigo-900">2. Contact Information</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <FieldLabel htmlFor="staff-phone" required>Primary Phone Number</FieldLabel>
              <input id="staff-phone" name="staff-phone" type="tel" minLength={10} maxLength={13} onInput={(e) => { e.currentTarget.value = e.currentTarget.value.replace(/[^\d+]/g, ''); }} required className={inputClassName} defaultValue={initialData?.phone ?? ""} />
            </div>
            <div>
              <FieldLabel htmlFor="staff-email">Email Address</FieldLabel>
              <input id="staff-email" name="staff-email" type="email" placeholder="e.g. example@domain.com" className={inputClassName} defaultValue={initialData?.email ?? ""} />
            </div>
            <div className="sm:col-span-2">
              <FieldLabel htmlFor="staff-photo-upload">Staff Photo</FieldLabel>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors">
                Upload photo
                <input
                  id="staff-photo-upload"
                  name="staff-photo-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => setStaffPhotoFile(e.target.files?.[0] ?? null)}
                />
              </label>
              {staffPhotoFile ? (
                <p className="mt-1 text-xs text-[#636e72]">{staffPhotoFile.name}</p>
              ) : initialData?.staffPhotoName ? (
                <p className="mt-1 text-xs text-[#636e72]">Current: {initialData.staffPhotoName}</p>
              ) : null}
            </div>
            <div className="sm:col-span-2">
              <FieldLabel htmlFor="staff-address" required>Current Physical Address</FieldLabel>
              <input id="staff-address" name="staff-address" required placeholder="Street address, city, district" className={inputClassName} defaultValue={initialData?.address ?? ""} />
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-bold text-indigo-900">3. Professional Background</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <FieldLabel htmlFor="staff-role" required>Role / Applied Position</FieldLabel>
              <input id="staff-role" name="staff-role" required placeholder="e.g. Senior Math Teacher" className={inputClassName} defaultValue={initialData?.subjects ?? ""} />
            </div>
            <div>
              <FieldLabel htmlFor="staff-qualification" required>Highest Qualification</FieldLabel>
              <input id="staff-qualification" name="staff-qualification" required placeholder="e.g. Bachelor&apos;s in Education" className={inputClassName} defaultValue={initialData?.qualification ?? ""} />
            </div>
            <div>
              <FieldLabel htmlFor="staff-languages">Languages Spoken</FieldLabel>
              <input id="staff-languages" name="staff-languages" placeholder="English, Kiswahili..." className={inputClassName} defaultValue={initialData?.languages ?? ""} />
            </div>
            <div>
              <FieldLabel htmlFor="staff-joining-date" required>Date of Joining</FieldLabel>
              <input id="staff-joining-date" name="staff-joining-date" type="date" required className={inputClassName} defaultValue={initialData?.dateOfJoining ?? ""} />
            </div>
            <div className="sm:col-span-2 lg:col-span-2">
              <FieldLabel htmlFor="staff-experience">Previous Work Experience</FieldLabel>
              <textarea
                id="staff-experience"
                name="staff-experience"
                rows={4}
                placeholder="Summarize total years of experience, relevant past employment, and responsibilities."
                className={inputClassName}
                defaultValue={initialData?.experience ?? ""}
              />
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-bold text-indigo-900">4. Assign Class</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <FieldLabel htmlFor="staff-teaching-section" required>Teaching Category</FieldLabel>
              <select
                id="staff-teaching-section"
                name="staff-teaching-section"
                value={selectedSection}
                onChange={(e) =>
                  setSelectedSection(e.target.value as Exclude<TeachingSection, "all"> | "")
                }
                required
                className={inputClassName}
              >
                <option value="" disabled>
                  Select Teaching category
                </option>
                <option value="kindergarten">Kindergarten</option>
                <option value="lower_primary">Lower Primary</option>
                <option value="upper_primary">Upper Primary</option>
              </select>
            </div>
            <div>
              <FieldLabel htmlFor="staff-assigned-class" required>Assigned Class</FieldLabel>
              <select
                id="staff-assigned-class"
                name="staff-assigned-class"
                required
                className={inputClassName}
                defaultValue={initialData?.assignedClass ?? ""}
              >
                <option value="" disabled>Select class</option>
                {classOptionsLoading ? (
                  <option value="" disabled>Loading classes...</option>
                ) : null}
                {classOptions.map((classRow) => (
                  <option key={classRow.id} value={classRow.name}>
                    {classRow.name}
                    {classRow.academicYear ? ` (${classRow.academicYear})` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-bold text-indigo-900">5. Emergency Contact &amp; Reference</h3>
          <div className="mt-3 grid gap-3 rounded-2xl bg-indigo-50/50 border border-indigo-100 p-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <FieldLabel htmlFor="staff-emergency-name" required>Emergency Contact Name</FieldLabel>
              <input id="staff-emergency-name" name="staff-emergency-name" required className={inputClassName} defaultValue={initialData?.emergencyContactName ?? ""} />
            </div>
            <div>
              <FieldLabel htmlFor="staff-emergency-phone" required>Emergency Contact Phone</FieldLabel>
              <input id="staff-emergency-phone" name="staff-emergency-phone" type="tel" minLength={10} maxLength={13} onInput={(e) => { e.currentTarget.value = e.currentTarget.value.replace(/[^\d+]/g, ''); }} required className={inputClassName} defaultValue={initialData?.emergencyContactPhone ?? ""} />
            </div>
            <div>
              <FieldLabel htmlFor="staff-referee-name" required>Professional Referee Name</FieldLabel>
              <input id="staff-referee-name" name="staff-referee-name" required className={inputClassName} defaultValue={initialData?.refereeName ?? ""} />
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <FieldLabel htmlFor="staff-referee-contact" required>Referee Contact Info</FieldLabel>
              <input id="staff-referee-contact" name="staff-referee-contact" required placeholder="Phone or email" className={inputClassName} defaultValue={initialData?.refereeContact ?? ""} />
            </div>
          </div>
        </div>

        {submitted ? (
          <p className="text-sm font-semibold text-emerald-600">
            Form submitted. (Demo mode: no backend save yet.)
          </p>
        ) : null}

        <div className="flex flex-wrap gap-3 pt-4">
          <button
            type="submit"
            className="rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            title="Submit and save staff registration"
          >
            {initialData ? "Save Changes" : "Save Staff"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-slate-200 bg-white px-6 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
            title="Discard changes and cancel"
          >
            Cancel
          </button>
        </div>
      </form>
    </section>
  );
}

function NonTeachingStaffForm({
  onCancel,
  onSave,
  initialData,
}: {
  onCancel: () => void;
  onSave: (staff: NonTeachingStaffRecord) => Promise<void>;
  initialData?: NonTeachingStaffRecord | null;
}) {
  const [saving, setSaving] = useState(false);
  const [nationalIdPhotoFile, setNationalIdPhotoFile] = useState<File | null>(null);

  return (
    <section className="flex flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
      <h2 className="text-sm font-bold uppercase tracking-wider text-indigo-900">
        {initialData ? "Edit Non-Teaching Staff Registration" : "Non-Teaching Staff Registration Form"}
      </h2>
      <p className="mt-1 text-xs text-slate-500">
        Fill in all required fields marked with an asterisk (*).
      </p>
      <form
        className="mt-4 grid gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          const formEl = e.currentTarget;
          const form = new FormData(formEl);
          const payload: NonTeachingStaffRecord = {
            id: initialData?.id ?? 0,
            name: ((form.get("nonstaff-full-name") as string) ?? "").trim(),
            role: ((form.get("nonstaff-role") as string) ?? "").trim(),
            category: (form.get("nonstaff-category") as Exclude<NonTeachingCategory, "all">) ?? "administration",
            email: ((form.get("nonstaff-email") as string) ?? "").trim(),
            phone: ((form.get("nonstaff-phone") as string) ?? "").trim(),
            address: ((form.get("nonstaff-address") as string) ?? "").trim(),
            emergencyContactName: ((form.get("nonstaff-emergency-name") as string) ?? "").trim(),
            emergencyContactPhone: ((form.get("nonstaff-emergency-phone") as string) ?? "").trim(),
            nationalIdNumber: ((form.get("nonstaff-national-id-number") as string) ?? "").trim(),
            nationalIdPhotoName: nationalIdPhotoFile?.name ?? initialData?.nationalIdPhotoName,
            nationalIdPhotoUrl: nationalIdPhotoFile
              ? URL.createObjectURL(nationalIdPhotoFile)
              : initialData?.nationalIdPhotoUrl,
          };
          setSaving(true);
          void (async () => {
            try {
              await onSave(payload);
              setNationalIdPhotoFile(null);
            } catch {
              /* parent sets staffError */
            } finally {
              setSaving(false);
            }
          })();
        }}
      >
        <div>
          <FieldLabel htmlFor="nonstaff-full-name" required>Full Name</FieldLabel>
          <input id="nonstaff-full-name" name="nonstaff-full-name" required className={inputClassName} defaultValue={initialData?.name ?? ""} />
        </div>
        <div>
          <FieldLabel htmlFor="nonstaff-category" required>Category</FieldLabel>
          <select id="nonstaff-category" name="nonstaff-category" required className={inputClassName} defaultValue={initialData?.category ?? ""}>
            <option value="" disabled>Select category</option>
            <option value="administration">Administration</option>
            <option value="finance">Finance</option>
            <option value="library">Library</option>
            <option value="health">Health</option>
            <option value="operations">Operations</option>
          </select>
        </div>
        <div>
          <FieldLabel htmlFor="nonstaff-role" required>Role</FieldLabel>
          <input id="nonstaff-role" name="nonstaff-role" required className={inputClassName} defaultValue={initialData?.role ?? ""} />
        </div>
        <div>
          <FieldLabel htmlFor="nonstaff-email">Email Address</FieldLabel>
          <input id="nonstaff-email" name="nonstaff-email" type="email" className={inputClassName} defaultValue={initialData?.email ?? ""} />
        </div>
        <div>
          <FieldLabel htmlFor="nonstaff-phone" required>Primary Phone Number</FieldLabel>
          <input id="nonstaff-phone" name="nonstaff-phone" type="tel" minLength={10} maxLength={13} onInput={(e) => { e.currentTarget.value = e.currentTarget.value.replace(/[^\d+]/g, ''); }} required className={inputClassName} defaultValue={initialData?.phone ?? ""} />
        </div>
        <div className="sm:col-span-2">
          <FieldLabel htmlFor="nonstaff-address" required>Current Physical Address</FieldLabel>
          <input id="nonstaff-address" name="nonstaff-address" required className={inputClassName} defaultValue={initialData?.address ?? ""} />
        </div>
        <div>
          <FieldLabel htmlFor="nonstaff-emergency-name" required>Emergency Contact Name</FieldLabel>
          <input id="nonstaff-emergency-name" name="nonstaff-emergency-name" required className={inputClassName} defaultValue={initialData?.emergencyContactName ?? ""} />
        </div>
        <div>
          <FieldLabel htmlFor="nonstaff-emergency-phone" required>Emergency Contact Phone</FieldLabel>
          <input id="nonstaff-emergency-phone" name="nonstaff-emergency-phone" type="tel" minLength={10} maxLength={13} onInput={(e) => { e.currentTarget.value = e.currentTarget.value.replace(/[^\d+]/g, ''); }} required className={inputClassName} defaultValue={initialData?.emergencyContactPhone ?? ""} />
        </div>
        <div>
          <FieldLabel htmlFor="nonstaff-national-id-number" required>National ID Number</FieldLabel>
          <input id="nonstaff-national-id-number" name="nonstaff-national-id-number" required className={inputClassName} defaultValue={initialData?.nationalIdNumber ?? ""} />
        </div>
        <div>
          <FieldLabel htmlFor="nonstaff-national-id-photo" required>National ID Photo</FieldLabel>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors">
            Upload NID photo
            <input
              id="nonstaff-national-id-photo"
              name="nonstaff-national-id-photo"
              type="file"
              accept="image/*"
              required={!initialData?.nationalIdPhotoName}
              className="hidden"
              onChange={(e) => setNationalIdPhotoFile(e.target.files?.[0] ?? null)}
            />
          </label>
          {nationalIdPhotoFile ? (
            <p className="mt-1 text-xs text-slate-500">{nationalIdPhotoFile.name}</p>
          ) : initialData?.nationalIdPhotoName ? (
            <p className="mt-1 text-xs text-slate-500">Current: {initialData.nationalIdPhotoName}</p>
          ) : null}
        </div>
        <div className="sm:col-span-2 flex flex-wrap gap-3 pt-4">
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-60"
            title="Submit and save non-teaching staff registration"
          >
            {saving ? "Saving…" : initialData ? "Save Changes" : "Save Non Staff"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="rounded-xl border border-slate-200 bg-white px-6 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
            title="Discard changes and cancel"
          >
            Cancel
          </button>
        </div>
      </form>
    </section>
  );
}

export function StaffSectionPage({
  section,
  teachingSection,
  nonTeachingCategory,
  onChangeTeachingSection,
  onChangeNonTeachingCategory,
}: {
  section: StaffNavSection;
  teachingSection: TeachingSection;
  nonTeachingCategory: NonTeachingCategory;
  onChangeTeachingSection: (value: TeachingSection) => void;
  onChangeNonTeachingCategory: (value: NonTeachingCategory) => void;
}) {
  const [showTeachingForm, setShowTeachingForm] = useState(false);
  const [showNonTeachingForm, setShowNonTeachingForm] = useState(false);
  const [teachingStaff, setTeachingStaff] = useState<TeachingStaffRecord[]>([]);
  const [nonTeachingStaff, setNonTeachingStaff] = useState<NonTeachingStaffRecord[]>([]);
  const [selectedTeachingProfile, setSelectedTeachingProfile] =
    useState<TeachingStaffRecord | null>(null);
  const [selectedNonTeachingProfile, setSelectedNonTeachingProfile] =
    useState<NonTeachingStaffRecord | null>(null);
  const [editingTeachingStaff, setEditingTeachingStaff] = useState<TeachingStaffRecord | null>(null);
  const [editingNonTeachingStaff, setEditingNonTeachingStaff] = useState<NonTeachingStaffRecord | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{
    kind: "teaching" | "nonTeaching";
    item: TeachingStaffRecord | NonTeachingStaffRecord;
  } | null>(null);
  const [staffRowActionsMenuKey, setStaffRowActionsMenuKey] = useState<string | null>(null);
  const [classRooms, setClassRooms] = useState<ClassRoomOption[]>([]);
  const [classRoomsLoading, setClassRoomsLoading] = useState(false);
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffError, setStaffError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setClassRoomsLoading(true);
    void fetchClassrooms()
      .then((rows) => {
        if (cancelled) return;
        setClassRooms(rows);
      })
      .catch(() => {
        if (!cancelled) setClassRooms([]);
      })
      .finally(() => {
        if (!cancelled) setClassRoomsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const classOptions = useMemo(
    () =>
      classRooms
        .filter((row) => row.isActive !== false)
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" })),
    [classRooms],
  );

  useEffect(() => {
    let cancelled = false;
    setStaffLoading(true);
    setStaffError(null);
    void fetchStaffMembers()
      .then((rows) => {
        if (cancelled) return;
        setTeachingStaff(rows.filter((x) => x.staffType === "teaching").map(mapTeachingStaff));
        setNonTeachingStaff(
          rows.filter((x) => x.staffType === "non_teaching").map(mapNonTeachingStaff),
        );
      })
      .catch((e) => {
        if (!cancelled) {
          setStaffError(e instanceof Error ? e.message : "Failed to load staff");
          setTeachingStaff([]);
          setNonTeachingStaff([]);
        }
      })
      .finally(() => {
        if (!cancelled) setStaffLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const heading =
    section === "teaching"
      ? teachingSectionLabels[teachingSection]
      : nonTeachingCategoryLabels[nonTeachingCategory];

  const intro =
    section === "teaching"
      ? "Browse teachers by section and assign them to classes as saved by admin."
      : "School support teams and administrative staff.";

  const filteredTeachers = useMemo(() => {
    if (teachingSection === "all") return teachingStaff;
    return teachingStaff.filter((teacher) => teacher.section === teachingSection);
  }, [teachingSection, teachingStaff]);
  const filteredNonTeaching = useMemo(() => {
    if (nonTeachingCategory === "all") return nonTeachingStaff;
    return nonTeachingStaff.filter((member) => member.category === nonTeachingCategory);
  }, [nonTeachingCategory, nonTeachingStaff]);

  async function createTeachingStaff(staff: TeachingStaffRecord) {
    setStaffError(null);
    const derivedStaffCategory = categoryNameForAssignedClass(staff.assignedClass, classOptions);
    const created = await createStaffMember({
      staffType: "teaching",
      displayName: staff.name,
      email: staff.email,
      staffRole: staff.subjects,
      phone: staff.phone,
      address: staff.address,
      gender: staff.gender,
      dateOfBirth: staff.dateOfBirth,
      nationality: staff.nationality,
      maritalStatus: staff.maritalStatus,
      nationalId: staff.nationalId,
      qualification: staff.qualification,
      languages: staff.languages,
      dateOfJoining: staff.dateOfJoining,
      experience: staff.experience,
      emergencyContactName: staff.emergencyContactName,
      emergencyContactPhone: staff.emergencyContactPhone,
      refereeName: staff.refereeName,
      refereeContact: staff.refereeContact,
      staffPhotoName: staff.staffPhotoName,
      assignedClass: staff.assignedClass,
      teachingSection: staff.section,
      staffCategory: derivedStaffCategory,
    });
    const next = mapTeachingStaff(created);
    setTeachingStaff((prev) => [next, ...prev]);
    setSelectedTeachingProfile(next);
    setShowTeachingForm(false);
  }

  async function createNonTeachingStaff(staff: NonTeachingStaffRecord) {
    setStaffError(null);
    const created = await createStaffMember({
      staffType: "non_teaching",
      displayName: staff.name,
      email: staff.email,
      staffRole: staff.role,
      phone: staff.phone,
      address: staff.address,
      emergencyContactName: staff.emergencyContactName,
      emergencyContactPhone: staff.emergencyContactPhone,
      nationalId: staff.nationalIdNumber,
      staffCategory: staff.category,
      nationalIdPhotoName: staff.nationalIdPhotoName,
    });
    const next = mapNonTeachingStaff(created);
    setNonTeachingStaff((prev) => [next, ...prev]);
    setSelectedNonTeachingProfile(null);
    setShowNonTeachingForm(false);
  }

  async function updateTeachingStaff(staff: TeachingStaffRecord) {
    setStaffError(null);
    const derivedStaffCategory = categoryNameForAssignedClass(staff.assignedClass, classOptions);
    const updated = await updateStaffMember(staff.id, {
      displayName: staff.name,
      email: staff.email,
      staffRole: staff.subjects,
      phone: staff.phone,
      address: staff.address,
      gender: staff.gender,
      dateOfBirth: staff.dateOfBirth,
      nationality: staff.nationality,
      maritalStatus: staff.maritalStatus,
      nationalId: staff.nationalId,
      qualification: staff.qualification,
      languages: staff.languages,
      dateOfJoining: staff.dateOfJoining,
      experience: staff.experience,
      emergencyContactName: staff.emergencyContactName,
      emergencyContactPhone: staff.emergencyContactPhone,
      refereeName: staff.refereeName,
      refereeContact: staff.refereeContact,
      staffPhotoName: staff.staffPhotoName,
      staffPhotoUrl: staff.staffPhotoUrl,
      assignedClass: staff.assignedClass,
      teachingSection: staff.section,
      staffCategory: derivedStaffCategory,
    });
    const next = mapTeachingStaff(updated);
    setTeachingStaff((prev) => prev.map((x) => (x.id === next.id ? next : x)));
    setSelectedTeachingProfile(next);
    setEditingTeachingStaff(null);
    setShowTeachingForm(false);
  }

  async function updateNonTeachingStaff(staff: NonTeachingStaffRecord) {
    setStaffError(null);
    const updated = await updateStaffMember(staff.id, {
      displayName: staff.name,
      email: staff.email,
      staffRole: staff.role,
      phone: staff.phone,
      address: staff.address,
      emergencyContactName: staff.emergencyContactName,
      emergencyContactPhone: staff.emergencyContactPhone,
      nationalId: staff.nationalIdNumber,
      staffCategory: staff.category,
      nationalIdPhotoName: staff.nationalIdPhotoName,
      nationalIdPhotoUrl: staff.nationalIdPhotoUrl,
    });
    const next = mapNonTeachingStaff(updated);
    setNonTeachingStaff((prev) => prev.map((x) => (x.id === next.id ? next : x)));
    setSelectedNonTeachingProfile(null);
    setEditingNonTeachingStaff(null);
    setShowNonTeachingForm(false);
  }

  async function removeStaff(kind: "teaching" | "nonTeaching", id: number) {
    await deleteStaffMember(id);
    if (kind === "teaching") {
      setTeachingStaff((prev) => prev.filter((x) => x.id !== id));
      setSelectedTeachingProfile((curr) => (curr?.id === id ? null : curr));
      return;
    }
    setNonTeachingStaff((prev) => prev.filter((x) => x.id !== id));
    setSelectedNonTeachingProfile((curr) => (curr?.id === id ? null : curr));
  }

  return (
    <div className="min-w-0 space-y-6">
      {confirmDelete ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-[#2d3436]/40 backdrop-blur-[2px]"
            onClick={() => setConfirmDelete(null)}
            aria-label="Close warning dialog"
            title="Close warning dialog"
          />
          <div className="relative w-full max-w-md rounded-2xl border border-[#f7d1cd] bg-[#fffcf7] p-5 shadow-[8px_12px_40px_rgba(45,52,54,0.2)]">
            <h3 className="text-base font-bold text-[#a9332a]">Warning</h3>
            <p className="mt-2 text-sm text-[#2d3436]">
              This will delete the selected record. You will have 10 seconds to undo.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="rounded-full bg-[#faf7f0] px-4 py-1.5 text-xs font-semibold text-[#636e72] ring-1 ring-[#ebe4d9]"
                title="Cancel deletion"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  void removeStaff(confirmDelete.kind, confirmDelete.item.id)
                    .catch((e) =>
                      setStaffError(e instanceof Error ? e.message : "Failed to delete staff"),
                    )
                    .finally(() => setConfirmDelete(null));
                }}
                className="rounded-full bg-[#fce8e5] px-4 py-1.5 text-xs font-bold text-[#a9332a]"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <header className="border-b border-slate-200 pb-6">
        <h1 className="text-3xl font-black tracking-tight text-slate-800">{heading}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-500">{intro}</p>
        <div className="mt-4">
          <button
            type="button"
            onClick={() => {
              if (section === "teaching") {
                setShowTeachingForm((v) => !v);
                setShowNonTeachingForm(false);
                setEditingTeachingStaff(null);
              } else {
                setShowNonTeachingForm((v) => !v);
                setShowTeachingForm(false);
                setEditingNonTeachingStaff(null);
              }
            }}
            className="rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            title={section === "teaching" ? "Add Teaching Staff" : "Add Non-Teaching Staff"}
          >
            {section === "teaching" ? "Add Staff" : "Add Non Staff"}
          </button>
        </div>
      </header>

      {staffError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 shadow-sm">
          {staffError}
        </div>
      ) : null}
      {section === "teaching" ? (
        <>
          {showTeachingForm ? (
            <TeachingStaffForm
              onCancel={() => {
                setShowTeachingForm(false);
                setEditingTeachingStaff(null);
              }}
              classOptions={classOptions}
              classOptionsLoading={classRoomsLoading}
              initialData={editingTeachingStaff}
              onSave={(staff) => {
                void (editingTeachingStaff ? updateTeachingStaff(staff) : createTeachingStaff(staff)).catch((e) =>
                  setStaffError(e instanceof Error ? e.message : "Failed to save staff"),
                );
              }}
            />
          ) : null}
          {showTeachingForm || selectedTeachingProfile ? null : (
          <div className="flex flex-col rounded-3xl border border-slate-200 bg-white p-5 shadow-sm max-w-md">
            <label
              htmlFor="teaching-section-select"
              className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500"
            >
              Teaching Section
            </label>
            <select
              id="teaching-section-select"
              value={teachingSection}
              onChange={(e) => onChangeTeachingSection(e.target.value as TeachingSection)}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 shadow-sm outline-none transition-all focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 hover:border-slate-300"
            >
              <option value="all">All Teaching Staff</option>
              <option value="kindergarten">Kindergarten Teachers</option>
              <option value="lower_primary">Lower Primary Teachers</option>
              <option value="upper_primary">Upper Primary Teachers</option>
            </select>
          </div>
          )}

          {showTeachingForm || selectedTeachingProfile ? null : (
          <section className="flex flex-col rounded-3xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md overflow-hidden">
            <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4 text-sm font-bold uppercase tracking-wider text-slate-800">
              {teachingSectionLabels[teachingSection]}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead className="border-b border-slate-100 bg-white text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-6 py-3">Name</th>
                    <th className="px-6 py-3">Subjects/Role</th>
                    <th className="px-6 py-3">Class</th>
                    <th className="px-6 py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {staffLoading ? (
                    <tr>
                      <td className="px-6 py-6 text-center text-sm text-slate-500" colSpan={4}>
                        Loading staff...
                      </td>
                    </tr>
                  ) : null}
                  {filteredTeachers.map((teacher) => (
                    <tr key={teacher.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="px-6 py-4 font-semibold text-slate-800">{teacher.name}</td>
                      <td className="px-6 py-4 text-xs text-slate-500">{teacher.subjects}</td>
                      <td className="px-6 py-4 text-xs font-bold text-slate-600">{teacher.assignedClass ?? "—"}</td>
                      <StaffTableRowActionsMenu
                        rowKey={`teaching:${teacher.id}`}
                        openMenuKey={staffRowActionsMenuKey}
                        onOpenMenuChange={setStaffRowActionsMenuKey}
                        onProfile={() => setSelectedTeachingProfile(teacher)}
                        onEdit={() => {
                          setEditingTeachingStaff(teacher);
                          setSelectedTeachingProfile(null);
                          setShowTeachingForm(true);
                        }}
                        onDelete={() => setConfirmDelete({ kind: "teaching", item: teacher })}
                      />
                    </tr>
                  ))}
                  {!staffLoading && filteredTeachers.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-sm text-slate-500 italic">
                        No teaching staff found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
          )}
          {showTeachingForm || !selectedTeachingProfile ? null : (
            <section className="flex flex-col rounded-3xl border border-slate-200 bg-white p-0 shadow-sm transition-shadow hover:shadow-md overflow-hidden">
              <div className="flex items-start justify-between gap-3 border-b border-slate-100 bg-slate-50/50">
                <div className="w-full px-6 py-4">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">Teaching Staff Profile Card</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedTeachingProfile(null)}
                  className="mr-6 mt-4 rounded-xl border border-slate-200 bg-white px-4 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
                  title="Close profile view"
                >
                  Close
                </button>
              </div>
              <div className="px-6 pb-6 pt-5">
              <div className="flex items-center gap-4 rounded-2xl border border-indigo-100 bg-indigo-50/30 p-4">
                <img src={selectedTeachingProfile.staffPhotoUrl ?? "/school-badge.png"} alt="Staff profile" className="h-16 w-16 rounded-xl object-cover ring-1 ring-slate-200 shadow-sm" />
                <div>
                  <p className="text-lg font-bold text-slate-800">{selectedTeachingProfile.name}</p>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {teachingSectionLabels[selectedTeachingProfile.section]}
                  </p>
                </div>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <p className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-2.5 text-sm text-slate-800"><span className="font-semibold text-slate-500 block mb-1">Assigned Class</span>{selectedTeachingProfile.assignedClass ?? "—"}</p>
                <p className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-2.5 text-sm text-slate-800"><span className="font-semibold text-slate-500 block mb-1">Role/Subjects</span>{selectedTeachingProfile.subjects}</p>
                <p className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-2.5 text-sm text-slate-800"><span className="font-semibold text-slate-500 block mb-1">Phone</span>{selectedTeachingProfile.phone ?? "—"}</p>
                <p className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-2.5 text-sm text-slate-800"><span className="font-semibold text-slate-500 block mb-1">Email</span>{selectedTeachingProfile.email ?? "—"}</p>
                <p className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-2.5 text-sm text-slate-800"><span className="font-semibold text-slate-500 block mb-1">Gender</span>{selectedTeachingProfile.gender ?? "—"}</p>
                <p className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-2.5 text-sm text-slate-800"><span className="font-semibold text-slate-500 block mb-1">Date of Birth</span>{selectedTeachingProfile.dateOfBirth ?? "—"}</p>
                <p className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-2.5 text-sm text-slate-800"><span className="font-semibold text-slate-500 block mb-1">Nationality</span>{selectedTeachingProfile.nationality ?? "—"}</p>
                <p className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-2.5 text-sm text-slate-800"><span className="font-semibold text-slate-500 block mb-1">Marital Status</span>{selectedTeachingProfile.maritalStatus ?? "—"}</p>
                <p className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-2.5 text-sm text-slate-800"><span className="font-semibold text-slate-500 block mb-1">National ID</span>{selectedTeachingProfile.nationalId ?? "—"}</p>
                <p className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-2.5 text-sm text-slate-800"><span className="font-semibold text-slate-500 block mb-1">Qualification</span>{selectedTeachingProfile.qualification ?? "—"}</p>
                <p className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-2.5 text-sm text-slate-800"><span className="font-semibold text-slate-500 block mb-1">Languages</span>{selectedTeachingProfile.languages ?? "—"}</p>
                <p className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-2.5 text-sm text-slate-800"><span className="font-semibold text-slate-500 block mb-1">Date of Joining</span>{selectedTeachingProfile.dateOfJoining ?? "—"}</p>
                <p className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-2.5 text-sm text-slate-800"><span className="font-semibold text-slate-500 block mb-1">Emergency Contact Name</span>{selectedTeachingProfile.emergencyContactName ?? "—"}</p>
                <p className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-2.5 text-sm text-slate-800"><span className="font-semibold text-slate-500 block mb-1">Emergency Contact Phone</span>{selectedTeachingProfile.emergencyContactPhone ?? "—"}</p>
                <p className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-2.5 text-sm text-slate-800"><span className="font-semibold text-slate-500 block mb-1">Referee Name</span>{selectedTeachingProfile.refereeName ?? "—"}</p>
                <p className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-2.5 text-sm text-slate-800"><span className="font-semibold text-slate-500 block mb-1">Referee Contact</span>{selectedTeachingProfile.refereeContact ?? "—"}</p>
                <p className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-2.5 text-sm text-slate-800"><span className="font-semibold text-slate-500 block mb-1">Staff Photo</span>{selectedTeachingProfile.staffPhotoName ?? "—"}</p>
                <p className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 sm:col-span-2"><span className="font-semibold text-slate-500 block mb-1">Address</span>{selectedTeachingProfile.address ?? "—"}</p>
                <p className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 sm:col-span-2"><span className="font-semibold text-slate-500 block mb-1">Experience</span>{selectedTeachingProfile.experience ?? "—"}</p>
              </div>
              <div className="mt-6 flex flex-wrap gap-3 border-t border-slate-100 pt-5">
                <button
                  type="button"
                  onClick={() => {
                    setEditingTeachingStaff(selectedTeachingProfile);
                    setSelectedTeachingProfile(null);
                    setShowTeachingForm(true);
                  }}
                  className="rounded-xl border border-slate-200 bg-white px-6 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-indigo-600"
                  title="Edit this staff profile"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmDelete({ kind: "teaching", item: selectedTeachingProfile });
                  }}
                  className="rounded-xl border border-rose-200 bg-rose-50 px-6 py-2.5 text-sm font-semibold text-rose-700 shadow-sm transition hover:bg-rose-100"
                  title="Delete this staff record"
                >
                  Delete
                </button>
              </div>
              </div>
            </section>
          )}
        </>
      ) : (
        <>
          {showNonTeachingForm ? (
            <NonTeachingStaffForm
              onCancel={() => {
                setShowNonTeachingForm(false);
                setEditingNonTeachingStaff(null);
              }}
              initialData={editingNonTeachingStaff}
              onSave={async (staff) => {
                setStaffError(null);
                try {
                  if (editingNonTeachingStaff) await updateNonTeachingStaff(staff);
                  else await createNonTeachingStaff(staff);
                } catch (e) {
                  setStaffError(e instanceof Error ? e.message : "Failed to save staff");
                  throw e;
                }
              }}
            />
          ) : null}
          {showNonTeachingForm || selectedNonTeachingProfile ? null : (
          <div className="flex flex-col rounded-3xl border border-slate-200 bg-white p-5 shadow-sm max-w-md">
            <label
              htmlFor="non-teaching-category-select"
              className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500"
            >
              Non-Teaching Category
            </label>
            <select
              id="non-teaching-category-select"
              value={nonTeachingCategory}
              onChange={(e) =>
                onChangeNonTeachingCategory(e.target.value as NonTeachingCategory)
              }
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 shadow-sm outline-none transition-all focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 hover:border-slate-300"
            >
              <option value="all">All Non-Teaching Staff</option>
              <option value="administration">Administration Staff</option>
              <option value="finance">Finance Staff</option>
              <option value="library">Library Staff</option>
              <option value="health">Health Staff</option>
              <option value="operations">Operations Staff</option>
            </select>
          </div>
          )}
          {showNonTeachingForm || selectedNonTeachingProfile ? null : (
          <section className="flex flex-col rounded-3xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md overflow-hidden">
            <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4 text-sm font-bold uppercase tracking-wider text-slate-800">
              {nonTeachingCategoryLabels[nonTeachingCategory]}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead className="border-b border-slate-100 bg-white text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-6 py-3">Name</th>
                    <th className="px-6 py-3">Role</th>
                    <th className="px-6 py-3">Category</th>
                    <th className="px-6 py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {staffLoading ? (
                    <tr>
                      <td className="px-6 py-6 text-center text-sm text-slate-500" colSpan={4}>
                        Loading staff...
                      </td>
                    </tr>
                  ) : null}
                  {filteredNonTeaching.map((member) => (
                    <tr key={member.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="px-6 py-4 font-semibold text-slate-800">{member.name}</td>
                      <td className="px-6 py-4 text-xs text-slate-500">{member.role}</td>
                      <td className="px-6 py-4 text-xs font-bold text-slate-600">{nonTeachingCategoryLabels[member.category]}</td>
                      <StaffTableRowActionsMenu
                        rowKey={`nonTeaching:${member.id}`}
                        openMenuKey={staffRowActionsMenuKey}
                        onOpenMenuChange={setStaffRowActionsMenuKey}
                        onProfile={() => setSelectedNonTeachingProfile(member)}
                        onEdit={() => {
                          setEditingNonTeachingStaff(member);
                          setSelectedNonTeachingProfile(null);
                          setShowNonTeachingForm(true);
                        }}
                        onDelete={() => setConfirmDelete({ kind: "nonTeaching", item: member })}
                      />
                    </tr>
                  ))}
                  {!staffLoading && filteredNonTeaching.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-sm text-slate-500 italic">
                        No non-teaching staff found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
          )}
          {showNonTeachingForm || !selectedNonTeachingProfile ? null : (
            <section className="flex flex-col rounded-3xl border border-slate-200 bg-white p-0 shadow-sm transition-shadow hover:shadow-md overflow-hidden">
              <div className="flex items-start justify-between gap-3 border-b border-slate-100 bg-slate-50/50">
                <div className="w-full px-6 py-4">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">Non-Teaching Staff Profile Card</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedNonTeachingProfile(null)}
                  className="mr-6 mt-4 rounded-xl border border-slate-200 bg-white px-4 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
                  title="Close profile view"
                >
                  Close
                </button>
              </div>
              <div className="px-6 pb-6 pt-5">
              <div className="flex items-center gap-4 rounded-2xl border border-indigo-100 bg-indigo-50/30 p-4">
                <img src={selectedNonTeachingProfile.nationalIdPhotoUrl ?? "/school-badge.png"} alt="Staff profile" className="h-16 w-16 rounded-xl object-cover ring-1 ring-slate-200 shadow-sm" />
                <div>
                  <p className="text-lg font-bold text-slate-800">{selectedNonTeachingProfile.name}</p>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {nonTeachingCategoryLabels[selectedNonTeachingProfile.category]}
                  </p>
                </div>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <p className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-2.5 text-sm text-slate-800"><span className="font-semibold text-slate-500 block mb-1">Role</span>{selectedNonTeachingProfile.role}</p>
                <p className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-2.5 text-sm text-slate-800"><span className="font-semibold text-slate-500 block mb-1">Category</span>{nonTeachingCategoryLabels[selectedNonTeachingProfile.category]}</p>
                <p className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-2.5 text-sm text-slate-800"><span className="font-semibold text-slate-500 block mb-1">Email</span>{selectedNonTeachingProfile.email ?? "—"}</p>
                <p className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-2.5 text-sm text-slate-800"><span className="font-semibold text-slate-500 block mb-1">Phone</span>{selectedNonTeachingProfile.phone ?? "—"}</p>
                <p className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-2.5 text-sm text-slate-800"><span className="font-semibold text-slate-500 block mb-1">Emergency Contact Name</span>{selectedNonTeachingProfile.emergencyContactName ?? "—"}</p>
                <p className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-2.5 text-sm text-slate-800"><span className="font-semibold text-slate-500 block mb-1">Emergency Contact Phone</span>{selectedNonTeachingProfile.emergencyContactPhone ?? "—"}</p>
                <p className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-2.5 text-sm text-slate-800"><span className="font-semibold text-slate-500 block mb-1">National ID Number</span>{selectedNonTeachingProfile.nationalIdNumber ?? "—"}</p>
                <p className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-2.5 text-sm text-slate-800"><span className="font-semibold text-slate-500 block mb-1">National ID Photo</span>{selectedNonTeachingProfile.nationalIdPhotoName ?? "—"}</p>
                <p className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 sm:col-span-2"><span className="font-semibold text-slate-500 block mb-1">Address</span>{selectedNonTeachingProfile.address ?? "—"}</p>
              </div>
              <div className="mt-6 flex flex-wrap gap-3 border-t border-slate-100 pt-5">
                <button
                  type="button"
                  onClick={() => {
                    setEditingNonTeachingStaff(selectedNonTeachingProfile);
                    setSelectedNonTeachingProfile(null);
                    setShowNonTeachingForm(true);
                  }}
                  className="rounded-xl border border-slate-200 bg-white px-6 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-indigo-600"
                  title="Edit this staff profile"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmDelete({ kind: "nonTeaching", item: selectedNonTeachingProfile });
                  }}
                  className="rounded-xl border border-rose-200 bg-rose-50 px-6 py-2.5 text-sm font-semibold text-rose-700 shadow-sm transition hover:bg-rose-100"
                  title="Delete this staff record"
                >
                  Delete
                </button>
              </div>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
