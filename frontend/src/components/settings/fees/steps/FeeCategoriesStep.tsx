import { useCallback, useEffect, useState } from "react";
import {
  deactivateFeeCategory,
  fetchFeeCategories,
  saveFeeCategory,
  type FeeCategoryRow,
} from "../../../../api/feeCategories";
import { fetchStudentStatuses, type StudentStatusRow } from "../../../../api/studentStatuses";
import { StudentStatusBadge } from "../../../statuses/StudentStatusBadge";
import { DangerConfirmDialog } from "../shared/DangerConfirmDialog";
import { InstructionBlock } from "../shared/InstructionBlock";
import { SetupSectionCard } from "../shared/SetupSectionCard";
import { btnDanger, btnPrimary, btnSecondary, fieldClass, selectClass } from "../shared/fieldStyles";

const FREQUENCIES = [
  { value: "term", label: "Per term" },
  { value: "monthly", label: "Monthly" },
  { value: "annual", label: "Annual" },
  { value: "once", label: "One-time" },
  { value: "custom", label: "Custom" },
] as const;

type FormState = {
  name: string;
  code: string;
  billingFrequency: string;
  description: string;
  isMandatory: boolean;
  applicableStatusIds: number[];
};

const emptyForm = (): FormState => ({
  name: "",
  code: "",
  billingFrequency: "term",
  description: "",
  isMandatory: true,
  applicableStatusIds: [],
});

export function FeeCategoriesStep({ onDataChange }: { onDataChange?: () => void }) {
  const [categories, setCategories] = useState<FeeCategoryRow[]>([]);
  const [statuses, setStatuses] = useState<StudentStatusRow[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<FeeCategoryRow | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [c, s] = await Promise.all([fetchFeeCategories(), fetchStudentStatuses()]);
      setCategories(c.filter((x) => x.isActive));
      setStatuses(s.filter((x) => !x.archivedAt));
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

  function startEdit(row: FeeCategoryRow) {
    setEditingId(row.id);
    setForm({
      name: row.name,
      code: row.code,
      billingFrequency: row.billingFrequency,
      description: row.description ?? "",
      isMandatory: row.isMandatory,
      applicableStatusIds: row.applicableStatuses.map((s) => s.id),
    });
  }

  function cancelForm() {
    setEditingId(null);
    setForm(emptyForm());
  }

  async function submitForm() {
    setBusy(true);
    setError(null);
    try {
      await saveFeeCategory(
        {
          name: form.name.trim(),
          code: form.code.trim().toUpperCase(),
          billingFrequency: form.billingFrequency,
          description: form.description.trim() || null,
          isMandatory: form.isMandatory,
          isActive: true,
          applicableStatusIds: form.applicableStatusIds,
        },
        editingId ?? undefined,
      );
      cancelForm();
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  if (statuses.length === 0 && !loading) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
        No student statuses found. Go back to step 1 and add at least one status before creating fee
        categories.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <InstructionBlock
        steps={[
          "Confirm student statuses exist (shown below).",
          "Add each category: name, code, billing frequency, and which statuses it applies to.",
          "Mark mandatory categories if every student must have that line item.",
          "Need at least one category before creating fee rules.",
        ]}
      />

      <SetupSectionCard
        stepNum={2}
        title="Fee categories"
        hint="Define fee types billed per term (tuition, meals, development levy, etc.)."
      >
        <div className="mb-6">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Linked student statuses
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {statuses.map((s) => (
              <StudentStatusBadge key={s.id} code={s.code} name={s.name} colorHex={s.colorHex} />
            ))}
          </div>
        </div>

        {error ? <p className="mb-3 text-sm text-rose-600">{error}</p> : null}

        <div className="mb-8 rounded-2xl border border-slate-200 bg-slate-50/50 p-5 space-y-4">
          <p className="text-sm font-semibold text-slate-800">
            {editingId ? "Edit category" : "Add category"}
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700">
              Name
              <input
                className={`${fieldClass} mt-1`}
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Tuition"
                required
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Code
              <input
                className={`${fieldClass} mt-1 font-mono uppercase`}
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                placeholder="TUIT"
                required
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Billing frequency
              <select
                className={`${selectClass} mt-1`}
                value={form.billingFrequency}
                onChange={(e) => setForm((f) => ({ ...f, billingFrequency: e.target.value }))}
              >
                {FREQUENCIES.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 self-end pb-2">
              <input
                type="checkbox"
                checked={form.isMandatory}
                onChange={(e) => setForm((f) => ({ ...f, isMandatory: e.target.checked }))}
              />
              Mandatory for applicable students
            </label>
          </div>
          <label className="block text-sm font-medium text-slate-700">
            Description (optional)
            <textarea
              className={`${fieldClass} mt-1`}
              rows={2}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </label>
          <div>
            <p className="text-sm font-medium text-slate-700 mb-2">Applies to statuses</p>
            <div className="flex flex-wrap gap-3">
              {statuses.map((s) => (
                <label key={s.id} className="flex items-center gap-2 text-sm">
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
                  {s.code} — {s.name}
                </label>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={btnPrimary}
              disabled={
                busy ||
                !form.name.trim() ||
                !form.code.trim() ||
                form.applicableStatusIds.length === 0
              }
              onClick={() => void submitForm()}
            >
              {editingId ? "Save changes" : "Add category"}
            </button>
            {editingId ? (
              <button type="button" className={btnSecondary} onClick={cancelForm}>
                Cancel
              </button>
            ) : null}
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-slate-500">Loading categories…</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Frequency</th>
                  <th className="px-4 py-3">Statuses</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((c) => (
                  <tr key={c.id} className="border-t border-slate-100">
                    <td className="px-4 py-3">
                      <span className="font-medium">{c.name}</span>
                      <span className="ml-2 font-mono text-xs text-slate-500">{c.code}</span>
                      {c.isMandatory ? (
                        <span className="ml-2 rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-800">
                          Required
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 capitalize">{c.billingFrequency}</td>
                    <td className="px-4 py-3">
                      {c.applicableStatuses.map((s) => s.code).join(", ") || "—"}
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button
                        type="button"
                        className="text-sm font-semibold text-indigo-600 hover:underline"
                        onClick={() => startEdit(c)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className={btnDanger}
                        onClick={() => setDeleteTarget(c)}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SetupSectionCard>

      <DangerConfirmDialog
        open={!!deleteTarget}
        title="Remove this fee category?"
        message={
          deleteTarget
            ? `You are about to deactivate "${deleteTarget.name}" (${deleteTarget.code}).\n\nExisting fee rules and student line items for this category may become inconsistent. Students already billed under this category will not be automatically recalculated.\n\nOnly remove if you are sure no active students depend on it.`
            : ""
        }
        confirmLabel="Remove category"
        busy={busy}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          setBusy(true);
          void deactivateFeeCategory(deleteTarget.id)
            .then(() => {
              setDeleteTarget(null);
              return reload();
            })
            .catch((e) => setError(e instanceof Error ? e.message : "Remove failed"))
            .finally(() => setBusy(false));
        }}
      />
    </div>
  );
}
