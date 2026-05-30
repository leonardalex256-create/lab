import { useCallback, useEffect, useState } from "react";
import {
  bulkAssignStudentStatus,
  fetchMissingStatusCount,
  fetchStudentStatuses,
  fetchStudentsMissingStatus,
  type StudentStatusRow,
} from "../../api/studentStatuses";

export function LegacyStatusBanner() {
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [statuses, setStatuses] = useState<StudentStatusRow[]>([]);
  const [rows, setRows] = useState<
    Array<{ id: number; admissionNumber: string; fullName: string; classRoomId: number | null }>
  >([]);
  const [selection, setSelection] = useState<Record<number, number>>({});
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    const c = await fetchMissingStatusCount();
    setCount(c);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!open) return;
    void Promise.all([
      fetchStudentStatuses(),
      fetchStudentsMissingStatus(100, 0),
    ]).then(([s, data]) => {
      setStatuses(s.filter((x) => !x.archivedAt));
      setRows(data.items);
    });
  }, [open]);

  if (count === 0) return null;

  return (
    <div className="rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm mb-4">
      <p className="font-semibold text-indigo-950">
        {count} student{count === 1 ? "" : "s"} need a Student Status before fees can be calculated.
      </p>
      <button
        type="button"
        className="mt-2 rounded-lg border border-indigo-300 bg-white px-3 py-1.5 text-xs font-bold text-indigo-900"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "Hide bulk update" : "Assign statuses"}
      </button>
      {open ? (
        <div className="mt-3 max-h-80 overflow-auto rounded border bg-white">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-slate-50 text-left">
                <th className="p-2">Student</th>
                <th className="p-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b">
                  <td className="p-2">
                    {row.fullName} <span className="text-slate-400">{row.admissionNumber}</span>
                  </td>
                  <td className="p-2">
                    <select
                      className="border rounded px-2 py-1 w-full"
                      value={selection[row.id] ?? ""}
                      onChange={(e) =>
                        setSelection((s) => ({
                          ...s,
                          [row.id]: Number(e.target.value),
                        }))
                      }
                    >
                      <option value="">Choose…</option>
                      {statuses.map((st) => (
                        <option key={st.id} value={st.id}>
                          {st.code} — {st.name}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="p-2 border-t">
            <button
              type="button"
              disabled={saving}
              className="rounded bg-indigo-600 text-white px-3 py-1.5 text-xs font-bold"
              onClick={() => {
                const updates = Object.entries(selection)
                  .filter(([, statusId]) => statusId > 0)
                  .map(([studentId, studentStatusId]) => ({
                    studentId: Number(studentId),
                    studentStatusId,
                  }));
                if (updates.length === 0) return;
                setSaving(true);
                void bulkAssignStudentStatus(updates)
                  .then(() => {
                    setSelection({});
                    setOpen(false);
                    return reload();
                  })
                  .finally(() => setSaving(false));
              }}
            >
              Save selected
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
