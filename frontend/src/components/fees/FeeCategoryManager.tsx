import { useCallback, useEffect, useState } from "react";
import {
  fetchFeeCategories,
  saveFeeCategory,
  type FeeCategoryRow,
} from "../../api/feeCategories";
import { fetchStudentStatuses, type StudentStatusRow } from "../../api/studentStatuses";
import "../../styles/fee-config-theme.css";

export function FeeCategoryManager() {
  const [categories, setCategories] = useState<FeeCategoryRow[]>([]);
  const [statuses, setStatuses] = useState<StudentStatusRow[]>([]);
  const [form, setForm] = useState({
    name: "",
    code: "",
    billingFrequency: "term",
    applicableStatusIds: [] as number[],
  });

  const reload = useCallback(async () => {
    const [c, s] = await Promise.all([fetchFeeCategories(), fetchStudentStatuses()]);
    setCategories(c);
    setStatuses(s.filter((x) => !x.archivedAt));
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (categories.length === 0 && statuses.length === 0) {
    return (
      <div className="fee-config-theme fee-panel">
        <p>Create student statuses first, then add fee categories.</p>
      </div>
    );
  }

  return (
    <div className="fee-config-theme max-w-4xl space-y-4">
      <h2 className="text-xl font-semibold">Fee Categories</h2>
      <div className="fee-panel bg-white space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <input
            className="border rounded px-2 py-1"
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <input
            className="border rounded px-2 py-1 font-mono uppercase"
            placeholder="Code"
            value={form.code}
            onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {statuses.map((s) => (
            <label key={s.id} className="text-sm flex items-center gap-1">
              <input
                type="checkbox"
                checked={form.applicableStatusIds.includes(s.id)}
                onChange={(e) => {
                  setForm((f) => ({
                    ...f,
                    applicableStatusIds: e.target.checked
                      ? [...f.applicableStatusIds, s.id]
                      : f.applicableStatusIds.filter((id) => id !== s.id),
                  }));
                }}
              />
              {s.code}
            </label>
          ))}
        </div>
        <button
          type="button"
          className="fee-btn-primary"
          onClick={() => {
            void saveFeeCategory({
              name: form.name,
              code: form.code,
              billingFrequency: form.billingFrequency,
              applicableStatusIds: form.applicableStatusIds,
              isMandatory: true,
              isActive: true,
            }).then(() => {
              setForm({ name: "", code: "", billingFrequency: "term", applicableStatusIds: [] });
              return reload();
            });
          }}
        >
          Add category
        </button>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="py-2">Category</th>
            <th>Frequency</th>
            <th>Statuses</th>
          </tr>
        </thead>
        <tbody>
          {categories.map((c) => (
            <tr key={c.id} className="border-b">
              <td className="py-2">
                {c.name} <span className="font-mono text-xs">{c.code}</span>
              </td>
              <td>{c.billingFrequency}</td>
              <td>{c.applicableStatuses.map((s) => s.code).join(", ")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
