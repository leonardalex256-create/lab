import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  fetchClassrooms,
  fetchStudents,
  type ClassRoomOption,
  type StudentApiRow,
  type StudentSortBy,
  type StudentSortDir,
} from "../../../api/students";
import { assignStudentFee } from "../../../api/financeStatements";
import { fetchFeeStructure, type FeeStructureRow } from "../../../api/financeFeeStructure";
import { formatCurrencyUGX } from "../shared/financeFormat";
import { AuthenticatedStudentPhoto } from "../../students/AuthenticatedStudentPhoto";
import { useTermContext } from "../../../context/TermContext";

const PAGE_SIZE = 50;
const FEE_ASSIGN_BY_STUDENT_STATUS = "__assign_by_student_status__";
const CUSTOM_FEE_STATUS = "__custom__";

function isP7Class(className: string | null | undefined): boolean {
  const s = (className ?? "").trim().toLowerCase();
  return s.includes("p7") || s.includes("primary seven");
}

function feeStructureRowForStudent(student: StudentApiRow, rows: FeeStructureRow[]): FeeStructureRow | null {
  if (rows.length === 0) return null;
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

  for (const key of candidates) {
    const row = rows.find((r) => r.status === key);
    if (row) return row;
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
    if (matchByLabel) return matchByLabel;
  }

  return rows[0] ?? null;
}

function studentLabel(student: StudentApiRow): string {
  return `${student.fullName} (${student.admissionNumber})`;
}

function formatBoardingStatus(status: string | null): string {
  if (!status) return "—";
  const s = status.toLowerCase();
  if (s === "boarding") return "Boarding";
  if (s === "day_full") return "Day (Full Day)";
  if (s === "day_half") return "Day (Half Day)";
  return status;
}

type AssignError =
  | { kind: "validation"; message: string }
  | { kind: "partial"; successes: number; failures: { student: string; reason: string }[] }
  | { kind: "fatal"; message: string }
  | null;

type AssignFeesMultiplePageProps = {
  onBack: () => void;
};

const selectFieldStyle: CSSProperties = {
  height: 48,
  borderRadius: 12,
  border: "2px solid #e2e8f0",
  padding: "0 12px",
  fontSize: "0.95rem",
  width: "100%",
  boxSizing: "border-box",
  background: "#fff",
};

export function AssignFeesMultiplePage({ onBack }: AssignFeesMultiplePageProps) {
  const { viewingTerm: term, historicalReadOnly } = useTermContext();
  const [listSearch, setListSearch] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [listSortBy, setListSortBy] = useState<StudentSortBy>("name");
  const [listSortDir, setListSortDir] = useState<StudentSortDir>("asc");
  const [filterClassRoomId, setFilterClassRoomId] = useState<string>("");
  const [filterBoardingStatus, setFilterBoardingStatus] = useState<"" | "boarding" | "day_half" | "day_full">("");
  const [classrooms, setClassrooms] = useState<ClassRoomOption[]>([]);
  const [offset, setOffset] = useState(0);
  const [items, setItems] = useState<StudentApiRow[]>([]);
  const [total, setTotal] = useState(0);
  const [listLoading, setListLoading] = useState(false);

  const [bulkStudents, setBulkStudents] = useState<StudentApiRow[]>([]);
  const bulkIdSet = useMemo(() => new Set(bulkStudents.map((s) => s.id)), [bulkStudents]);

  const [feeRows, setFeeRows] = useState<FeeStructureRow[]>([]);
  const [feeTypeStatus, setFeeTypeStatus] = useState(FEE_ASSIGN_BY_STUDENT_STATUS);
  const [customFeeDescription, setCustomFeeDescription] = useState("");
  const [customAmountInput, setCustomAmountInput] = useState("");
  const [feeStructureLoading, setFeeStructureLoading] = useState(false);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [assignError, setAssignError] = useState<AssignError>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const isCustomFee = feeTypeStatus === CUSTOM_FEE_STATUS;
  const assignByStudentStatus = feeTypeStatus === FEE_ASSIGN_BY_STUDENT_STATUS;

  const customAmountUgx = useMemo(() => {
    const raw = customAmountInput.replace(/,/g, "").trim();
    if (!raw) return 0;
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [customAmountInput]);

  const bulkStructureUnmapped = useMemo(() => {
    if (isCustomFee || feeRows.length === 0 || !assignByStudentStatus) return [];
    return bulkStudents.filter((s) => {
      const r = feeStructureRowForStudent(s, feeRows);
      return !r || Math.max(Number(r.amountDueUgx) || 0, 0) <= 0;
    });
  }, [isCustomFee, assignByStudentStatus, feeRows, bulkStudents]);

  const p7DayFullSelectedCount = useMemo(
    () =>
      bulkStudents.filter(
        (s) => (s.boardingStatus ?? "").toLowerCase() === "day_full" && isP7Class(s.className),
      ).length,
    [bulkStudents],
  );

  const selectedByTier = useMemo(() => {
    if (!assignByStudentStatus || isCustomFee) return [];
    const grouped = new Map<
      string,
      { key: string; label: string; students: StudentApiRow[]; amountUgx: number }
    >();
    for (const student of bulkStudents) {
      const row = feeStructureRowForStudent(student, feeRows);
      if (!row) continue;
      const key = row.status;
      const label =
        key === "boarding"
          ? "Boarding"
          : key === "day_full_p7"
            ? "Day (Full Day) - P7"
            : key === "day_full"
              ? "Day (Full Day)"
              : key === "day_half"
                ? "Day (Half Day)"
                : row.label;
      const entry = grouped.get(key) ?? { key, label, students: [], amountUgx: Math.max(Number(row.amountDueUgx) || 0, 0) };
      entry.students.push(student);
      grouped.set(key, entry);
    }
    return Array.from(grouped.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [assignByStudentStatus, isCustomFee, bulkStudents, feeRows]);

  const listParamsKey = useMemo(
    () => `${debouncedQ}|${listSortBy}|${listSortDir}|${filterClassRoomId}|${filterBoardingStatus}`,
    [debouncedQ, listSortBy, listSortDir, filterClassRoomId, filterBoardingStatus],
  );
  const prevListParamsKeyRef = useRef(listParamsKey);

  const inViewCounts = useMemo(
    () => ({
      boarding: items.filter((s) => (s.boardingStatus ?? "").toLowerCase() === "boarding").length,
      dayFull: items.filter((s) => (s.boardingStatus ?? "").toLowerCase() === "day_full").length,
      dayHalf: items.filter((s) => (s.boardingStatus ?? "").toLowerCase() === "day_half").length,
      all: items.length,
    }),
    [items],
  );

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(listSearch.trim()), 350);
    return () => window.clearTimeout(t);
  }, [listSearch]);

  useEffect(() => {
    let cancelled = false;
    void fetchClassrooms()
      .then((rows) => {
        if (!cancelled) {
          setClassrooms(rows.filter((r) => r.isActive !== false));
        }
      })
      .catch(() => {
        if (!cancelled) setClassrooms([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const paramsChanged = prevListParamsKeyRef.current !== listParamsKey;
    prevListParamsKeyRef.current = listParamsKey;
    if (paramsChanged && offset !== 0) {
      setItems([]);
      setOffset(0);
      return;
    }

    let cancelled = false;
    setListLoading(true);
    const fetchOffset = paramsChanged ? 0 : offset;
    const classIdParsed = filterClassRoomId.trim() === "" ? Number.NaN : Number.parseInt(filterClassRoomId, 10);
    const classRoomId = Number.isFinite(classIdParsed) && classIdParsed > 0 ? classIdParsed : undefined;

    void fetchStudents({
      q: debouncedQ || undefined,
      sortBy: listSortBy,
      sortDir: listSortDir,
      classRoomId,
      boardingStatus: filterBoardingStatus || undefined,
      limit: PAGE_SIZE,
      offset: fetchOffset,
    })
      .then((res) => {
        if (cancelled) return;
        setItems((prev) => (fetchOffset === 0 ? res.items : [...prev, ...res.items]));
        setTotal(res.total);
      })
      .catch(() => {
        if (!cancelled && fetchOffset === 0) {
          setItems([]);
          setTotal(0);
        }
      })
      .finally(() => {
        if (!cancelled) setListLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [listParamsKey, offset, filterClassRoomId, filterBoardingStatus, listSortBy, listSortDir, debouncedQ]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    const loadStructure = async () => {
      setFeeStructureLoading(true);
      try {
        const rows = await fetchFeeStructure(term);
        if (cancelled) return;
        setAssignError(null);
        setFeeRows(rows);
        if (rows.length === 0) {
          setFeeTypeStatus((prev) => (prev === CUSTOM_FEE_STATUS ? prev : ""));
        } else {
          setFeeTypeStatus((prev) => (prev === CUSTOM_FEE_STATUS ? prev : FEE_ASSIGN_BY_STUDENT_STATUS));
        }
      } catch (e) {
        if (!cancelled) {
          setFeeRows([]);
          setFeeTypeStatus((prev) => (prev === CUSTOM_FEE_STATUS ? prev : ""));
          setAssignError({ kind: "fatal", message: e instanceof Error ? e.message : "Failed to load fee structure." });
          setSuccessMsg(null);
        }
      } finally {
        if (!cancelled) setFeeStructureLoading(false);
      }
    };

    void loadStructure();
    timer = setInterval(() => void loadStructure(), 30000);
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [term]);

  const clearBanners = useCallback(() => {
    setAssignError(null);
    setSuccessMsg(null);
  }, []);

  const toggleBulkStudent = useCallback(
    (student: StudentApiRow) => {
      setBulkStudents((prev) => {
        if (prev.some((s) => s.id === student.id)) return prev.filter((s) => s.id !== student.id);
        return [...prev, student];
      });
      clearBanners();
    },
    [clearBanners],
  );

  const clearBulkSelection = useCallback(() => {
    setBulkStudents([]);
    clearBanners();
  }, [clearBanners]);

  const appendStudents = useCallback(
    (rows: StudentApiRow[]) => {
      setBulkStudents((prev) => {
        const map = new Map(prev.map((s) => [s.id, s]));
        for (const row of rows) map.set(row.id, row);
        return Array.from(map.values());
      });
      clearBanners();
    },
    [clearBanners],
  );

  const addStudentsByStatus = useCallback(
    (status: "boarding" | "day_full" | "day_half" | "all") => {
      if (status === "all") {
        appendStudents(items);
        return;
      }
      appendStudents(items.filter((s) => (s.boardingStatus ?? "").toLowerCase() === status));
    },
    [appendStudents, items],
  );

  const allOnPageSelected = items.length > 0 && items.every((s) => bulkIdSet.has(s.id));
  const someOnPageSelected = items.some((s) => bulkIdSet.has(s.id));

  const toggleSelectAllOnPage = () => {
    if (allOnPageSelected) {
      const pageIds = new Set(items.map((s) => s.id));
      setBulkStudents((prev) => prev.filter((s) => !pageIds.has(s.id)));
    } else {
      appendStudents(items);
    }
    clearBanners();
  };

  const handleAssign = async () => {
    clearBanners();
    if (historicalReadOnly) {
      setAssignError({
        kind: "validation",
        message: "This term is locked. Only administrators can assign fees outside the current term.",
      });
      return;
    }
    if (bulkStudents.length === 0) {
      setAssignError({ kind: "validation", message: "Select at least one student using the checkboxes." });
      return;
    }

    if (isCustomFee) {
      if (!customFeeDescription.trim()) {
        setAssignError({ kind: "validation", message: "Enter a description for the custom fee." });
        return;
      }
      if (customAmountUgx <= 0) {
        setAssignError({ kind: "validation", message: "Enter a valid amount greater than 0 UGX." });
        return;
      }
    } else if (feeRows.length === 0 || !assignByStudentStatus) {
      setAssignError({ kind: "validation", message: "Fee structure could not be loaded. Retry or use Custom fee." });
      return;
    }

    if (!isCustomFee && assignByStudentStatus && bulkStructureUnmapped.length > 0) {
      const proceed = window.confirm(
        `${bulkStructureUnmapped.length} selected students have no matching fee row — they will be skipped. Continue?`,
      );
      if (!proceed) return;
    }

    const ok =
      bulkStudents.length === 1 ||
      window.confirm(
        isCustomFee
          ? `Assign ${formatCurrencyUGX(customAmountUgx)} to ${bulkStudents.length} students for ${term}?\n\n${bulkStudents
              .map((s) => studentLabel(s))
              .join("\n")}`
          : `Assign ${term} fees from the structure for ${bulkStudents.length} students? Each amount follows that student's boarding status.\nP7 Day-Full students will use the P7 rate (day_full_p7). All others use day_full.\n\n${bulkStudents
              .map((s) => studentLabel(s))
              .join("\n")}`,
      );
    if (!ok) return;

    setSubmitting(true);
    try {
      const failures: { student: string; reason: string }[] = [];
      for (const student of bulkStudents) {
        try {
          if (isCustomFee) {
            const notesPayload = [`Custom fee: ${customFeeDescription.trim()}`, notes.trim()].filter(Boolean).join(" | ");
            await assignStudentFee({
              studentId: student.id,
              term,
              amountDueUgx: customAmountUgx,
              notes: notesPayload || undefined,
            });
          } else {
            const row = feeStructureRowForStudent(student, feeRows);
            if (!row || Math.max(Number(row.amountDueUgx) || 0, 0) <= 0) {
              failures.push({ student: studentLabel(student), reason: "No fee row for status" });
              continue;
            }
            const notesPayload = [
              `Fee type: ${row.label}`,
              row.notes ? `Structure note: ${row.notes}` : "",
              notes.trim(),
            ]
              .filter(Boolean)
              .join(" | ");
            await assignStudentFee({
              studentId: student.id,
              term,
              amountDueUgx: Math.round(Number(row.amountDueUgx)),
              notes: notesPayload || undefined,
            });
          }
        } catch (err) {
          failures.push({
            student: studentLabel(student),
            reason: err instanceof Error ? err.message : "Failed",
          });
        }
      }

      const successes = bulkStudents.length - failures.length;
      if (failures.length > 0) {
        setAssignError({ kind: "partial", successes, failures });
      }
      if (successes > 0) {
        setSuccessMsg(
          isCustomFee
            ? `Assigned ${formatCurrencyUGX(customAmountUgx)} for ${term} to ${successes} of ${bulkStudents.length} student(s).`
            : `Assigned ${term} structure fees (by each student's status) to ${successes} of ${bulkStudents.length} student(s).`,
        );
        if (failures.length === 0) {
          setNotes("");
          if (isCustomFee) {
            setCustomFeeDescription("");
            setCustomAmountInput("");
          }
          clearBulkSelection();
        }
      }
    } catch (e) {
      setSuccessMsg(null);
      setAssignError({ kind: "fatal", message: e instanceof Error ? e.message : "Failed to assign fees." });
    } finally {
      setSubmitting(false);
    }
  };

  const hasMore = items.length < total;
  const selectAllCheckboxRef = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => {
    const el = selectAllCheckboxRef.current;
    if (el) el.indeterminate = someOnPageSelected && !allOnPageSelected;
  }, [someOnPageSelected, allOnPageSelected]);

  const canSubmit =
    !historicalReadOnly &&
    bulkStudents.length > 0 &&
    !submitting &&
    (isCustomFee
      ? customFeeDescription.trim().length > 0 && customAmountUgx > 0
      : !feeStructureLoading && feeRows.length > 0 && assignByStudentStatus);

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      <div
        style={{
          position: "relative",
          background: "#fff",
          borderRadius: 28,
          padding: "32px 40px 40px",
          border: "1px solid #e2e8f0",
          boxShadow: "0 10px 25px -5px rgba(0,0,0,0.05)",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
          <div>
            <button
              type="button"
              onClick={onBack}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 12,
                padding: "8px 14px",
                borderRadius: 12,
                border: "2px solid #e2e8f0",
                background: "#fff",
                color: "#334155",
                fontWeight: 700,
                fontSize: "0.82rem",
                cursor: "pointer",
              }}
            >
              ← Back to single assign
            </button>
            <h2 style={{ color: "#0c2340", margin: 0, fontWeight: 800, fontSize: "1.5rem", letterSpacing: "-0.02em" }}>
              Assign fees to multiple students
            </h2>
            <p style={{ color: "#64748b", fontSize: "0.9rem", marginTop: 6, maxWidth: 620 }}>
              Select learners first, then configure fee assignment below.
            </p>
          </div>
          <div
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              background: "#f1f5f9",
              border: "1px solid #cbd5e1",
              fontSize: "0.8rem",
              fontWeight: 700,
              color: "#0f172a",
            }}
          >
            {bulkStudents.length} students selected
          </div>
        </div>

        <section style={{ marginBottom: 24 }}>
          <h3 style={{ margin: 0, color: "#0f172a", fontWeight: 800, fontSize: "1rem" }}>Step 1: Select Students</h3>
          <p style={{ margin: "6px 0 14px", color: "#64748b", fontSize: "0.84rem" }}>
            Use filters, then quick-select by status or pick students manually.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 14 }}>
            <div>
              <label style={{ fontWeight: 700, color: "#334155", fontSize: "0.75rem", display: "block", marginBottom: 6 }}>FILTER STUDENTS</label>
              <input
                value={listSearch}
                onChange={(e) => setListSearch(e.target.value)}
                placeholder="Name or admission number"
                style={{ height: 48, borderRadius: 12, border: "2px solid #e2e8f0", padding: "0 14px", fontSize: "0.95rem", width: "100%", boxSizing: "border-box" }}
              />
            </div>
            <div>
              <label style={{ fontWeight: 700, color: "#334155", fontSize: "0.75rem", display: "block", marginBottom: 6 }}>CLASS</label>
              <select value={filterClassRoomId} onChange={(e) => setFilterClassRoomId(e.target.value)} style={selectFieldStyle}>
                <option value="">All classes</option>
                {classrooms.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontWeight: 700, color: "#334155", fontSize: "0.75rem", display: "block", marginBottom: 6 }}>STATUS</label>
              <select
                value={filterBoardingStatus}
                onChange={(e) => setFilterBoardingStatus(e.target.value as "" | "boarding" | "day_half" | "day_full")}
                style={selectFieldStyle}
              >
                <option value="">All statuses</option>
                <option value="boarding">Boarding</option>
                <option value="day_full">Day (full day)</option>
                <option value="day_half">Day (half day)</option>
              </select>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 14 }}>
            <div>
              <label style={{ fontWeight: 700, color: "#334155", fontSize: "0.75rem", display: "block", marginBottom: 6 }}>SORT BY</label>
              <select value={listSortBy} onChange={(e) => setListSortBy(e.target.value as StudentSortBy)} style={selectFieldStyle}>
                <option value="name">Name</option>
                <option value="class">Class</option>
                <option value="boarding">Status</option>
                <option value="date">Date admitted</option>
                <option value="id">Admission ID</option>
              </select>
            </div>
            <div>
              <label style={{ fontWeight: 700, color: "#334155", fontSize: "0.75rem", display: "block", marginBottom: 6 }}>ORDER</label>
              <select value={listSortDir} onChange={(e) => setListSortDir(e.target.value as StudentSortDir)} style={selectFieldStyle}>
                <option value="asc">A → Z / low → high</option>
                <option value="desc">Z → A / high → low</option>
              </select>
            </div>
            <div>
              <label style={{ fontWeight: 700, color: "#334155", fontSize: "0.75rem", display: "block", marginBottom: 6 }}>TERM</label>
              <div style={{ ...selectFieldStyle, background: "#f8fafc", display: "flex", alignItems: "center", fontWeight: 700 }}>
                {term}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
            <button type="button" onClick={() => addStudentsByStatus("boarding")} style={{ borderRadius: 10, border: "1px solid #cbd5e1", background: "#fff", padding: "8px 12px", fontWeight: 700, fontSize: "0.78rem", cursor: "pointer" }}>
              Select all Boarding ({inViewCounts.boarding})
            </button>
            <button type="button" onClick={() => addStudentsByStatus("day_full")} style={{ borderRadius: 10, border: "1px solid #cbd5e1", background: "#fff", padding: "8px 12px", fontWeight: 700, fontSize: "0.78rem", cursor: "pointer" }}>
              Select all Day Full ({inViewCounts.dayFull})
            </button>
            <button type="button" onClick={() => addStudentsByStatus("day_half")} style={{ borderRadius: 10, border: "1px solid #cbd5e1", background: "#fff", padding: "8px 12px", fontWeight: 700, fontSize: "0.78rem", cursor: "pointer" }}>
              Select all Day Half ({inViewCounts.dayHalf})
            </button>
            <button type="button" onClick={() => addStudentsByStatus("all")} style={{ borderRadius: 10, border: "1px solid #94a3b8", background: "#f8fafc", padding: "8px 12px", fontWeight: 800, fontSize: "0.78rem", cursor: "pointer" }}>
              Select all in view ({inViewCounts.all})
            </button>
          </div>

          <div style={{ borderRadius: 14, border: "1px solid #e2e8f0", overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0", fontSize: "0.78rem", color: "#64748b", fontWeight: 600 }}>
              <span>{listLoading ? "Loading…" : `Showing ${items.length} of ${total} students`}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                  <input ref={selectAllCheckboxRef} type="checkbox" checked={allOnPageSelected} onChange={toggleSelectAllOnPage} />
                  Select all loaded
                </label>
                <button type="button" onClick={clearBulkSelection} style={{ border: "none", background: "transparent", color: "#2563eb", fontWeight: 700, cursor: "pointer", fontSize: "0.78rem" }}>
                  Clear selection
                </button>
              </div>
            </div>

            <div style={{ overflowX: "auto", maxHeight: "min(55vh, 520px)", overflowY: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                <thead>
                  <tr style={{ background: "#f1f5f9", position: "sticky", top: 0, zIndex: 1 }}>
                    <th style={{ width: 52, padding: "10px 6px", textAlign: "center", borderBottom: "1px solid #e2e8f0", fontSize: "0.65rem", fontWeight: 800, color: "#64748b", letterSpacing: "0.04em" }}>Sel.</th>
                    <th style={{ width: 56, padding: "10px 8px", textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>Photo</th>
                    <th style={{ padding: "10px 8px", textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>Name</th>
                    <th style={{ padding: "10px 8px", textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>Admission #</th>
                    <th style={{ padding: "10px 8px", textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>Class</th>
                    <th style={{ padding: "10px 8px", textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((student) => {
                    const isP7FullDay = (student.boardingStatus ?? "").toLowerCase() === "day_full" && isP7Class(student.className);
                    return (
                      <tr key={student.id} style={{ background: bulkIdSet.has(student.id) ? "rgba(59, 130, 246, 0.06)" : "#fff", borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: 0, verticalAlign: "middle", width: 52 }}>
                          <label style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 48, width: "100%", cursor: "pointer", boxSizing: "border-box", padding: "6px 8px" }}>
                            <input type="checkbox" checked={bulkIdSet.has(student.id)} onChange={() => toggleBulkStudent(student)} style={{ width: 18, height: 18, cursor: "pointer", margin: 0 }} />
                          </label>
                        </td>
                        <td style={{ padding: "8px", verticalAlign: "middle" }}>
                          <div style={{ width: 44, height: 44, borderRadius: 10, overflow: "hidden", flexShrink: 0 }}>
                            <AuthenticatedStudentPhoto studentId={student.id} hasPhoto={student.hasPassportPhoto} alt={student.fullName} className="h-full w-full object-cover" />
                          </div>
                        </td>
                        <td style={{ padding: "10px 8px", fontWeight: 700, color: "#1e293b", verticalAlign: "middle" }}>{student.fullName}</td>
                        <td style={{ padding: "10px 8px", color: "#475569", verticalAlign: "middle" }}>{student.admissionNumber}</td>
                        <td style={{ padding: "10px 8px", color: "#475569", verticalAlign: "middle" }}>{student.className ?? "—"}</td>
                        <td style={{ padding: "10px 8px", color: "#475569", verticalAlign: "middle" }}>
                          {formatBoardingStatus(student.boardingStatus)}
                          {isP7FullDay ? (
                            <span style={{ marginLeft: 8, borderRadius: 999, padding: "2px 8px", fontSize: "0.7rem", fontWeight: 800, background: "#fef3c7", color: "#92400e" }}>
                              Day (Full Day) • P7 rate
                            </span>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!listLoading && items.length === 0 ? (
                <p style={{ padding: 24, textAlign: "center", color: "#94a3b8", fontWeight: 600 }}>No students match this filter.</p>
              ) : null}
            </div>

            {hasMore ? (
              <div style={{ padding: 12, textAlign: "center", borderTop: "1px solid #e2e8f0" }}>
                <button type="button" onClick={() => setOffset((o) => o + PAGE_SIZE)} disabled={listLoading} style={{ padding: "10px 20px", borderRadius: 12, border: "2px solid #e2e8f0", background: "#fff", fontWeight: 700, color: "#0c2340", cursor: listLoading ? "not-allowed" : "pointer" }}>
                  Load more
                </button>
              </div>
            ) : null}
          </div>
        </section>

        <div style={{ borderTop: "1px solid #e2e8f0", margin: "24px 0" }} />

        <section>
          <h3 style={{ margin: 0, color: "#0f172a", fontWeight: 800, fontSize: "1rem" }}>Step 2: Configure Fee</h3>
          <p style={{ margin: "6px 0 14px", color: "#64748b", fontSize: "0.84rem" }}>Configure the fee and submit.</p>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontWeight: 700, color: "#334155", fontSize: "0.75rem", display: "block", marginBottom: 6 }}>FEE TYPE</label>
            <select
              value={feeTypeStatus}
              onChange={(e) => {
                setFeeTypeStatus(e.target.value);
                clearBanners();
              }}
              style={selectFieldStyle}
            >
              {feeStructureLoading && feeRows.length === 0 ? <option value="">Loading fee structure…</option> : null}
              {!feeStructureLoading && feeRows.length === 0 ? <option value="">No structure for this term — choose Custom fee below</option> : null}
              {feeRows.map((item) => (
                <option key={item.status} value={item.status}>
                  {item.label}
                </option>
              ))}
              <option value={CUSTOM_FEE_STATUS}>Custom fee (describe & set amount)</option>
            </select>
            {isCustomFee ? (
              <div style={{ marginTop: 10 }}>
                <label style={{ fontWeight: 700, color: "#334155", fontSize: "0.75rem", display: "block", marginBottom: 6 }}>CUSTOM FEE DESCRIPTION</label>
                <input value={customFeeDescription} onChange={(e) => setCustomFeeDescription(e.target.value)} placeholder="e.g. Sports levy, exam registration, trip deposit" style={{ height: 48, borderRadius: 12, border: "2px solid #e2e8f0", padding: "0 14px", fontSize: "0.95rem", width: "100%", boxSizing: "border-box" }} />
              </div>
            ) : null}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            <div>
              <label style={{ fontWeight: 700, color: "#334155", fontSize: "0.75rem", display: "block", marginBottom: 6 }}>AMOUNT (UGX)</label>
              <input
                readOnly={!isCustomFee}
                inputMode={isCustomFee ? "numeric" : undefined}
                value={isCustomFee ? customAmountInput : feeStructureLoading ? "…" : feeRows.length === 0 ? "—" : "Varies by student (from structure)"}
                onChange={isCustomFee ? (e) => setCustomAmountInput(e.target.value.replace(/[^\d]/g, "")) : undefined}
                placeholder={isCustomFee ? "Enter amount in UGX" : undefined}
                style={{ height: 48, borderRadius: 12, border: "2px solid #e2e8f0", padding: "0 14px", fontSize: "1rem", fontWeight: 700, width: "100%", boxSizing: "border-box", background: isCustomFee ? "#fff" : "#f8fafc", color: "#0f172a" }}
              />
            </div>
            <div>
              <label style={{ fontWeight: 700, color: "#334155", fontSize: "0.75rem", display: "block", marginBottom: 6 }}>ADMIN NOTES</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional context" style={{ minHeight: 48, borderRadius: 12, border: "2px solid #e2e8f0", padding: "10px 14px", fontSize: "0.95rem", width: "100%", boxSizing: "border-box", resize: "vertical", fontFamily: "inherit" }} />
            </div>
          </div>

          {!isCustomFee && assignByStudentStatus ? (
            <div style={{ border: "1px solid #cbd5e1", borderRadius: 12, background: "#f8fafc", padding: 12, marginBottom: 14 }}>
              <p style={{ margin: "0 0 8px", fontSize: "0.8rem", fontWeight: 800, color: "#0f172a" }}>Assignment preview</p>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
                <tbody>
                  {selectedByTier.map((tier) => (
                    <tr key={tier.key}>
                      <td style={{ padding: "6px 0", fontWeight: 700, color: "#1e293b" }}>{tier.label}</td>
                      <td style={{ padding: "6px 0", color: "#475569", textAlign: "right" }}>
                        {tier.students.length} student{tier.students.length === 1 ? "" : "s"}
                      </td>
                      <td style={{ padding: "6px 0", color: "#0f172a", textAlign: "right", fontWeight: 800 }}>{formatCurrencyUGX(tier.amountUgx)}</td>
                      <td style={{ padding: "6px 0 6px 10px", color: "#92400e", fontWeight: 700, minWidth: 240 }}>
                        {tier.key === "day_full" && p7DayFullSelectedCount > 0 ? "⚠ P7 students in this group will be charged the P7 full-day rate" : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {!isCustomFee && assignByStudentStatus && bulkStructureUnmapped.length > 0 ? (
            <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 12, padding: "12px 16px", marginBottom: 14, color: "#991b1b", fontSize: "0.84rem" }}>
              <p style={{ margin: 0, fontWeight: 800 }}>{bulkStructureUnmapped.length} selected students have no matching fee row.</p>
              <div style={{ maxHeight: 120, overflowY: "auto", marginTop: 8 }}>
                {bulkStructureUnmapped.map((student) => (
                  <div key={student.id} style={{ marginBottom: 4, fontWeight: 600 }}>
                    {studentLabel(student)}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {assignError?.kind === "validation" ? (
            <div style={{ background: "#fef3c7", border: "1px solid #fcd34d", borderRadius: 12, padding: "12px 16px", marginBottom: 14, color: "#92400e", fontSize: "0.86rem", fontWeight: 700 }}>
              ⚠ {assignError.message}
            </div>
          ) : null}
          {assignError?.kind === "partial" ? (
            <div style={{ background: "#ffedd5", border: "1px solid #fdba74", borderRadius: 12, padding: "12px 16px", marginBottom: 14, color: "#9a3412", fontSize: "0.84rem" }}>
              <p style={{ margin: 0, fontWeight: 800 }}>
                {assignError.successes} assigned successfully. {assignError.failures.length} failed:
              </p>
              <div style={{ marginTop: 8, maxHeight: 140, overflowY: "auto" }}>
                {assignError.failures.map((failure, idx) => (
                  <div key={`${failure.student}-${idx}`} style={{ marginBottom: 4, fontWeight: 600 }}>
                    [{failure.student}]: {failure.reason}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {assignError?.kind === "fatal" ? (
            <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 12, padding: "12px 16px", marginBottom: 14, color: "#991b1b", fontSize: "0.86rem", fontWeight: 700 }}>
              ✕ {assignError.message}
            </div>
          ) : null}
          {successMsg ? (
            <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: 12, padding: "12px 16px", marginBottom: 14, color: "#065f46", fontSize: "0.86rem", fontWeight: 600 }}>
              ✓ {successMsg}
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => void handleAssign()}
            disabled={!canSubmit}
            style={{
              width: "100%",
              height: 54,
              borderRadius: 14,
              fontWeight: 700,
              border: "none",
              background: "linear-gradient(135deg, #0c2340, #1a3a5c)",
              color: "#fff",
              fontSize: "0.95rem",
              cursor: !canSubmit ? "not-allowed" : "pointer",
              opacity: !canSubmit ? 0.5 : 1,
            }}
          >
            {submitting
              ? "Saving…"
              : bulkStudents.length > 0
                ? `Assign fees to ${bulkStudents.length} student${bulkStudents.length === 1 ? "" : "s"}`
                : "Select students to assign"}
          </button>
        </section>
      </div>
    </div>
  );
}
