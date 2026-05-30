import { type RefObject } from "react";
import type { ManagedUser } from "../../../api/account";
import { ROLE_OPTIONS, ROLES_WITH_CLASS_ASSIGNMENT } from "./constants";

export type UserListTabProps = {
  filteredUsers: ManagedUser[];
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  roleFilter: string;
  onRoleFilterChange: (value: string) => void;
  isLoadingUsers: boolean;
  actingUserId: number | null;
  activeManageRowId: number | null;
  activeManageMenuRef: RefObject<HTMLDivElement | null>;
  onManageRowToggle: (userId: number) => void;
  classAssignmentLabel: (user: ManagedUser) => string;
  onManagePermissions: () => void;
  onAddUser: () => void;
  onEditUser: (user: ManagedUser) => void;
  onUserPermissions: (user: ManagedUser) => void;
  onClassAssignment: (user: ManagedUser) => void;
  onToggleActive: (user: ManagedUser) => void;
  onAdminResetPassword: (user: ManagedUser) => void;
  onDeleteUser: (user: ManagedUser) => void;
  canLoadMore: boolean;
  onLoadMore: () => void;
};

export function UserListTab({
  filteredUsers,
  searchQuery,
  onSearchQueryChange,
  roleFilter,
  onRoleFilterChange,
  isLoadingUsers,
  actingUserId,
  activeManageRowId,
  activeManageMenuRef,
  onManageRowToggle,
  classAssignmentLabel,
  onManagePermissions,
  onAddUser,
  onEditUser,
  onUserPermissions,
  onClassAssignment,
  onToggleActive,
  onAdminResetPassword,
  onDeleteUser,
  canLoadMore,
  onLoadMore,
}: UserListTabProps) {
  return (
    <>
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
                onClick={onManagePermissions}
                className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-600 shadow-sm hover:bg-slate-50 transition-all"
              >
                Manage System Permissions
              </button>
              <button
                type="button"
                onClick={onAddUser}
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
                <svg
                  className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <input
                  value={searchQuery}
                  onChange={(event) => onSearchQueryChange(event.target.value)}
                  placeholder="Search accounts..."
                  className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 py-2.5 text-sm font-semibold text-slate-700 outline-none shadow-sm transition-all hover:border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                />
              </div>
              <select
                value={roleFilter}
                onChange={(event) => onRoleFilterChange(event.target.value)}
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
                              onClick={() => onManageRowToggle(user.id)}
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
                                    onClick={() => onEditUser(user)}
                                    disabled={rowBusy}
                                    className="flex items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-bold text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                                  >
                                    Edit Identity
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onUserPermissions(user)}
                                    disabled={rowBusy}
                                    className="flex items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-bold text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                                  >
                                    Account Permissions
                                  </button>
                                  {ROLES_WITH_CLASS_ASSIGNMENT.has(user.role) ? (
                                    <button
                                      type="button"
                                      onClick={() => onClassAssignment(user)}
                                      disabled={rowBusy}
                                      className="flex items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-bold text-indigo-600 hover:bg-indigo-100 transition-colors"
                                    >
                                      Class Assignment
                                    </button>
                                  ) : null}
                                  <div className="my-1 h-px bg-slate-100" />
                                  <button
                                    type="button"
                                    onClick={() => onToggleActive(user)}
                                    disabled={rowBusy}
                                    className="flex items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors"
                                  >
                                    {user.isActive ? "Deactivate Account" : "Reactivate Account"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onAdminResetPassword(user)}
                                    disabled={rowBusy}
                                    className="flex items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-bold text-amber-600 hover:bg-amber-50 transition-colors"
                                  >
                                    Force Password Reset
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onDeleteUser(user)}
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
        {canLoadMore ? (
          <div className="flex justify-center pt-2">
            <button
              type="button"
              onClick={onLoadMore}
              disabled={isLoadingUsers}
              className="rounded-xl border border-slate-200 bg-white px-8 py-2.5 text-sm font-bold text-slate-600 shadow-sm transition-all hover:bg-slate-50 disabled:opacity-50"
            >
              {isLoadingUsers ? "Loading..." : "Load More Users"}
            </button>
          </div>
        ) : null}
      </div>
    </>
  );
}
