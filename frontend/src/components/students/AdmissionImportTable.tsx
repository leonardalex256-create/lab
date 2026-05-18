import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  fetchClassrooms,
  bulkCreateStudentsJson,
  type ClassRoomOption,
  type CreateStudentBody,
} from "../../api/students";
import { fetchFeeStructure } from "../../api/financeFeeStructure";
import { useI18n } from "../../i18n/I18nProvider";
import { useTermContext } from "../../context/TermContext";

/** Student `boardingStatus` values persisted in the DB / API. */
const STUDENT_BOARDING_STATUSES = new Set(["boarding", "day_half", "day_full"]);

const FALLBACK_BOARDING_OPTIONS: Array<{ status: string; label: string }> = [
  { status: "day_half", label: "Day (half day)" },
  { status: "day_full", label: "Day (full day)" },
  { status: "boarding", label: "Boarding" },
];

function coerceClassRoomIdToStoredValue(raw: string, roomList: ClassRoomOption[]): string {
  const t = raw.trim();
  if (!t) return "";
  const n = Number.parseInt(t, 10);
  if (Number.isFinite(n) && n > 0 && roomList.some((r) => r.id === n)) return String(n);
  const byName = roomList.find((r) => r.name.trim().toLowerCase() === t.toLowerCase());
  return byName ? String(byName.id) : "";
}

type AdmissionImportTableProps = {
  onDone: () => void;
};

/** Seven-column bulk import: `classRoomId` stores selected classroom id as string (from system list). */
type Row = {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  classRoomId: string;
  boardingStatus: "boarding" | "day_half" | "day_full" | "";
  parentFullName: string;
  parentPhone: string;
};

const headers: Array<{ key: keyof Row; label: string }> = [
  { key: "firstName", label: "First Name" },
  { key: "lastName", label: "Last Name" },
  { key: "dateOfBirth", label: "Date of Birth" },
  { key: "classRoomId", label: "Class" },
  { key: "boardingStatus", label: "Status" },
  { key: "parentFullName", label: "Parents Name" },
  { key: "parentPhone", label: "Parents Contact" },
];

const HEADER_ALIASES: Record<string, keyof Row> = {
  firstname: "firstName",
  lastname: "lastName",
  dateofbirth: "dateOfBirth",
  dob: "dateOfBirth",
  class: "classRoomId",
  classroomid: "classRoomId",
  classroom: "classRoomId",
  classid: "classRoomId",
  classname: "classRoomId",
  boardingstatus: "boardingStatus",
  status: "boardingStatus",
  parentsname: "parentFullName",
  parentname: "parentFullName",
  parentsfullname: "parentFullName",
  parentfullname: "parentFullName",
  parentscontact: "parentPhone",
  parentcontact: "parentPhone",
  parentphone: "parentPhone",
};

function normalizeHeader(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function resolveHeader(raw: string): keyof Row | null {
  const normalized = normalizeHeader(raw);
  return HEADER_ALIASES[normalized] ?? null;
}

const requiredKeys: Array<keyof Row> = [
  "firstName",
  "lastName",
  "dateOfBirth",
  "classRoomId",
  "boardingStatus",
  "parentFullName",
  "parentPhone",
];

function emptyRow(): Row {
  return {
    firstName: "",
    lastName: "",
    dateOfBirth: "",
    classRoomId: "",
    boardingStatus: "",
    parentFullName: "",
    parentPhone: "",
  };
}

function normalizeFlexibleDate(val: string): string {
  if (!val) return "";
  const v = val.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const parts = v.split(/[-/.]/);
  if (parts.length === 3) {
    let d = parts[0];
    let m = parts[1];
    const y = parts[2];
    if (y.length === 4) {
      if (d.length === 1) d = "0" + d;
      if (m.length === 1) m = "0" + m;
      return `${y}-${m}-${d}`;
    }
  }
  return v;
}

function normalizeBoardingStatus(val: string): string {
  if (!val) return "";
  const s = val.trim().toLowerCase();
  if (s === "boarding") return "boarding";
  if (s === "day" || s === "day_scholar" || s === "day_full" || s === "dayfull" || s === "full_day" || s === "fullday")
    return "day_full";
  if (s === "day_half" || s === "dayhalf" || s === "half_day" || s === "halfday") return "day_half";
  return val;
}

function csvToRows(text: string): Row[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];
  const cols = lines[0].split(",").map((h) => resolveHeader(h.trim()));
  const out: Row[] = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
    if (vals.every((v) => !v)) continue;
    const r = emptyRow();
    cols.forEach((c, idx) => {
      let v = vals[idx] ?? "";
      if (c) {
        if (c === "dateOfBirth") v = normalizeFlexibleDate(v);
        if (c === "boardingStatus") v = normalizeBoardingStatus(v);
        (r as Record<string, string>)[c] = v;
      }
    });
    out.push(r);
  }
  return out;
}

function sheetToRows(rows2d: string[][]): Row[] {
  if (rows2d.length < 2) return [];
  const cols = rows2d[0].map((h) => resolveHeader(String(h ?? "").trim()));
  const out: Row[] = [];
  for (let i = 1; i < rows2d.length; i++) {
    const vals = rows2d[i].map((v) => String(v ?? "").trim());
    if (vals.every((v) => !v)) continue;
    const r = emptyRow();
    cols.forEach((c, idx) => {
      let v = vals[idx] ?? "";
      if (c) {
        if (c === "dateOfBirth") v = normalizeFlexibleDate(v);
        if (c === "boardingStatus") v = normalizeBoardingStatus(v);
        (r as Record<string, string>)[c] = v;
      }
    });
    out.push(r);
  }
  return out;
}

const IMPORT_DEFAULT_PARENT_ADDRESS = "Imported via bulk";

export function AdmissionImportTable({ onDone }: AdmissionImportTableProps) {
  const { t } = useI18n();
  const { systemTerm, status: termCtxStatus } = useTermContext();
  const [rooms, setRooms] = useState<ClassRoomOption[]>([]);
  const roomsRef = useRef<ClassRoomOption[]>([]);
  roomsRef.current = rooms;
  const [boardingStatusOptions, setBoardingStatusOptions] =
    useState<Array<{ status: string; label: string }>>(FALLBACK_BOARDING_OPTIONS);
  const [boardingOptionsLoading, setBoardingOptionsLoading] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [skipErrors, setSkipErrors] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchClassrooms()
      .then((cr) => {
        if (!cancelled) setRooms(cr);
      })
      .catch(() => {
        if (!cancelled) setError(t("students.form.classroomsError"));
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  useEffect(() => {
    if (termCtxStatus !== "ready") return;
    let cancelled = false;
    setBoardingOptionsLoading(true);
    void fetchFeeStructure(systemTerm)
      .then((items) => {
        if (cancelled) return;
        const seen = new Set<string>();
        const opts: Array<{ status: string; label: string }> = [];
        for (const row of items) {
          if (!STUDENT_BOARDING_STATUSES.has(row.status) || seen.has(row.status)) continue;
          seen.add(row.status);
          opts.push({ status: row.status, label: row.label });
        }
        if (opts.length > 0) setBoardingStatusOptions(opts);
        else setBoardingStatusOptions(FALLBACK_BOARDING_OPTIONS);
      })
      .catch(() => {
        if (!cancelled) setBoardingStatusOptions(FALLBACK_BOARDING_OPTIONS);
      })
      .finally(() => {
        if (!cancelled) setBoardingOptionsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [termCtxStatus, systemTerm]);

  const sortedRooms = useMemo(
    () =>
      [...rooms]
        .filter((r) => r.isActive !== false)
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" })),
    [rooms],
  );

  /** When classrooms load after a file import, map names/ids in rows to stored class ids. */
  useEffect(() => {
    if (rooms.length === 0 || rows.length === 0) return;
    setRows((prev) => {
      let changed = false;
      const next = prev.map((r) => {
        const t = r.classRoomId.trim();
        if (t && sortedRooms.some((rm) => String(rm.id) === t)) return r;
        const c = coerceClassRoomIdToStoredValue(r.classRoomId, rooms);
        if (c && c !== r.classRoomId) {
          changed = true;
          return { ...r, classRoomId: c };
        }
        return r;
      });
      return changed ? next : prev;
    });
  }, [rooms, sortedRooms, rows.length]);

  async function onImportFile(file: File) {
    const lower = file.name.toLowerCase();
    let parsed: Row[] = [];

    if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) {
        setRows([]);
        setError("No worksheet found in Excel file.");
        setMessage(null);
        return;
      }
      const sheet = workbook.Sheets[firstSheetName];
      const rows2d = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(sheet, {
        header: 1,
        raw: false,
      });
      parsed = sheetToRows(
        rows2d.map((row) => row.map((cell) => (cell == null ? "" : String(cell)))),
      );
    } else {
      const text = await file.text();
      parsed = csvToRows(text);
    }

    const roomList = roomsRef.current;
    setRows(
      parsed.map((r) => ({
        ...r,
        classRoomId:
          roomList.length > 0
            ? coerceClassRoomIdToStoredValue(r.classRoomId, roomList)
            : r.classRoomId.trim(),
      })),
    );
    setError(parsed.length === 0 ? "No rows found in file." : null);
    setMessage(parsed.length > 0 ? `Loaded ${parsed.length} row(s). Review and save.` : null);
    setSkipErrors(false);
  }

  function downloadTemplate() {
    const csvContent = headers.map((h) => h.label).join(",") + "\n";
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "student_import_template.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function updateCell(index: number, key: keyof Row, value: string) {
    setRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [key]: value };
      return next;
    });
  }

  function addRow() {
    setRows((prev) => [...prev, emptyRow()]);
  }

  function classIdFromRow(r: Row): number | undefined {
    const byId = Number.parseInt(r.classRoomId.trim(), 10);
    if (Number.isFinite(byId) && byId > 0) return byId;
    const byName = rooms.find(
      (rm) => rm.name.trim().toLowerCase() === r.classRoomId.trim().toLowerCase(),
    );
    return byName?.id;
  }

  function validateRow(r: Row): string | null {
    for (const key of requiredKeys) {
      if (!String(r[key] ?? "").trim()) {
        const displayKey =
          key === "boardingStatus"
            ? "Status"
            : key === "classRoomId"
              ? "Class"
              : key === "parentFullName"
                ? "Parents Name"
                : key === "parentPhone"
                  ? "Parents Contact"
                  : key === "dateOfBirth"
                    ? "Date of Birth"
                    : key === "firstName"
                      ? "First Name"
                      : "Last Name";
        return `${displayKey} is required`;
      }
    }
    if (!["boarding", "day_full", "day_half"].includes(r.boardingStatus)) {
      return "Status must be boarding, day_full, or day_half";
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.dateOfBirth.trim())) {
      return "Date of Birth must be DD/MM/YYYY or YYYY-MM-DD";
    }
    const resolvedClass = classIdFromRow(r);
    if (resolvedClass == null) {
      return "Class must match a saved classroom (choose from the list)";
    }
    const phone = r.parentPhone.trim().replace(/[^\d+]/g, "");
    if (phone.length < 10 || phone.length > 13) {
      return "Parents Contact must be 10–13 digits";
    }
    return null;
  }

  async function saveAll() {
    if (rows.length === 0) {
      setError("Import data first.");
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);

    const itemsToUpload: CreateStudentBody[] = [];
    const localFailures: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const rowError = validateRow(r);
      if (rowError) {
        localFailures.push(`Row ${i + 1}: ${rowError}`);
        continue;
      }

      const classRoomNum = classIdFromRow(r)!;
      const phone = r.parentPhone.trim().replace(/[^\d+]/g, "");

      itemsToUpload.push({
        firstName: r.firstName.trim(),
        lastName: r.lastName.trim(),
        dateOfBirth: r.dateOfBirth.trim(),
        classRoomId: classRoomNum,
        registrationType: "first",
        parentAliveStatus: "both",
        parentFullName: r.parentFullName.trim(),
        parentPhone: phone,
        parentAddress: IMPORT_DEFAULT_PARENT_ADDRESS,
        boardingStatus: r.boardingStatus as "boarding" | "day_half" | "day_full",
      });
    }

    if (itemsToUpload.length === 0) {
      setBusy(false);
      if (localFailures.length > 0) {
        setError(localFailures.slice(0, 8).join("\n"));
      }
      return;
    }

    try {
      const response = await bulkCreateStudentsJson(itemsToUpload);
      const { created, results } = response;

      const apiFailures: string[] = [];
      const assignedAdmissionNumbers: string[] = [];

      results.forEach((res, idx) => {
        if (res.error) {
          apiFailures.push(`Item ${idx + 1}: ${res.error}`);
        } else if (res.admissionNumber) {
          assignedAdmissionNumbers.push(res.admissionNumber);
        }
      });

      const allFailures = [...localFailures, ...apiFailures];
      const assignedPreview =
        assignedAdmissionNumbers.length > 0
          ? ` Admission numbers: ${assignedAdmissionNumbers.slice(0, 8).join(", ")}${
              assignedAdmissionNumbers.length > 8 ? "..." : ""
            }`
          : "";

      setMessage(`Import finished. Created: ${created} row(s).${assignedPreview}`);
      if (allFailures.length > 0) {
        setError(allFailures.slice(0, 8).join("\n"));
      } else {
        setError(null);
        if (created > 0) onDone();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bulk import failed");
    } finally {
      setBusy(false);
    }
  }

  const validationErrors = useMemo(() => {
    return rows.map((r) => validateRow(r));
  }, [rows, rooms]);

  const hasErrors = validationErrors.some((e) => e !== null);
  const canSubmit = rows.length > 0 && !busy && (!hasErrors || skipErrors);
  const errorCount = validationErrors.filter((e) => e !== null).length;

  const cellBorder = (rowError: string | null, key: keyof Row) => {
    const msg = rowError ?? "";
    const keyMatch =
      msg.includes("First Name") && key === "firstName"
        ? true
        : msg.includes("Last Name") && key === "lastName"
          ? true
          : msg.includes("Date of Birth") && key === "dateOfBirth"
            ? true
            : msg.includes("Class") && key === "classRoomId"
              ? true
              : msg.includes("Status") && key === "boardingStatus"
                ? true
                : msg.includes("Parents Name") && key === "parentFullName"
                  ? true
                  : msg.includes("Parents Contact") && key === "parentPhone"
                    ? true
                    : false;
    return keyMatch ? "border-rose-400 bg-rose-50" : "border-[#e0d8cc] bg-transparent";
  };

  return (
    <section className="animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-[#2d3436]">
            {t("students.import.title")}
          </h1>
          <p className="mt-1 text-sm font-semibold text-[#636e72]">
            Bulk import students via CSV or Excel spreadsheets.
          </p>
        </div>
        <div>
          <button
            type="button"
            onClick={downloadTemplate}
            className="flex items-center gap-2 rounded-xl border-2 border-[#ebe4d9] bg-white px-5 py-2.5 text-sm font-bold text-[#2d3436] transition hover:bg-[#faf9f6]"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            Download Template
          </button>
        </div>
      </div>

      <div className="neo-card p-6">
        {rows.length === 0 ? (
          <div
            className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-12 transition-colors ${
              isDragging
                ? "border-[#3498db] bg-[#3498db]/5"
                : "border-[#ebe4d9] bg-[#faf9f6] hover:border-[#b2bec3]"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setIsDragging(false);
            }}
            onDrop={async (e) => {
              e.preventDefault();
              setIsDragging(false);
              if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                await onImportFile(e.dataTransfer.files[0]);
              }
            }}
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-sm text-[#636e72]">
              <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
            </div>
            <h3 className="mt-4 text-lg font-bold text-[#2d3436]">Drag and drop your file here</h3>
            <p className="mt-2 text-sm font-medium text-[#636e72]">
              Supported formats: .csv, .xlsx, .xls
            </p>
            <div className="mt-6">
              <label className="cursor-pointer rounded-full bg-[#2d3436] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#636e72]">
                Browse Files
                <input
                  type="file"
                  accept=".csv,text/csv,.xlsx,.xls,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void onImportFile(f);
                  }}
                />
              </label>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-lg font-bold text-[#2d3436]">Review Import Data</h3>
                <p className="text-sm font-medium text-[#636e72]">
                  Found {rows.length} row(s).{" "}
                  {errorCount > 0 ? (
                    <span className="text-rose-600">{errorCount} row(s) have errors.</span>
                  ) : (
                    <span className="text-emerald-600">All rows are valid.</span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-4">
                {errorCount > 0 && (
                  <label className="flex cursor-pointer items-center gap-2 text-sm font-bold text-[#2d3436]">
                    <input
                      type="checkbox"
                      checked={skipErrors}
                      onChange={(e) => setSkipErrors(e.target.checked)}
                      className="h-4 w-4 rounded border-[#b2bec3] text-[#3498db] focus:ring-[#3498db]"
                    />
                    Skip {errorCount} erroneous row(s)
                  </label>
                )}
                <button
                  type="button"
                  onClick={() => setRows([])}
                  className="rounded-full border-2 border-[#ebe4d9] bg-white px-6 py-2.5 text-sm font-bold text-[#2d3436] transition hover:bg-[#faf9f6]"
                >
                  Clear & Start Over
                </button>
                <button
                  type="button"
                  disabled={!canSubmit}
                  onClick={() => void saveAll()}
                  className="rounded-full bg-gradient-to-br from-[#3498db] to-[#2980b9] px-6 py-2.5 text-sm font-bold text-white shadow-lg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy ? "Importing..." : "Complete Import"}
                </button>
              </div>
            </div>

            {message ? (
              <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
                <p className="text-sm font-bold text-emerald-800">{message}</p>
              </div>
            ) : null}
            {error ? (
              <div className="rounded-xl border border-rose-100 bg-rose-50 p-4">
                <pre className="whitespace-pre-wrap font-sans text-sm font-bold text-rose-800">{error}</pre>
              </div>
            ) : null}

            <div className="max-h-[60vh] overflow-auto rounded-xl border border-[#ebe4d9]">
              <table className="min-w-[900px] text-xs">
                <thead className="sticky top-0 z-10 bg-[#f5f0e6] text-[#2d3436] shadow-sm">
                  <tr>
                    <th className="w-8 border-b border-r border-[#ebe4d9] px-2 py-3 text-center">#</th>
                    <th className="w-8 border-b border-r border-[#ebe4d9] px-2 py-3 text-center">Stat</th>
                    {headers.map((h) => (
                      <th
                        key={h.key}
                        className="whitespace-nowrap border-b border-r border-[#ebe4d9] px-2 py-3 text-left font-black"
                      >
                        {h.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const rowError = validationErrors[i];
                    return (
                      <tr
                        key={i}
                        className={`odd:bg-white even:bg-[#fcfaf6] ${rowError ? "bg-rose-50/50" : ""}`}
                      >
                        <td className="border-b border-r border-[#ebe4d9] p-1 text-center font-bold text-[#b2bec3]">
                          {i + 1}
                        </td>
                        <td className="border-b border-r border-[#ebe4d9] p-1 text-center">
                          {rowError ? (
                            <div className="group relative flex justify-center">
                              <svg
                                className="h-4 w-4 text-rose-500"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="2"
                                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                              </svg>
                              <div className="absolute bottom-full left-1/2 z-20 mb-2 hidden w-48 -translate-x-1/2 rounded bg-[#2d3436] p-2 text-[10px] text-white shadow-lg group-hover:block">
                                {rowError}
                              </div>
                            </div>
                          ) : (
                            <svg
                              className="mx-auto h-4 w-4 text-emerald-500"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          )}
                        </td>
                        {headers.map((h) => (
                          <td key={h.key} className="relative border-b border-r border-[#ebe4d9] p-1">
                            {h.key === "dateOfBirth" ? (
                              <input
                                type="date"
                                value={r.dateOfBirth}
                                onChange={(e) => updateCell(i, h.key, e.target.value)}
                                className={`w-full min-w-[140px] rounded border px-2 py-1.5 outline-none focus:border-[#3498db] ${cellBorder(rowError, h.key)}`}
                              />
                            ) : h.key === "boardingStatus" ? (
                              <select
                                value={r.boardingStatus}
                                onChange={(e) => updateCell(i, h.key, e.target.value)}
                                disabled={boardingOptionsLoading}
                                className={`w-full min-w-[160px] rounded border px-2 py-1.5 outline-none focus:border-[#3498db] disabled:opacity-60 ${cellBorder(rowError, h.key)}`}
                              >
                                <option value="">
                                  {boardingOptionsLoading ? "Loading statuses…" : "Select status"}
                                </option>
                                {boardingStatusOptions.map((opt) => (
                                  <option key={opt.status} value={opt.status}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            ) : h.key === "parentPhone" ? (
                              <input
                                type="tel"
                                minLength={10}
                                maxLength={13}
                                value={r.parentPhone}
                                onChange={(e) => {
                                  const val = e.target.value.replace(/[^\d+]/g, "");
                                  updateCell(i, h.key, val);
                                }}
                                className={`w-full min-w-[120px] rounded border px-2 py-1.5 outline-none focus:border-[#3498db] ${cellBorder(rowError, h.key)}`}
                              />
                            ) : h.key === "classRoomId" ? (
                              <select
                                value={
                                  sortedRooms.some((rm) => String(rm.id) === r.classRoomId.trim())
                                    ? r.classRoomId.trim()
                                    : ""
                                }
                                onChange={(e) => updateCell(i, h.key, e.target.value)}
                                className={`w-full min-w-[180px] rounded border px-2 py-1.5 outline-none focus:border-[#3498db] ${cellBorder(rowError, h.key)}`}
                              >
                                <option value="">
                                  {sortedRooms.length === 0 ? "Loading classes…" : "Select class"}
                                </option>
                                {sortedRooms.map((rm) => (
                                  <option key={rm.id} value={String(rm.id)}>
                                    {rm.name}
                                    {rm.academicYear ? ` (${rm.academicYear})` : ""}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <input
                                value={String(r[h.key] ?? "")}
                                onChange={(e) => updateCell(i, h.key, e.target.value)}
                                className={`w-full min-w-[120px] rounded border px-2 py-1.5 outline-none focus:border-[#3498db] ${cellBorder(rowError, h.key)}`}
                              />
                            )}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end border-t border-[#ebe4d9] pt-4">
              <button
                type="button"
                onClick={addRow}
                className="rounded-xl border-2 border-dashed border-[#ebe4d9] bg-white px-6 py-2.5 text-sm font-bold text-[#636e72] transition hover:border-[#b2bec3] hover:text-[#2d3436]"
              >
                + Add Empty Row
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
