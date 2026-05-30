import { useCallback, useEffect, useState } from "react";
import {
  archiveStudentStatus,
  createStudentStatus,
  fetchStudentStatuses,
  updateStudentStatus,
  type StudentStatusRow,
} from "../../api/studentStatuses";
import { StudentStatusBadge } from "./StudentStatusBadge";
import { StatusForm } from "./StatusForm";
import "../../styles/fee-config-theme.css";

export function StatusManager() {
  const [rows, setRows] = useState<StudentStatusRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<StudentStatusRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await fetchStudentStatuses(true));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <div className="fee-config-theme max-w-4xl">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Student Statuses</h2>
        <button type="button" className="fee-btn-primary" onClick={() => setCreating(true)}>
          Add status
        </button>
      </div>
      {error ? <p className="text-red-600 text-sm mb-2">{error}</p> : null}
      {creating ? (
        <div className="fee-panel mb-4 bg-white">
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
        <div className="fee-panel mb-4 bg-white">
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
        <p>Loading…</p>
      ) : (
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left border-b">
              <th className="py-2">Status</th>
              <th>Students</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-slate-100">
                <td className="py-2">
                  <StudentStatusBadge code={row.code} name={row.name} colorHex={row.colorHex} />
                  {row.archivedAt ? (
                    <span className="ml-2 text-xs text-slate-400">Archived</span>
                  ) : null}
                </td>
                <td>{row.studentCount}</td>
                <td className="text-right space-x-2">
                  {!row.archivedAt ? (
                    <button
                      type="button"
                      className="text-blue-600"
                      onClick={() => setEditing(row)}
                    >
                      Edit
                    </button>
                  ) : null}
                  {!row.archivedAt ? (
                    <button
                      type="button"
                      className="text-amber-700"
                      onClick={async () => {
                        if (
                          row.studentCount > 0 &&
                          !window.confirm(
                            `${row.studentCount} students use this status. Archive anyway?`,
                          )
                        ) {
                          return;
                        }
                        await archiveStudentStatus(row.id);
                        await reload();
                      }}
                    >
                      Archive
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
