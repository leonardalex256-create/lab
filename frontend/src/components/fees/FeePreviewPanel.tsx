import { useEffect, useState } from "react";
import { previewStudentFees, type FeeLineItemPreview } from "../../api/studentFees";
import { formatCurrencyUGX } from "../finance/shared/financeFormat";

export function FeePreviewPanel({
  studentStatusId,
  term,
  academicYear,
}: {
  studentStatusId: number | null;
  term: string;
  academicYear: string;
}) {
  const [lineItems, setLineItems] = useState<FeeLineItemPreview[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!studentStatusId || !term || !academicYear) {
      setLineItems([]);
      setTotal(0);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void previewStudentFees(studentStatusId, term, academicYear)
      .then((data) => {
        if (!cancelled) {
          setLineItems(data.lineItems);
          setTotal(data.totalUgx);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Preview failed");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [studentStatusId, term, academicYear]);

  if (!studentStatusId) {
    return <p className="text-sm text-slate-500">Select a student status to preview fees.</p>;
  }

  return (
    <div className="fee-panel bg-slate-50 rounded-lg border p-4">
      <h3 className="font-semibold mb-2">Fee preview ({term})</h3>
      {loading ? <p className="text-sm">Calculating…</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <ul className="space-y-1 text-sm mb-3">
        {lineItems.map((li) => (
          <li key={li.feeCategoryId} className="flex justify-between gap-4">
            <span>
              {li.feeCategoryName}{" "}
              <span className="font-mono text-xs text-slate-500">{li.feeCategoryCode}</span>
            </span>
            <span>{formatCurrencyUGX(li.amountUgx)}</span>
          </li>
        ))}
      </ul>
      <div className="flex justify-between font-semibold border-t pt-2">
        <span>Total due</span>
        <span>{formatCurrencyUGX(total)}</span>
      </div>
    </div>
  );
}
