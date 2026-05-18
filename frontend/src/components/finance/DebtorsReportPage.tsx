import { useEffect, useMemo, useState } from "react";
import { useTermContext } from "../../context/TermContext";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { fetchDebtorsReport } from "../../api/financeDebtors";
import { formatCurrencyUGX } from "./shared/financeFormat";
import type { DebtorsPayload } from "./shared/financeTypes";
import { ConfirmModal } from "./shared/ConfirmModal";
import { useSchoolConfig } from "../../context/SchoolConfigContext";

type ExportFormat = "excel" | "pdf";

function formatBoardingStatus(status: string | null | undefined): string {
  const s = (status ?? "").trim().toLowerCase();
  if (!s) return "—";
  if (s === "boarding") return "Boarding";
  if (s === "day_full") return "Day (Full Day)";
  if (s === "day_half") return "Day (Half Day)";
  return status ?? "—";
}

function slugifyTerm(term: string): string {
  return term
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "term";
}

export function DebtorsReportPage() {
  const { viewingTerm, viewingAcademicYear } = useTermContext();
  const config = useSchoolConfig();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClass, setSelectedClass] = useState("all");
  const [exportFormat, setExportFormat] = useState<ExportFormat>("excel");
  const [exporting, setExporting] = useState(false);
  const [data, setData] = useState<DebtorsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    description: string;
    variant: "danger" | "warning" | "info";
    onConfirm: () => void;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetchDebtorsReport(viewingTerm, viewingAcademicYear)
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load report");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [viewingTerm, viewingAcademicYear]);

  const classOptions = useMemo(() => {
    if (!data) return [];
    return Array.from(new Set(data.items.map((item) => item.className))).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" }),
    );
  }, [data]);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = searchTerm.trim().toLowerCase();
    return data.items.filter(
      (s) =>
        (selectedClass === "all" || s.className === selectedClass) &&
        (!q ||
        s.fullName.toLowerCase().includes(q) ||
        s.admissionNumber.toLowerCase().includes(q) ||
        s.className.toLowerCase().includes(q)),
    );
  }, [data, searchTerm, selectedClass]);

  const filteredOutstanding = useMemo(
    () => filtered.reduce((acc, row) => acc + row.balance, 0),
    [filtered],
  );
  const filteredAssigned = useMemo(
    () => filtered.reduce((acc, row) => acc + row.totalFees, 0),
    [filtered],
  );
  const filteredPaid = useMemo(
    () => filtered.reduce((acc, row) => acc + row.totalPaid, 0),
    [filtered],
  );

  const handleExport = () => {
    if (!data || filtered.length === 0 || exporting) return;
    setExporting(true);
    try {
      const stamp = new Date().toISOString().slice(0, 10);
      const termSlug = slugifyTerm(data.term);

      if (exportFormat === "excel") {
        const workbook = XLSX.utils.book_new();
        const rows = filtered.map((row) => {
          const boardingStatus = formatBoardingStatus(
            (row as { boardingStatus?: string | null }).boardingStatus ?? null,
          );
          const outstandingAmount = Math.max(0, Number(row.balance) || 0);
          const creditAmount = Math.max(0, 0 - (Number(row.balance) || 0));
          return [
            row.admissionNumber,
            row.fullName,
            row.className,
            boardingStatus,
            Number(row.totalFees) || 0,
            Number(row.totalPaid) || 0,
            outstandingAmount,
            creditAmount,
            data.term,
          ];
        });
        const totalsRow = [
          "TOTALS",
          "",
          "",
          "",
          filteredAssigned,
          filteredPaid,
          filteredOutstanding,
          rows.reduce((sum, row) => sum + Number(row[7] ?? 0), 0),
          data.term,
        ];
        const sheetRows: Array<Array<string | number>> = [
          [
            "Admission Number",
            "Student Name",
            "Class",
            "Boarding Status",
            "Amount Assigned (UGX)",
            "Total Paid (UGX)",
            "Outstanding Balance (UGX)",
            "Credit (UGX)",
            "Term",
          ],
          ...rows,
          totalsRow,
        ];
        const sheet = XLSX.utils.aoa_to_sheet(sheetRows);
        sheet["!cols"] = [
          { wch: 18 },
          { wch: 28 },
          { wch: 14 },
          { wch: 18 },
          { wch: 20 },
          { wch: 18 },
          { wch: 24 },
          { wch: 14 },
          { wch: 20 },
        ];
        const totalsRowIndex = sheetRows.length;
        for (let col = 0; col <= 8; col += 1) {
          const cellAddress = XLSX.utils.encode_cell({ r: totalsRowIndex - 1, c: col });
          const cell = sheet[cellAddress];
          if (cell) {
            (cell as { s?: unknown }).s = {
              font: { bold: true },
              fill: { patternType: "solid", fgColor: { rgb: "F1F5F9" } },
            };
          }
        }
        const sheetName = `Debtors – ${data.term}`.slice(0, 31);
        XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
        XLSX.writeFile(workbook, `debtors_report_${termSlug}_${stamp}.xlsx`);
      } else {
        const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
        const pageWidth = doc.internal.pageSize.getWidth();
        doc.setFontSize(14);
        doc.text(`${config.schoolName} — Debtors Report`, 40, 36);
        doc.setFontSize(10);
        doc.text(`Term: ${data.term}`, 40, 54);
        doc.text(`Class: ${selectedClass === "all" ? "All classes" : selectedClass}`, 40, 68);
        doc.text(`Total Outstanding: ${formatCurrencyUGX(filteredOutstanding)}`, 40, 82);
        doc.text(`Students: ${filtered.length}`, pageWidth - 40, 54, { align: "right" });
        doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth - 40, 68, { align: "right" });

        autoTable(doc, {
          startY: 94,
          head: [["Admission No.", "Student Name", "Class", "Total Fees", "Amount Paid", "Balance Due"]],
          body: filtered.map((row) => [
            row.admissionNumber,
            row.fullName,
            row.className,
            formatCurrencyUGX(row.totalFees),
            formatCurrencyUGX(row.totalPaid),
            formatCurrencyUGX(row.balance),
          ]),
          styles: { fontSize: 9, cellPadding: 5 },
          headStyles: { fillColor: [90, 143, 175], textColor: 255 },
          columnStyles: {
            3: { halign: "right" },
            4: { halign: "right" },
            5: { halign: "right" },
          },
        });
        doc.save(`debtors-report-${termSlug}-${stamp}.pdf`);
      }
    } catch (e) {
      setConfirmModal({
        title: "Export failed",
        description: e instanceof Error ? e.message : "Failed to export debtors report",
        variant: "warning",
        onConfirm: () => setConfirmModal(null),
      });
    } finally {
      setExporting(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#5a8faf] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      {/* Header Summary Card */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <p className="text-xs font-bold uppercase tracking-widest text-[#636e72] opacity-70">Accounting Period</p>
          <div className="flex items-center gap-2">
            <span className="text-lg font-black text-[#2d3436]">{data?.term || "Current Term"}</span>
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">ACTIVE</span>
          </div>
        </div>
        
        <div className="neo-card-elevated border-l-4 border-[#dc2626] bg-gradient-to-br from-[#fef2f2] to-[#fee2e2] px-6 py-4 text-right shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-wider text-[#991b1b]">Total Outstanding Debt</p>
          <p className="mt-1 text-2xl font-black text-[#dc2626]">
            {formatCurrencyUGX(data?.totalOutstanding ?? 0)}
          </p>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl bg-red-50 p-4 border border-red-100">
          <p className="text-sm font-semibold text-[#b84040]">{error}</p>
        </div>
      ) : null}

      <ConfirmModal
        open={!!confirmModal}
        title={confirmModal?.title ?? ""}
        description={confirmModal?.description ?? ""}
        variant={confirmModal?.variant ?? "warning"}
        confirmLabel="OK"
        cancelLabel="Dismiss"
        onConfirm={confirmModal?.onConfirm ?? (() => undefined)}
        onCancel={() => setConfirmModal(null)}
      />

      <div className="neo-card overflow-hidden p-0 shadow-xl">
        {/* Search Bar Header */}
        <div className="flex flex-col gap-4 border-b border-[#ebe4d9]/80 bg-white px-6 py-5">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-sm font-black uppercase tracking-widest text-[#2d3436]">Debtors List</h2>
            <p className="text-[11px] font-semibold text-[#636e72]">
              Showing {filtered.length} student{filtered.length === 1 ? "" : "s"} with balances
            </p>
          </div>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex w-full flex-col gap-1 sm:w-auto">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#636e72]">Filter Class</span>
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="neo-inset-field rounded-xl px-3 py-2 text-sm text-[#2d3436] focus:ring-2 focus:ring-[#5a8faf]/50 sm:min-w-44"
              >
                <option value="all">All classes</option>
                {classOptions.map((className) => (
                  <option key={className} value={className}>
                    {className}
                  </option>
                ))}
              </select>
            </div>
            <div className="relative w-full lg:max-w-xl">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
              <input
                type="text"
                placeholder="Filter by name, admission no, or class..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="neo-inset-field w-full rounded-xl pl-10 pr-4 py-2 text-sm text-[#2d3436] focus:ring-2 focus:ring-[#5a8faf]/50"
              />
            </div>
            <div className="flex flex-col gap-1 sm:w-auto">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#636e72]">Export As</span>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <select
                  value={exportFormat}
                  onChange={(e) => setExportFormat(e.target.value as ExportFormat)}
                  className="neo-inset-field rounded-xl px-3 py-2 text-sm text-[#2d3436] focus:ring-2 focus:ring-[#5a8faf]/50 sm:min-w-36"
                >
                  <option value="excel">Excel</option>
                  <option value="pdf">PDF</option>
                </select>
                <button
                  type="button"
                  onClick={handleExport}
                  disabled={!data || filtered.length === 0 || exporting}
                  className="rounded-xl border border-[#c9e2f2] bg-gradient-to-br from-[#e8f4fa] to-[#d4e8f5] px-4 py-2 text-sm font-bold text-[#2d3436] shadow-sm transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {exporting ? "Exporting..." : "Export Sheet"}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-[#fcfbf9] text-[10px] font-bold uppercase tracking-wider text-[#636e72]">
              <tr>
                <th className="px-6 py-4">ADMISSION NO.</th>
                <th className="px-6 py-4">STUDENT NAME</th>
                <th className="px-6 py-3 text-center">CLASS</th>
                <th className="px-6 py-3 text-right">TOTAL FEES</th>
                <th className="px-6 py-3 text-right">TOTAL PAID</th>
                <th className="px-6 py-3 text-right">BALANCE DUE</th>
                <th className="px-6 py-3 text-center">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ebe4d9]/50">
              {filtered.map((d) => (
                <tr key={d.id} className="hover:bg-[#f8fbff] transition-colors group">
                  <td className="px-6 py-4 text-xs font-bold text-[#5a8faf]">
                    {d.admissionNumber}
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-black text-[#2d3436] tracking-tight">{d.fullName}</p>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="rounded-lg bg-gray-50 px-2 py-1 text-[11px] font-bold text-[#636e72] border border-gray-100">
                      {d.className}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right text-xs font-semibold text-[#636e72]">
                    {formatCurrencyUGX(d.totalFees)}
                  </td>
                  <td className="px-6 py-4 text-right text-xs font-bold text-[#15803d]">
                    {formatCurrencyUGX(d.totalPaid)}
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-black text-[#dc2626]">
                    {formatCurrencyUGX(d.balance)}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button className="rounded-xl border border-[#ebe4d9] bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-[#5a8faf] transition hover:bg-[#5a8faf] hover:text-white">
                      Profile
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} className="px-6 py-24 text-center">
                    <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#f0fdf4] text-4xl shadow-sm mb-4">
                      ✅
                    </div>
                    <h3 className="text-lg font-black text-[#166534]">All Clear!</h3>
                    <p className="mt-1 text-sm text-[#3f4f67] opacity-70">No students have outstanding balances for this term.</p>
                  </td>
                </tr>
              )}
            </tbody>
            {filtered.length > 0 ? (
              <tfoot>
                <tr className="bg-[#f1f5f9]">
                  <td className="px-6 py-4 text-xs font-black text-[#0f172a]" colSpan={3}>
                    TOTALS
                  </td>
                  <td className="px-6 py-4 text-right text-xs font-black text-[#0f172a]">
                    {formatCurrencyUGX(filteredAssigned)}
                  </td>
                  <td className="px-6 py-4 text-right text-xs font-black text-[#15803d]">
                    {formatCurrencyUGX(filteredPaid)}
                  </td>
                  <td className="px-6 py-4 text-right text-xs font-black text-[#b91c1c]">
                    {formatCurrencyUGX(filteredOutstanding)}
                  </td>
                  <td className="px-6 py-4" />
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      </div>
    </div>
  );
}
