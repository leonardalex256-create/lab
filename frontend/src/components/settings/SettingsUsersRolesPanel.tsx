import { useEffect, useMemo, useRef, useState } from "react";
import {
  fetchRolePermissions,
  fetchUserPermissions,
  updateRolePermissionsBulk,
  updateUserPermissionOverrides,
} from "../../api/settings";
import {
  adminResetManagedUserPassword,
  createManagedUser,
  deleteManagedUser,
  fetchManagedUsers,
  type ManagedUser,
  updateManagedUserClassRooms,
  updateManagedUserProfile,
  updateManagedUserStatus,
} from "../../api/account";
import {
  fetchClassrooms,
  fetchStaffMembers,
  type ClassRoomOption,
  type StaffMemberApiRow,
} from "../../api/students";
import {
  groupAvailableKeysBySector,
  orphanPermissionKeys,
  PERMISSION_DETAILS,
} from "./permissionCatalog";

type UserRoleOption = {
  id:
    | "admin"
    | "accountant"
    | "head_teacher"
    | "teacher"
    | "registrar"
    | "staff"
    | "student"
    | "parent";
  label: string;
  description: string;
};

const ROLE_OPTIONS: UserRoleOption[] = [
  {
    id: "admin",
    label: "admin",
    description: "Full school control and top-level system administration.",
  },
  {
    id: "accountant",
    label: "accountant",
    description: "Handles finance, payments, expenses, payroll, and bursary workflows.",
  },
  {
    id: "head_teacher",
    label: "head_teacher",
    description: "Oversees academic activity, teaching performance, and school learning records.",
  },
  {
    id: "teacher",
    label: "teacher",
    description: "Manages assigned classes, attendance, marks, and learner records.",
  },
  {
    id: "registrar",
    label: "registrar",
    description: "Manages admissions, student profiles, and parent-linked records.",
  },
  {
    id: "staff",
    label: "staff",
    description: "General internal access for approved non-teaching staff operations.",
  },
  {
    id: "student",
    label: "student",
    description: "Own-profile access for learner dashboards and school self-service.",
  },
  {
    id: "parent",
    label: "parent",
    description: "Parent/guardian access for linked children, fees, and communication.",
  },
];

const STRONG_PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

/** Roles that receive curriculum/class-scoped access via user_class_authorizations */
const ROLES_WITH_CLASS_ASSIGNMENT = new Set(["teacher", "head_teacher"]);

function mergeManagedUserRow(prev: ManagedUser, next: ManagedUser): ManagedUser {
  return {
    ...next,
    classRoomIds: next.classRoomIds ?? prev.classRoomIds,
  };
}

export function SettingsUsersRolesPanel() {
  const [view, setView] = useState<"list" | "add" | "permissions">("list");
  const [permissionMode, setPermissionMode] = useState<"role" | "user">("role");
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [permissionMappings, setPermissionMappings] = useState<{ role: string; permissionKey: string }[]>([]);
  const [availablePermissionKeys, setAvailablePermissionKeys] = useState<string[]>([]);
  const [selectedPermissionUserId, setSelectedPermissionUserId] = useState<number | null>(null);
  const [selectedPermissionUserRole, setSelectedPermissionUserRole] = useState<string>("");
  const [rolePermissionKeySet, setRolePermissionKeySet] = useState<Set<string>>(new Set());
  const [userOverrideMap, setUserOverrideMap] = useState<Record<string, boolean>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [permissionSearch, setPermissionSearch] = useState("");
  const [dirtyKeys, setDirtyKeys] = useState<Set<string>>(new Set());
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [linkedClassIds, setLinkedClassIds] = useState<number[]>([]);
  const [linkedStaffMemberId, setLinkedStaffMemberId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [actingUserId, setActingUserId] = useState<number | null>(null);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [activeManageRowId, setActiveManageRowId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [totalUsers, setTotalUsers] = useState(0);
  const [offset, setOffset] = useState(0);
  const USERS_PAGE_SIZE = 100;
  const [status, setStatus] = useState<string | null>(null);
  const [classrooms, setClassrooms] = useState<ClassRoomOption[]>([]);
  const [staffMembers, setStaffMembers] = useState<StaffMemberApiRow[]>([]);
  const [classAssignUser, setClassAssignUser] = useState<ManagedUser | null>(null);
  const [classRoomSelection, setClassRoomSelection] = useState<number[]>([]);
  const [classAssignSaving, setClassAssignSaving] = useState(false);
  const activeManageMenuRef = useRef<HTMLDivElement | null>(null);

  const lastFetchedPermissionMappingsRef = useRef<Array<{ role: string; permissionKey: string }>>([]);
  const [permissionsToast, setPermissionsToast] = useState<string | null>(null);
  const [confirmSaveRoleOpen, setConfirmSaveRoleOpen] = useState(false);

  const [deleteUserModal, setDeleteUserModal] = useState<{ open: boolean; user: ManagedUser | null }>({
    open: false,
    user: null,
  });
  const [resetPasswordModal, setResetPasswordModal] = useState<{ open: boolean; user: ManagedUser | null }>({
    open: false,
    user: null,
  });
  const [resetPasswordInput, setResetPasswordInput] = useState("");

  const [userPickerQuery, setUserPickerQuery] = useState("");
  const [userPickerOpen, setUserPickerOpen] = useState(false);

  const roleSuggestions = useMemo(() => ROLE_OPTIONS.map((item) => item.id), []);
  const passwordChecks = useMemo(
    () => ({
      minLength: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /\d/.test(password),
      symbol: /[^A-Za-z0-9]/.test(password),
      matches: password.length > 0 && password === confirmPassword,
      isStrong: STRONG_PASSWORD_REGEX.test(password),
    }),
    [password, confirmPassword],
  );
  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return users.filter((u) => {
      const roleOk = roleFilter === "all" ? true : u.role === roleFilter;
      if (!roleOk) return false;
      if (!q) return true;
      return (
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q)
      );
    });
  }, [users, roleFilter, searchQuery]);
  const shouldShowLinkedClasses =
    editingUserId == null &&
    (role.trim().toLowerCase() === "teacher" || role.trim().toLowerCase() === "head_teacher");

  function resetForm() {
    setName("");
    setEmail("");
    setRole("");
    setPassword("");
    setConfirmPassword("");
    setLinkedClassIds([]);
    setLinkedStaffMemberId(null);
    setEditingUserId(null);
    setStatus(null);
  }

  const permissionSectors = useMemo(
    () => groupAvailableKeysBySector(availablePermissionKeys),
    [availablePermissionKeys],
  );
  const orphanKeys = useMemo(
    () => orphanPermissionKeys(availablePermissionKeys),
    [availablePermissionKeys],
  );

  const resetPasswordChecks = useMemo(() => {
    const p = resetPasswordInput;
    return {
      minLength: p.length >= 8,
      uppercase: /[A-Z]/.test(p),
      lowercase: /[a-z]/.test(p),
      number: /\d/.test(p),
      symbol: /[^A-Za-z0-9]/.test(p),
      isStrong: STRONG_PASSWORD_REGEX.test(p),
    };
  }, [resetPasswordInput]);

  useEffect(() => {
    if (!classAssignUser) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !classAssignSaving) setClassAssignUser(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [classAssignUser, classAssignSaving]);

  useEffect(() => {
    setIsLoadingUsers(true);
    fetchManagedUsers(USERS_PAGE_SIZE, offset)
      .then((data) => {
        if (offset === 0) {
          setUsers(data.users);
        } else {
          setUsers((prev) => [...prev, ...data.users]);
        }
        setTotalUsers(data.total);
      })
      .catch((err: Error) => setStatus("Error loading users: " + err.message))
      .finally(() => setIsLoadingUsers(false));
  }, [offset]);

  useEffect(() => {
    void Promise.all([fetchClassrooms(), fetchStaffMembers()])
      .then(([rooms, staff]) => {
        setClassrooms(rooms);
        setStaffMembers(staff);
      })
      .catch(() => {
        // Keep users table functional even if class/staff helpers fail to load.
      });
  }, []);

  useEffect(() => {
    if (view === "permissions") {
      fetchRolePermissions()
        .then((data) => {
          setPermissionMappings(data.permissions);
          setAvailablePermissionKeys(data.availableKeys);
          lastFetchedPermissionMappingsRef.current = data.permissions;
          setDirtyKeys(new Set());
        })
        .catch((err) => {
          setStatus("Error loading permissions: " + err.message);
        });
    }
  }, [view]);

  useEffect(() => {
    if (view !== "permissions" || permissionMode !== "user") return;
    if (selectedPermissionUserId == null) return;
    fetchUserPermissions(selectedPermissionUserId)
      .then((data) => {
        setSelectedPermissionUserRole(data.userRole);
        setAvailablePermissionKeys(data.availableKeys);
        setRolePermissionKeySet(new Set(data.rolePermissions));
        const map: Record<string, boolean> = {};
        for (const row of data.overrides) map[row.permissionKey] = row.allowed;
        setUserOverrideMap(map);
      })
      .catch((err: Error) => setStatus("Error loading user permissions: " + err.message));
  }, [view, permissionMode, selectedPermissionUserId]);

  useEffect(() => {
    if (activeManageRowId == null) return;
    function onPointerDown(event: MouseEvent) {
      if (!activeManageMenuRef.current) return;
      const target = event.target;
      if (target instanceof Node && !activeManageMenuRef.current.contains(target)) {
        setActiveManageRowId(null);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [activeManageRowId]);

  useEffect(() => {
    if (!shouldShowLinkedClasses && linkedClassIds.length > 0) {
      setLinkedClassIds([]);
    }
  }, [shouldShowLinkedClasses, linkedClassIds.length]);

  async function handleTogglePermission(roleId: string, permKey: string) {
    const isCurrentlyChecked = permissionMappings.some(m => m.role === roleId && m.permissionKey === permKey);
    let newMappings = [];
    if (isCurrentlyChecked) {
      newMappings = permissionMappings.filter(m => !(m.role === roleId && m.permissionKey === permKey));
    } else {
      newMappings = [...permissionMappings, { role: roleId, permissionKey: permKey }];
    }
    setPermissionMappings(newMappings);

    const baseline = new Set(
      lastFetchedPermissionMappingsRef.current.map((m) => `${m.role}:${m.permissionKey}`),
    );
    const pair = `${roleId}:${permKey}`;
    const nextChecked = !isCurrentlyChecked;
    const differs = baseline.has(pair) !== nextChecked;
    setDirtyKeys((prev) => {
      const copy = new Set(prev);
      if (differs) copy.add(pair);
      else copy.delete(pair);
      return copy;
    });
  }

  async function handleSavePermissions() {
    setIsSaving(true);
    setStatus(null);
    try {
      const updates = ROLE_OPTIONS.map((r) => ({
        role: r.id,
        permissions: permissionMappings
          .filter((m) => m.role === r.id)
          .map((m) => m.permissionKey),
      }));
      await updateRolePermissionsBulk(updates);
      setStatus("Permissions updated successfully!");
      lastFetchedPermissionMappingsRef.current = permissionMappings;
      setDirtyKeys(new Set());
    } catch (err: any) {
      setStatus("Error saving permissions: " + err.message);
    } finally {
      setIsSaving(false);
    }
  }

  function effectiveForUserPermission(permissionKey: string): boolean {
    if (permissionKey in userOverrideMap) return Boolean(userOverrideMap[permissionKey]);
    return rolePermissionKeySet.has(permissionKey);
  }

  function cycleUserPermissionOverride(permissionKey: string) {
    const baseAllowed = rolePermissionKeySet.has(permissionKey);
    const hasOverride = Object.prototype.hasOwnProperty.call(userOverrideMap, permissionKey);
    // Cycle: Inherited → Override Allow → Override Deny → Inherited
    if (!hasOverride) {
      setUserOverrideMap((prev) => ({ ...prev, [permissionKey]: true }));
      return;
    }
    const currentOverride = Boolean(userOverrideMap[permissionKey]);
    if (currentOverride === true) {
      setUserOverrideMap((prev) => ({ ...prev, [permissionKey]: false }));
      return;
    }
    if (currentOverride === false) {
      setUserOverrideMap((prev) => {
        const copy = { ...prev };
        delete copy[permissionKey];
        return copy;
      });
      return;
    }

    // Fallback: preserve previous behavior if unexpected state appears.
    const next = !baseAllowed;
    setUserOverrideMap((prev) => ({ ...prev, [permissionKey]: next }));
  }

  async function handleSaveUserPermissions() {
    if (selectedPermissionUserId == null) {
      setStatus("Select a user first.");
      return;
    }
    setIsSaving(true);
    setStatus(null);
    try {
      const overrides = Object.entries(userOverrideMap).map(([permissionKey, allowed]) => ({
        permissionKey,
        allowed,
      }));
      await updateUserPermissionOverrides(selectedPermissionUserId, overrides);
      setStatus("User permissions updated successfully!");
    } catch (err: any) {
      setStatus("Error saving user permissions: " + err.message);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSubmit() {
    if (!name.trim()) {
      setStatus("Enter the user's full name before creating the account.");
      return;
    }
    if (!email.trim()) {
      setStatus("Enter the user's email before creating the account.");
      return;
    }
    if (!role.trim()) {
      setStatus("Enter a role for this user.");
      return;
    }
    try {
      setIsSubmitting(true);
      if (editingUserId != null) {
        const updated = await updateManagedUserProfile(editingUserId, {
          name: name.trim(),
          email: email.trim(),
          role: role.trim(),
        });
        setUsers((currentUsers) =>
          currentUsers.map((u) => (u.id === updated.id ? mergeManagedUserRow(u, updated) : u)),
        );
        setStatus(`Saved changes for ${updated.name}.`);
      } else {
        if (!passwordChecks.isStrong) {
          setStatus("Password must be at least 8 characters and include uppercase, lowercase, number, and symbol.");
          setIsSubmitting(false);
          return;
        }
        if (!passwordChecks.matches) {
          setStatus("Confirm password, please.");
          setIsSubmitting(false);
          return;
        }
        const created = await createManagedUser({
          name: name.trim(),
          email: email.trim(),
          role: role.trim(),
          password,
          confirmPassword,
          classRoomIds: linkedClassIds,
          staffMemberId: linkedStaffMemberId,
        });
        setUsers((currentUsers) => [created, ...currentUsers]);
        setStatus(`User account created for role "${created.role}". They can sign in and access their dashboard.`);
      }
      setName("");
      setEmail("");
      setRole("");
      setPassword("");
      setConfirmPassword("");
      setLinkedClassIds([]);
      setLinkedStaffMemberId(null);
      setEditingUserId(null);
      setView("list");
    } catch (err: any) {
      setStatus(err?.message ?? "Failed to create user");
    } finally {
      setIsSubmitting(false);
    }
  }

  function openEditUser(user: ManagedUser) {
    setEditingUserId(user.id);
    setName(user.name);
    setEmail(user.email);
    setRole(user.role);
    setPassword("");
    setConfirmPassword("");
    setLinkedClassIds([]);
    setLinkedStaffMemberId(null);
    setView("add");
    setActiveManageRowId(null);
    setStatus(null);
  }

  function permissionDetail(permKey: string) {
    const d = PERMISSION_DETAILS[permKey];
    return {
      title: d?.title ?? permKey.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
      description:
        d?.description ??
        "Controls access for this capability. Extend permissionCatalog.ts when new keys are added.",
    };
  }

  async function handleToggleActive(user: ManagedUser) {
    try {
      setActingUserId(user.id);
      const updated = await updateManagedUserStatus(user.id, !user.isActive);
      setUsers((current) =>
        current.map((row) => (row.id === user.id ? mergeManagedUserRow(row, updated) : row)),
      );
      setStatus(
        updated.isActive
          ? `${updated.name} has been reactivated.`
          : `${updated.name} has been deactivated.`,
      );
    } catch (err: any) {
      setStatus(err?.message ?? "Failed to update user status");
    } finally {
      setActingUserId(null);
    }
  }

  async function handleDeleteUser(user: ManagedUser) {
    setDeleteUserModal({ open: true, user });
    setActiveManageRowId(null);
  }

  async function confirmDeleteUser() {
    const user = deleteUserModal.user;
    if (!user) return;
    try {
      setActingUserId(user.id);
      await deleteManagedUser(user.id);
      setUsers((current) => current.filter((row) => row.id !== user.id));
      setStatus(`${user.name} was deleted successfully.`);
    } catch (err: any) {
      setStatus(err?.message ?? "Failed to delete user");
    } finally {
      setActingUserId(null);
      setDeleteUserModal({ open: false, user: null });
    }
  }

  async function handleAdminResetPassword(user: ManagedUser) {
    setResetPasswordInput("");
    setResetPasswordModal({ open: true, user });
    setActiveManageRowId(null);
  }

  async function confirmAdminResetPassword() {
    const user = resetPasswordModal.user;
    if (!user) return;
    const newPassword = resetPasswordInput;
    if (!STRONG_PASSWORD_REGEX.test(newPassword)) {
      setStatus("Temporary password must include uppercase, lowercase, number, and symbol characters.");
      return;
    }
    try {
      setActingUserId(user.id);
      await adminResetManagedUserPassword(user.id, newPassword);
      setStatus(`Password reset completed for ${user.name}. Share the temporary password securely.`);
    } catch (err: any) {
      setStatus(err?.message ?? "Failed to reset password");
    } finally {
      setActingUserId(null);
      setResetPasswordModal({ open: false, user: null });
      setResetPasswordInput("");
    }
  }

  function classAssignmentLabel(user: ManagedUser): string {
    if (!ROLES_WITH_CLASS_ASSIGNMENT.has(user.role)) return "—";
    const ids = user.classRoomIds ?? [];
    if (ids.length === 0) return "No classes assigned";
    const names = ids
      .map((id) => classrooms.find((c) => c.id === id)?.name)
      .filter((n): n is string => Boolean(n));
    if (names.length === 0) return `${ids.length} class(es)`;
    return names.length > 2 ? `${names.slice(0, 2).join(", ")} +${names.length - 2}` : names.join(", ");
  }

  function openClassAssignment(user: ManagedUser) {
    setClassAssignUser(user);
    setClassRoomSelection([...(user.classRoomIds ?? [])]);
    setActiveManageRowId(null);
    setStatus(null);
  }

  function toggleClassRoomInAssignment(classRoomId: number) {
    setClassRoomSelection((prev) =>
      prev.includes(classRoomId) ? prev.filter((id) => id !== classRoomId) : [...prev, classRoomId],
    );
  }

  async function saveClassAssignment() {
    if (!classAssignUser) return;
    setClassAssignSaving(true);
    try {
      const updated = await updateManagedUserClassRooms(classAssignUser.id, classRoomSelection);
      setUsers((current) => current.map((row) => (row.id === updated.id ? updated : row)));
      setStatus(
        `Class access updated for ${updated.name} (${classRoomSelection.length} class${classRoomSelection.length === 1 ? "" : "es"}).`,
      );
      setClassAssignUser(null);
    } catch (err: unknown) {
      setStatus(err instanceof Error ? err.message : "Failed to save class assignment");
    } finally {
      setClassAssignSaving(false);
    }
  }

  function openUserPermissions(user: ManagedUser) {
    setView("permissions");
    setPermissionMode("user");
    setSelectedPermissionUserId(user.id);
    setStatus(null);
  }

  function renderPermissionMatrix(permKeys: string[]) {
    const iconByRole: Record<string, string> = {
      admin: "🛡️",
      accountant: "💰",
      head_teacher: "🎓",
      teacher: "👨‍🏫",
      registrar: "📋",
      staff: "👷",
      student: "🎒",
      parent: "👨‍👩‍👧",
    };

    const baseline = new Set(
      lastFetchedPermissionMappingsRef.current.map((m) => `${m.role}:${m.permissionKey}`),
    );

    function roleHasDirty(roleId: string) {
      for (const k of dirtyKeys) {
        if (k.startsWith(`${roleId}:`)) return true;
      }
      return false;
    }

    function toggleTrackClass(on: boolean) {
      return [
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border transition-colors",
        on ? "bg-emerald-500 border-emerald-500" : "bg-slate-200 border-slate-300",
      ].join(" ");
    }

    function toggleKnobClass(on: boolean) {
      return [
        "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition",
        on ? "translate-x-5" : "translate-x-0.5",
      ].join(" ");
    }

    function setDirtyForPair(roleId: string, permKey: string, nextChecked: boolean, prev: Set<string>) {
      const pair = `${roleId}:${permKey}`;
      const differs = baseline.has(pair) !== nextChecked;
      if (differs) prev.add(pair);
      else prev.delete(pair);
    }

    function bulkSetRole(roleId: string, nextChecked: boolean) {
      const current = new Set(permissionMappings.map((m) => `${m.role}:${m.permissionKey}`));
      const next = new Set(current);
      for (const permKey of permKeys) {
        const pair = `${roleId}:${permKey}`;
        if (nextChecked) next.add(pair);
        else next.delete(pair);
      }
      setPermissionMappings(
        Array.from(next).map((p) => {
          const [role, permissionKey] = p.split(":");
          return { role, permissionKey };
        }),
      );
      setDirtyKeys((prev) => {
        const copy = new Set(prev);
        for (const permKey of permKeys) setDirtyForPair(roleId, permKey, nextChecked, copy);
        return copy;
      });
    }

    function bulkSetSectorAllRoles(nextChecked: boolean) {
      const current = new Set(permissionMappings.map((m) => `${m.role}:${m.permissionKey}`));
      const next = new Set(current);
      for (const roleId of ROLE_OPTIONS.map((r) => r.id)) {
        for (const permKey of permKeys) {
          const pair = `${roleId}:${permKey}`;
          if (nextChecked) next.add(pair);
          else next.delete(pair);
        }
      }
      setPermissionMappings(
        Array.from(next).map((p) => {
          const [role, permissionKey] = p.split(":");
          return { role, permissionKey };
        }),
      );
      setDirtyKeys((prev) => {
        const copy = new Set(prev);
        for (const roleId of ROLE_OPTIONS.map((r) => r.id)) {
          for (const permKey of permKeys) setDirtyForPair(roleId, permKey, nextChecked, copy);
        }
        return copy;
      });
    }

    return (
      <div className="overflow-auto">
        <table className="w-full min-w-[980px] border-collapse text-left">
          <thead className="sticky top-0 z-20 bg-white">
            <tr className="border-b border-slate-200">
              <th className="px-6 py-4 align-bottom">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Permission</div>
              </th>
              {ROLE_OPTIONS.map((r) => {
                const rows = permKeys.map((permKey) =>
                  permissionMappings.some((m) => m.role === r.id && m.permissionKey === permKey),
                );
                const allChecked = rows.length > 0 && rows.every(Boolean);
                const anyDirty = roleHasDirty(r.id);
                const icon = iconByRole[r.id] ?? "👤";
                return (
                  <th key={r.id} className="px-3 py-4 text-center align-bottom" title={r.description}>
                    <div className="flex flex-col items-center gap-1">
                      <div className="inline-flex items-center gap-2 text-xs font-black text-slate-800">
                        <span className="text-base">{icon}</span>
                        <span className="uppercase tracking-wide">{r.label}</span>
                        {anyDirty ? (
                          <span className="ml-1 h-2 w-2 rounded-full bg-amber-400" title="Unsaved changes" />
                        ) : null}
                      </div>
                      <button
                        type="button"
                        className="text-[11px] font-semibold text-indigo-600 hover:underline"
                        onClick={() => bulkSetRole(r.id, !allChecked)}
                      >
                        {allChecked ? "Clear" : "Select All"}
                      </button>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            <tr className="bg-slate-50/60">
              <td className="px-6 py-3">
                <div className="text-xs font-bold text-slate-700">Sector actions</div>
                <div className="text-[11px] font-medium text-slate-500">Apply to all roles for this sector.</div>
              </td>
              <td colSpan={ROLE_OPTIONS.length} className="px-6 py-3">
                <div className="flex flex-wrap gap-2 justify-end">
                  <button
                    type="button"
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                    onClick={() => bulkSetSectorAllRoles(true)}
                  >
                    Select All in Sector
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                    onClick={() => bulkSetSectorAllRoles(false)}
                  >
                    Clear Sector
                  </button>
                </div>
              </td>
            </tr>

            {permKeys.map((permKey) => {
              const { title, description } = permissionDetail(permKey);
              const rowDirty = Array.from(dirtyKeys).some((k) => k.endsWith(`:${permKey}`));
              const grantedRoles = ROLE_OPTIONS.filter((r) =>
                permissionMappings.some((m) => m.role === r.id && m.permissionKey === permKey),
              );
              return (
                <tr
                  key={permKey}
                  className={`hover:bg-slate-50 ${
                    rowDirty ? "border-l-4 border-amber-400" : "border-l-4 border-transparent"
                  }`}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-bold text-slate-900">{title}</p>
                        <p className="mt-1 text-xs font-medium leading-relaxed text-slate-600">{description}</p>
                        <p className="mt-1.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                          {permKey}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Roles granted</div>
                        <div className="mt-1 flex flex-wrap justify-end gap-1">
                          {grantedRoles.length === 0 ? (
                            <span className="text-xs text-slate-400">—</span>
                          ) : (
                            grantedRoles.map((r) => (
                              <span
                                key={r.id}
                                className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700 ring-1 ring-slate-200"
                                title={r.label}
                              >
                                {iconByRole[r.id] ?? "👤"}
                              </span>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  </td>

                  {ROLE_OPTIONS.map((r) => {
                    const isChecked = permissionMappings.some(
                      (m) => m.role === r.id && m.permissionKey === permKey,
                    );
                    const dirty = dirtyKeys.has(`${r.id}:${permKey}`);
                    return (
                      <td key={r.id} className="px-3 py-3 text-center">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={isChecked}
                          aria-label={`${r.label}: ${title}`}
                          onClick={() => handleTogglePermission(r.id, permKey)}
                          className="inline-flex items-center justify-center"
                          title={dirty ? "Unsaved change" : undefined}
                        >
                          <span className={toggleTrackClass(isChecked)}>
                            <span className={toggleKnobClass(isChecked)} />
                          </span>
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  if (view === "permissions") {
    const successMessage = status?.startsWith("Permissions updated") || status?.startsWith("User permissions updated");
    const totalPerms = availablePermissionKeys.length;
    const searchLower = permissionSearch.trim().toLowerCase();
    const matchPermKey = (k: string) => {
      if (!searchLower) return true;
      const { title } = permissionDetail(k);
      return title.toLowerCase().includes(searchLower) || k.toLowerCase().includes(searchLower);
    };
    const filteredSectors = permissionSectors
      .map((s) => ({ ...s, keys: s.keys.filter((k) => matchPermKey(k)) }))
      .filter((s) => s.keys.length > 0);
    const filteredOrphanKeys = orphanKeys.filter((k) => matchPermKey(k));
    const showingCount = filteredSectors.reduce((sum, s) => sum + s.keys.length, 0) + filteredOrphanKeys.length;
    return (
      <div className="max-w-[1100px] space-y-6 pb-24">
        <header className="flex flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-2xl text-indigo-600 shadow-inner ring-1 ring-indigo-100">
                🔐
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight text-slate-800">
                  {permissionMode === "role" ? "Role Permissions" : "User Permissions"}
                </h1>
                <p className="mt-1 text-sm font-medium text-slate-500">
                  {permissionMode === "role"
                    ? "Configure system access for each role. Grant or revoke per sector, then save."
                    : "Individual permission overrides for specific administrative accounts."}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
                <button
                  type="button"
                  onClick={() => {
                    setPermissionMode("role");
                    setStatus(null);
                  }}
                  className={`rounded-lg px-4 py-2 text-xs font-bold transition-all ${
                    permissionMode === "role" ? "bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  By Role
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPermissionMode("user");
                    setStatus(null);
                    if (selectedPermissionUserId == null && users.length > 0) {
                      setSelectedPermissionUserId(users[0].id);
                    }
                  }}
                  className={`rounded-lg px-4 py-2 text-xs font-bold transition-all ${
                    permissionMode === "user" ? "bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  By User
                </button>
              </div>
              <button
                type="button"
                onClick={() => setView("list")}
                className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-600 shadow-sm hover:bg-slate-50"
              >
                Back
              </button>
              {permissionMode === "role" && dirtyKeys.size > 0 ? (
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => {
                    setPermissionMappings(lastFetchedPermissionMappingsRef.current);
                    setDirtyKeys(new Set());
                    setStatus(null);
                  }}
                  className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-600 shadow-sm hover:bg-slate-50 disabled:opacity-50"
                >
                  Discard Changes
                </button>
              ) : null}
              <button
                type="button"
                disabled={isSaving}
                onClick={() => {
                  if (permissionMode === "role") {
                    setConfirmSaveRoleOpen(true);
                    return;
                  }
                  void handleSaveUserPermissions();
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:shadow-indigo-300 disabled:pointer-events-none disabled:opacity-60 transition-all"
              >
                {isSaving
                  ? "Saving..."
                  : permissionMode === "role" && dirtyKeys.size > 0
                    ? `Save Changes (${dirtyKeys.size} pending)`
                    : "Save Changes"}
              </button>
            </div>
          </div>
        </header>

        <div className="space-y-6">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex-1">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                  Search permissions
                </label>
                <input
                  value={permissionSearch}
                  onChange={(e) => setPermissionSearch(e.target.value)}
                  placeholder="Search permissions by name or key..."
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 outline-none shadow-sm transition-all hover:border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                />
              </div>
              <div className="shrink-0 rounded-xl bg-indigo-50 px-4 py-2.5 text-xs font-bold text-indigo-600 ring-1 ring-indigo-100">
                Showing {showingCount} of {totalPerms} permissions
              </div>
            </div>
            {showingCount === 0 ? (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-6 text-center">
                <div className="text-lg font-black text-slate-800">🔍 No permissions match your search.</div>
                <div className="mt-1 text-sm font-medium text-slate-600">Try a broader term.</div>
              </div>
            ) : null}
          </section>

          {permissionsToast ? (
            <div className="fixed top-4 right-4 z-[210] max-w-[92vw] rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800 shadow-lg">
              {permissionsToast}
            </div>
          ) : null}

          {permissionMode === "user" ? (
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div className="flex-1">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Select User (Admin managed)
                  </div>
                  <div className="relative mt-2">
                    <input
                      value={userPickerQuery}
                      onChange={(e) => {
                        setUserPickerQuery(e.target.value);
                        setUserPickerOpen(true);
                      }}
                      onFocus={() => setUserPickerOpen(true)}
                      placeholder="Search by name, email, or role…"
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 outline-none shadow-sm transition-all hover:border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                    />
                    {userPickerOpen ? (
                      <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                        <div className="max-h-64 overflow-auto">
                          {users
                            .filter((u) => {
                              const q = userPickerQuery.trim().toLowerCase();
                              if (!q) return true;
                              return (
                                u.name.toLowerCase().includes(q) ||
                                u.email.toLowerCase().includes(q) ||
                                u.role.toLowerCase().includes(q)
                              );
                            })
                            .slice(0, 40)
                            .map((u) => (
                              <button
                                key={u.id}
                                type="button"
                                className="w-full px-4 py-3 text-left hover:bg-slate-50 transition"
                                onClick={() => {
                                  setSelectedPermissionUserId(u.id);
                                  setUserPickerQuery(`${u.name} (${u.email})`);
                                  setUserPickerOpen(false);
                                }}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="truncate text-sm font-bold text-slate-800">{u.name}</div>
                                    <div className="truncate text-xs font-medium text-slate-500">{u.email}</div>
                                  </div>
                                  <span className="shrink-0 inline-flex rounded-lg border border-indigo-100 bg-indigo-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-indigo-600">
                                    {u.role}
                                  </span>
                                </div>
                              </button>
                            ))}
                          {users.length === 0 ? (
                            <div className="px-4 py-6 text-sm font-medium text-slate-500">
                              No users loaded.
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className="shrink-0">
                  <button
                    type="button"
                    disabled={selectedPermissionUserId == null}
                    onClick={() => setUserOverrideMap({})}
                    className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-600 shadow-sm hover:bg-slate-50 disabled:opacity-50"
                    title="Clear all overrides for this user"
                  >
                    Reset All Overrides
                  </button>
                </div>
              </div>
              <p className="mt-2 text-xs font-medium text-slate-500">
                Base role: <span className="font-bold text-slate-700">{selectedPermissionUserRole || "not selected"}</span>.
                Unchecked options are denied, checked options are allowed. Overrides can differ from role defaults.
              </p>
            </section>
          ) : null}
          {filteredSectors.map((sector) => (
            <section
              key={sector.id}
              className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4">
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">{sector.title}</h2>
                <p className="mt-0.5 text-xs font-medium text-slate-500">{sector.subtitle}</p>
              </div>
              {permissionMode === "role" ? (
                renderPermissionMatrix([...sector.keys])
              ) : (
                <div className="grid gap-3 p-4 sm:grid-cols-2">
                  {sector.keys.map((permKey) => {
                    const { title, description } = permissionDetail(permKey);
                    const checked = effectiveForUserPermission(permKey);
                    const roleBased = rolePermissionKeySet.has(permKey);
                    const overridden = Object.prototype.hasOwnProperty.call(userOverrideMap, permKey);
                    const overrideVal = overridden ? Boolean(userOverrideMap[permKey]) : null;
                    const stateBadge =
                      overridden && overrideVal === true
                        ? { label: "Override: Allowed", cls: "bg-amber-50 text-amber-800 ring-amber-200" }
                        : overridden && overrideVal === false
                          ? { label: "Override: Denied", cls: "bg-rose-50 text-rose-700 ring-rose-200" }
                          : roleBased && checked
                            ? { label: "From role", cls: "bg-slate-100 text-slate-700 ring-slate-200" }
                            : { label: "Not granted", cls: "bg-slate-100 text-slate-500 ring-slate-200" };
                    const toggleColor =
                      overridden && overrideVal === true
                        ? "bg-emerald-500 border-emerald-500"
                        : overridden && overrideVal === false
                          ? "bg-rose-500 border-rose-500"
                          : roleBased && checked
                            ? "bg-blue-500 border-blue-500"
                            : "bg-slate-200 border-slate-300";
                    return (
                      <label
                        key={permKey}
                        className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm hover:border-slate-300"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-bold text-slate-900">{title}</p>
                            <p className="mt-1 text-xs font-medium leading-relaxed text-slate-600">{description}</p>
                            <p className="mt-1.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                              {permKey}
                            </p>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <span
                                className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${stateBadge.cls}`}
                              >
                                {stateBadge.label}
                              </span>
                              {overridden ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setUserOverrideMap((prev) => {
                                      const copy = { ...prev };
                                      delete copy[permKey];
                                      return copy;
                                    })
                                  }
                                  className="text-[11px] font-semibold text-indigo-600 hover:underline"
                                >
                                  Reset to Role Default
                                </button>
                              ) : null}
                            </div>
                          </div>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={checked}
                            onClick={() => cycleUserPermissionOverride(permKey)}
                            className="mt-1 inline-flex items-center"
                            title="Cycle: Inherited → Override Allow → Override Deny → Inherited"
                          >
                            <span
                              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border transition-colors ${toggleColor}`}
                            >
                              <span
                                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                                  checked ? "translate-x-5" : "translate-x-0.5"
                                }`}
                              />
                            </span>
                          </button>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </section>
          ))}

          {filteredOrphanKeys.length > 0 ? (
            <section className="neo-card overflow-hidden rounded-2xl border border-amber-100 bg-white shadow-sm">
              <div className="border-b border-amber-100 bg-amber-50/80 px-5 py-4">
                <h2 className="text-sm font-black uppercase tracking-wider text-amber-900">
                  ⚠️ {filteredOrphanKeys.length} permission keys returned from the server are not documented in{" "}
                  <span className="font-mono">permissionCatalog.ts</span>.
                </h2>
                <p className="mt-1 text-xs font-medium text-amber-900/80">
                  They are still functional but lack descriptions. Add them to the catalog for full documentation.
                </p>
              </div>
              <div className="p-4 space-y-2">
                {filteredOrphanKeys.map((key) => (
                  <div
                    key={key}
                    className="flex items-center justify-between rounded-xl border border-amber-100 bg-white px-4 py-3"
                  >
                    <div className="min-w-0">
                      <div className="font-mono text-xs font-bold text-slate-800">{key}</div>
                      <div className="mt-0.5 text-xs text-slate-500">
                        Not documented in <span className="font-mono">permissionCatalog.ts</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="inline-flex items-center justify-center rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900 hover:bg-amber-100"
                      title="Copy scaffold to clipboard"
                      onClick={async () => {
                        const scaffold = `"${key}": { title: "${key}", description: "TODO: Describe this permission." }`;
                        try {
                          await navigator.clipboard.writeText(scaffold);
                          setPermissionsToast("Scaffold copied to clipboard. Paste into permissionCatalog.ts.");
                          window.setTimeout(() => setPermissionsToast(null), 2500);
                        } catch {
                          setStatus("Could not access clipboard. Copy manually: " + scaffold);
                        }
                      }}
                    >
                      📝 Add to Catalog
                    </button>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {status ? (
            <div
              className={`rounded-xl border px-5 py-4 text-sm font-bold ${
                successMessage
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-red-200 bg-red-50 text-red-700"
              }`}
            >
              {status}
            </div>
          ) : null}
        </div>

        {confirmSaveRoleOpen ? (
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[2px]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-save-role-title"
            onClick={() => (isSaving ? null : setConfirmSaveRoleOpen(false))}
          >
            <div
              className="w-full max-w-lg overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="border-b border-slate-100 bg-slate-50 px-6 py-4">
                <h2 id="confirm-save-role-title" className="text-lg font-black text-[#0c2340]">
                  Confirm permission update
                </h2>
                <p className="mt-1 text-sm font-medium text-slate-600">
                  You are about to update permissions for{" "}
                  <span className="font-bold text-slate-800">{ROLE_OPTIONS.length}</span> roles affecting all users in
                  those roles. This takes effect immediately. Continue?
                </p>
              </div>
              <div className="flex gap-3 border-t border-slate-100 bg-slate-50/80 px-6 py-4">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => setConfirmSaveRoleOpen(false)}
                  className="flex-1 rounded-xl border border-slate-200 bg-white py-3 text-sm font-bold text-slate-600 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => {
                    setConfirmSaveRoleOpen(false);
                    void handleSavePermissions();
                  }}
                  className="flex-1 rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-200 transition-all hover:bg-indigo-700 disabled:opacity-50"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  if (view === "add") {
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
              onClick={() => {
                resetForm();
                setView("list");
              }}
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
                  <span className="text-xs font-bold text-slate-700">Full Name <span className="text-rose-500">*</span></span>
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="e.g. Jane Namusoke"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 outline-none shadow-sm transition-all hover:border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                  />
                </label>
                <label className="block space-y-2">
                  <span className="text-xs font-bold text-slate-700">Email Address <span className="text-rose-500">*</span></span>
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value.toLowerCase())}
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
                  <span className="text-xs font-bold text-slate-700">Assigned Role <span className="text-rose-500">*</span></span>
                  <input
                    list="role-suggestions"
                    value={role}
                    onChange={(event) => setRole(event.target.value)}
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
                      <span className="text-xs font-bold text-slate-700">Account Password <span className="text-rose-500">*</span></span>
                      <input
                        type="password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder="Enter secure password"
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 outline-none shadow-sm transition-all hover:border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                      />
                    </label>
                    <label className="block space-y-2">
                      <span className="text-xs font-bold text-slate-700">Confirm Account Password <span className="text-rose-500">*</span></span>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
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
                    <span className="text-xs font-bold text-slate-700">
                      Link Staff (optional)
                    </span>
                    <select
                      value={linkedStaffMemberId == null ? "" : String(linkedStaffMemberId)}
                      onChange={(event) => {
                        const value = event.target.value;
                        const nextId = value ? Number.parseInt(value, 10) : null;
                        setLinkedStaffMemberId(nextId);
                        if (nextId == null) return;
                        const linkedStaff = staffMembers.find((staff) => staff.id === nextId);
                        if (!linkedStaff) return;
                        setName(linkedStaff.displayName ?? "");
                        setEmail(linkedStaff.email ?? "");
                      }}
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 outline-none shadow-sm transition-all hover:border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                    >
                      <option value="">No linked staff member</option>
                      {staffMembers.map((staff) => (
                        <option
                          key={staff.id}
                          value={String(staff.id)}
                          disabled={Boolean(staff.userId)}
                        >
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
                  <p className="text-xs font-bold text-slate-700">
                    Linked Classes (optional, multiple selection)
                  </p>
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
                                setLinkedClassIds((prev) =>
                                  nextChecked
                                    ? [...prev, room.id]
                                    : prev.filter((id) => id !== room.id),
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

            {status ? (
              <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700">
                {status}
              </div>
            ) : null}

            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={handleSubmit}
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
                onClick={() => {
                  resetForm();
                  setView("list");
                }}
                className="w-full inline-flex justify-center rounded-2xl bg-white border border-slate-200 px-6 py-4 text-sm font-bold text-slate-600 shadow-sm hover:bg-slate-50 transition-all"
              >
                Cancel and Return
              </button>
            </div>
        </div>
      </div>
    );
  }

    return (
      <div className="max-w-[1000px] space-y-6 pb-24">
        <header className="flex flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-2xl text-indigo-600 shadow-inner ring-1 ring-indigo-100">
                👥
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight text-slate-800">Users & Roles</h1>
                <p className="mt-1 text-sm font-medium text-slate-500">
                  Administrative control for system accounts, role definitions, and portal access permissions.
                </p>
              </div>
            </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setView("permissions")}
              className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-600 shadow-sm hover:bg-slate-50 transition-all"
            >
              Manage System Permissions
            </button>
            <button
              type="button"
              onClick={() => {
                resetForm();
                setView("add");
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:shadow-indigo-300 transition-all"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Add New User
            </button>
          </div>
        </div>
      </header>

      <div className="space-y-6">
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
          <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4">
            <div className="grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-center">
              <div className="relative">
                <svg className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search accounts..."
                  className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 py-2.5 text-sm font-semibold text-slate-700 outline-none shadow-sm transition-all hover:border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                />
              </div>
              <select
                value={roleFilter}
                onChange={(event) => setRoleFilter(event.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 outline-none shadow-sm transition-all hover:border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
              >
                <option value="all">All Roles</option>
                {ROLE_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <div className="inline-flex items-center rounded-xl bg-indigo-50 px-4 py-2.5 text-xs font-bold text-indigo-600 ring-1 ring-indigo-100">
                {filteredUsers.length} Active Accounts
              </div>
            </div>
          </div>
          <div className="max-h-[65vh] overflow-auto">
            <table className="w-full min-w-[980px] text-left border-collapse">
              <thead className="sticky top-0 z-10 bg-white">
                <tr className="border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="px-6 py-4">Identity</th>
                  <th className="px-6 py-4">Assigned Role</th>
                  <th className="px-6 py-4">Account Status</th>
                  <th className="px-6 py-4">Academic Assignment</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((user) => {
                  const rowBusy = actingUserId === user.id;
                  return (
                    <tr key={user.id} className="group hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <p className="text-sm font-bold text-slate-800">{user.name}</p>
                        <p className="mt-0.5 text-xs font-medium text-slate-500">{user.email}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-indigo-600">
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex rounded-lg border px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${
                            user.isActive
                              ? "border-emerald-100 bg-emerald-50 text-emerald-600"
                              : "border-rose-100 bg-rose-50 text-rose-600"
                          }`}
                        >
                          {user.isActive ? "Active" : "Archived"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs font-semibold text-slate-600 italic">
                          {classAssignmentLabel(user)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div
                          ref={activeManageRowId === user.id ? activeManageMenuRef : null}
                          className="relative flex justify-end"
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setActiveManageRowId((prev) => (prev === user.id ? null : user.id))
                            }
                            disabled={rowBusy}
                            className="rounded-xl border border-slate-200 bg-white px-4 py-1.5 text-xs font-bold text-slate-600 shadow-sm transition-all hover:bg-slate-50 hover:text-indigo-600 disabled:pointer-events-none disabled:opacity-60"
                          >
                            {activeManageRowId === user.id ? "Close" : "Manage"}
                          </button>
                          {activeManageRowId === user.id ? (
                            <div
                              role="menu"
                              aria-orientation="vertical"
                              className="absolute right-0 top-full z-[60] mt-2 w-56 origin-top-right overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-150"
                            >
                              <div className="flex flex-col gap-1">
                                <button
                                  type="button"
                                  onClick={() => openEditUser(user)}
                                  disabled={rowBusy}
                                  className="flex items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-bold text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                                >
                                  Edit Identity
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openUserPermissions(user)}
                                  disabled={rowBusy}
                                  className="flex items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-bold text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                                >
                                  Account Permissions
                                </button>
                                {ROLES_WITH_CLASS_ASSIGNMENT.has(user.role) ? (
                                  <button
                                    type="button"
                                    onClick={() => openClassAssignment(user)}
                                    disabled={rowBusy}
                                    className="flex items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-bold text-indigo-600 hover:bg-indigo-100 transition-colors"
                                  >
                                    Class Assignment
                                  </button>
                                ) : null}
                                <div className="my-1 h-px bg-slate-100" />
                                <button
                                  type="button"
                                  onClick={() => void handleToggleActive(user)}
                                  disabled={rowBusy}
                                  className="flex items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors"
                                >
                                  {user.isActive ? "Deactivate Account" : "Reactivate Account"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleAdminResetPassword(user)}
                                  disabled={rowBusy}
                                  className="flex items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-bold text-amber-600 hover:bg-amber-50 transition-colors"
                                >
                                  Force Password Reset
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleDeleteUser(user)}
                                  disabled={rowBusy}
                                  className="flex items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-bold text-rose-600 hover:bg-rose-50 transition-colors"
                                >
                                  Purge Record
                                </button>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {isLoadingUsers ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-sm font-medium text-slate-400">
                      Loading users...
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-sm font-medium text-slate-400">
                      No users match your filters.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
        {users.length < totalUsers && (
          <div className="flex justify-center pt-2">
            <button
              type="button"
              onClick={() => setOffset((prev) => prev + USERS_PAGE_SIZE)}
              disabled={isLoadingUsers}
              className="rounded-xl border border-slate-200 bg-white px-8 py-2.5 text-sm font-bold text-slate-600 shadow-sm transition-all hover:bg-slate-50 disabled:opacity-50"
            >
              {isLoadingUsers ? "Loading..." : "Load More Users"}
            </button>
          </div>
        )}
        {status ? (
          <div className="rounded-xl border border-blue-100 bg-blue-50 px-5 py-4 text-sm font-bold text-blue-700">
            {status}
          </div>
        ) : null}

        {classAssignUser ? (
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[2px]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="class-assign-title"
            onClick={() => (classAssignSaving ? null : setClassAssignUser(null))}
          >
            <div
              className="max-h-[85vh] w-full max-w-lg overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="border-b border-slate-100 bg-slate-50 px-6 py-4">
                <h2 id="class-assign-title" className="text-lg font-black text-[#0c2340]">
                  Class assignment
                </h2>
                <p className="mt-1 text-sm font-medium text-slate-500">
                  Choose which classes <span className="font-bold text-slate-700">{classAssignUser.name}</span> can access
                  for curriculum and class-scoped tools.
                </p>
              </div>
              <div className="max-h-[min(52vh,420px)] overflow-y-auto px-6 py-4">
                {classrooms.filter((c) => c.isActive !== false).length === 0 ? (
                  <p className="text-sm font-medium text-slate-500">No active classes in the system. Add classes under Settings → Class structure first.</p>
                ) : (
                  <ul className="space-y-2">
                    {[...classrooms]
                      .filter((c) => c.isActive !== false)
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map((room) => {
                        const checked = classRoomSelection.includes(room.id);
                        return (
                          <li key={room.id}>
                            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3 transition-colors hover:bg-indigo-50/60">
                              <input
                                type="checkbox"
                                className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                checked={checked}
                                disabled={classAssignSaving}
                                onChange={() => toggleClassRoomInAssignment(room.id)}
                              />
                              <span className="min-w-0 flex-1">
                                <span className="block text-sm font-bold text-slate-800">{room.name}</span>
                                {room.categoryName ? (
                                  <span className="mt-0.5 block text-xs font-medium text-slate-500">{room.categoryName}</span>
                                ) : null}
                              </span>
                            </label>
                          </li>
                        );
                      })}
                  </ul>
                )}
              </div>
              <div className="flex gap-3 border-t border-slate-100 bg-slate-50/80 px-6 py-4">
                <button
                  type="button"
                  disabled={classAssignSaving}
                  onClick={() => setClassAssignUser(null)}
                  className="flex-1 rounded-xl border border-slate-200 bg-white py-3 text-sm font-bold text-slate-600 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={classAssignSaving || classrooms.filter((c) => c.isActive !== false).length === 0}
                  onClick={() => void saveClassAssignment()}
                  className="flex-1 rounded-xl bg-gradient-to-r from-[#0c2340] to-[#1a3a5c] py-3 text-sm font-bold text-white shadow-lg shadow-[#0c2340]/25 transition-all hover:shadow-xl disabled:opacity-50"
                >
                  {classAssignSaving ? "Saving…" : "Save assignment"}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {deleteUserModal.open && deleteUserModal.user ? (
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[2px]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-user-title"
            onClick={() => (actingUserId ? null : setDeleteUserModal({ open: false, user: null }))}
          >
            <div
              className="w-full max-w-lg overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="border-b border-slate-100 bg-slate-50 px-6 py-4">
                <h2 id="delete-user-title" className="text-lg font-black text-[#0c2340]">
                  Confirm delete
                </h2>
                <p className="mt-1 text-sm font-medium text-slate-600">
                  Delete <span className="font-bold text-slate-800">{deleteUserModal.user.name}</span>{" "}
                  <span className="rounded-lg border border-indigo-100 bg-indigo-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-600">
                    {deleteUserModal.user.role}
                  </span>
                  ? This action archives the account and removes it from active users.
                </p>
              </div>
              <div className="flex gap-3 border-t border-slate-100 bg-slate-50/80 px-6 py-4">
                <button
                  type="button"
                  disabled={actingUserId === deleteUserModal.user.id}
                  onClick={() => setDeleteUserModal({ open: false, user: null })}
                  className="flex-1 rounded-xl border border-slate-200 bg-white py-3 text-sm font-bold text-slate-600 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={actingUserId === deleteUserModal.user.id}
                  onClick={() => void confirmDeleteUser()}
                  className="flex-1 rounded-xl bg-rose-600 py-3 text-sm font-bold text-white shadow-lg shadow-rose-200 transition-all hover:bg-rose-700 disabled:opacity-50"
                >
                  Confirm Delete
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {resetPasswordModal.open && resetPasswordModal.user ? (
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[2px]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reset-password-title"
            onClick={() => (actingUserId ? null : setResetPasswordModal({ open: false, user: null }))}
          >
            <div
              className="w-full max-w-lg overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="border-b border-slate-100 bg-slate-50 px-6 py-4">
                <h2 id="reset-password-title" className="text-lg font-black text-[#0c2340]">
                  Force password reset
                </h2>
                <p className="mt-1 text-sm font-medium text-slate-600">
                  Set a temporary strong password for{" "}
                  <span className="font-bold text-slate-800">{resetPasswordModal.user.name}</span>.
                </p>
              </div>
              <div className="px-6 py-4 space-y-4">
                <label className="block space-y-2">
                  <span className="text-xs font-bold text-slate-700">Temporary password</span>
                  <input
                    value={resetPasswordInput}
                    onChange={(e) => setResetPasswordInput(e.target.value)}
                    placeholder="Enter a strong password"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 outline-none shadow-sm transition-all hover:border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                  />
                </label>
                <div className="grid gap-2 sm:grid-cols-2">
                  <PasswordRule ok={resetPasswordChecks.minLength} label="At least 8 characters" />
                  <PasswordRule ok={resetPasswordChecks.uppercase} label="Uppercase letter" />
                  <PasswordRule ok={resetPasswordChecks.lowercase} label="Lowercase letter" />
                  <PasswordRule ok={resetPasswordChecks.number} label="Number" />
                  <PasswordRule ok={resetPasswordChecks.symbol} label="Symbol" />
                </div>
              </div>
              <div className="flex gap-3 border-t border-slate-100 bg-slate-50/80 px-6 py-4">
                <button
                  type="button"
                  disabled={actingUserId === resetPasswordModal.user.id}
                  onClick={() => setResetPasswordModal({ open: false, user: null })}
                  className="flex-1 rounded-xl border border-slate-200 bg-white py-3 text-sm font-bold text-slate-600 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={actingUserId === resetPasswordModal.user.id || !resetPasswordChecks.isStrong}
                  onClick={() => void confirmAdminResetPassword()}
                  className="flex-1 rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-200 transition-all hover:bg-indigo-700 disabled:opacity-50"
                >
                  Reset Password
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function PasswordRule({ ok, label }: { ok: boolean; label: string }) {
  return (
    <p className={`rounded-lg px-3 py-2 text-xs font-bold ${ok ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
      {ok ? "OK" : "Need"} - {label}
    </p>
  );
}
