import { useState, useRef, useCallback } from "react";
import { apiUrl, authHeaders } from "../../api/baseUrl";

interface ErrorRow {
  row: number;
  data: Record<string, string>;
  issues: string[];
}

interface ImportReport {
  total_rows: number;
  imported: number;
  skipped_duplicates: number;
  failed: number;
  errors: ErrorRow[];
}

type Step = "upload" | "report" | "success";

const TEMPLATE_HEADERS = [
  "first_name", "last_name", "date_of_birth", "gender", "class_name",
  "parent_first_name", "parent_last_name", "parent_relationship",
  "parent_phone", "parent_email"
].join(",");

const TEMPLATE_EXAMPLE = [
  TEMPLATE_HEADERS,
  "Jane,Doe,2015-03-14,female,Primary 3,John,Doe,father,+256700123456,john.doe@email.com",
  "Alice,Smith,2014-07-22,female,Primary 4,Mary,Smith,mother,+256700654321,mary.smith@email.com",
].join("\n");

function downloadTemplate() {
  const blob = new Blob([TEMPLATE_EXAMPLE], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "student_import_template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function downloadErrorReport(errors: ErrorRow[]) {
  const headers = "Row,First Name,Last Name,Issues";
  const rows = errors.map((e) =>
    `${e.row},"${e.data.first_name ?? ""}","${e.data.last_name ?? ""}","${e.issues.join("; ")}"`
  );
  const csv = [headers, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "import_errors.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// ── Confetti ──────────────────────────────────────────────────────────────────
function Confetti() {
  const colors = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444"];
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {[...Array(30)].map((_, i) => (
        <div
          key={i}
          className="absolute w-2 h-2 rounded-full opacity-0 animate-bounce"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 60}%`,
            backgroundColor: colors[i % colors.length],
            animationDelay: `${Math.random() * 0.5}s`,
            animationDuration: `${0.8 + Math.random() * 0.6}s`,
            opacity: Math.random() * 0.8 + 0.2,
            transform: `scale(${0.5 + Math.random()})`,
          }}
        />
      ))}
    </div>
  );
}

export function BulkStudentImportWizard({ onViewStudents }: { onViewStudents: () => void }) {
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File) => {
    if (!f.name.endsWith(".csv")) {
      setError("Please upload a .csv file");
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      setError("File must be smaller than 5 MB");
      return;
    }
    setError(null);
    setFile(f);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, []);

  const upload = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(apiUrl("/api/me/students/import"), {
        method: "POST",
        headers: authHeaders(),
        body: form,
      });
      const json = await res.json();
      if (json.success) {
        setReport(json.data ?? json);
        if ((json.data?.failed ?? json.failed) === 0) {
          setStep("success");
        } else {
          setStep("report");
        }
      } else {
        setError(json.error ?? "Upload failed");
      }
    } catch {
      setError("Network error — please try again");
    }
    setUploading(false);
  };

  const reset = () => {
    setStep("upload");
    setFile(null);
    setReport(null);
    setError(null);
  };

  // ── STEP 1: UPLOAD ──────────────────────────────────────────────────────────
  if (step === "upload") {
    return (
      <div className="space-y-6 max-w-2xl">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Import Students from CSV</h2>
          <p className="text-sm text-slate-500 mt-1">Upload a CSV file to bulk-import students and their parents.</p>
        </div>

        {/* Drop zone */}
        <div
          className={`relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${dragOver ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:border-blue-300 hover:bg-slate-50"}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input ref={fileInputRef} type="file" accept=".csv" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          <div className="text-4xl mb-4">{file ? "📄" : "☁️"}</div>
          {file ? (
            <div>
              <p className="font-semibold text-slate-800">{file.name}</p>
              <p className="text-sm text-slate-500">{(file.size / 1024).toFixed(1)} KB</p>
              <button
                className="mt-3 text-xs text-red-500 hover:text-red-700"
                onClick={(e) => { e.stopPropagation(); setFile(null); }}
              >
                ✕ Remove
              </button>
            </div>
          ) : (
            <div>
              <p className="font-semibold text-slate-700">Drop your CSV here or click to browse</p>
              <p className="text-sm text-slate-400 mt-1">Max 5 MB · .csv files only</p>
            </div>
          )}
        </div>

        {/* Template download */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-blue-800">Don't have a template?</p>
            <p className="text-xs text-blue-600 mt-0.5">Download our pre-filled example with all required columns</p>
          </div>
          <button onClick={downloadTemplate}
            className="text-sm font-semibold text-blue-700 border border-blue-300 rounded-lg px-4 py-2 hover:bg-blue-100 transition-colors whitespace-nowrap">
            ↓ Download Template
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm">{error}</div>
        )}

        <button
          onClick={upload}
          disabled={!file || uploading}
          className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-bold text-base shadow-lg transition-all"
        >
          {uploading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Uploading & Validating…
            </span>
          ) : "Upload & Validate"}
        </button>
      </div>
    );
  }

  // ── STEP 2: REPORT ──────────────────────────────────────────────────────────
  if (step === "report" && report) {
    return (
      <div className="space-y-5 max-w-3xl">
        <h2 className="text-xl font-bold text-slate-800">Import Report</h2>

        {/* Summary chips */}
        <div className="flex flex-wrap gap-3">
          <span className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-100 text-emerald-800 rounded-xl font-semibold text-sm">
            ✓ {report.imported} imported
          </span>
          <span className="inline-flex items-center gap-2 px-4 py-2 bg-amber-100 text-amber-800 rounded-xl font-semibold text-sm">
            ⊘ {report.skipped_duplicates} duplicates skipped
          </span>
          <span className="inline-flex items-center gap-2 px-4 py-2 bg-red-100 text-red-800 rounded-xl font-semibold text-sm">
            ✕ {report.failed} rows failed
          </span>
        </div>

        {/* Error table */}
        {report.errors.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-700">Failed Rows</h3>
              <button onClick={() => downloadErrorReport(report.errors)}
                className="text-sm font-medium text-blue-600 hover:text-blue-800 border border-blue-200 rounded-lg px-3 py-1.5 hover:bg-blue-50 transition-colors">
                ↓ Download Error Report
              </button>
            </div>
            <div className="bg-white rounded-xl border border-slate-100 overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Row #</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">First Name</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Last Name</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Issues</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {report.errors.map((err) => (
                    <tr key={err.row} className="bg-red-50/50">
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">{err.row}</td>
                      <td className="px-4 py-3 text-slate-700">{err.data.first_name ?? "—"}</td>
                      <td className="px-4 py-3 text-slate-700">{err.data.last_name ?? "—"}</td>
                      <td className="px-4 py-3 text-red-600 text-xs">{err.issues.join(", ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={reset}
            className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition-all">
            Import Another File
          </button>
          <button onClick={onViewStudents}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold shadow-md transition-all">
            View Students →
          </button>
        </div>
      </div>
    );
  }

  // ── STEP 3: SUCCESS ─────────────────────────────────────────────────────────
  return (
    <div className="relative max-w-2xl text-center py-16 space-y-6">
      <Confetti />
      <div className="text-7xl">🎉</div>
      <h2 className="text-2xl font-bold text-slate-800">Import Complete!</h2>
      {report && (
        <p className="text-slate-600 text-lg">
          Successfully imported <span className="font-bold text-emerald-600">{report.imported}</span> students.
        </p>
      )}
      <div className="flex gap-3 justify-center">
        <button onClick={reset}
          className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition-all">
          Import Another File
        </button>
        <button onClick={onViewStudents}
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-md transition-all">
          View Students →
        </button>
      </div>
    </div>
  );
}
