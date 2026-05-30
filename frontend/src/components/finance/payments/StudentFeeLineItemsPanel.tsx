import { useCallback, useEffect, useState } from "react";
import {
  fetchStudentLineItems,
  generateStudentLineItems,
} from "../../../api/studentFees";
import { formatCurrencyUGX } from "../shared/financeFormat";
import { useTermContext } from "../../../context/TermContext";

export function StudentFeeLineItemsPanel({ studentId }: { studentId: number }) {
  const { viewingTerm, viewingAcademicYear } = useTermContext();
  const [items, setItems] = useState<
    Array<{ feeCategoryName: string; feeCategoryCode: string; amountUgx: number }>
  >([]);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const data = await fetchStudentLineItems(studentId, viewingTerm, viewingAcademicYear);
    setItems(data.items);
    setTotal(data.totalUgx);
  }, [studentId, viewingTerm, viewingAcademicYear]);

  useEffect(() => {
    void load().catch(() => {
      setItems([]);
      setTotal(0);
    });
  }, [load]);

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm mb-4">
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="font-semibold text-slate-800">Fee line items ({viewingTerm})</p>
        <button
          type="button"
          disabled={busy}
          className="text-xs font-bold text-indigo-700"
          onClick={() => {
            setBusy(true);
            void generateStudentLineItems(studentId, viewingTerm, viewingAcademicYear)
              .then((r) => {
                setItems(
                  r.lineItems.map((li) => ({
                    feeCategoryName: li.feeCategoryName,
                    feeCategoryCode: li.feeCategoryCode,
                    amountUgx: li.amountUgx,
                  })),
                );
                setTotal(r.totalUgx);
              })
              .finally(() => setBusy(false));
          }}
        >
          {busy ? "Generating…" : "Regenerate from rules"}
        </button>
      </div>
      {items.length === 0 ? (
        <p className="text-slate-500 text-xs">No line items — set student status and regenerate.</p>
      ) : (
        <ul className="space-y-1">
          {items.map((li) => (
            <li key={li.feeCategoryCode} className="flex justify-between">
              <span>
                {li.feeCategoryName}{" "}
                <span className="font-mono text-xs text-slate-400">{li.feeCategoryCode}</span>
              </span>
              <span>{formatCurrencyUGX(li.amountUgx)}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 font-semibold flex justify-between border-t pt-2">
        <span>Rollup total</span>
        <span>{formatCurrencyUGX(total)}</span>
      </p>
    </div>
  );
}
