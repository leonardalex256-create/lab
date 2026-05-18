import { useState, useEffect, useCallback } from "react";
import { apiUrl, authHeaders } from "../../api/baseUrl";

interface AttendanceRecord {
  id: number;
  student_id: number;
  first_name: string;
  last_name: string;
  passport_photo_filename?: string;
  class_name: string;
  status: string;
  recorded_at?: string;
  recorded_by_email?: string;
}

interface AttendanceSummary {
  total: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
}

interface ClassRosterItem {
  student_id: number;
  first_name: string;
  last_name: string;
  passport_photo_filename?: string;
  attendance_id?: number;
  status: string;
}

interface Props {
  mode: "list" | "take";
  classId?: number;
}

export function AttendanceSectionPage({ mode, classId }: Props) {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [roster, setRoster] = useState<ClassRosterItem[]>([]);
  const [marks, setMarks] = useState<Record<number, string>>({});
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [classFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ date });
      if (classFilter) params.set("class", classFilter);
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(apiUrl(`/api/me/attendance?${params}`), { headers: authHeaders() });
      const json = await res.json();
      if (json.success) {
        setRecords(json.data ?? []);
        setSummary(json.summary ?? null);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [date, classFilter, statusFilter]);

  const loadRoster = useCallback(async () => {
    if (!classId) return;
    setLoading(true);
    try {
      const res = await fetch(apiUrl(`/api/me/attendance/class/${classId}?date=${date}`), { headers: authHeaders() });
      const json = await res.json();
      if (json.success) {
        setRoster(json.data ?? []);
        // Pre-fill existing marks
        const existing: Record<number, string> = {};
        for (const s of (json.data ?? []) as ClassRosterItem[]) {
          if (s.status) existing[s.student_id] = s.status;
        }
        setMarks(existing);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [classId, date]);

  useEffect(() => {
    if (mode === "list") loadList();
    else loadRoster();
  }, [mode, loadList, loadRoster]);

  const markAll = (status: string) => {
    const updated: Record<number, string> = {};
    for (const s of roster) updated[s.student_id] = status;
    setMarks(updated);
  };

  const submit = async () => {
    if (!classId) return;
    const recordsArr = roster.map((s) => ({ student_id: s.student_id, status: marks[s.student_id] ?? "absent" }));
    setSaving(true);
    try {
      const res = await fetch(apiUrl("/api/me/attendance/bulk"), {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ class_room_id: classId, record_date: date, records: recordsArr }),
      });
      const json = await res.json();
      if (json.success) {
        showToast("Attendance saved successfully!");
      } else {
        showToast(json.error ?? "Failed to save", "error");
      }
    } catch {
      showToast("Network error", "error");
    } finally {
      setSaving(false);
    }
  };

  const statusColors: Record<string, string> = {
    present: "bg-emerald-500",
    absent: "bg-red-500",
    late: "bg-amber-500",
    excused: "bg-slate-400",
  };
  const statusLabels: Record<string, string> = { present: "P", absent: "A", late: "L", excused: "E" };

  // ── TAKE ATTENDANCE VIEW ──────────────────────────────────────────────────
  if (mode === "take") {
    return (
      <div className="space-y-4">
        {/* Toast */}
        {toast && (
          <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-xl shadow-lg text-white font-semibold text-sm ${toast.type === "success" ? "bg-emerald-600" : "bg-red-600"}`}>
            {toast.msg}
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Mark Attendance</h2>
            <p className="text-sm text-slate-500">Class {classId} · {date}</p>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button onClick={() => markAll("present")} className="px-3 py-2 text-sm bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-200 hover:bg-emerald-100 font-medium">
              ✓ Mark All Present
            </button>
          </div>
        </div>

        {/* Roster */}
        {loading ? (
          <div className="space-y-2">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="divide-y divide-slate-100">
              {roster.map((s) => (
                <div key={s.student_id} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                      {s.first_name[0]}{s.last_name[0]}
                    </div>
                    <span className="font-medium text-slate-800">{s.last_name}, {s.first_name}</span>
                  </div>
                  <div className="flex gap-2">
                    {(["present", "absent", "late", "excused"] as const).map((st) => (
                      <button
                        key={st}
                        onClick={() => setMarks((prev) => ({ ...prev, [s.student_id]: st }))}
                        className={`w-9 h-9 rounded-lg text-xs font-bold transition-all border-2 ${marks[s.student_id] === st ? `${statusColors[st]} text-white border-transparent` : "bg-slate-50 text-slate-400 border-slate-200 hover:border-slate-300"}`}
                      >
                        {statusLabels[st]}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {roster.length === 0 && (
                <div className="py-12 text-center text-slate-400">No students found for this class</div>
              )}
            </div>
          </div>
        )}

        {/* Save button */}
        <div className="flex justify-end">
          <button
            onClick={submit}
            disabled={saving || roster.length === 0}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-semibold shadow-md transition-all"
          >
            {saving ? "Saving…" : "Save & Close"}
          </button>
        </div>
      </div>
    );
  }

  // ── LIST VIEW ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-slate-800">Attendance</h2>

      {/* Summary */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Present", value: summary.present, color: "emerald" },
            { label: "Absent", value: summary.absent, color: "red" },
            { label: "Late", value: summary.late, color: "amber" },
            { label: "Excused", value: summary.excused, color: "slate" },
          ].map((c) => (
            <div key={c.label} className={`bg-${c.color}-50 border border-${c.color}-100 rounded-xl p-4 text-center`}>
              <div className={`text-2xl font-bold text-${c.color}-700`}>{c.value}</div>
              <div className={`text-xs font-medium text-${c.color}-500 mt-1`}>{c.label}</div>
              <div className={`text-xs text-${c.color}-400`}>{summary.total > 0 ? `${Math.round((c.value / summary.total) * 100)}%` : "—"}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All Statuses</option>
          <option value="present">Present</option>
          <option value="absent">Absent</option>
          <option value="late">Late</option>
          <option value="excused">Excused</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">{[...Array(6)].map((_, i) => <div key={i} className="h-14 bg-slate-100 rounded-xl animate-pulse" />)}</div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Student</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Class</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Time</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Recorded By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {records.map((rec) => (
                <tr key={rec.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                        {rec.first_name[0]}{rec.last_name[0]}
                      </div>
                      <span className="font-medium text-slate-800">{rec.first_name} {rec.last_name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{rec.class_name}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold text-white ${statusColors[rec.status] ?? "bg-slate-400"}`}>
                      {rec.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{rec.recorded_at ? new Date(rec.recorded_at).toLocaleTimeString() : "—"}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{rec.recorded_by_email ?? "—"}</td>
                </tr>
              ))}
              {records.length === 0 && (
                <tr><td colSpan={5} className="py-12 text-center text-slate-400">No attendance records for {date}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
