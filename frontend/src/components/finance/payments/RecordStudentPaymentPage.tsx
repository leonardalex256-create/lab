import { useEffect, useState } from "react";
import { createFinancePayment } from "../../../api/financePayments";
import { fetchStudentStatement } from "../../../api/financeStatements";
import { fetchDebtorsReport } from "../../../api/financeDebtors";
import { fetchFinanceDashboard } from "../../../api/financeDashboard";
import { fetchStudents, type StudentApiRow } from "../../../api/students";
import { StudentStatementPage } from "../statements/StudentStatementPage";
import { StudentReceiptPage } from "./StudentReceiptPage";
import type { StudentPaymentReceipt, StudentStatementPayload } from "../shared/financeTypes";
import { useTermContext } from "../../../context/TermContext";
import { numberToWords, toSentenceCase } from "../shared/numberToWords";

function studentLabel(student: StudentApiRow): string {
  return `${student.fullName} (${student.admissionNumber})`;
}

type ViewMode = "form" | "receipt" | "statement";

type ReportStatus = {
  status: string;
  isReopened: boolean;
  isLocked: boolean;
};

export function RecordStudentPaymentPage({ generatedByName }: { generatedByName?: string }) {
  const { viewingTerm: term, viewingAcademicYear, historicalReadOnly } = useTermContext();
  const [mode, setMode] = useState<ViewMode>("form");
  const [studentSearch, setStudentSearch] = useState("");
  const [studentMatches, setStudentMatches] = useState<StudentApiRow[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentApiRow | null>(null);
  const [method, setMethod] = useState("Cash");
  const [paidBy, setPaidBy] = useState("");
  const [amount, setAmount] = useState("");
  const [outstandingDue, setOutstandingDue] = useState<number | null>(null);
  const [changeReason, setChangeReason] = useState("");
  const [receipt, setReceipt] = useState<StudentPaymentReceipt | null>(null);
  const [statement, setStatement] = useState<StudentStatementPayload | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [reportStatus, setReportStatus] = useState<ReportStatus | null>(null);

  // Fetch today's report status to determine locking
  useEffect(() => {
    void fetchFinanceDashboard()
      .then((dash) => {
        const st = dash.today.reportStatus;
        const isReopened = dash.today.isReopened;
        const isLocked =
          st === "submitted" || st === "admin_review" || st === "closed";
        setReportStatus({ status: st, isReopened, isLocked: isLocked && !isReopened });
      })
      .catch(() => {
        setReportStatus(null);
      });
  }, []);

  // Student search effect
  useEffect(() => {
    if (studentSearch.trim().length < 2) {
      setStudentMatches([]);
      return;
    }
    let cancelled = false;
    setSearchLoading(true);
    // #region agent log
    void fetch("http://127.0.0.1:7413/ingest/299b84ae-e9b2-45ce-b53d-28789819d44d", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "b215a2",
      },
      body: JSON.stringify({
        sessionId: "b215a2",
        runId: "pre_debug",
        hypothesisId: "H1_studentSearchFetchResultShape",
        location: "RecordStudentPaymentPage.tsx:studentSearch:beforeFetch",
        message: "About to fetch students for search",
        data: { qLen: studentSearch.trim().length },
        timestamp: Date.now(),
      }),
    }).catch(() => { });
    // #endregion
    void fetchStudents({ q: studentSearch.trim(), sortBy: "name", sortDir: "asc", limit: 8 })
      .then((result) => {
        if (!cancelled) setStudentMatches(result.items);
        // #region agent log
        void fetch("http://127.0.0.1:7413/ingest/299b84ae-e9b2-45ce-b53d-28789819d44d", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Debug-Session-Id": "b215a2",
          },
          body: JSON.stringify({
            sessionId: "b215a2",
            runId: "pre_debug",
            hypothesisId: "H2_studentSearchItemsCount",
            location: "RecordStudentPaymentPage.tsx:studentSearch:afterFetch",
            message: "Fetched student search results",
            data: {
              itemsCount: result.items.length,
              firstId: result.items[0]?.id ?? null,
            },
            timestamp: Date.now(),
          }),
        }).catch(() => { });
        // #endregion
      })
      .catch(() => {
        if (!cancelled) setStudentMatches([]);
        // #region agent log
        void fetch("http://127.0.0.1:7413/ingest/299b84ae-e9b2-45ce-b53d-28789819d44d", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Debug-Session-Id": "b215a2",
          },
          body: JSON.stringify({
            sessionId: "b215a2",
            runId: "pre_debug",
            hypothesisId: "H3_studentSearchFetchError",
            location: "RecordStudentPaymentPage.tsx:studentSearch:catch",
            message: "Student search fetch failed",
            data: {},
            timestamp: Date.now(),
          }),
        }).catch(() => { });
        // #endregion
      })
      .finally(() => {
        if (!cancelled) setSearchLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [studentSearch]);

  const parsedAmount = Math.max(Number(amount) || 0, 0);
  const amountWords = `${toSentenceCase(numberToWords(parsedAmount))} Uganda shillings only`;
  const calculatedBalance = outstandingDue != null ? outstandingDue - parsedAmount : null;

  useEffect(() => {
    if (!selectedStudent) {
      setOutstandingDue(null);
      return;
    }
    let cancelled = false;
    void fetchDebtorsReport(term, viewingAcademicYear)
      .then((report) => {
        if (cancelled) return;
        const row = report.items.find((x) => x.id === selectedStudent.id);
        setOutstandingDue(row ? Number(row.balance) : 0);
      })
      .catch(() => {
        if (!cancelled) setOutstandingDue(null);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedStudent, term, viewingAcademicYear]);

  const createReceipt = async (printAfterCreate = false) => {
    setFormError(null);
    if (!selectedStudent) {
      setFormError("Select a student from the search results.");
      return;
    }
    // Even if UI input is allowed for searching, recording payments must be blocked when the daily report is locked.
    if (historicalReadOnly) {
      setFormError(
        "You can view past terms, but only administrators can record payments outside the current school term.",
      );
      return;
    }
    if (reportStatus?.isLocked && !reportStatus?.isReopened) {
      setFormError("Data entry is locked for today. Ask an admin to reopen the report before saving payments.");
      return;
    }
    if (parsedAmount <= 0) {
      setFormError("Amount paid must be greater than zero.");
      return;
    }
    if (reportStatus?.isReopened && !changeReason.trim()) {
      setFormError("Please provide a reason for this change since the report was previously submitted.");
      return;
    }
    setSubmitting(true);
    try {
      const calculatedOutstandingAfterSave =
        outstandingDue != null ? Math.max(outstandingDue - parsedAmount, 0) : null;
      const saved = await createFinancePayment({
        studentId: selectedStudent.id,
        term,
        paymentMethod: method,
        paidBy: paidBy.trim() || selectedStudent.parentFullName || "Parent / Guardian",
        amountPaid: parsedAmount,
        // Do not overwrite assigned term fee while recording payments.
        // Payment flow should subtract from existing outstanding balance only.
        amountDueUgx: undefined,
        changeReason: reportStatus?.isReopened ? changeReason.trim() : null,
      });
      setReceipt({
        ...saved,
        outstandingAfter:
          calculatedOutstandingAfterSave != null
            ? calculatedOutstandingAfterSave
            : saved.outstandingAfter,
        generatedByName:
          (saved.generatedByName ??
          generatedByName?.trim()) ||
          "Account User",
      });
      setMode("receipt");
      if (printAfterCreate) window.setTimeout(() => window.print(), 150);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Failed to save payment.");
    } finally {
      setSubmitting(false);
    }
  };

  const openStatement = async () => {
    if (!selectedStudent) return;
    try {
      const data = await fetchStudentStatement(selectedStudent.id, term, viewingAcademicYear);
      setStatement(data);
      setMode("statement");
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Failed to load statement");
    }
  };

  /* ── Receipt View ── */
  if (mode === "receipt" && receipt) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2 print:hidden">
          <button
            type="button"
            onClick={() => setMode("form")}
            style={{
              background: "rgba(15,23,42,0.06)",
              color: "#1e293b",
              borderRadius: "12px",
              padding: "10px 20px",
              fontWeight: 600,
              fontSize: "0.85rem",
              border: "none",
              cursor: "pointer",
            }}
          >
            ← Back to Record Payment
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            style={{
              background: "linear-gradient(135deg, #0c2340, #1a3a5c)",
              color: "#fff",
              borderRadius: "12px",
              padding: "10px 20px",
              fontWeight: 700,
              fontSize: "0.85rem",
              border: "none",
              cursor: "pointer",
            }}
          >
            🖨️ Print Receipt
          </button>
          <button
            type="button"
            onClick={() => void openStatement()}
            style={{
              background: "linear-gradient(135deg, #059669, #047857)",
              color: "#fff",
              borderRadius: "12px",
              padding: "10px 20px",
              fontWeight: 700,
              fontSize: "0.85rem",
              border: "none",
              cursor: "pointer",
            }}
          >
            📄 View Term Statement
          </button>
        </div>
        <StudentReceiptPage
          receipt={{
            ...receipt,
            generatedByName:
              (receipt.generatedByName ??
              generatedByName?.trim()) ||
              "Account User",
          }}
        />
      </div>
    );
  }

  /* ── Statement View ── */
  if (mode === "statement" && statement) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2 print:hidden">
          <button
            type="button"
            onClick={() => setMode("form")}
            style={{
              background: "rgba(15,23,42,0.06)",
              color: "#1e293b",
              borderRadius: "12px",
              padding: "10px 20px",
              fontWeight: 600,
              fontSize: "0.85rem",
              border: "none",
              cursor: "pointer",
            }}
          >
            ← Back to Payment Form
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            style={{
              background: "linear-gradient(135deg, #0c2340, #1a3a5c)",
              color: "#fff",
              borderRadius: "12px",
              padding: "10px 20px",
              fontWeight: 700,
              fontSize: "0.85rem",
              border: "none",
              cursor: "pointer",
            }}
          >
            🖨️ Print Statement
          </button>
        </div>
        <StudentStatementPage statement={statement} />
      </div>
    );
  }

  /* ── Locked state ── */
  const isLocked = reportStatus?.isLocked === true;
  const isReopened = reportStatus?.isReopened === true;
  const saveDisabled =
    submitting ||
    historicalReadOnly ||
    isLocked ||
    !selectedStudent ||
    parsedAmount <= 0 ||
    (isReopened && !changeReason.trim());

  /* ── Payment Form ── */
  return (
    <div style={{ maxWidth: 860, margin: "0 auto" }}>
      {/* Status Banners */}
      {isLocked && (
        <div
          style={{
            background: "rgba(239,68,68,0.08)",
            borderLeft: "5px solid #ef4444",
            padding: "16px 24px",
            borderRadius: "12px",
            marginBottom: 24,
            display: "flex",
            alignItems: "center",
            gap: 15,
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              background: "#fee2e2",
              color: "#dc2626",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.3rem",
              flexShrink: 0,
            }}
          >
            🔒
          </div>
          <div>
            <h4 style={{ margin: 0, color: "#7f1d1d", fontSize: "0.95rem", fontWeight: 800 }}>
              DATA ENTRY LOCKED
            </h4>
            <p style={{ margin: "3px 0 0", color: "#991b1b", fontSize: "0.8rem" }}>
              Today's financial report has been submitted. No further payments can be recorded until
              reopened by an Admin.
            </p>
          </div>
        </div>
      )}

      {isReopened && (
        <div
          style={{
            background: "rgba(139,92,246,0.08)",
            borderLeft: "5px solid #8b5cf6",
            padding: "16px 24px",
            borderRadius: "12px",
            marginBottom: 24,
            display: "flex",
            alignItems: "center",
            gap: 15,
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              background: "#ede9fe",
              color: "#7c3aed",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.3rem",
              flexShrink: 0,
            }}
          >
            🔓
          </div>
          <div>
            <h4 style={{ margin: 0, color: "#5b21b6", fontSize: "0.95rem", fontWeight: 800 }}>
              DATA ENTRY REOPENED
            </h4>
            <p style={{ margin: "3px 0 0", color: "#6d28d9", fontSize: "0.8rem" }}>
              An Administrator has unlocked today's entries for corrections. You must provide a
              reason for each entry.
            </p>
          </div>
        </div>
      )}

      {/* Main Card */}
      <div
        style={{
          background: "#fff",
          borderRadius: 28,
          padding: "40px",
          border: "1px solid #e2e8f0",
          boxShadow: "0 10px 25px -5px rgba(0,0,0,0.05)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Locked Overlay */}
        {isLocked && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(255,255,255,0.75)",
              backdropFilter: "blur(3px)",
              zIndex: 50,
              // Allow the operator to still type into the search input while locked,
              // but block saving via disabled buttons + createReceipt guard.
              pointerEvents: "none",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              padding: 30,
            }}
          >
            <div
              style={{
                width: 80,
                height: 80,
                background: "#fee2e2",
                color: "#dc2626",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "2.5rem",
                marginBottom: 20,
                boxShadow: "0 10px 15px -3px rgba(220,38,38,0.2)",
              }}
            >
              🔒
            </div>
            <h3 style={{ color: "#991b1b", fontWeight: 800, marginBottom: 8 }}>Section Locked</h3>
            <p
              style={{
                color: "#b91c1c",
                maxWidth: 400,
                fontWeight: 500,
                fontSize: "0.9rem",
              }}
            >
              Today's financial report has been submitted or closed. Data entry is disabled to
              maintain record integrity.
            </p>
          </div>
        )}

        {/* Header Section */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div
            style={{
              width: 70,
              height: 70,
              background: "linear-gradient(135deg, rgba(12,35,64,0.08), rgba(234,160,62,0.15))",
              color: "#0c2340",
              borderRadius: 24,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 15px",
              fontSize: "1.8rem",
              boxShadow: "inset 0 2px 4px 0 rgba(0,0,0,0.06)",
            }}
          >
            💰
          </div>
          <h2
            style={{
              color: "#0c2340",
              margin: 0,
              fontWeight: 800,
              fontSize: "1.75rem",
              letterSpacing: "-0.02em",
            }}
          >
            Record Student Payment
          </h2>
          <p style={{ color: "#64748b", fontSize: "1rem", marginTop: 8 }}>
            Securely record student fee collection and generate receipts.
          </p>
        </div>

        {/* Form */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32, marginBottom: 32 }}>
          {/* Student Search */}
          <div style={{ position: "relative" }}>
            <label
              style={{
                fontWeight: 700,
                color: "#334155",
                marginBottom: 10,
                display: "block",
                fontSize: "0.9rem",
                letterSpacing: "0.03em",
              }}
            >
              STUDENT SEARCH <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <div style={{ position: "relative" }}>
              <span
                style={{
                  position: "absolute",
                  left: 16,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "#94a3b8",
                  fontSize: "1rem",
                }}
              >
                🔍
              </span>
              <input
                value={studentSearch}
                onChange={(e) => {
                  setStudentSearch(e.target.value);
                  if (selectedStudent) setSelectedStudent(null);
                }}
                placeholder="Start typing name or admission #"
                style={{
                  height: 56,
                  borderRadius: 12,
                  border: "2px solid #e2e8f0",
                  padding: "0 16px 0 44px",
                  fontSize: "1rem",
                  width: "100%",
                  boxSizing: "border-box",
                  transition: "border-color 0.2s, box-shadow 0.2s",
                  outline: "none",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = "#0c2340";
                  e.target.style.boxShadow = "0 0 0 4px rgba(12,35,64,0.08)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "#e2e8f0";
                  e.target.style.boxShadow = "none";
                }}
              />
            </div>
            {searchLoading && (
              <p style={{ marginTop: 4, fontSize: "0.75rem", color: "#94a3b8" }}>
                Searching students...
              </p>
            )}
            {selectedStudent && (
              <div
                style={{
                  marginTop: 8,
                  padding: "10px 14px",
                  background: "rgba(5,150,105,0.06)",
                  border: "1px solid rgba(5,150,105,0.2)",
                  borderRadius: 10,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <span style={{ color: "#059669", fontSize: "1.1rem" }}>✅</span>
                <div>
                  <p
                    style={{
                      margin: 0,
                      fontSize: "0.85rem",
                      fontWeight: 700,
                      color: "#065f46",
                    }}
                  >
                    {selectedStudent.fullName}
                  </p>
                  <p style={{ margin: 0, fontSize: "0.75rem", color: "#6b7280" }}>
                    {selectedStudent.admissionNumber} • {selectedStudent.className}
                  </p>
                </div>
              </div>
            )}
            {studentMatches.length > 0 && !selectedStudent && (
              <div
                style={{
                  marginTop: 4,
                  background: "#fff",
                  border: "1px solid #e2e8f0",
                  borderRadius: 12,
                  boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
                  maxHeight: 250,
                  overflowY: "auto",
                  zIndex: 100,
                  position: "relative",
                }}
              >
                {studentMatches.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setSelectedStudent(s);
                      setStudentSearch(studentLabel(s));
                      setStudentMatches([]);
                      setPaidBy(s.parentFullName ?? "");
                    }}
                    style={{
                      display: "block",
                      width: "100%",
                      padding: "12px 16px",
                      border: "none",
                      borderBottom: "1px solid #f1f5f9",
                      background: "transparent",
                      textAlign: "left",
                      cursor: "pointer",
                      transition: "background 0.15s",
                      fontSize: "0.9rem",
                    }}
                    onMouseOver={(e) =>
                      (e.currentTarget.style.background = "rgba(12,35,64,0.04)")
                    }
                    onMouseOut={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <strong style={{ color: "#1e293b" }}>{s.fullName}</strong>
                    <span
                      style={{
                        display: "block",
                        fontSize: "0.75rem",
                        color: "#94a3b8",
                        marginTop: 2,
                      }}
                    >
                      {s.admissionNumber} • {s.className}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Academic Term */}
          <div>
            <label
              style={{
                fontWeight: 700,
                color: "#334155",
                marginBottom: 10,
                display: "block",
                fontSize: "0.9rem",
                letterSpacing: "0.03em",
              }}
            >
              ACADEMIC TERM <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <div style={{ position: "relative" }}>
              <span
                style={{
                  position: "absolute",
                  left: 16,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "#94a3b8",
                  fontSize: "1rem",
                }}
              >
                📅
              </span>
              <div
                style={{
                  height: 56,
                  borderRadius: 12,
                  border: "2px solid #e2e8f0",
                  padding: "0 16px 0 44px",
                  fontSize: "1rem",
                  width: "100%",
                  boxSizing: "border-box",
                  background: "#f8fafc",
                  display: "flex",
                  alignItems: "center",
                  fontWeight: 700,
                  color: "#0f172a",
                }}
              >
                {term}
                <span style={{ marginLeft: 10, fontSize: "0.75rem", fontWeight: 600, color: "#64748b" }}>
                  (header picker)
                </span>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32, marginBottom: 32 }}>
          {/* Payment Method */}
          <div>
            <label
              style={{
                fontWeight: 700,
                color: "#334155",
                marginBottom: 10,
                display: "block",
                fontSize: "0.9rem",
                letterSpacing: "0.03em",
              }}
            >
              PAYMENT METHOD <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <div style={{ position: "relative" }}>
              <span
                style={{
                  position: "absolute",
                  left: 16,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "#94a3b8",
                  fontSize: "1rem",
                }}
              >
                💳
              </span>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                style={{
                  height: 56,
                  borderRadius: 12,
                  border: "2px solid #e2e8f0",
                  padding: "0 16px 0 44px",
                  fontSize: "1rem",
                  width: "100%",
                  boxSizing: "border-box",
                  background: "#fff",
                  cursor: "pointer",
                  appearance: "none",
                  outline: "none",
                  transition: "border-color 0.2s",
                }}
                onFocus={(e) => (e.target.style.borderColor = "#0c2340")}
                onBlur={(e) => (e.target.style.borderColor = "#e2e8f0")}
              >
                <option value="Cash">Cash Payment</option>
                <option value="Bank Deposit">Bank Deposit / Slip</option>
                <option value="Mobile Money">Mobile Money (MoMo)</option>
                <option value="Other">Other</option>
                <option value="School Pay">School Pay</option>
              </select>
              <span
                style={{
                  position: "absolute",
                  right: 16,
                  top: "50%",
                  transform: "translateY(-50%)",
                  pointerEvents: "none",
                  color: "#94a3b8",
                }}
              >
                ▾
              </span>
            </div>
          </div>

          {/* Paid By */}
          <div>
            <label
              style={{
                fontWeight: 700,
                color: "#334155",
                marginBottom: 10,
                display: "block",
                fontSize: "0.9rem",
                letterSpacing: "0.03em",
              }}
            >
              PAID BY (Depositor's Name)
            </label>
            <div style={{ position: "relative" }}>
              <span
                style={{
                  position: "absolute",
                  left: 16,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "#94a3b8",
                  fontSize: "1rem",
                }}
              >
                👤
              </span>
              <input
                value={paidBy}
                onChange={(e) => setPaidBy(e.target.value)}
                placeholder="Parent / Guardian / Agent name"
                style={{
                  height: 56,
                  borderRadius: 12,
                  border: "2px solid #e2e8f0",
                  padding: "0 16px 0 44px",
                  fontSize: "1rem",
                  width: "100%",
                  boxSizing: "border-box",
                  outline: "none",
                  transition: "border-color 0.2s, box-shadow 0.2s",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = "#0c2340";
                  e.target.style.boxShadow = "0 0 0 4px rgba(12,35,64,0.08)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "#e2e8f0";
                  e.target.style.boxShadow = "none";
                }}
              />
            </div>
            <span style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: 4, display: "block" }}>
              Who physically handed in this payment?
            </span>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32, marginBottom: 24 }}>
          {/* Amount Paid */}
          <div>
            <label
              style={{
                fontWeight: 700,
                color: "#334155",
                marginBottom: 10,
                display: "block",
                fontSize: "0.9rem",
                letterSpacing: "0.03em",
              }}
            >
              AMOUNT PAID (UGX) <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <div style={{ position: "relative" }}>
              <span
                style={{
                  position: "absolute",
                  left: 16,
                  top: "50%",
                  transform: "translateY(-50%)",
                  fontWeight: 800,
                  color: "#94a3b8",
                  fontSize: "0.85rem",
                }}
              >
                UGX
              </span>
              <input
                type="number"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                style={{
                  height: 56,
                  borderRadius: 12,
                  border: "2px solid #e2e8f0",
                  padding: "0 16px 0 56px",
                  fontSize: "1.25rem",
                  fontWeight: 800,
                  color: "#10b981",
                  width: "100%",
                  boxSizing: "border-box",
                  outline: "none",
                  transition: "border-color 0.2s, box-shadow 0.2s",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = "#10b981";
                  e.target.style.boxShadow = "0 0 0 4px rgba(16,185,129,0.1)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "#e2e8f0";
                  e.target.style.boxShadow = "none";
                }}
              />
            </div>
          </div>

          {/* Auto-calculated Student Balance */}
          <div>
            <label
              style={{
                fontWeight: 700,
                color: "#334155",
                marginBottom: 10,
                display: "block",
                fontSize: "0.9rem",
                letterSpacing: "0.03em",
              }}
            >
              STUDENT BALANCE (AUTO-CALCULATED)
            </label>
            <div
              style={{
                minHeight: 56,
                borderRadius: 12,
                border: "2px solid #e2e8f0",
                padding: "12px 16px",
                background: "#f8fafc",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                gap: 4,
              }}
            >
              <span style={{ fontSize: "1.05rem", color: "#0f172a", fontWeight: 900, letterSpacing: "-0.01em" }}>
                {calculatedBalance != null
                  ? `${calculatedBalance.toLocaleString("en-UG")} UGX`
                  : "Select student to auto-calculate"}
              </span>
            </div>
            <span style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: 4, display: "block" }}>
              {outstandingDue != null
                ? `Calculated from ${outstandingDue.toLocaleString("en-UG")} UGX outstanding balance (from Debtors Report) minus ${parsedAmount.toLocaleString("en-UG")} UGX amount paid.`
                : "Balance is automatically fetched after selecting a student."}
            </span>
          </div>
        </div>

        <div
          style={{
            borderRadius: 12,
            border: "1px solid rgba(16,185,129,0.28)",
            background: "rgba(16,185,129,0.08)",
            padding: "12px 14px",
            marginBottom: 24,
          }}
        >
          <p style={{ margin: 0, fontSize: "0.72rem", letterSpacing: "0.1em", fontWeight: 800, color: "#047857" }}>
            AMOUNT IN WORDS (AUTOGENERATED)
          </p>
          <p style={{ margin: "6px 0 0", fontSize: "0.92rem", fontWeight: 800, color: "#065f46" }}>
            {amountWords}
          </p>
        </div>

        {/* Reason for Change (visible only when reopened) */}
        {isReopened && (
          <div style={{ marginBottom: 24 }}>
            <label
              style={{
                fontWeight: 700,
                color: "#7c3aed",
                marginBottom: 10,
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: "0.9rem",
              }}
            >
              💬 REASON FOR ADDITIONAL CHANGE <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <textarea
              value={changeReason}
              onChange={(e) => setChangeReason(e.target.value)}
              placeholder="e.g., Correcting amount, forgotten entry, etc."
              style={{
                height: 80,
                borderRadius: 12,
                border: "2px solid #8b5cf6",
                padding: "12px 16px",
                fontSize: "0.95rem",
                width: "100%",
                boxSizing: "border-box",
                outline: "none",
                resize: "vertical",
                transition: "box-shadow 0.2s",
                fontFamily: "inherit",
              }}
              onFocus={(e) => (e.target.style.boxShadow = "0 0 0 4px rgba(139,92,246,0.15)")}
              onBlur={(e) => (e.target.style.boxShadow = "none")}
            />
            <span
              style={{
                fontSize: "0.75rem",
                color: "#6d28d9",
                marginTop: 4,
                display: "block",
                fontWeight: 500,
              }}
            >
              Please provide a valid reason for this modification as the report was previously
              submitted.
            </span>
          </div>
        )}

        {/* Error Message */}
        {formError && (
          <div
            style={{
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: 12,
              padding: "12px 16px",
              marginBottom: 20,
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <span style={{ fontSize: "1.1rem" }}>⚠️</span>
            <p
              style={{
                margin: 0,
                color: "#991b1b",
                fontSize: "0.85rem",
                fontWeight: 600,
              }}
            >
              {formError}
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 20 }}>
          <button
            type="button"
            onClick={() => void createReceipt(true)}
            disabled={saveDisabled}
            style={{
              height: 56,
              borderRadius: 14,
              fontWeight: 800,
              border: "none",
              background: "linear-gradient(135deg, #0c2340, #1a3a5c)",
              color: "#fff",
              fontSize: "1rem",
              cursor: saveDisabled ? "not-allowed" : "pointer",
              opacity: saveDisabled ? 0.6 : 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              boxShadow: "0 10px 15px -3px rgba(12,35,64,0.2)",
              transition: "all 0.2s",
            }}
            onMouseOver={(e) => {
              if (!saveDisabled) e.currentTarget.style.transform = "translateY(-1px)";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            🖨️ {submitting ? "Saving..." : "Save & Print Receipt"}
          </button>
        </div>
      </div>
    </div>
  );
}
