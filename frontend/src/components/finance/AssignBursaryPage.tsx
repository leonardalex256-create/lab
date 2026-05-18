import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchStudent, fetchStudents, type StudentApiRow } from "../../api/students";
import { assignBursary, fetchActiveBursaries, revokeBursary, type BursaryRow } from "../../api/financeBursary";
import { fetchStudentStatement } from "../../api/financeStatements";
import { formatCurrencyUGX } from "./shared/financeFormat";
import { useI18n } from "../../i18n/I18nProvider";
import { useTermContext } from "../../context/TermContext";
import { ConfirmModal } from "./shared/ConfirmModal";

type ExpiryState =
  | { kind: "expiring_soon"; endsAt: string; daysLeft: number }
  | { kind: "expired"; endsAt: string }
  | null;

function studentLabel(student: Pick<StudentApiRow, "fullName" | "admissionNumber">): string {
  return `${student.fullName} (${student.admissionNumber})`;
}

function toDateTimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function normalizeStatusLabel(status: string | null | undefined): string {
  const s = (status ?? "").trim();
  if (!s) return "—";
  return s
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function isBursaryActive(startsAt: string | null, endsAt: string | null): boolean {
  if (!startsAt || !endsAt) return false;
  const now = Date.now();
  return now >= new Date(startsAt).getTime() && now < new Date(endsAt).getTime();
}

function daysRemaining(endsAt: string): number {
  const diffMs = new Date(endsAt).getTime() - Date.now();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

export function AssignBursaryPage({
  initialStudentId,
  initialTerm,
  initialPercentage,
}: {
  initialStudentId?: number;
  initialTerm?: string;
  initialPercentage?: string;
}) {
  const { t } = useI18n();
  const { viewingTerm, viewingAcademicYear, historicalReadOnly } = useTermContext();
  const term = useMemo(() => (initialTerm?.trim() ? initialTerm.trim() : viewingTerm), [initialTerm, viewingTerm]);

  const [studentSearch, setStudentSearch] = useState("");
  const [studentMatches, setStudentMatches] = useState<StudentApiRow[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentApiRow | null>(null);
  const [percentage, setPercentage] = useState(initialPercentage ?? "0");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [expectedBase, setExpectedBase] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    description: string;
    variant: "danger" | "warning" | "info";
    onConfirm: () => void;
  } | null>(null);
  const [expiryState, setExpiryState] = useState<ExpiryState>(null);
  const [expiryDismissed, setExpiryDismissed] = useState(false);
  const [bursaryRows, setBursaryRows] = useState<BursaryRow[]>([]);
  const [tableLoading, setTableLoading] = useState(false);
  const [tableFilter, setTableFilter] = useState("");

  const formRef = useRef<HTMLDivElement | null>(null);
  const sliderRef = useRef<HTMLInputElement | null>(null);
  const autoRevokedRef = useRef<number | null>(null);

  const percentageNumber = useMemo(() => Number(percentage) || 0, [percentage]);
  const discountAmount = useMemo(() => {
    if (expectedBase == null || percentageNumber <= 0) return 0;
    return Math.round((expectedBase * percentageNumber) / 100);
  }, [expectedBase, percentageNumber]);
  const activeNow = useMemo(
    () => isBursaryActive(selectedStudent?.bursaryStartsAt ?? null, selectedStudent?.bursaryEndsAt ?? null),
    [selectedStudent],
  );
  const currentBalance = useMemo(() => {
    if (expectedBase == null) return null;
    if (!activeNow) return expectedBase;
    if (expiryState?.kind === "expired") return expectedBase;
    return expectedBase - discountAmount;
  }, [expectedBase, discountAmount, activeNow, expiryState]);

  const bursaryDurationDays = useMemo(() => {
    if (!startsAt || !endsAt) return null;
    const diff = new Date(endsAt).getTime() - new Date(startsAt).getTime();
    return diff > 0 ? Math.ceil(diff / (1000 * 60 * 60 * 24)) : null;
  }, [startsAt, endsAt]);

  const loadExpectedBase = useCallback(
    async (studentId: number) => {
      try {
        const data = await fetchStudentStatement(studentId, term, viewingAcademicYear);
        setExpectedBase(data.assignedAmount);
      } catch {
        setExpectedBase(null);
      }
    },
    [term, viewingAcademicYear],
  );

  const loadBursaryTable = useCallback(async () => {
    setTableLoading(true);
    try {
      const rows = await fetchActiveBursaries(term, viewingAcademicYear);
      setBursaryRows(rows);
    } catch {
      setBursaryRows([]);
    } finally {
      setTableLoading(false);
    }
  }, [term, viewingAcademicYear]);

  useEffect(() => {
    setPercentage(initialPercentage ?? "0");
  }, [initialPercentage]);

  useEffect(() => {
    void loadBursaryTable();
  }, [loadBursaryTable]);

  useEffect(() => {
    if (!initialStudentId) return;
    let cancelled = false;
    setSearchLoading(true);
    void fetchStudent(initialStudentId)
      .then((student) => {
        if (cancelled) return;
        setSelectedStudent(student);
        setStudentSearch(studentLabel(student));
        setPercentage(String(Number(student.bursaryPercentage) || Number(initialPercentage) || 0));
        setStartsAt(toDateTimeLocalValue(student.bursaryStartsAt));
        setEndsAt(toDateTimeLocalValue(student.bursaryEndsAt));
        setStudentMatches([]);
        setExpiryDismissed(false);
      })
      .catch(() => {
        if (!cancelled) setStatusMsg({ type: "error", text: "Failed to load selected student." });
      })
      .finally(() => {
        if (!cancelled) setSearchLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [initialStudentId, initialPercentage]);

  useEffect(() => {
    if (studentSearch.trim().length < 2) {
      setStudentMatches([]);
      return;
    }
    let cancelled = false;
    setSearchLoading(true);
    void fetchStudents({ q: studentSearch.trim(), sortBy: "name", sortDir: "asc", limit: 8 })
      .then((response) => {
        if (!cancelled) setStudentMatches(response.items);
      })
      .catch(() => {
        if (!cancelled) setStudentMatches([]);
      })
      .finally(() => {
        if (!cancelled) setSearchLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [studentSearch]);

  useEffect(() => {
    if (selectedStudent) {
      void loadExpectedBase(selectedStudent.id);
    } else {
      setExpectedBase(null);
    }
  }, [selectedStudent, loadExpectedBase]);

  useEffect(() => {
    if (!selectedStudent?.bursaryEndsAt || Number(selectedStudent.bursaryPercentage || 0) === 0) {
      setExpiryState(null);
      return;
    }
    const endsMs = new Date(selectedStudent.bursaryEndsAt).getTime();
    const now = Date.now();
    const diffMs = endsMs - now;
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    if (diffMs <= 0) {
      setExpiryState({ kind: "expired", endsAt: selectedStudent.bursaryEndsAt });
    } else if (diffDays <= 7) {
      setExpiryState({
        kind: "expiring_soon",
        endsAt: selectedStudent.bursaryEndsAt,
        daysLeft: Math.ceil(diffDays),
      });
    } else {
      setExpiryState(null);
    }
  }, [selectedStudent]);

  useEffect(() => {
    if (expiryState?.kind === "expired" && selectedStudent && autoRevokedRef.current !== selectedStudent.id) {
      autoRevokedRef.current = selectedStudent.id;
      void revokeBursary(selectedStudent.id, term)
        .then(async () => {
          await loadExpectedBase(selectedStudent.id);
          await loadBursaryTable();
        })
        .catch(() => {
          // silent by design
        });
    }
  }, [expiryState, selectedStudent, term, loadExpectedBase, loadBursaryTable]);

  const handleApply = async () => {
    if (!selectedStudent) return;
    if (historicalReadOnly) {
      setStatusMsg({
        type: "error",
        text: "Only administrators can change bursaries when viewing a past term.",
      });
      return;
    }
    if (!Number.isFinite(percentageNumber) || percentageNumber <= 0) {
      setStatusMsg({ type: "error", text: "Bursary percentage must be greater than 0." });
      return;
    }
    if (!startsAt || !endsAt) {
      setStatusMsg({ type: "error", text: "Bursary start and end dates are required." });
      return;
    }
    if (new Date(endsAt).getTime() <= Date.now()) {
      setStatusMsg({ type: "error", text: "Bursary end date must be in the future." });
      return;
    }
    if (new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
      setStatusMsg({ type: "error", text: "Bursary end time must be after start time." });
      return;
    }
    setStatusMsg(null);
    setSubmitting(true);
    try {
      await assignBursary({
        studentId: selectedStudent.id,
        percentage: percentageNumber,
        term,
        startsAt: startsAt ? new Date(startsAt).toISOString() : null,
        endsAt: endsAt ? new Date(endsAt).toISOString() : null,
      });
      setStatusMsg({
        type: "success",
        text: `${t("finance.bursary.status.success")} ${percentage}% for ${term}.`,
      });
      await loadExpectedBase(selectedStudent.id);
      await loadBursaryTable();
    } catch (e) {
      setStatusMsg({ type: "error", text: e instanceof Error ? e.message : "Failed to assign bursary" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = useCallback(
    async (student?: Pick<StudentApiRow, "id">) => {
      const targetStudent = student?.id != null ? selectedStudent && selectedStudent.id === student.id ? selectedStudent : null : selectedStudent;
      const targetId = student?.id ?? selectedStudent?.id;
      if (!targetId) return;
      if (historicalReadOnly) {
        setStatusMsg({
          type: "error",
          text: "Only administrators can change bursaries when viewing a past term.",
        });
        return;
      }
      setConfirmModal({
        title: "Revoke bursary award",
        description: "Are you sure you want to revoke this student's bursary? Fees will return to standard rates.",
        variant: "danger",
        onConfirm: () => {
          setConfirmModal(null);
          void (async () => {
            setStatusMsg(null);
            setSubmitting(true);
            try {
              await revokeBursary(targetId, term);
              if (targetStudent || selectedStudent?.id === targetId) {
                setPercentage("0");
                setStartsAt("");
                setEndsAt("");
                setExpiryState(null);
              }
              setStatusMsg({ type: "success", text: t("finance.bursary.status.revoked") });
              if (selectedStudent?.id === targetId) {
                await loadExpectedBase(targetId);
              }
              await loadBursaryTable();
            } catch (e) {
              setStatusMsg({ type: "error", text: e instanceof Error ? e.message : "Failed to revoke bursary" });
            } finally {
              setSubmitting(false);
            }
          })();
        },
      });
    },
    [selectedStudent, historicalReadOnly, term, t, loadExpectedBase, loadBursaryTable],
  );

  const handleExtendFromExpiry = () => {
    const now = new Date();
    const plus90 = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    setEndsAt(toDateTimeLocalValue(plus90.toISOString()));
    setExpiryDismissed(false);
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleAssignNewFromExpiry = () => {
    setPercentage("0");
    setStartsAt("");
    setEndsAt("");
    setExpiryDismissed(false);
    sliderRef.current?.focus();
  };

  const filteredRows = useMemo(() => {
    const q = tableFilter.trim().toLowerCase();
    if (!q) return bursaryRows;
    return bursaryRows.filter(
      (r) =>
        r.fullName.toLowerCase().includes(q) ||
        r.admissionNumber.toLowerCase().includes(q),
    );
  }, [bursaryRows, tableFilter]);

  const totals = useMemo(() => {
    return filteredRows.reduce(
      (acc, row) => {
        acc.termFee += Number(row.termFee) || 0;
        acc.discount += Number(row.discountAmount) || 0;
        acc.balance += Number(row.currentBalance) || 0;
        return acc;
      },
      { termFee: 0, discount: 0, balance: 0 },
    );
  }, [filteredRows]);

  const isFormReady =
    !historicalReadOnly &&
    !submitting &&
    !!startsAt &&
    !!endsAt &&
    Number.isFinite(percentageNumber) &&
    percentageNumber > 0;

  const selectedBursaryPct = Number(selectedStudent?.bursaryPercentage || 0);
  // Live preview should follow slider immediately.
  const effectiveDiscount = percentageNumber > 0 ? discountAmount : 0;

  return (
    <div className="max-w-3xl mx-auto pb-10">
      <div className="mb-8">
        <h1 className="text-[#0c2340] font-black text-2xl m-0">{t("finance.bursary.assignTitle")}</h1>
        <p className="text-slate-500 mt-1">{t("finance.bursary.assignDesc")}</p>
      </div>

      <div ref={formRef} className="neo-card rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="grid gap-6 md:grid-cols-2 mb-8">
          <div className="relative">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              {t("finance.bursary.field.search")}
            </label>
            <div className="relative">
              <input
                type="text"
                value={studentSearch}
                onChange={(e) => {
                  setStudentSearch(e.target.value);
                  if (selectedStudent) setSelectedStudent(null);
                }}
                placeholder="Name or Admission #"
                className="neo-inset-field w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-[#2d3436] outline-none focus:ring-2 focus:ring-[#5a8faf]/40"
              />
              {searchLoading ? (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="animate-spin h-5 w-5 border-2 border-[#0c2340] border-t-transparent rounded-full" />
                </div>
              ) : null}
            </div>

            {studentMatches.length > 0 && !selectedStudent ? (
              <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-60 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl">
                {studentMatches.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setSelectedStudent(s);
                      setStudentSearch(studentLabel(s));
                      setPercentage(String(Number(s.bursaryPercentage) || 0));
                      setStartsAt(toDateTimeLocalValue(s.bursaryStartsAt));
                      setEndsAt(toDateTimeLocalValue(s.bursaryEndsAt));
                      setStudentMatches([]);
                      setExpiryDismissed(false);
                    }}
                    className="w-full border-b border-slate-50 px-4 py-3 text-left hover:bg-slate-50"
                  >
                    <div className="font-bold text-slate-800">{s.fullName}</div>
                    <div className="text-xs font-medium text-slate-500">
                      {s.admissionNumber} • {s.className}
                    </div>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              {t("finance.bursary.field.term")}
            </label>
            <div className="neo-inset-field w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700 bg-slate-50">
              <span className="font-black">{term}</span>{" "}
              <span className="ml-2 text-xs font-semibold text-slate-500">
                {initialTerm?.trim() ? "(from record)" : "(header picker)"}
              </span>
            </div>
          </div>
        </div>

        {selectedStudent ? (
          <>
            <div className="rounded-2xl bg-gradient-to-br from-[#0c2340] to-[#1e3a8a] p-6 text-white flex items-center justify-between mb-6">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-widest text-white/80">
                  {selectedStudent.fullName}
                </p>
                <p className="mt-1 text-sm font-semibold text-white/90">
                  {selectedStudent.className} • {normalizeStatusLabel(selectedStudent.boardingStatus)}
                </p>
              </div>
              <div className="text-right">
                <div className="inline-flex items-center rounded-full bg-white/10 px-4 py-2 text-xs font-black tracking-widest">
                  {selectedStudent.admissionNumber}
                </div>
              </div>
            </div>

            {expiryState !== null && !expiryDismissed ? (
              <div
                className={
                  expiryState.kind === "expired"
                    ? "mb-6 rounded-2xl border border-red-300 bg-red-50 px-5 py-4"
                    : "mb-6 rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4"
                }
              >
                {expiryState.kind === "expiring_soon" ? (
                  <>
                    <p className="text-sm font-black text-amber-900">
                      ⏱ Bursary expires in {expiryState.daysLeft} day(s) — {formatDate(expiryState.endsAt)}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-amber-800">
                      This student's fees will revert to {expectedBase != null ? formatCurrencyUGX(expectedBase) : "standard rate"} on expiry.
                    </p>
                    <div className="mt-3 flex gap-2 justify-end">
                      <button type="button" onClick={handleExtendFromExpiry} className="rounded-lg border border-amber-400 bg-white px-3 py-1.5 text-xs font-black text-amber-900">
                        Extend Bursary
                      </button>
                      <button type="button" onClick={() => setExpiryDismissed(true)} className="rounded-lg border border-amber-300 bg-amber-100 px-3 py-1.5 text-xs font-black text-amber-900">
                        Dismiss
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-black text-red-900">❌ Bursary expired on {formatDate(expiryState.endsAt)}</p>
                    <p className="mt-1 text-xs font-semibold text-red-800">
                      Fees have reverted to standard rate: {expectedBase != null ? formatCurrencyUGX(expectedBase) : "—"}.
                      This student has been removed from the active bursary list.
                    </p>
                    <div className="mt-3 flex gap-2 justify-end">
                      <button type="button" onClick={handleAssignNewFromExpiry} className="rounded-lg border border-red-400 bg-white px-3 py-1.5 text-xs font-black text-red-900">
                        Assign New Bursary
                      </button>
                      <button type="button" onClick={() => setExpiryDismissed(true)} className="rounded-lg border border-red-300 bg-red-100 px-3 py-1.5 text-xs font-black text-red-900">
                        Dismiss
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : null}

            <div className="rounded-2xl bg-gradient-to-br from-[#0c2340] to-[#1e3a8a] p-5 text-white mb-8">
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-widest text-white/75">Total Assigned Fees</p>
                  <p className="mt-2 text-2xl font-black">{expectedBase != null ? formatCurrencyUGX(expectedBase) : "—"}</p>
                </div>
                <div>
                  <p className="text-[11px] font-black uppercase tracking-widest text-white/75">Bursary Discount</p>
                  <p className="mt-2 text-lg font-black" style={{ color: "#6ee7b7" }}>
                    {percentageNumber > 0 ? `${percentageNumber}% = ${formatCurrencyUGX(effectiveDiscount)}` : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-black uppercase tracking-widest text-white/75">Current Balance</p>
                  <p className="mt-2 text-2xl font-black" style={{ color: "#fbbf24" }}>
                    {currentBalance != null ? formatCurrencyUGX(currentBalance) : "—"}
                  </p>
                  {!activeNow && selectedStudent.bursaryStartsAt && selectedStudent.bursaryEndsAt ? (
                    <span
                      className={
                        new Date(selectedStudent.bursaryEndsAt).getTime() <= Date.now()
                          ? "mt-2 inline-flex rounded-full bg-red-100 px-2 py-1 text-[10px] font-black text-red-700"
                          : "mt-2 inline-flex rounded-full bg-amber-100 px-2 py-1 text-[10px] font-black text-amber-800"
                      }
                    >
                      {new Date(selectedStudent.bursaryEndsAt).getTime() <= Date.now()
                        ? `Expired ${formatDate(selectedStudent.bursaryEndsAt)}`
                        : `Starts ${formatDate(selectedStudent.bursaryStartsAt)}`}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="mb-8">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                {t("finance.bursary.field.percentage")}
              </label>
              <div className="flex flex-wrap items-center gap-4">
                <input
                  ref={sliderRef}
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={percentage}
                  onChange={(e) => setPercentage(e.target.value)}
                  className="flex-1 accent-[#0c2340]"
                />
                <div className="h-12 w-20 rounded-xl bg-[#0c2340] text-white flex items-center justify-center font-black">
                  {percentage}%
                </div>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={percentage}
                  onChange={(e) => setPercentage(e.target.value)}
                  className="neo-inset-field w-32 rounded-xl px-4 py-2.5 text-sm font-semibold text-[#2d3436] outline-none focus:ring-2 focus:ring-[#5a8faf]/40"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 mb-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Bursary starts at *
                </label>
                <input
                  type="datetime-local"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                  required
                  className="neo-inset-field w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-[#2d3436] outline-none focus:ring-2 focus:ring-[#5a8faf]/40"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Bursary ends at *
                </label>
                <input
                  type="datetime-local"
                  value={endsAt}
                  onChange={(e) => setEndsAt(e.target.value)}
                  required
                  className="neo-inset-field w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-[#2d3436] outline-none focus:ring-2 focus:ring-[#5a8faf]/40"
                />
              </div>
            </div>

            {bursaryDurationDays != null ? (
              <div className="mb-8">
                <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-1.5 text-xs font-bold text-slate-600">
                  📅 Duration: {bursaryDurationDays} day{bursaryDurationDays === 1 ? "" : "s"} (from {formatDate(startsAt)} to {formatDate(endsAt)})
                </span>
              </div>
            ) : null}

            {statusMsg ? (
              <div
                className={
                  statusMsg.type === "success"
                    ? "rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-bold text-emerald-800 mb-6"
                    : "rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-800 mb-6"
                }
              >
                {statusMsg.text}
              </div>
            ) : null}

            <div className="flex gap-4">
              <button
                type="button"
                disabled={!isFormReady}
                onClick={handleApply}
                className="flex-[2] h-14 rounded-2xl bg-gradient-to-r from-[#0c2340] to-[#1a3a5c] text-white font-black text-sm shadow-lg transition-all hover:shadow-xl disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? "Processing..." : t("finance.bursary.btn.apply")}
              </button>
              <button
                type="button"
                disabled={historicalReadOnly || submitting || Number(selectedStudent.bursaryPercentage || 0) === 0}
                onClick={() => void handleRevoke()}
                className="flex-1 h-14 rounded-2xl border-2 border-red-400 bg-white text-red-500 font-black text-sm transition-all hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t("finance.bursary.btn.revoke")}
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <div className="text-4xl mb-4">🔎</div>
            <p className="text-sm font-bold">Select a student to manage their bursary.</p>
          </div>
        )}
      </div>

      <hr className="my-8 border-slate-200" />

      <section className="neo-card rounded-2xl border border-slate-200 bg-white p-5">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-black uppercase tracking-widest text-[#0c2340] m-0">
            Active Bursaries — {term}
          </p>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-black text-slate-700">
            {filteredRows.length} students
          </span>
        </div>

        <div className="mb-2 flex items-center justify-end gap-3">
          <input
            type="text"
            value={tableFilter}
            onChange={(e) => setTableFilter(e.target.value)}
            placeholder="Filter by name or adm no…"
            style={{
              height: 30,
              width: 200,
              fontSize: 12,
              border: "1px solid #7b9cbf",
              padding: "0 8px",
              outline: "none",
            }}
          />
          <span className="text-[11px] font-bold text-slate-500">
            Showing {filteredRows.length} of {bursaryRows.length}
          </span>
        </div>

        <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: 400, border: "2px solid #7b9cbf" }}>
          {tableLoading ? (
            <div className="py-10 text-center text-sm font-semibold text-slate-400">Loading active bursaries…</div>
          ) : filteredRows.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-400">
              No active bursaries for {term}.
              <br />
              Assign a bursary above to see students listed here.
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", borderSpacing: 0, borderRadius: 0, fontSize: 12 }}>
              <thead style={{ position: "sticky", top: 0, zIndex: 10 }}>
                <tr>
                  {[
                    "No.",
                    "Adm No.",
                    "Student Name",
                    "Class",
                    "Status",
                    "Term Fee (UGX)",
                    "Bursary %",
                    "Discount (UGX)",
                    "Balance (UGX)",
                    "Starts",
                    "Expires",
                    "Days Left",
                    "Actions",
                  ].map((head) => (
                    <th
                      key={head}
                      style={{
                        background: "#dce6f1",
                        border: "1px solid #7b9cbf",
                        height: 28,
                        padding: "0 6px",
                        textAlign: head.includes("(UGX)") ? "right" : head === "Bursary %" || head === "Days Left" ? "center" : "left",
                        fontWeight: 800,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {head}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row, idx) => {
                  const rowDays = Number.isFinite(row.daysRemaining) ? row.daysRemaining : daysRemaining(row.endsAt);
                  const isExpiringSoon = rowDays >= 0 && rowDays <= 7;
                  const isExpired = rowDays < 0;
                  const isSelected = selectedStudent?.id === row.studentId;
                  const rowBg = isExpired
                    ? "#fff1f2"
                    : isSelected
                      ? "#eff6ff"
                      : isExpiringSoon
                        ? "#fffbeb"
                        : idx % 2 === 0
                          ? "#ffffff"
                          : "#f5f9ff";
                  const leftBorder = isSelected
                    ? "3px solid #1d4ed8"
                    : isExpired
                      ? "3px solid #ef4444"
                      : isExpiringSoon
                        ? "3px solid #f59e0b"
                        : "1px solid #c8d8e8";
                  const baseColor = isExpired ? "#6b7280" : "#1f2937";
                  return (
                    <tr key={`${row.studentId}-${row.startsAt}-${row.endsAt}`} style={{ background: rowBg, color: baseColor, height: 26 }}>
                      <td style={{ width: 40, border: "1px solid #c8d8e8", borderLeft: leftBorder, padding: "0 6px" }}>{idx + 1}</td>
                      <td style={{ width: 90, border: "1px solid #c8d8e8", padding: "0 6px" }}>{row.admissionNumber}</td>
                      <td style={{ width: 200, border: "1px solid #c8d8e8", padding: "0 6px", fontWeight: 700 }}>{row.fullName}</td>
                      <td style={{ width: 80, border: "1px solid #c8d8e8", padding: "0 6px" }}>{row.className}</td>
                      <td style={{ width: 90, border: "1px solid #c8d8e8", padding: "0 6px" }}>{normalizeStatusLabel(row.boardingStatus)}</td>
                      <td style={{ width: 130, border: "1px solid #c8d8e8", padding: "0 6px", textAlign: "right" }}>{formatCurrencyUGX(row.termFee)}</td>
                      <td style={{ width: 80, border: "1px solid #c8d8e8", padding: "0 6px", textAlign: "center", fontWeight: 700 }}>{row.bursaryPercentage}%</td>
                      <td style={{ width: 130, border: "1px solid #c8d8e8", padding: "0 6px", textAlign: "right", color: isExpired ? "#6b7280" : "#b91c1c", fontWeight: 700 }}>
                        {formatCurrencyUGX(row.discountAmount)}
                      </td>
                      <td style={{ width: 130, border: "1px solid #c8d8e8", padding: "0 6px", textAlign: "right", color: isExpired ? "#6b7280" : "#15803d", fontWeight: 700 }}>
                        {formatCurrencyUGX(row.currentBalance)}
                      </td>
                      <td style={{ width: 110, border: "1px solid #c8d8e8", padding: "0 6px" }}>{formatDate(row.startsAt)}</td>
                      <td style={{ width: 110, border: "1px solid #c8d8e8", padding: "0 6px" }}>{formatDate(row.endsAt)}</td>
                      <td style={{ width: 80, border: "1px solid #c8d8e8", padding: "0 6px", textAlign: "center", fontWeight: 800, color: isExpired ? "#b91c1c" : isExpiringSoon ? "#b45309" : baseColor }}>
                        {isExpired ? "Expired" : rowDays}
                      </td>
                      <td style={{ width: 120, border: "1px solid #c8d8e8", padding: "0 6px" }}>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              void fetchStudent(row.studentId).then((student) => {
                                setSelectedStudent(student);
                                setStudentSearch(studentLabel(student));
                                setPercentage(String(Number(student.bursaryPercentage) || 0));
                                setStartsAt(toDateTimeLocalValue(student.bursaryStartsAt));
                                setEndsAt(toDateTimeLocalValue(student.bursaryEndsAt));
                                setExpiryDismissed(false);
                                formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                              });
                            }}
                            style={{ height: 22, padding: "0 8px", border: "1px solid #9ca3af", background: "#fff", fontSize: 11, fontWeight: 700 }}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleRevoke({ id: row.studentId })}
                            style={{ height: 22, padding: "0 8px", border: "1px solid #ef4444", background: "#fff", color: "#dc2626", fontSize: 11, fontWeight: 700 }}
                          >
                            Revoke
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot style={{ position: "sticky", bottom: 0, zIndex: 9 }}>
                <tr style={{ background: "#dce6f1", fontWeight: 800 }}>
                  <td style={{ border: "1px solid #7b9cbf", padding: "4px 6px" }} />
                  <td style={{ border: "1px solid #7b9cbf", padding: "4px 6px" }} />
                  <td style={{ border: "1px solid #7b9cbf", padding: "4px 6px" }}>{filteredRows.length} students</td>
                  <td style={{ border: "1px solid #7b9cbf", padding: "4px 6px" }} />
                  <td style={{ border: "1px solid #7b9cbf", padding: "4px 6px" }} />
                  <td style={{ border: "1px solid #7b9cbf", padding: "4px 6px", textAlign: "right" }}>Σ {formatCurrencyUGX(totals.termFee)}</td>
                  <td style={{ border: "1px solid #7b9cbf", padding: "4px 6px" }} />
                  <td style={{ border: "1px solid #7b9cbf", padding: "4px 6px", textAlign: "right" }}>Σ {formatCurrencyUGX(totals.discount)}</td>
                  <td style={{ border: "1px solid #7b9cbf", padding: "4px 6px", textAlign: "right" }}>Σ {formatCurrencyUGX(totals.balance)}</td>
                  <td style={{ border: "1px solid #7b9cbf", padding: "4px 6px" }} />
                  <td style={{ border: "1px solid #7b9cbf", padding: "4px 6px" }} />
                  <td style={{ border: "1px solid #7b9cbf", padding: "4px 6px" }} />
                  <td style={{ border: "1px solid #7b9cbf", padding: "4px 6px" }} />
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </section>

      <ConfirmModal
        open={!!confirmModal}
        title={confirmModal?.title ?? ""}
        description={confirmModal?.description ?? ""}
        variant={confirmModal?.variant ?? "danger"}
        loading={submitting}
        onConfirm={confirmModal?.onConfirm ?? (() => undefined)}
        onCancel={() => setConfirmModal(null)}
      />
    </div>
  );
}
