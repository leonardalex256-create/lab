import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TERM_OPTIONS, useTermContext, type TermLabel } from "../../context/TermContext";
import { fetchAssessmentExamTypesForPeriod, fetchPerformanceSummary, generateClassMarksheet, type PerformanceSummaryRow, type GeneratedMarksheetPayload } from "../../api/academics";
import { fetchStudentFinanceRecords, recordStudentPayment, type StudentFinanceRecord } from "../../api/financeHistorical";

// ─── Types ───

type ConfirmedPeriod = { year: string; term: string } | null;

type RecordType = "finance" | "results" | null;

type ToastMessage = { type: "success" | "error" | "info"; message: string };

type PaymentMethod = "Cash" | "Mobile Money" | "Bank Transfer" | "Cheque" | "Other";

type ActivePaymentModal = { open: boolean; studentId: number | null };

function ymd(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function money(currency: string, amount: number | null | undefined): string {
  const n = Number(amount);
  if (!Number.isFinite(n)) return `${currency ?? "—"} —`;
  return `${currency} ${n.toLocaleString()}`;
}

/** UI grade band for class average (not necessarily the school's official transcript scale). */
function gradeBandFromAverage(avgScore: number | null): { label: string; className: string } {
  const v = avgScore == null ? null : Number(avgScore);
  if (v == null || !Number.isFinite(v)) return { label: "—", className: "text-[#636e72]" };
  if (v >= 75) return { label: "A", className: "border border-emerald-200 bg-emerald-50 text-emerald-800" };
  if (v >= 60) return { label: "B", className: "border border-sky-200 bg-sky-50 text-sky-800" };
  if (v >= 50) return { label: "C", className: "border border-amber-200 bg-amber-50 text-amber-800" };
  if (v >= 40) return { label: "D", className: "border border-orange-200 bg-orange-50 text-orange-900" };
  return { label: "F", className: "border border-rose-200 bg-rose-50 text-rose-800" };
}

function isValidPaymentDateYmd(value: string): boolean {
  const s = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const t = Date.parse(`${s}T12:00:00`);
  return !Number.isNaN(t);
}

function focusableElements(container: HTMLElement | null): HTMLElement[] {
  if (!container) return [];
  const list = Array.from(
    container.querySelectorAll<HTMLElement>(
      'button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])',
    ),
  );
  return list.filter((el) => !el.hasAttribute("disabled") && el.tabIndex !== -1);
}

function useFocusTrap(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement | null>(null);
  // Keep the latest onClose in a ref so the keydown listener is not torn down
  // and re-added every time the parent passes a new inline arrow function.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const el = ref.current;
    const focusables = focusableElements(el);
    (focusables[0] ?? el)?.focus?.();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusableElements(el);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey) {
        if (!active || active === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return ref;
}

function Toast({ toast, onClear }: { toast: ToastMessage | null; onClear: () => void }) {
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(onClear, 3500);
    return () => window.clearTimeout(t);
  }, [toast, onClear]);

  if (!toast) return null;
  const cls =
    toast.type === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : toast.type === "error"
        ? "border-rose-200 bg-rose-50 text-rose-900"
        : "border-sky-200 bg-sky-50 text-sky-900";
  return (
    <div className="fixed bottom-6 right-6 z-[120]">
      <div className={`neo-card border px-4 py-3 text-sm font-semibold shadow-lg ${cls}`} role="status">
        {toast.message}
      </div>
    </div>
  );
}

function PaymentModal({
  open,
  student,
  period,
  onClose,
  onSaved,
}: {
  open: boolean;
  student: StudentFinanceRecord | null;
  period: { term: string; year: string } | null;
  onClose: () => void;
  onSaved: (params: {
    studentId: number;
    currentPaid: number;
    oldPaid: number;
    fullName: string;
    priorOldBalance: number;
  }) => void;
}) {
  const containerRef = useFocusTrap(open, onClose);
  const [includeOldBalance, setIncludeOldBalance] = useState(false);
  const [amount, setAmount] = useState("");
  const [oldBalancePayment, setOldBalancePayment] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("Cash");
  const [date, setDate] = useState<string>(ymd());
  const [note, setNote] = useState<string>("");
  const [paidBy, setPaidBy] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [overpayWarning, setOverpayWarning] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setIncludeOldBalance(false);
    setAmount("");
    setOldBalancePayment("");
    setMethod("Cash");
    setDate(ymd());
    setNote("");
    setPaidBy("");
    setSaving(false);
    setError(null);
    setOverpayWarning(null);
  }, [open, student?.studentId]);

  const currency = student?.currency ?? "UGX";
  const currentBalance = student?.currentBalance ?? 0;
  const oldBalance = student?.oldBalance ?? 0;

  const currentPaid = useMemo(() => {
    const n = Number(amount);
    return Number.isFinite(n) ? n : 0;
  }, [amount]);

  const oldPaid = useMemo(() => {
    const n = Number(oldBalancePayment);
    return Number.isFinite(n) ? n : 0;
  }, [oldBalancePayment]);

  const totalPayment = useMemo(() => currentPaid + (includeOldBalance ? oldPaid : 0), [currentPaid, oldPaid, includeOldBalance]);

  useEffect(() => {
    if (!student) return;
    if (currentPaid > 0 && currentBalance > 0 && currentPaid > currentBalance) {
      setOverpayWarning("This payment exceeds the current term balance. The student will be overpaid for this period.");
      return;
    }
    setOverpayWarning(null);
  }, [student, currentPaid, currentBalance]);

  const canSubmit = Boolean(
    student &&
      period &&
      currentPaid > 0 &&
      Number.isFinite(currentPaid) &&
      isValidPaymentDateYmd(date) &&
      (!includeOldBalance ||
        oldBalance <= 0 ||
        (oldPaid > 0 && oldPaid <= oldBalance && Number.isFinite(oldPaid))),
  );

  const submit = useCallback(async () => {
    if (!student || !period) return;
    setSaving(true);
    setError(null);
    try {
      const oldAmt = includeOldBalance ? Math.max(0, oldPaid) : 0;
      await recordStudentPayment({
        studentId: student.studentId,
        term: period.term,
        academicYear: period.year,
        currentTermAmount: Math.max(0, currentPaid),
        oldBalanceAmount: oldAmt,
        paymentMethod: method,
        paidBy: paidBy.trim() || "Historical payment",
        paymentDate: date,
        note: note.trim() ? note.trim() : null,
      });
      onSaved({
        studentId: student.studentId,
        currentPaid: Math.max(0, currentPaid),
        oldPaid: oldAmt,
        fullName: student.fullName,
        priorOldBalance: student.oldBalance,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save payment.");
    } finally {
      setSaving(false);
    }
  }, [student, period, includeOldBalance, oldPaid, currentPaid, method, date, note, paidBy, onSaved, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        ref={containerRef}
        className="neo-card-elevated relative w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl outline-none animate-in fade-in zoom-in-95 duration-300"
        role="dialog"
        aria-modal="true"
        aria-label="Record payment"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-[#ebe4d9]/80 bg-[#faf7f0]/60 px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-black tracking-tight text-[#2d3436]">Record payment</h2>
              {student ? (
                <p className="mt-1 text-sm font-semibold text-[#636e72]">
                  {student.fullName} · {student.admissionNumber} · {student.className}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              aria-label="Close"
              className="rounded-xl border border-[#ebe4d9] bg-white px-3 py-2 text-xs font-black text-[#2d3436] transition-all duration-300 hover:bg-slate-50"
              onClick={onClose}
              disabled={saving}
            >
              Close
            </button>
          </div>
        </div>

        <div className="space-y-5 p-6">
          {/* TESTCASE: student with oldBalance > 0 → alert shown, input appears */}
          {/* TESTCASE: payment reduces oldBalance to 0 → alert replaced by green notice */}
          {student ? (
            student.oldBalance > 0 ? (
              <div className="neo-card border border-amber-200 bg-amber-50 px-4 py-4 text-sm" role="alert">
                <p className="font-black text-amber-900">
                  ⚠ {student.fullName} has an old balance of {money(currency, oldBalance)}.
                </p>
                <p className="mt-1 font-semibold text-amber-900/80">Would you like to include payment toward the old balance?</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-xl border border-amber-300 bg-white px-3 py-2 text-xs font-black text-amber-800 transition-all duration-300 hover:bg-amber-100"
                    onClick={() => setIncludeOldBalance(true)}
                    aria-label="Pay old balance too"
                  >
                    Pay Old Balance Too
                  </button>
                  <button
                    type="button"
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-[#2d3436] transition-all duration-300 hover:bg-slate-50"
                    onClick={() => setIncludeOldBalance(false)}
                    aria-label="Pay current term only"
                  >
                    Current Term Only
                  </button>
                </div>
              </div>
            ) : (
              <div className="neo-card border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900">
                ✓ {student.fullName} has no outstanding old balance.
              </div>
            )
          ) : null}

          {error ? (
            <div className="neo-card border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-900">
              {error}
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-[#636e72]">Payment amount (current term)</span>
              <input
                className="neo-inset-field w-full rounded-xl border border-[#ebe4d9] bg-white px-3 py-2 text-sm font-semibold text-[#2d3436]"
                type="number"
                min={0}
                max={currentBalance > 0 ? currentBalance : undefined}
                placeholder={currentBalance > 0 ? `Max: ${money(currency, currentBalance)}` : "Enter amount"}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                aria-label="Payment amount"
              />
            </label>

            <label className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-[#636e72]">Payment method</span>
              <select
                className="neo-inset-field w-full rounded-xl border border-[#ebe4d9] bg-white px-3 py-2 text-sm font-semibold text-[#2d3436]"
                value={method}
                onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                aria-label="Payment method"
              >
                <option>Cash</option>
                <option>Mobile Money</option>
                <option>Bank Transfer</option>
                <option>Cheque</option>
                <option>Other</option>
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-[#636e72]">Payment date</span>
              <input
                className="neo-inset-field w-full rounded-xl border border-[#ebe4d9] bg-white px-3 py-2 text-sm font-semibold text-[#2d3436]"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                aria-label="Payment date"
              />
            </label>

            <label className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-[#636e72]">Paid by</span>
              <input
                className="neo-inset-field w-full rounded-xl border border-[#ebe4d9] bg-white px-3 py-2 text-sm font-semibold text-[#2d3436]"
                value={paidBy}
                onChange={(e) => setPaidBy(e.target.value)}
                placeholder="Optional"
                aria-label="Paid by"
              />
            </label>
          </div>

          {overpayWarning ? (
            <div className="neo-card border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-900">
              {overpayWarning}
            </div>
          ) : null}

          {includeOldBalance && student && student.oldBalance > 0 ? (
            <div className="grid gap-2">
              <label className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-[#636e72]">
                  Old balance payment amount
                </span>
                <input
                  className="neo-inset-field w-full rounded-xl border border-[#ebe4d9] bg-white px-3 py-2 text-sm font-semibold text-[#2d3436]"
                  type="number"
                  min={0}
                  max={oldBalance}
                  placeholder={`Max: ${money(currency, oldBalance)}`}
                  value={oldBalancePayment}
                  onChange={(e) => setOldBalancePayment(e.target.value)}
                  aria-label="Old balance payment amount"
                />
              </label>
              <p className="text-xs font-bold text-[#636e72]">
                Total payment: {money(currency, totalPayment)}
              </p>
            </div>
          ) : null}

          <label className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-[#636e72]">Note (optional)</span>
            <textarea
              className="neo-inset-field w-full rounded-xl border border-[#ebe4d9] bg-white px-3 py-2 text-sm font-semibold text-[#2d3436]"
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 200))}
              rows={3}
              maxLength={200}
              aria-label="Payment note"
            />
          </label>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              className="rounded-xl border border-[#ebe4d9] bg-white px-4 py-2 text-sm font-black text-[#2d3436] transition-all duration-300 hover:bg-slate-50 disabled:opacity-50"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded-xl bg-[#3498db] px-5 py-2 text-sm font-black text-white shadow-sm transition-all duration-300 hover:brightness-110 disabled:opacity-50"
              onClick={() => void submit()}
              disabled={!canSubmit || saving}
              aria-label="Save payment"
            >
              {saving ? "Saving…" : "Save Payment"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReadOnlyMarksheetModal({
  open,
  onClose,
  marksheet,
  title,
  loading = false,
  error = null,
}: {
  open: boolean;
  onClose: () => void;
  marksheet: GeneratedMarksheetPayload | null;
  title: string;
  loading?: boolean;
  error?: string | null;
}) {
  const containerRef = useFocusTrap(open, onClose);
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        ref={containerRef}
        className="neo-card-elevated relative w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl outline-none animate-in fade-in zoom-in-95 duration-300"
        role="dialog"
        aria-modal="true"
        aria-label="Results details"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-[#ebe4d9]/80 bg-[#faf7f0]/60 px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-black tracking-tight text-[#2d3436]">{title}</h2>
              <p className="mt-1 text-sm font-semibold text-[#636e72]">
                Historical records are read-only.
              </p>
            </div>
            <button
              type="button"
              aria-label="Close"
              className="rounded-xl border border-[#ebe4d9] bg-white px-3 py-2 text-xs font-black text-[#2d3436] transition-all duration-300 hover:bg-slate-50"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>

        <div className="max-h-[75vh] overflow-auto p-6">
          {loading ? (
            <p className="text-sm font-semibold text-[#636e72]">Loading…</p>
          ) : error ? (
            <div
              className="neo-card border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-900"
              role="alert"
            >
              {error}
            </div>
          ) : !marksheet ? (
            <p className="text-sm font-semibold text-[#636e72]">No data available.</p>
          ) : (
            <div className="space-y-4">
              <div className="neo-card border border-slate-200 bg-white p-4 text-sm">
                <p className="font-black text-[#2d3436]">
                  {marksheet.className} · {marksheet.examType} · {marksheet.term} · {marksheet.academicYear ?? "—"}
                </p>
              </div>
              <div className="neo-card-elevated overflow-hidden">
                <div className="overflow-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-[#faf7f0]/70">
                      <tr className="border-b border-[#ebe4d9]/80">
                        <th className="px-4 py-2 text-xs font-black uppercase tracking-widest text-[#636e72]">Student</th>
                        {marksheet.subjects.map((s) => (
                          <th key={s} className="px-4 py-2 text-xs font-black uppercase tracking-widest text-[#636e72]">
                            {s}
                          </th>
                        ))}
                        <th className="px-4 py-2 text-xs font-black uppercase tracking-widest text-[#636e72]">Total</th>
                        <th className="px-4 py-2 text-xs font-black uppercase tracking-widest text-[#636e72]">Position</th>
                      </tr>
                    </thead>
                    <tbody>
                      {marksheet.rows.map((r) => (
                        <tr key={r.studentId} className="border-b border-[#ebe4d9]/70">
                          <td className="px-4 py-2">
                            <div className="font-bold text-[#2d3436]">{r.fullName}</div>
                            <div className="text-xs font-semibold text-[#636e72]">{r.admissionNumber}</div>
                          </td>
                          {marksheet.subjects.map((s) => (
                            <td key={s} className="px-4 py-2 font-semibold text-[#2d3436]">
                              {r.marksBySubject[s] == null ? "—" : Number(r.marksBySubject[s]).toLocaleString()}
                            </td>
                          ))}
                          <td className="px-4 py-2 font-black text-[#2d3436]">{r.totalMarks.toLocaleString()}</td>
                          <td className="px-4 py-2 font-black text-[#2d3436]">{r.position.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function HistoricalRecordsPage() {
  const { status, yearChoices, viewingAcademicYear, viewingTerm, systemAcademicYear, systemTerm } = useTermContext();

  const [localYear, setLocalYear] = useState<string>(viewingAcademicYear);
  const [localTerm, setLocalTerm] = useState<TermLabel>(viewingTerm);
  const [confirmedPeriod, setConfirmedPeriod] = useState<ConfirmedPeriod>(null);

  const [recordType, setRecordType] = useState<RecordType>(null);

  const [students, setStudents] = useState<StudentFinanceRecord[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentsError, setStudentsError] = useState<string | null>(null);
  const [studentQuery, setStudentQuery] = useState("");
  const [paymentModal, setPaymentModal] = useState<ActivePaymentModal>({ open: false, studentId: null });

  const [examsLoading, setExamsLoading] = useState(false);
  const [examsError, setExamsError] = useState<string | null>(null);
  const [availableExamTypes, setAvailableExamTypes] = useState<string[]>([]);
  const [selectedExamType, setSelectedExamType] = useState<string | null>(null);
  const [perfLoading, setPerfLoading] = useState(false);
  const [perfError, setPerfError] = useState<string | null>(null);
  const [perfRows, setPerfRows] = useState<PerformanceSummaryRow[]>([]);

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [detailsTitle, setDetailsTitle] = useState<string>("");
  const [detailsMarksheet, setDetailsMarksheet] = useState<GeneratedMarksheetPayload | null>(null);

  const [toast, setToast] = useState<ToastMessage | null>(null);

  // Banner reflects the period actually loaded (confirmedPeriod), not the
  // selectors, so changing the dropdowns without confirming does not warn
  // about a period that has not been viewed.
  const isViewingHistorical = Boolean(
    confirmedPeriod &&
      (confirmedPeriod.year !== systemAcademicYear || confirmedPeriod.term !== systemTerm),
  );

  // State reset rules
  useEffect(() => {
    setRecordType(null);
    setStudents([]);
    setStudentsError(null);
    setStudentQuery("");
    setPaymentModal({ open: false, studentId: null });
    setAvailableExamTypes([]);
    setSelectedExamType(null);
    setPerfRows([]);
    setPerfError(null);
    setDetailsOpen(false);
    setDetailsLoading(false);
    setDetailsError(null);
    setDetailsTitle("");
    setDetailsMarksheet(null);
  }, [confirmedPeriod?.term, confirmedPeriod?.year]);

  useEffect(() => {
    if (recordType === "finance") {
      setAvailableExamTypes([]);
      setSelectedExamType(null);
      setPerfRows([]);
      setPerfError(null);
      setDetailsOpen(false);
      setDetailsLoading(false);
      setDetailsError(null);
      setDetailsTitle("");
      setDetailsMarksheet(null);
    }
    if (recordType === "results") {
      setStudents([]);
      setStudentsError(null);
      setStudentQuery("");
      setPaymentModal({ open: false, studentId: null });
    }
    // TESTCASE: switching record type resets all content state
  }, [recordType]);

  const onYearChange = useCallback(
    (y: string) => {
      setLocalYear(y);
      setLocalTerm(TERM_OPTIONS[0]);
      setConfirmedPeriod(null);
    },
    [setLocalYear, setLocalTerm],
  );

  const onTermChange = useCallback((t: TermLabel) => {
    setLocalTerm(t);
    setConfirmedPeriod(null);
  }, []);

  const confirm = useCallback(() => {
    setConfirmedPeriod({ year: localYear, term: localTerm });
  }, [localYear, localTerm]);

  const loadStudents = useCallback(
    async (signal: { cancelled: boolean }, opts: { showLoading: boolean }) => {
      if (!confirmedPeriod) return;
      if (opts.showLoading) setStudentsLoading(true);
      setStudentsError(null);
      try {
        const items = await fetchStudentFinanceRecords({
          term: confirmedPeriod.term,
          academicYear: confirmedPeriod.year,
        });
        if (signal.cancelled) return;
        setStudents(items.map((s) => ({ ...s })));
      } catch (e) {
        if (signal.cancelled) return;
        setStudentsError(e instanceof Error ? e.message : "Failed to load finance records.");
        setStudents([]);
      } finally {
        if (!signal.cancelled && opts.showLoading) setStudentsLoading(false);
      }
    },
    [confirmedPeriod?.term, confirmedPeriod?.year],
  );

  useEffect(() => {
    if (recordType !== "finance") return;
    if (!confirmedPeriod) return;
    const signal = { cancelled: false };
    void loadStudents(signal, { showLoading: true });
    return () => {
      signal.cancelled = true;
      setStudentsLoading(false);
    };
  }, [recordType, confirmedPeriod?.term, confirmedPeriod?.year, loadStudents]);

  useEffect(() => {
    if (recordType !== "results") return;
    if (!confirmedPeriod) return;
    let cancelled = false;
    setExamsLoading(true);
    setExamsError(null);
    setAvailableExamTypes([]);
    void fetchAssessmentExamTypesForPeriod({
      term: confirmedPeriod.term,
      academicYear: confirmedPeriod.year,
    })
      .then((types) => {
        if (cancelled) return;
        setAvailableExamTypes(Array.from(new Set(types.map((x) => x.trim().toUpperCase()))));
      })
      .catch((e) => {
        if (cancelled) return;
        setExamsError(e instanceof Error ? e.message : "Failed to load exams.");
        setAvailableExamTypes([]);
      })
      .finally(() => {
        if (!cancelled) setExamsLoading(false);
      });
    return () => {
      cancelled = true;
      setExamsLoading(false);
    };
  }, [recordType, confirmedPeriod?.term, confirmedPeriod?.year]);

  const onPickRecordType = useCallback((t: Exclude<RecordType, null>) => {
    if (!confirmedPeriod) return;
    setRecordType(t);
  }, [confirmedPeriod]);

  useEffect(() => {
    if (recordType !== "results") return;
    if (!confirmedPeriod) return;
    if (!selectedExamType) return;
    let cancelled = false;
    setPerfLoading(true);
    setPerfError(null);
    setPerfRows([]);
    void fetchPerformanceSummary(confirmedPeriod.term, selectedExamType, confirmedPeriod.year)
      .then((rows) => {
        if (cancelled) return;
        setPerfRows(rows);
      })
      .catch((e) => {
        if (cancelled) return;
        setPerfError(e instanceof Error ? e.message : "Failed to load performance summary.");
        setPerfRows([]);
      })
      .finally(() => {
        if (!cancelled) setPerfLoading(false);
      });
    return () => {
      cancelled = true;
      setPerfLoading(false);
    };
  }, [recordType, confirmedPeriod?.term, confirmedPeriod?.year, selectedExamType]);

  const filteredStudents = useMemo(() => {
    const q = studentQuery.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) => {
      return (
        s.fullName.toLowerCase().includes(q) ||
        s.admissionNumber.toLowerCase().includes(q) ||
        s.className.toLowerCase().includes(q)
      );
    });
  }, [students, studentQuery]);

  const activeStudent = useMemo(() => {
    if (!paymentModal.open || !paymentModal.studentId) return null;
    return students.find((s) => s.studentId === paymentModal.studentId) ?? null;
  }, [paymentModal, students]);

  const perfStats = useMemo(() => {
    const rows = perfRows ?? [];
    // Weight each class average by its enrolment so a class of 60 does not
    // count the same as a class of 3. Rows with a null/non-finite average
    // are excluded from both the numerator and the weight sum.
    const weighted = rows
      .map((r) => ({ avg: r.avgScore == null ? null : Number(r.avgScore), w: Number(r.totalStudents) || 0 }))
      .filter((x): x is { avg: number; w: number } => x.avg != null && Number.isFinite(x.avg) && x.w > 0);
    const totalWeight = weighted.reduce((acc, x) => acc + x.w, 0);
    const globalAvg = totalWeight > 0
      ? weighted.reduce((acc, x) => acc + x.avg * x.w, 0) / totalWeight
      : null;
    const avgs = weighted.map((x) => x.avg);
    const hi = avgs.length ? Math.max(...avgs) : null;
    const lo = avgs.length ? Math.min(...avgs) : null;
    const totalStudentsSum = rows.reduce((acc, r) => acc + (Number(r.totalStudents) || 0), 0);
    return { globalAvg, hi, lo, totalStudentsSum };
  }, [perfRows]);

  const viewDetails = useCallback(
    async (row: PerformanceSummaryRow) => {
      if (!confirmedPeriod || !selectedExamType) return;
      setDetailsOpen(true);
      setDetailsLoading(true);
      setDetailsError(null);
      setDetailsMarksheet(null);
      setDetailsTitle(`${row.className} · ${row.sectionName || "General"}`);
      try {
        const item = await generateClassMarksheet({
          term: confirmedPeriod.term,
          academicYear: confirmedPeriod.year,
          examType: selectedExamType,
          classRoomId: row.classRoomId,
        });
        setDetailsMarksheet(item);
      } catch (e) {
        setDetailsError(e instanceof Error ? e.message : "Failed to load class results.");
      } finally {
        setDetailsLoading(false);
      }
    },
    [confirmedPeriod, selectedExamType],
  );

  const closePaymentModal = useCallback(
    () => setPaymentModal({ open: false, studentId: null }),
    [],
  );

  const closeDetailsModal = useCallback(() => {
    setDetailsOpen(false);
    setDetailsError(null);
  }, []);

  const onPaymentSaved = useCallback(
    ({
      oldPaid,
      fullName,
      priorOldBalance,
    }: {
      studentId: number;
      currentPaid: number;
      oldPaid: number;
      fullName: string;
      priorOldBalance: number;
    }) => {
      // Refetch from the server to keep balances authoritative — the backend
      // applies overpayments toward outstanding debt, so reproducing that math
      // on the client would drift over multiple saves.
      const signal = { cancelled: false };
      void loadStudents(signal, { showLoading: false });

      const nextOld = Math.max(0, priorOldBalance - oldPaid);
      if (priorOldBalance > 0 && nextOld === 0 && oldPaid > 0) {
        setToast({ type: "success", message: `✓ ${fullName} has cleared their old balance!` });
      } else {
        setToast({ type: "success", message: "Payment saved." });
      }
    },
    [loadStudents],
  );

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 space-y-6 duration-500 pb-24">
      <Toast toast={toast} onClear={() => setToast(null)} />

      <header className="border-b border-[#ebe4d9]/80 pb-4">
        <h1 className="text-2xl font-black tracking-tight text-[#2d3436]">Historical records</h1>
        <p className="mt-1 text-sm font-semibold text-[#636e72]">
          View finance records and academic results for a selected term and year.
        </p>
      </header>

      {/* Stage 1 */}
      <section className="neo-card-elevated p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-[260px]">
            <h2 className="text-sm font-black uppercase tracking-widest text-[#2d3436]">Select Historical Period</h2>
            <p className="mt-1 text-xs font-semibold text-[#636e72]">Pick a term and year, then confirm.</p>
          </div>

          <div className="grid w-full gap-3 sm:max-w-3xl sm:grid-cols-[1fr_1.2fr_auto]">
            <label className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-[#636e72]">Year</span>
              <select
                className="neo-inset-field w-full rounded-xl border border-[#ebe4d9] bg-white px-3 py-2 text-sm font-semibold text-[#2d3436]"
                value={localYear}
                onChange={(e) => onYearChange(e.target.value)}
                aria-label="Select year"
              >
                {yearChoices.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </label>

            <fieldset className="space-y-1">
              <legend className="text-[10px] font-black uppercase tracking-widest text-[#636e72]">Term</legend>
              <div className="flex flex-wrap gap-2">
                {TERM_OPTIONS.map((t) => (
                  <label
                    key={t}
                    className={`cursor-pointer rounded-xl border px-3 py-2 text-xs font-black transition-all duration-300 ${
                      localTerm === t
                        ? "border-sky-300 bg-sky-50 text-sky-800"
                        : "border-[#ebe4d9] bg-white text-[#2d3436] hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="term"
                      value={t}
                      checked={localTerm === t}
                      onChange={() => onTermChange(t)}
                      className="sr-only"
                      aria-label={`Select ${t}`}
                    />
                    {t}
                  </label>
                ))}
              </div>
            </fieldset>

            <button
              type="button"
              className="h-10 rounded-xl bg-[#2d3436] px-5 text-sm font-black text-white shadow-sm transition-all duration-300 hover:brightness-110 disabled:opacity-50"
              onClick={confirm}
              disabled={status === "loading"}
              aria-label="View records"
            >
              View Records
            </button>
          </div>
        </div>

        {isViewingHistorical && confirmedPeriod ? (
          <div className="mt-4 neo-card border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900" role="alert">
            ⚠ You are viewing historical records for {confirmedPeriod.term} · {confirmedPeriod.year}. Data shown is read-only.
          </div>
        ) : null}
      </section>

      {/* Stage 2 */}
      {confirmedPeriod ? (
        <section className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="neo-card-elevated p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-black uppercase tracking-widest text-[#2d3436]">Record type</h2>
                <p className="mt-1 text-xs font-semibold text-[#636e72]">
                  {confirmedPeriod.term} · {confirmedPeriod.year}
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  className={`neo-card-elevated rounded-2xl border p-4 text-left transition-all duration-300 hover:-translate-y-0.5 ${
                    recordType === "finance" ? "border-sky-300 bg-sky-50" : "border-[#ebe4d9] bg-white"
                  }`}
                  onClick={() => onPickRecordType("finance")}
                  aria-label="Finance records"
                >
                  <div className="text-lg font-black text-[#2d3436]">📁 Finance Records</div>
                  <div className="mt-1 text-xs font-semibold text-[#636e72]">Fees, balances, and payments for this period.</div>
                </button>
                <button
                  type="button"
                  className={`neo-card-elevated rounded-2xl border p-4 text-left transition-all duration-300 hover:-translate-y-0.5 ${
                    recordType === "results" ? "border-sky-300 bg-sky-50" : "border-[#ebe4d9] bg-white"
                  }`}
                  onClick={() => onPickRecordType("results")}
                  aria-label="Academic results"
                >
                  <div className="text-lg font-black text-[#2d3436]">📊 Academic Results</div>
                  <div className="mt-1 text-xs font-semibold text-[#636e72]">Exams and performance summaries.</div>
                </button>
              </div>
            </div>
          </div>

          {recordType === "finance" ? (
            <section className="neo-card-elevated overflow-hidden">
              <div className="border-b border-[#ebe4d9]/80 bg-[#faf7f0]/60 px-4 py-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <h3 className="text-sm font-black uppercase tracking-widest text-[#2d3436]">Finance records</h3>
                  <input
                    type="search"
                    value={studentQuery}
                    onChange={(e) => setStudentQuery(e.target.value)}
                    placeholder="Search student name / admission / class…"
                    className="neo-input w-full max-w-md rounded-xl border border-[#ebe4d9] bg-white px-3 py-2 text-sm font-semibold text-[#2d3436]"
                    aria-label="Search students"
                  />
                </div>
              </div>

              {studentsError ? (
                <div className="p-4">
                  <div className="neo-card border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-900">
                    {studentsError}
                  </div>
                </div>
              ) : null}

              <div className="overflow-auto p-4">
                {studentsLoading ? (
                  <p className="text-sm font-semibold text-[#636e72]">Loading…</p>
                ) : (
                  <table className="min-w-[1100px] w-full text-left text-sm">
                    <thead className="bg-[#faf7f0]/70">
                      <tr className="border-b border-[#ebe4d9]/80">
                        <th className="px-3 py-2 text-xs font-black uppercase tracking-widest text-[#636e72]">Name</th>
                        <th className="px-3 py-2 text-xs font-black uppercase tracking-widest text-[#636e72]">Class</th>
                        <th className="px-3 py-2 text-xs font-black uppercase tracking-widest text-[#636e72]">Fees Due</th>
                        <th className="px-3 py-2 text-xs font-black uppercase tracking-widest text-[#636e72]">Paid</th>
                        <th className="px-3 py-2 text-xs font-black uppercase tracking-widest text-[#636e72]">Old Balance</th>
                        <th className="px-3 py-2 text-xs font-black uppercase tracking-widest text-[#636e72]">Current Balance</th>
                        <th className="px-3 py-2 text-xs font-black uppercase tracking-widest text-[#636e72]">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStudents.map((s) => {
                        const oldBal = s.oldBalance;
                        const curBal = s.currentBalance;
                        return (
                          <tr key={s.studentId} className="border-b border-[#ebe4d9]/70">
                            <td className="px-3 py-2">
                              <div className="font-bold text-[#2d3436]">{s.fullName}</div>
                              <div className="text-xs font-semibold text-[#636e72]">{s.admissionNumber}</div>
                            </td>
                            <td className="px-3 py-2 font-semibold text-[#2d3436]">{s.className}</td>
                            <td className="px-3 py-2 font-semibold text-[#2d3436]">{money(s.currency, s.totalFees)}</td>
                            <td className="px-3 py-2 font-semibold text-[#2d3436]">{money(s.currency, s.totalPaid)}</td>
                            <td className="px-3 py-2">
                              {oldBal > 0 ? (
                                <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-black text-amber-800">
                                  {money(s.currency, oldBal)}
                                </span>
                              ) : (
                                <span className="text-xs font-semibold text-[#636e72]">—</span>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              {curBal > 0 ? (
                                <span className="font-black text-rose-700">{money(s.currency, curBal)}</span>
                              ) : curBal === 0 ? (
                                <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-800">
                                  Paid
                                </span>
                              ) : (
                                <span className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-black text-sky-800">
                                  Overpaid
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              <button
                                type="button"
                                className="rounded-xl border border-sky-200 bg-white px-3 py-1.5 text-xs font-black text-sky-700 transition-all duration-300 hover:bg-sky-50"
                                onClick={() => setPaymentModal({ open: true, studentId: s.studentId })}
                                aria-label={`Record payment for ${s.fullName}`}
                              >
                                Record Payment
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {filteredStudents.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-3 py-6 text-center text-sm font-semibold text-[#636e72]">
                            {studentQuery.trim()
                              ? "No students match your search."
                              : "No finance records for this period."}
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                )}
              </div>
            </section>
          ) : null}

          {recordType === "results" ? (
            <section className="space-y-6">
              {/* TESTCASE: period with no exams → results section shows empty state */}
              <div className="neo-card-elevated p-5">
                <h3 className="text-sm font-black uppercase tracking-widest text-[#2d3436]">Exam type</h3>
                <p className="mt-1 text-xs font-semibold text-[#636e72]">
                  Pick an exam type that has records for {confirmedPeriod.term} · {confirmedPeriod.year}.
                </p>

                {examsError ? (
                  <div className="mt-4 neo-card border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-900">
                    {examsError}
                  </div>
                ) : null}

                {examsLoading ? (
                  <p className="mt-4 text-sm font-semibold text-[#636e72]">Loading…</p>
                ) : availableExamTypes.length === 0 ? (
                  <div className="mt-4 neo-card border border-[#ebe4d9] bg-white px-4 py-3 text-sm font-semibold text-[#636e72]">
                    No examinations were recorded for {confirmedPeriod.term} · {confirmedPeriod.year}.
                  </div>
                ) : (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {availableExamTypes.map((key) => {
                      const selected = selectedExamType === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          className={`rounded-full px-4 py-2 text-xs font-black transition-all duration-300 ${
                            selected
                              ? "bg-[#3498db] text-white shadow-sm"
                              : "border border-slate-200 bg-white text-[#636e72] hover:bg-slate-50"
                          }`}
                          onClick={() => setSelectedExamType(key)}
                          aria-label={`Select exam type ${key}`}
                        >
                          {key}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {selectedExamType ? (
                <section className="neo-card-elevated overflow-hidden">
                  <div className="border-b border-[#ebe4d9]/80 bg-[#faf7f0]/60 px-4 py-3">
                    <h3 className="text-sm font-black uppercase tracking-widest text-[#2d3436]">Performance summary</h3>
                  </div>

                  <div className="space-y-4 p-4">
                    {perfError ? (
                      <div className="neo-card border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-900">
                        {perfError}
                      </div>
                    ) : null}

                    <div className="neo-card border border-[#ebe4d9] bg-white px-4 py-3 text-sm">
                      <div className="flex flex-wrap gap-4">
                        <div>
                          <div className="text-[10px] font-black uppercase tracking-widest text-[#636e72]">Total students</div>
                          <div className="text-lg font-black text-[#2d3436]">{perfStats.totalStudentsSum.toLocaleString()}</div>
                        </div>
                        <div>
                          <div className="text-[10px] font-black uppercase tracking-widest text-[#636e72]">Global average</div>
                          <div className="text-lg font-black text-[#2d3436]">
                            {perfStats.globalAvg == null ? "—" : perfStats.globalAvg.toFixed(1)}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] font-black uppercase tracking-widest text-[#636e72]">Highest class avg</div>
                          <div className="text-lg font-black text-[#2d3436]">
                            {perfStats.hi == null ? "—" : perfStats.hi.toFixed(1)}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] font-black uppercase tracking-widest text-[#636e72]">Lowest class avg</div>
                          <div className="text-lg font-black text-[#2d3436]">
                            {perfStats.lo == null ? "—" : perfStats.lo.toFixed(1)}
                          </div>
                        </div>
                      </div>
                    </div>

                    {perfLoading ? (
                      <p className="text-sm font-semibold text-[#636e72]">Loading…</p>
                    ) : (
                      <div className="overflow-auto">
                        <table className="min-w-[1000px] w-full text-left text-sm">
                          <thead className="bg-[#faf7f0]/70">
                            <tr className="border-b border-[#ebe4d9]/80">
                              <th className="px-3 py-2 text-xs font-black uppercase tracking-widest text-[#636e72]">Class</th>
                              <th className="px-3 py-2 text-xs font-black uppercase tracking-widest text-[#636e72]">Students</th>
                              <th className="px-3 py-2 text-xs font-black uppercase tracking-widest text-[#636e72]">Average score</th>
                              <th className="px-3 py-2 text-xs font-black uppercase tracking-widest text-[#636e72]">Top score</th>
                              <th className="px-3 py-2 text-xs font-black uppercase tracking-widest text-[#636e72]">Pass rate</th>
                              <th className="px-3 py-2 text-xs font-black uppercase tracking-widest text-[#636e72]">Grade band</th>
                              <th className="px-3 py-2 text-xs font-black uppercase tracking-widest text-[#636e72]">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {perfRows.map((r) => {
                              const band = gradeBandFromAverage(r.avgScore);
                              return (
                                <tr key={`${r.classRoomId}::${r.sectionName ?? "General"}`} className="border-b border-[#ebe4d9]/70">
                                  <td className="px-3 py-2 font-bold text-[#2d3436]">
                                    {r.className}{" "}
                                    <span className="text-xs font-semibold text-[#636e72]">· {r.sectionName || "General"}</span>
                                  </td>
                                  <td className="px-3 py-2 font-semibold text-[#2d3436]">{r.totalStudents.toLocaleString()}</td>
                                  <td className="px-3 py-2 font-black text-[#2d3436]">
                                    {r.avgScore == null ? "—" : Number(r.avgScore).toFixed(1)}
                                  </td>
                                  <td className="px-3 py-2 font-black text-[#2d3436]">
                                    {r.topScore == null ? "—" : Number(r.topScore).toFixed(1)}
                                  </td>
                                  <td className="px-3 py-2 font-semibold text-[#2d3436]">
                                    {r.passRate == null ? "—" : `${Number(r.passRate).toFixed(1)}%`}
                                  </td>
                                  <td className="px-3 py-2">
                                    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-black ${band.className}`}>
                                      {band.label}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2">
                                    <button
                                      type="button"
                                      className="rounded-xl border border-sky-200 bg-white px-3 py-1.5 text-xs font-black text-sky-700 transition-all duration-300 hover:bg-sky-50"
                                      onClick={() => void viewDetails(r)}
                                      aria-label={`View details for ${r.className}`}
                                    >
                                      View Details
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                            {perfRows.length === 0 ? (
                              <tr>
                                <td colSpan={7} className="px-3 py-6 text-center text-sm font-semibold text-[#636e72]">
                                  No rows.
                                </td>
                              </tr>
                            ) : null}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </section>
              ) : null}
            </section>
          ) : null}
        </section>
      ) : null}

      <PaymentModal
        open={paymentModal.open}
        student={activeStudent}
        period={confirmedPeriod ? { term: confirmedPeriod.term, year: confirmedPeriod.year } : null}
        onClose={closePaymentModal}
        onSaved={onPaymentSaved}
      />

      <ReadOnlyMarksheetModal
        open={detailsOpen}
        onClose={closeDetailsModal}
        marksheet={detailsMarksheet}
        title={detailsTitle}
        loading={detailsLoading}
        error={detailsError}
      />
    </div>
  );
}

