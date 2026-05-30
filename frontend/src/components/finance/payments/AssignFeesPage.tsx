import { useEffect, useMemo, useRef, useState } from "react";
import { fetchStudents, type StudentApiRow } from "../../../api/students";
import { assignStudentFee, fetchStudentStatement } from "../../../api/financeStatements";
import { fetchFeeStructure, type FeeStructureRow } from "../../../api/financeFeeStructure";
import { formatCurrencyUGX } from "../shared/financeFormat";
import { AssignFeesMultiplePage } from "./AssignFeesMultiplePage";
import { StudentFeeLineItemsPanel } from "./StudentFeeLineItemsPanel";
import { useTermContext } from "../../../context/TermContext";

/** Sentinel value for fee type `<select>` — not a fee-structure status slug. */
const CUSTOM_FEE_STATUS = "__custom__";

function isP7Class(className: string | null | undefined): boolean {
  const s = (className ?? "").trim().toLowerCase();
  return s.includes("p7") || s.includes("primary seven");
}

type AssignmentPreview = {
  assignedAmount: number;
  totalPaid: number;
  outstandingAmount: number;
  creditAmount: number;
};

function suggestFeeStatus(
  student: StudentApiRow | null,
  rows: FeeStructureRow[],
): { status: string; reason: string } | null {
  if (!student || rows.length === 0) return null;
  const normalized = (student.boardingStatus ?? "").toLowerCase();
  const candidates: string[] = [];

  if (normalized === "boarding") {
    candidates.push("boarding");
  } else if (normalized === "day_full") {
    if (isP7Class(student.className)) candidates.push("day_full_p7");
    candidates.push("day_full");
  } else if (normalized === "day_half") {
    candidates.push("day_half");
  }

  const matchByStatus = candidates
    .map((key) => rows.find((row) => row.status === key))
    .find((row): row is FeeStructureRow => Boolean(row));
  if (matchByStatus) {
    const isP7Rate = matchByStatus.status === "day_full_p7";
    return {
      status: matchByStatus.status,
      reason: isP7Rate
        ? "P7 full-day rate applied (day_full_p7) based on class and status."
        : `Suggested from status "${student.boardingStatus ?? "unknown"}".`,
    };
  }

  const labelHint =
    normalized === "boarding"
      ? "boarding"
      : normalized === "day_half"
        ? "half"
        : normalized === "day_full"
          ? "full"
          : "";
  if (labelHint) {
    const matchByLabel = rows.find((row) => row.label.toLowerCase().includes(labelHint));
    if (matchByLabel) {
      return {
        status: matchByLabel.status,
        reason: `Suggested from status "${student.boardingStatus ?? "unknown"}".`,
      };
    }
  }

  return {
    status: rows[0].status,
    reason: "No exact status match found, showing first available fee structure option.",
  };
}

function studentLabel(student: StudentApiRow): string {
  return `${student.fullName} (${student.admissionNumber})`;
}

export function AssignFeesPage() {
  const { viewingTerm: term, viewingAcademicYear, historicalReadOnly } = useTermContext();
  const [studentSearch, setStudentSearch] = useState("");
  const [studentMatches, setStudentMatches] = useState<StudentApiRow[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentApiRow | null>(null);
  /** Students checked for bulk assign (same fee row + term for all). */
  const [bulkStudents, setBulkStudents] = useState<StudentApiRow[]>([]);
  const [feeRows, setFeeRows] = useState<FeeStructureRow[]>([]);
  const [feeTypeStatus, setFeeTypeStatus] = useState("");
  const [customFeeDescription, setCustomFeeDescription] = useState("");
  const [customAmountInput, setCustomAmountInput] = useState("");
  const [feeStructureLoading, setFeeStructureLoading] = useState(false);
  const [notes, setNotes] = useState("");
  const [preview, setPreview] = useState<AssignmentPreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [suggestionNote, setSuggestionNote] = useState<string | null>(null);
  const [showMultipleAssignPage, setShowMultipleAssignPage] = useState(false);

  const feeTypeStatusRef = useRef(feeTypeStatus);
  feeTypeStatusRef.current = feeTypeStatus;

  const isCustomFee = feeTypeStatus === CUSTOM_FEE_STATUS;

  const selectedFeeRow = useMemo(
    () => feeRows.find((row) => row.status === feeTypeStatus) ?? null,
    [feeRows, feeTypeStatus],
  );
  const structureAmountUgx = useMemo(
    () => Math.max(Number(selectedFeeRow?.amountDueUgx ?? 0) || 0, 0),
    [selectedFeeRow],
  );
  const customAmountUgx = useMemo(() => {
    const raw = customAmountInput.replace(/,/g, "").trim();
    if (!raw) return 0;
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [customAmountInput]);

  const assignAmountUgx = isCustomFee ? customAmountUgx : structureAmountUgx;

  const bulkIdSet = useMemo(() => new Set(bulkStudents.map((s) => s.id)), [bulkStudents]);

  /** Fee suggestion + statement preview follow first bulk pick, else the singly selected student. */
  const previewStudent = bulkStudents[0] ?? selectedStudent;

  function toggleBulkStudent(student: StudentApiRow) {
    setBulkStudents((prev) => {
      if (prev.some((s) => s.id === student.id)) {
        return prev.filter((s) => s.id !== student.id);
      }
      return [...prev, student];
    });
    setSuccessMsg(null);
  }

  function removeBulkStudent(id: number) {
    setBulkStudents((prev) => prev.filter((s) => s.id !== id));
    setSuccessMsg(null);
  }

  function clearBulkSelection() {
    setBulkStudents([]);
    setSuccessMsg(null);
  }

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
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const loadStructure = async () => {
      setFeeStructureLoading(true);
      try {
        const rows = await fetchFeeStructure(term);
        if (cancelled) return;
        setFormError(null);
        setFeeRows(rows);
        setFeeTypeStatus((prev) => {
          if (prev === CUSTOM_FEE_STATUS) return prev;
          if (prev && rows.some((row) => row.status === prev)) return prev;
          return rows[0]?.status ?? "";
        });
      } catch (e) {
        if (!cancelled) {
          setFeeRows([]);
          setFeeTypeStatus((prev) => (prev === CUSTOM_FEE_STATUS ? prev : ""));
          setFormError(e instanceof Error ? e.message : "Failed to load fee structure.");
        }
      } finally {
        if (!cancelled) setFeeStructureLoading(false);
      }
    };

    void loadStructure();
    // Keep options in sync when admin updates fee structure.
    timer = setInterval(() => {
      void loadStructure();
    }, 30000);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [term]);

  useEffect(() => {
    if (feeTypeStatusRef.current === CUSTOM_FEE_STATUS) {
      setSuggestionNote(null);
      return;
    }
    const suggestion = suggestFeeStatus(previewStudent, feeRows);
    if (!suggestion) {
      setSuggestionNote(null);
      return;
    }
    setFeeTypeStatus(suggestion.status);
    setSuggestionNote(suggestion.reason);
  }, [previewStudent, feeRows]);

  useEffect(() => {
    if (!previewStudent) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    setLoadingPreview(true);
    void fetchStudentStatement(previewStudent.id, term, viewingAcademicYear)
      .then((payload) => {
        if (cancelled) return;
        setPreview({
          assignedAmount: payload.assignedAmount,
          totalPaid: payload.totalPaid,
          outstandingAmount: payload.outstandingAmount,
          creditAmount: payload.creditAmount,
        });
      })
      .catch(() => {
        if (!cancelled) setPreview(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingPreview(false);
      });
    return () => {
      cancelled = true;
    };
  }, [previewStudent, term, viewingAcademicYear]);

  const assignTargets = useMemo(() => {
    if (bulkStudents.length > 0) return bulkStudents;
    if (selectedStudent) return [selectedStudent];
    return [];
  }, [bulkStudents, selectedStudent]);

  const handleAssign = async () => {
    setSuccessMsg(null);
    setFormError(null);
    if (historicalReadOnly) {
      setFormError(
        "You can view past terms, but only administrators can assign fees outside the current school term.",
      );
      return;
    }
    if (assignTargets.length === 0) {
      setFormError(
        "Select at least one student (use checkboxes for multiple, or click a student) before assigning fees.",
      );
      return;
    }
    if (isCustomFee) {
      if (!customFeeDescription.trim()) {
        setFormError("Describe the custom fee (what it is for).");
        return;
      }
      if (customAmountUgx <= 0) {
        setFormError("Enter a valid amount in UGX for the custom fee.");
        return;
      }
    } else if (structureAmountUgx <= 0) {
      setFormError("Selected fee type has no valid amount in fee structure.");
      return;
    } else if (!selectedFeeRow) {
      setFormError("Select a fee type from fee structure before assigning.");
      return;
    }

    const isBulk = assignTargets.length > 1;
    if (isBulk) {
      const ok = window.confirm(
        `Assign ${formatCurrencyUGX(assignAmountUgx)} to ${assignTargets.length} students for ${term}?\n\n` +
          assignTargets.map((s) => studentLabel(s)).join("\n"),
      );
      if (!ok) return;
    }

    setSubmitting(true);
    try {
      const notesPayload = isCustomFee
        ? [`Custom fee: ${customFeeDescription.trim()}`, notes.trim()].filter(Boolean).join(" | ")
        : [
            `Fee type: ${selectedFeeRow!.label}`,
            selectedFeeRow!.notes ? `Structure note: ${selectedFeeRow!.notes}` : "",
            notes.trim(),
          ]
            .filter(Boolean)
            .join(" | ");

      const failures: string[] = [];
      for (const student of assignTargets) {
        try {
          await assignStudentFee({
            studentId: student.id,
            term,
            amountDueUgx: assignAmountUgx,
            notes: notesPayload || undefined,
          });
        } catch (err) {
          failures.push(
            `${studentLabel(student)}: ${err instanceof Error ? err.message : "Failed"}`,
          );
        }
      }

      const primaryId = previewStudent?.id ?? assignTargets[0]?.id;
      if (primaryId != null) {
        try {
          const payload = await fetchStudentStatement(primaryId, term, viewingAcademicYear);
          setPreview({
            assignedAmount: payload.assignedAmount,
            totalPaid: payload.totalPaid,
            outstandingAmount: payload.outstandingAmount,
            creditAmount: payload.creditAmount,
          });
        } catch {
          /* keep prior preview */
        }
      }

      const okCount = assignTargets.length - failures.length;
      if (failures.length > 0) {
        setFormError(failures.slice(0, 6).join("\n") + (failures.length > 6 ? "\n…" : ""));
      }
      if (okCount > 0) {
        setSuccessMsg(
          isBulk
            ? `Assigned ${formatCurrencyUGX(assignAmountUgx)} for ${term} to ${okCount} of ${assignTargets.length} student(s).`
            : `Assigned ${formatCurrencyUGX(assignAmountUgx)} to ${assignTargets[0]!.fullName} for ${term}.`,
        );
        if (failures.length === 0) {
          setNotes("");
          if (isCustomFee) {
            setCustomFeeDescription("");
            setCustomAmountInput("");
          }
          clearBulkSelection();
          setSelectedStudent(null);
          setStudentSearch("");
        }
      }
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Failed to assign fees.");
    } finally {
      setSubmitting(false);
    }
  };

  if (showMultipleAssignPage) {
    return <AssignFeesMultiplePage onBack={() => setShowMultipleAssignPage(false)} />;
  }

  const canAssign =
    !historicalReadOnly &&
    assignTargets.length > 0 &&
    !submitting &&
    (isCustomFee
      ? customFeeDescription.trim().length > 0 && customAmountUgx > 0
      : !feeStructureLoading && selectedFeeRow != null && structureAmountUgx > 0);

  return (
    <div style={{ maxWidth: 940, margin: "0 auto" }}>
      <div
        style={{
          position: "relative",
          background: "#fff",
          borderRadius: 28,
          padding: "40px",
          border: "1px solid #e2e8f0",
          boxShadow: "0 10px 25px -5px rgba(0,0,0,0.05)",
        }}
      >
        <button
          type="button"
          onClick={() => {
            setShowMultipleAssignPage(true);
            setSuccessMsg(null);
            setFormError(null);
          }}
          style={{
            position: "absolute",
            top: 24,
            right: 24,
            zIndex: 2,
            padding: "10px 16px",
            borderRadius: 12,
            border: "2px solid #e2e8f0",
            background: "#fff",
            color: "#0c2340",
            fontWeight: 700,
            fontSize: "0.82rem",
            letterSpacing: "0.02em",
            cursor: "pointer",
            boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
          }}
        >
          Assign to Multiple Students →
        </button>

        <div style={{ textAlign: "center", marginBottom: 34 }}>
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
            🧮
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
            Assign Student Fees
          </h2>
          <p style={{ color: "#64748b", fontSize: "1rem", marginTop: 8 }}>
            Search learners, assign fee amounts, and make them available for accountant payment
            capture.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 24 }}>
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
              STUDENT SEARCH *
            </label>
            <input
              id="assign-fees-student-search"
              value={studentSearch}
              onChange={(e) => {
                setStudentSearch(e.target.value);
                setSuccessMsg(null);
                if (selectedStudent) setSelectedStudent(null);
              }}
              placeholder="Start typing student name or admission number"
              style={{
                height: 56,
                borderRadius: 12,
                border: "2px solid #e2e8f0",
                padding: "0 16px",
                fontSize: "1rem",
                width: "100%",
                boxSizing: "border-box",
                outline: "none",
              }}
            />
            {searchLoading ? (
              <p style={{ marginTop: 4, fontSize: "0.75rem", color: "#94a3b8" }}>Searching students...</p>
            ) : null}
            {studentMatches.length > 0 && !selectedStudent ? (
              <div
                style={{
                  marginTop: 4,
                  background: "#fff",
                  border: "1px solid #e2e8f0",
                  borderRadius: 12,
                  boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
                  maxHeight: 250,
                  overflowY: "auto",
                  zIndex: 30,
                  position: "relative",
                }}
              >
                <p
                  style={{
                    margin: 0,
                    padding: "8px 12px",
                    fontSize: "0.72rem",
                    color: "#64748b",
                    fontWeight: 600,
                    borderBottom: "1px solid #f1f5f9",
                    background: "#f8fafc",
                  }}
                >
                  Tick students to assign the same fee to many; click a row to preview one student&apos;s
                  balance.
                </p>
                {studentMatches.map((student) => (
                  <div
                    key={student.id}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 10,
                      padding: "10px 12px",
                      borderBottom: "1px solid #f1f5f9",
                    }}
                  >
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        paddingTop: 2,
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={bulkIdSet.has(student.id)}
                        onChange={() => toggleBulkStudent(student)}
                        style={{ width: 18, height: 18, cursor: "pointer" }}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedStudent(student);
                        setStudentSearch(studentLabel(student));
                        setStudentMatches([]);
                      }}
                      style={{
                        flex: 1,
                        padding: 0,
                        border: "none",
                        background: "transparent",
                        textAlign: "left",
                        cursor: "pointer",
                      }}
                    >
                      <strong style={{ color: "#1e293b" }}>{student.fullName}</strong>
                      <span
                        style={{
                          display: "block",
                          fontSize: "0.75rem",
                          color: "#94a3b8",
                          marginTop: 2,
                        }}
                      >
                        {student.admissionNumber} {student.className ? `• ${student.className}` : ""}
                      </span>
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
            {bulkStudents.length > 0 ? (
              <div
                style={{
                  marginTop: 12,
                  padding: "12px 14px",
                  borderRadius: 12,
                  border: "1px solid #cbd5e1",
                  background: "#f1f5f9",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ fontSize: "0.8rem", fontWeight: 800, color: "#0f172a" }}>
                    Assign to {bulkStudents.length} student{bulkStudents.length === 1 ? "" : "s"} (checked)
                  </span>
                  <button
                    type="button"
                    onClick={clearBulkSelection}
                    style={{
                      border: "none",
                      background: "transparent",
                      color: "#2563eb",
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      cursor: "pointer",
                      textDecoration: "underline",
                    }}
                  >
                    Clear all
                  </button>
                </div>
                <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: "0.78rem", color: "#334155" }}>
                  {bulkStudents.map((s) => (
                    <li key={s.id} style={{ marginBottom: 4 }}>
                      {studentLabel(s)}{" "}
                      <button
                        type="button"
                        onClick={() => removeBulkStudent(s.id)}
                        style={{
                          border: "none",
                          background: "transparent",
                          color: "#b91c1c",
                          cursor: "pointer",
                          fontSize: "0.72rem",
                          fontWeight: 700,
                        }}
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

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
              ACADEMIC TERM
            </label>
            <div
              style={{
                height: 56,
                borderRadius: 12,
                border: "2px solid #e2e8f0",
                padding: "0 14px",
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

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 24 }}>
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
              FEE TYPE *
            </label>
            <select
              value={feeTypeStatus}
              onChange={(e) => {
                setFeeTypeStatus(e.target.value);
                setSuccessMsg(null);
                setFormError(null);
              }}
              style={{
                height: 56,
                borderRadius: 12,
                border: "2px solid #e2e8f0",
                padding: "0 14px",
                fontSize: "1rem",
                width: "100%",
                boxSizing: "border-box",
                background: "#fff",
              }}
            >
              {feeStructureLoading && feeRows.length === 0 ? (
                <option value="">Loading fee structure...</option>
              ) : null}
              {!feeStructureLoading && feeRows.length === 0 ? (
                <option value="">No structure for this term — choose Custom fee below</option>
              ) : null}
              {feeRows.map((item) => (
                <option key={item.status} value={item.status}>
                  {item.label}
                </option>
              ))}
              <option value={CUSTOM_FEE_STATUS}>Custom fee (describe & set amount)</option>
            </select>
            {isCustomFee ? (
              <div style={{ marginTop: 12 }}>
                <label
                  style={{
                    fontWeight: 700,
                    color: "#334155",
                    marginBottom: 6,
                    display: "block",
                    fontSize: "0.8rem",
                    letterSpacing: "0.03em",
                  }}
                >
                  CUSTOM FEE DESCRIPTION *
                </label>
                <input
                  value={customFeeDescription}
                  onChange={(e) => setCustomFeeDescription(e.target.value)}
                  placeholder="e.g. Sports levy, exam registration, trip deposit"
                  style={{
                    height: 48,
                    borderRadius: 12,
                    border: "2px solid #e2e8f0",
                    padding: "0 14px",
                    fontSize: "0.95rem",
                    width: "100%",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            ) : null}
            <p style={{ margin: "6px 0 0", fontSize: "0.75rem", color: "#64748b" }}>
              Fee options update automatically from the current term fee structure.
            </p>
            {suggestionNote && !isCustomFee ? (
              <p style={{ margin: "4px 0 0", fontSize: "0.75rem", color: "#2563eb", fontWeight: 600 }}>
                {suggestionNote}
              </p>
            ) : null}
          </div>

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
              AMOUNT TO ASSIGN (UGX) *
            </label>
            <input
              type="text"
              readOnly={!isCustomFee}
              inputMode={isCustomFee ? "numeric" : undefined}
              value={
                isCustomFee
                  ? customAmountInput
                  : selectedFeeRow
                    ? formatCurrencyUGX(selectedFeeRow.amountDueUgx)
                    : feeStructureLoading
                      ? "…"
                      : ""
              }
              onChange={
                isCustomFee
                  ? (e) => setCustomAmountInput(e.target.value.replace(/[^\d]/g, ""))
                  : undefined
              }
              placeholder={isCustomFee ? "Enter amount in UGX" : "Auto from fee structure"}
              style={{
                height: 56,
                borderRadius: 12,
                border: "2px solid #e2e8f0",
                padding: "0 14px",
                fontSize: "1.1rem",
                fontWeight: 700,
                width: "100%",
                boxSizing: "border-box",
                background: isCustomFee ? "#fff" : "#f8fafc",
                color: "#0f172a",
                cursor: isCustomFee ? "text" : "not-allowed",
              }}
            />
            <p style={{ margin: "6px 0 0", fontSize: "0.75rem", color: "#64748b" }}>
              {isCustomFee
                ? "Enter the UGX amount to assign; it is stored on the student’s fee record."
                : "This value is read-only and pulled from fee structure."}
            </p>
          </div>
        </div>

        <div style={{ marginBottom: 24 }}>
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
            ADMIN NOTES
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional context for this assignment"
            style={{
              width: "100%",
              minHeight: 76,
              borderRadius: 12,
              border: "2px solid #e2e8f0",
              padding: "12px 14px",
              fontSize: "0.95rem",
              boxSizing: "border-box",
              resize: "vertical",
              fontFamily: "inherit",
            }}
          />
        </div>

        {previewStudent && assignTargets.length <= 1 ? (
          <StudentFeeLineItemsPanel studentId={previewStudent.id} />
        ) : null}

        <div
          style={{
            border: "1px solid #e2e8f0",
            borderRadius: 14,
            padding: "16px 18px",
            background: "#f8fafc",
            marginBottom: 20,
          }}
        >
          <h4 style={{ margin: 0, color: "#0f172a", fontSize: "0.9rem", fontWeight: 800 }}>
            Current term snapshot
          </h4>
          {!previewStudent ? (
            <p style={{ margin: "8px 0 0", color: "#64748b", fontSize: "0.85rem" }}>
              Select or check students to preview term figures (first checked student when assigning multiple).
            </p>
          ) : loadingPreview ? (
            <p style={{ margin: "8px 0 0", color: "#64748b", fontSize: "0.85rem" }}>
              Loading fee balances...
            </p>
          ) : preview ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 10, marginTop: 10 }}>
              <div>
                <p style={{ margin: 0, fontSize: "0.72rem", color: "#64748b" }}>Assigned</p>
                <p style={{ margin: "2px 0 0", fontWeight: 800, fontSize: "0.9rem", color: "#0f172a" }}>
                  {formatCurrencyUGX(preview.assignedAmount)}
                </p>
              </div>
              <div>
                <p style={{ margin: 0, fontSize: "0.72rem", color: "#64748b" }}>Paid</p>
                <p style={{ margin: "2px 0 0", fontWeight: 800, fontSize: "0.9rem", color: "#0f172a" }}>
                  {formatCurrencyUGX(preview.totalPaid)}
                </p>
              </div>
              <div>
                <p style={{ margin: 0, fontSize: "0.72rem", color: "#64748b" }}>Outstanding</p>
                <p style={{ margin: "2px 0 0", fontWeight: 800, fontSize: "0.9rem", color: "#b91c1c" }}>
                  {formatCurrencyUGX(preview.outstandingAmount)}
                </p>
              </div>
              <div>
                <p style={{ margin: 0, fontSize: "0.72rem", color: "#64748b" }}>Credit</p>
                <p style={{ margin: "2px 0 0", fontWeight: 800, fontSize: "0.9rem", color: "#0369a1" }}>
                  {formatCurrencyUGX(preview.creditAmount)}
                </p>
              </div>
            </div>
          ) : (
            <p style={{ margin: "8px 0 0", color: "#b91c1c", fontSize: "0.85rem" }}>
              Could not load statement snapshot for this student.
            </p>
          )}
        </div>

        {formError ? (
          <div
            style={{
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: 12,
              padding: "12px 16px",
              marginBottom: 14,
              color: "#991b1b",
              fontSize: "0.86rem",
              fontWeight: 600,
            }}
          >
            {formError}
          </div>
        ) : null}
        {successMsg ? (
          <div
            style={{
              background: "#ecfdf5",
              border: "1px solid #a7f3d0",
              borderRadius: 12,
              padding: "12px 16px",
              marginBottom: 14,
              color: "#065f46",
              fontSize: "0.86rem",
              fontWeight: 600,
            }}
          >
            {successMsg}
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => void handleAssign()}
          disabled={!canAssign}
          style={{
            width: "100%",
            height: 56,
            borderRadius: 14,
            fontWeight: 700,
            border: "none",
            background: "linear-gradient(135deg, #0c2340, #1a3a5c)",
            color: "#fff",
            fontSize: "0.95rem",
            cursor: !canAssign ? "not-allowed" : "pointer",
            opacity: !canAssign ? 0.5 : 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            boxShadow: "0 4px 6px -1px rgba(12,35,64,0.3)",
          }}
        >
          {submitting
            ? "Saving assignment..."
            : assignTargets.length > 1
              ? `Assign fees to ${assignTargets.length} students`
              : "Assign Fees"}
        </button>
      </div>
    </div>
  );
}
