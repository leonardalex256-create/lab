import { useState, useEffect } from "react";
import { apiUrl, authHeaders } from "../../api/baseUrl";

type EventType =
  | "fee_payment_received"
  | "invoice_generated"
  | "attendance_below_threshold"
  | "new_student_enrolled"
  | "password_reset_requested"
  | "results_published"
  | "low_balance_warning";

type Channel = "email" | "in_app";

const EVENT_LABELS: Record<EventType, string> = {
  fee_payment_received: "Fee payment received",
  invoice_generated: "Invoice generated",
  attendance_below_threshold: "Attendance below threshold",
  new_student_enrolled: "New student enrolled",
  password_reset_requested: "Password reset requested",
  results_published: "Results published",
  low_balance_warning: "Low balance warning",
};

const EVENT_ICONS: Record<EventType, string> = {
  fee_payment_received: "💰",
  invoice_generated: "🧾",
  attendance_below_threshold: "📅",
  new_student_enrolled: "🎓",
  password_reset_requested: "🔐",
  results_published: "📊",
  low_balance_warning: "⚠️",
};

const EVENTS = Object.keys(EVENT_LABELS) as EventType[];
const CHANNELS: Channel[] = ["email", "in_app"];

type SettingsMatrix = Record<EventType, Record<Channel, boolean>>;

function defaultMatrix(): SettingsMatrix {
  const m = {} as SettingsMatrix;
  for (const e of EVENTS) {
    m[e] = { email: true, in_app: true };
  }
  return m;
}

export function SettingsNotificationsPanel() {
  const [matrix, setMatrix] = useState<SettingsMatrix>(defaultMatrix());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(apiUrl("/api/me/settings/notifications"), { headers: authHeaders() });
        const json = await res.json();
        if (json.success && json.data) {
          const m = defaultMatrix();
          for (const row of json.data as Array<{ event_type: string; channel: string; is_enabled: boolean }>) {
            if (EVENTS.includes(row.event_type as EventType) && CHANNELS.includes(row.channel as Channel)) {
              m[row.event_type as EventType]![row.channel as Channel] = row.is_enabled;
            }
          }
          setMatrix(m);
        }
      } catch { /* */ }
      setLoading(false);
    })();
  }, []);

  const toggle = (event: EventType, channel: Channel) => {
    setMatrix((prev) => ({
      ...prev,
      [event]: { ...prev[event], [channel]: !prev[event]![channel] },
    }));
  };

  const save = async () => {
    setSaving(true);
    const rows = [];
    for (const ev of EVENTS) {
      for (const ch of CHANNELS) {
        rows.push({ event_type: ev, channel: ch, is_enabled: matrix[ev]![ch]! });
      }
    }
    try {
      const res = await fetch(apiUrl("/api/me/settings/notifications"), {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ settings: rows }),
      });
      const json = await res.json();
      setToast(json.success ? "Notification settings saved!" : (json.error ?? "Error saving"));
      setTimeout(() => setToast(null), 3000);
    } catch {
      setToast("Network error");
    }
    setSaving(false);
  };

  if (loading) {
    return <div className="space-y-3">{[...Array(7)].map((_, i) => <div key={i} className="h-14 bg-slate-100 rounded-xl animate-pulse" />)}</div>;
  }

  return (
    <div className="space-y-5">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-blue-600 text-white px-5 py-3 rounded-xl shadow-lg font-semibold text-sm">{toast}</div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Notification Settings</h2>
          <p className="text-sm text-slate-500">Control which events trigger emails and in-app notifications</p>
        </div>
        <button onClick={save} disabled={saving}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-semibold shadow-md transition-all">
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Event Type</th>
              <th className="text-center px-6 py-4 text-sm font-semibold text-slate-600">
                <div className="flex items-center justify-center gap-2">📧 Email</div>
              </th>
              <th className="text-center px-6 py-4 text-sm font-semibold text-slate-600">
                <div className="flex items-center justify-center gap-2">🔔 In-App</div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {EVENTS.map((ev) => (
              <tr key={ev} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{EVENT_ICONS[ev]}</span>
                    <span className="font-medium text-slate-800">{EVENT_LABELS[ev]}</span>
                  </div>
                </td>
                {CHANNELS.map((ch) => (
                  <td key={ch} className="px-6 py-4 text-center">
                    <button
                      onClick={() => toggle(ev, ch)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${matrix[ev]![ch] ? "bg-blue-600" : "bg-slate-200"}`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform ${matrix[ev]![ch] ? "translate-x-6" : "translate-x-1"}`}
                      />
                    </button>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-400 text-center">
        Changes take effect immediately for new events. Existing queued notifications are not affected.
      </p>
    </div>
  );
}
