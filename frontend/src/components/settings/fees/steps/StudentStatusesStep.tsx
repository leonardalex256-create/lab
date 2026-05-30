import { useCallback, useEffect, useState } from "react";
import {
  archiveStudentStatus,
  createStudentStatus,
  fetchStudentStatuses,
  updateStudentStatus,
  type StudentStatusRow,
} from "../../../../api/studentStatuses";
import { StudentStatusBadge } from "../../../statuses/StudentStatusBadge";
import { StatusForm } from "../../../statuses/StatusForm";
import { DangerConfirmDialog } from "../shared/DangerConfirmDialog";
import { InstructionBlock } from "../shared/InstructionBlock";
import { SetupSectionCard } from "../shared/SetupSectionCard";
import { btnDanger, btnPrimary, btnSecondary } from "../shared/fieldStyles";

export function StudentStatusesStep({
  onDataChange,
  statusCount,
}: {
  onDataChange?: () => void;
  statusCount: number;
}) {
  const [rows, setRows] = useState<StudentStatusRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<StudentStatusRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<StudentStatusRow | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await fetchStudentStatuses(true));
      onDataChange?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [onDataChange]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <div className="space-y-6">
      <InstructionBlock
        steps={[
          "Add each status your school uses (e.g. day scholar, boarder) — names and codes come from your setup, not hardcoded lists.",
          "Each status needs a name, code (short, unique), and color.",
          "Ensure at least one active status before continuing to fee categories.",
          "Archive only when no students use a status — you will be warned if students are linked.",
        ]}
      />

      <SetupSectionCard
        stepNum={1}
        title="Student statuses"
        hint="Define how students are grouped (e.g. Day Scholar, Boarder). Every fee rule applies to one status."
      >
        <p className="mb-4 text-sm text-slate-600">
          Active statuses: <strong>{statusCount}</strong>
          {statusCount < 1 ? (
            <span className="ml-2 text-amber-700">— add at least one to continue</span>
          ) : null}
        </p>

        <div className="mb-6 flex flex-wrap gap-2">
          <button
            type="button"
            className={btnPrimary}
            onClick={() => setCreating(true)}
          >
            Add student status
          </button>
        </div>

        {error ? <p className="mb-3 text-sm text-rose-600">{error}</p> : null}

        {creating ? (
          <div className="mb-6 rounded-2xl border border-slate-200 bg-slate-50/50 p-5">
            <StatusForm
              onCancel={() => setCreating(false)}
              onSubmit={async (v) => {
                await createStudentStatus(v);
                setCreating(false);
                await reload();
              }}
            />
          </div>
        ) : null}

        {editing ? (
          <div className="mb-6 rounded-2xl border border-indigo-200 bg-indigo-50/30 p-5">
            <p className="mb-3 text-sm font-semibold text-indigo-900">Edit status</p>
            <StatusForm
              initial={{
                name: editing.name,
                code: editing.code,
                description: editing.description ?? "",
                colorHex: editing.colorHex,
              }}
              onCancel={() => setEditing(null)}
              onSubmit={async (v) => {
                await updateStudentStatus(editing.id, v);
                setEditing(null);
                await reload();
              }}
            />
          </div>
        ) : null}

        {loading ? (
          <p className="text-sm text-slate-500">Loading statuses…</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Students</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100">
                    <td className="px-4 py-3">
                      <StudentStatusBadge
                        code={row.code}
                        name={row.name}
                        colorHex={row.colorHex}
                      />
                      {row.archivedAt ? (
                        <span className="ml-2 text-xs text-slate-400">Archived</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{row.code}</td>
                    <td className="px-4 py-3">{row.studentCount}</td>
                    <td className="px-4 py-3 text-right space-x-2">
                      {!row.archivedAt ? (
                        <button
                          type="button"
                          className="text-sm font-semibold text-indigo-600 hover:underline"
                          onClick={() => setEditing(row)}
                        >
                          Edit
                        </button>
                      ) : null}
                      {!row.archivedAt ? (
                        <button
                          type="button"
                          className={btnDanger}
                          onClick={() => setArchiveTarget(row)}
                        >
                          Archive
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SetupSectionCard>

      <DangerConfirmDialog
        open={!!archiveTarget}
        title="Archive this student status?"
        message={
          archiveTarget
            ? archiveTarget.studentCount > 0
              ? `Warning: ${archiveTarget.studentCount} student(s) currently use "${archiveTarget.name}".\n\nArchiving may break fee assignments for those students. Existing fee rules for this status may stop applying correctly.\n\nOnly proceed if you understand the impact.`
              : `Archive "${archiveTarget.name}" (${archiveTarget.code})? Fee rules linked to this status will no longer apply to new calculations.`
            : ""
        }
        confirmLabel="Archive status"
        busy={busy}
        onCancel={() => setArchiveTarget(null)}
        onConfirm={() => {
          if (!archiveTarget) return;
          setBusy(true);
          void archiveStudentStatus(archiveTarget.id)
            .then(() => {
              setArchiveTarget(null);
              return reload();
            })
            .catch((e) => setError(e instanceof Error ? e.message : "Archive failed"))
            .finally(() => setBusy(false));
        }}
      />
    </div>
  );
}
