import type { ClassRoomOption, StaffMemberApiRow } from "../../../api/students";
import { PasswordRule } from "./PasswordRule";

export type PasswordChecks = {
  minLength: boolean;
  uppercase: boolean;
  lowercase: boolean;
  number: boolean;
  symbol: boolean;
  matches: boolean;
  isStrong: boolean;
};

export type AddUserFormProps = {
  editingUserId: number | null;
  name: string;
  onNameChange: (value: string) => void;
  email: string;
  onEmailChange: (value: string) => void;
  role: string;
  onRoleChange: (value: string) => void;
  password: string;
  onPasswordChange: (value: string) => void;
  confirmPassword: string;
  onConfirmPasswordChange: (value: string) => void;
  linkedClassIds: number[];
  onLinkedClassIdsChange: (ids: number[]) => void;
  linkedStaffMemberId: number | null;
  onLinkedStaffMemberIdChange: (id: number | null) => void;
  roleSuggestions: string[];
  passwordChecks: PasswordChecks;
  shouldShowLinkedClasses: boolean;
  classrooms: ClassRoomOption[];
  staffMembers: StaffMemberApiRow[];
  isSubmitting: boolean;
  onBack: () => void;
  onSubmit: () => void;
  onCancel: () => void;
};

export function AddUserForm({
  editingUserId,
  name,
  onNameChange,
  email,
  onEmailChange,
  role,
  onRoleChange,
  password,
  onPasswordChange,
  confirmPassword,
  onConfirmPasswordChange,
  linkedClassIds,
  onLinkedClassIdsChange,
  linkedStaffMemberId,
  onLinkedStaffMemberIdChange,
  roleSuggestions,
  passwordChecks,
  shouldShowLinkedClasses,
  classrooms,
  staffMembers,
  isSubmitting,
  onBack,
  onSubmit,
  onCancel,
}: AddUserFormProps) {
  return (
    <div className="max-w-[860px] space-y-6 pb-24">
      <header className="flex flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-2xl text-indigo-600 shadow-inner ring-1 ring-indigo-100">
                👤
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight text-slate-800">
                  {editingUserId != null ? "Edit User Account" : "Add New User Account"}
                </h1>
                <p className="mt-1 text-sm font-medium text-slate-500">
                  {editingUserId != null
                    ? "Update access and profile information for this user."
                    : "Create a new school identity with role-based dashboard access."}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onBack}
              className="rounded-xl bg-slate-100 px-5 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-200 shrink-0"
            >
              Back to users
            </button>
        </div>
      </header>

      <div className="space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <h2 className="mb-6 text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Step 1: User Identity
          </h2>
          <div className="grid gap-6 sm:grid-cols-2">
            <label className="block space-y-2">
              <span className="text-xs font-bold text-slate-700">
                Full Name <span className="text-rose-500">*</span>
              </span>
              <input
                value={name}
                onChange={(event) => onNameChange(event.target.value)}
                placeholder="e.g. Jane Namusoke"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 outline-none shadow-sm transition-all hover:border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
              />
            </label>
            <label className="block space-y-2">
              <span className="text-xs font-bold text-slate-700">
                Email Address <span className="text-rose-500">*</span>
              </span>
              <input
                type="email"
                value={email}
                onChange={(event) => onEmailChange(event.target.value.toLowerCase())}
                placeholder="e.g. jane@queens.school"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 outline-none shadow-sm transition-all hover:border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
              />
            </label>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <h2 className="mb-6 text-[10px] font-bold uppercase tracking-widest text-slate-400">
            {editingUserId != null ? "Step 2: Access Role" : "Step 2: Role & Security"}
          </h2>
          <div className="grid gap-6 sm:grid-cols-2">
            <label className="block space-y-2">
              <span className="text-xs font-bold text-slate-700">
                Assigned Role <span className="text-rose-500">*</span>
              </span>
              <input
                list="role-suggestions"
                value={role}
                onChange={(event) => onRoleChange(event.target.value)}
                placeholder="e.g. teacher, accountant, registrar"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 outline-none shadow-sm transition-all hover:border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
              />
              <datalist id="role-suggestions">
                {roleSuggestions.map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
              <p className="text-[11px] font-semibold text-slate-500">
                You can type a custom role. Spaces and symbols are normalized when saved.
              </p>
            </label>
            {editingUserId == null ? (
              <>
                <label className="block space-y-2">
                  <span className="text-xs font-bold text-slate-700">
                    Account Password <span className="text-rose-500">*</span>
                  </span>
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => onPasswordChange(event.target.value)}
                    placeholder="Enter secure password"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 outline-none shadow-sm transition-all hover:border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                  />
                </label>
                <label className="block space-y-2">
                  <span className="text-xs font-bold text-slate-700">
                    Confirm Account Password <span className="text-rose-500">*</span>
                  </span>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => onConfirmPasswordChange(event.target.value)}
                    placeholder="Re-type password"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 outline-none shadow-sm transition-all hover:border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                  />
                </label>
              </>
            ) : null}
          </div>
          {editingUserId == null ? (
            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <label className="block space-y-2">
                <span className="text-xs font-bold text-slate-700">Link Staff (optional)</span>
                <select
                  value={linkedStaffMemberId == null ? "" : String(linkedStaffMemberId)}
                  onChange={(event) => {
                    const value = event.target.value;
                    const nextId = value ? Number.parseInt(value, 10) : null;
                    onLinkedStaffMemberIdChange(nextId);
                    if (nextId == null) return;
                    const linkedStaff = staffMembers.find((staff) => staff.id === nextId);
                    if (!linkedStaff) return;
                    onNameChange(linkedStaff.displayName ?? "");
                    onEmailChange(linkedStaff.email ?? "");
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 outline-none shadow-sm transition-all hover:border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                >
                  <option value="">No linked staff member</option>
                  {staffMembers.map((staff) => (
                    <option key={staff.id} value={String(staff.id)} disabled={Boolean(staff.userId)}>
                      {staff.displayName} ({staff.staffType}){staff.userId ? " - already linked" : ""}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] font-semibold text-slate-500">
                  Links this login account to a staff profile by staff ID.
                </p>
              </label>
            </div>
          ) : null}
          {shouldShowLinkedClasses ? (
            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <p className="text-xs font-bold text-slate-700">Linked Classes (optional, multiple selection)</p>
              <p className="mt-1 text-[11px] font-semibold text-slate-500">
                Select one or more classes this user is allowed to access.
              </p>
              <div className="mt-3 max-h-52 space-y-2 overflow-auto rounded-xl border border-slate-200 bg-white p-3">
                {classrooms.length === 0 ? (
                  <p className="text-xs font-semibold text-slate-500">No classes available.</p>
                ) : (
                  classrooms.map((room) => {
                    const checked = linkedClassIds.includes(room.id);
                    return (
                      <label
                        key={room.id}
                        className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) => {
                            const nextChecked = event.target.checked;
                            onLinkedClassIdsChange(
                              nextChecked
                                ? [...linkedClassIds, room.id]
                                : linkedClassIds.filter((id) => id !== room.id),
                            );
                          }}
                          className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span>
                          {room.name} ({room.academicYear})
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>
          ) : null}
          {editingUserId == null && password.length > 0 ? (
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <PasswordRule ok={passwordChecks.minLength} label="At least 8 characters" />
                <PasswordRule ok={passwordChecks.uppercase} label="At least one uppercase letter" />
                <PasswordRule ok={passwordChecks.lowercase} label="At least one lowercase letter" />
                <PasswordRule ok={passwordChecks.number} label="At least one number" />
                <PasswordRule ok={passwordChecks.symbol} label="At least one symbol" />
                <PasswordRule ok={passwordChecks.matches} label="Password confirmation matches" />
              </div>
          ) : null}
        </section>

        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={onSubmit}
            disabled={isSubmitting}
            className="w-full inline-flex justify-center items-center gap-2 rounded-2xl bg-indigo-600 px-6 py-4 text-sm font-bold text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:shadow-indigo-300 disabled:pointer-events-none disabled:opacity-60 transition-all"
          >
            {isSubmitting
              ? editingUserId != null
                ? "Saving Changes..."
                : "Creating Account..."
              : editingUserId != null
                ? "Save User Changes"
                : "Create User Account"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="w-full inline-flex justify-center rounded-2xl bg-white border border-slate-200 px-6 py-4 text-sm font-bold text-slate-600 shadow-sm hover:bg-slate-50 transition-all"
          >
            Cancel and Return
          </button>
        </div>
      </div>
    </div>
  );
}
