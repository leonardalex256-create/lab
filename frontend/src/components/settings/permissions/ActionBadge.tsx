import type { PermissionAction } from "./permissionModuleCatalog";

const ACTION_STYLES: Record<PermissionAction, string> = {
  view: "bg-blue-50 text-blue-700 ring-blue-200",
  create: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  edit: "bg-amber-50 text-amber-800 ring-amber-200",
  delete: "bg-red-50 text-red-700 ring-red-200",
  print: "bg-slate-100 text-slate-600 ring-slate-200",
  export: "bg-slate-100 text-slate-600 ring-slate-200",
  approve: "bg-purple-50 text-purple-700 ring-purple-200",
  restore: "bg-orange-50 text-orange-800 ring-orange-200",
};

export type ActionBadgeProps = {
  action: PermissionAction;
};

export function ActionBadge({ action }: ActionBadgeProps) {
  return (
    <span
      className={`inline-flex shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${ACTION_STYLES[action]}`}
      aria-label={`Action: ${action}`}
    >
      {action}
    </span>
  );
}
