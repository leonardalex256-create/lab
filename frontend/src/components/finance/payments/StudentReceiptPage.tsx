import { formatCurrencyUGX, formatReceiptDate } from "../shared/financeFormat";
import type { StudentPaymentReceipt } from "../shared/financeTypes";
import { useTheme } from "../../../theme/ThemeProvider";
import { numberToWords, toSentenceCase } from "../shared/numberToWords";
import { useSchoolConfig } from "../../../context/SchoolConfigContext";

export function StudentReceiptPage({ receipt }: { receipt: StudentPaymentReceipt }) {
  const { resolvedTheme } = useTheme();
  const isDarkUi = resolvedTheme === "dark" || resolvedTheme === "tinted-dark";
  const config = useSchoolConfig();
  const amountWords = `${toSentenceCase(numberToWords(Math.round(Number(receipt.amountPaid) || 0)))} Uganda shillings only`;
  const generatedBy = receipt.generatedByName?.trim() || "Account User";
  const receiptTimestamp = formatReceiptDate(receipt.issuedAt);

  return (
    <section
      className={`relative mx-auto w-full max-w-[148mm] overflow-hidden rounded-md border p-3 text-slate-900 shadow-sm sm:p-4 print:max-w-[148mm] print:rounded-none print:border-black print:bg-white print:p-2 print:shadow-none print:text-black ${
        isDarkUi ? "bg-slate-900 border-slate-700" : "bg-white border-slate-300"
      }`}
    >
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.02] print:hidden">
        <div className="flex flex-col items-center">
          <span className="text-5xl font-black tracking-tight [transform:rotate(-20deg)]">
            {config.watermarkText}
          </span>
          <span className="mt-[-0.4rem] text-2xl font-black uppercase tracking-[0.4em] [transform:rotate(-20deg)]">
            {config.shortName}
          </span>
        </div>
      </div>

      <div className="relative z-10 space-y-3 print:space-y-2">
        <header className="flex flex-col items-start justify-between gap-2 border-b border-dashed border-slate-300 pb-2 sm:flex-row print:gap-1 print:pb-1">
          <div className="flex items-center gap-3">
            <div className={`h-14 w-14 shrink-0 overflow-hidden rounded-md border p-1 ${isDarkUi ? "bg-slate-800 border-slate-700" : "bg-white border-slate-300"}`}>
              <img src={config.badgeImagePath} alt="School Badge" className="h-full w-full object-contain" />
            </div>
            <div>
              <h1 className={`text-lg font-black leading-tight ${isDarkUi ? "text-white" : "text-slate-900"}`}>
                {config.schoolName}
              </h1>
              <p className="mt-0.5 text-xs font-bold uppercase tracking-wide text-slate-700 print:text-black">Official Payment Receipt</p>
              <div className="mt-1 space-y-0.5 text-xs text-slate-600 print:text-black">
                <p>{config.address}</p>
                <p>{`P.O. BOX ${config.poBox} | ${config.email}`}</p>
                <p>{`${config.phone1}${config.phone2 ? ` · ${config.phone2}` : ""}`}</p>
              </div>
            </div>
          </div>

          <div className="text-left sm:text-right">
            <div className={`inline-block rounded-md border px-3 py-2 ${isDarkUi ? "bg-slate-800 border-slate-700" : "bg-slate-50 border-slate-300"} print:border-black`}>
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 print:text-black">Receipt No.</p>
              <p className={`text-lg font-black tabular-nums ${isDarkUi ? "text-slate-200" : "text-slate-900"} print:text-black`}>#{receipt.receiptNo}</p>
            </div>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500 print:text-black">
              Issued: {receiptTimestamp}
            </p>
          </div>
        </header>

        <div className="grid gap-2 sm:grid-cols-2 print:gap-1">
          <div className={`rounded-sm border p-2 ${isDarkUi ? "bg-slate-800/20 border-slate-700" : "bg-slate-50 border-slate-300"} print:bg-white print:border-black`}>
            <h3 className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-500 print:text-black">
              <span className="h-1 w-1 rounded-full bg-slate-500 print:bg-black" />
              Student Information
            </h3>
            <div className="space-y-1">
              <div className="flex items-end justify-between border-b border-dashed border-slate-300 pb-0.5 print:border-black">
                <span className="text-[10px] font-bold uppercase text-slate-500 print:text-black">Full Name</span>
                <span className={`text-sm font-bold ${isDarkUi ? "text-slate-200" : "text-slate-900"} print:text-black`}>{receipt.student.fullName}</span>
              </div>
              <div className="flex items-end justify-between border-b border-dashed border-slate-300 pb-0.5 print:border-black">
                <span className="text-[10px] font-bold uppercase text-slate-500 print:text-black">Admission No.</span>
                <span className={`text-sm font-bold ${isDarkUi ? "text-slate-200" : "text-slate-900"} print:text-black`}>{receipt.student.admissionNumber}</span>
              </div>
              <div className="flex items-end justify-between border-b border-dashed border-slate-300 pb-0.5 print:border-black">
                <span className="text-[10px] font-bold uppercase text-slate-500 print:text-black">Class / Stream</span>
                <span className={`text-sm font-bold ${isDarkUi ? "text-slate-200" : "text-slate-900"} print:text-black`}>
                  {receipt.student.className ?? "—"} · {receipt.student.sectionName ?? "—"}
                </span>
              </div>
            </div>
          </div>

          <div className={`rounded-sm border p-2 ${isDarkUi ? "bg-slate-800/20 border-slate-700" : "bg-slate-50 border-slate-300"} print:bg-white print:border-black`}>
            <h3 className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-500 print:text-black">
              <span className="h-1 w-1 rounded-full bg-slate-500 print:bg-black" />
              Payment Context
            </h3>
            <div className="space-y-1">
              <div className="flex items-end justify-between border-b border-dashed border-slate-300 pb-0.5 print:border-black">
                <span className="text-[10px] font-bold uppercase text-slate-500 print:text-black">Academic Term</span>
                <span className={`text-sm font-bold ${isDarkUi ? "text-slate-200" : "text-slate-900"} print:text-black`}>{receipt.term}</span>
              </div>
              <div className="flex items-end justify-between border-b border-dashed border-slate-300 pb-0.5 print:border-black">
                <span className="text-[10px] font-bold uppercase text-slate-500 print:text-black">Method</span>
                <span className={`text-sm font-bold ${isDarkUi ? "text-slate-200" : "text-slate-900"} print:text-black`}>{receipt.paymentMethod}</span>
              </div>
              <div className="flex items-end justify-between border-b border-dashed border-slate-300 pb-0.5 print:border-black">
                <span className="text-[10px] font-bold uppercase text-slate-500 print:text-black">Payee Name</span>
                <span className={`text-sm font-bold ${isDarkUi ? "text-slate-200" : "text-slate-900"} print:text-black`}>{receipt.paidBy}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-sm border border-slate-300 print:border-black" style={{ breakInside: "avoid-page" }}>
          <div className={`grid grid-cols-[1fr_auto] px-2 py-1.5 text-[10px] font-bold uppercase tracking-wide ${isDarkUi ? "bg-slate-800 text-slate-400" : "bg-slate-100 text-slate-600"} print:bg-white print:text-black`}>
            <span>Transaction Description</span>
            <span className="text-right">Amount</span>
          </div>

          <div className={`grid grid-cols-[1fr_auto] items-center border-b border-dashed border-slate-300 px-2 py-2 ${isDarkUi ? "bg-slate-800/20" : "bg-white"} print:border-black print:bg-white`}>
            <div>
              <h4 className="text-sm font-bold text-slate-900 print:text-black">Amount Paid</h4>
            </div>
            <span className="text-lg font-bold text-slate-900 tabular-nums print:text-black">
              {formatCurrencyUGX(receipt.amountPaid)}
            </span>
          </div>

          <div className={`border-b border-dashed border-slate-300 px-2 py-1.5 ${isDarkUi ? "bg-slate-800/30" : "bg-slate-50"} print:border-black print:bg-white`}>
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-600 print:text-black">
              Amount In Words
            </p>
            <p className={`mt-0.5 text-sm font-bold leading-snug ${isDarkUi ? "text-slate-200" : "text-slate-900"} print:text-black`}>
              {amountWords}
            </p>
          </div>

          <div className={`grid grid-cols-[1fr_auto] items-center border-b border-dashed border-slate-300 px-2 py-2 ${isDarkUi ? "bg-slate-800/20" : "bg-white"} print:border-black print:bg-white`}>
            <div>
              <h4 className={`text-sm font-bold ${isDarkUi ? "text-white" : "text-slate-900"} print:text-black`}>Balance After Payment</h4>
            </div>
            <span className={`text-lg font-bold tabular-nums ${isDarkUi ? "text-slate-200" : "text-slate-900"} print:text-black`}>
              {receipt.outstandingAfter === 0 ? "CLEAR" : formatCurrencyUGX(receipt.outstandingAfter)}
            </span>
          </div>

          {receipt.creditAmount > 0 && (
            <div className={`grid grid-cols-[1fr_auto] items-center border-b border-dashed border-slate-300 px-2 py-1.5 ${isDarkUi ? "bg-slate-800/10" : "bg-slate-50/60"} print:border-black print:bg-white`}>
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wide text-slate-700 print:text-black">Credit Balance</h4>
                <p className="text-[10px] text-slate-500 print:text-black">Carried forward to next period.</p>
              </div>
              <span className="text-sm font-bold text-slate-900 tabular-nums print:text-black">
                {formatCurrencyUGX(receipt.creditAmount)}
              </span>
            </div>
          )}

        </div>

        <footer className="border-t border-slate-300 pt-2 print:border-black" style={{ breakInside: "avoid-page" }}>
          <div className="grid gap-2 sm:grid-cols-2">
            <SignatureBlock label="School Stamp & Seal" isDarkUi={isDarkUi} />
            <SignatureBlock label="Bursar's Signature" isDarkUi={isDarkUi} />
          </div>
          <div className={`mx-auto mt-2 w-full max-w-[90mm] rounded-sm border px-2 py-1.5 text-center ${isDarkUi ? "border-slate-700 bg-slate-800/30" : "border-slate-300 bg-slate-50"} print:border-black print:bg-white`}>
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 print:text-black">Generated By</p>
            <p className={`text-sm font-bold ${isDarkUi ? "text-slate-200" : "text-slate-900"} print:text-black`}>{generatedBy}</p>
          </div>

          <div className="mt-2 text-center">
            <p className="text-xs font-bold italic text-slate-500 print:text-black">
              {config.tagline}
            </p>
            <p className="mt-0.5 text-[10px] text-slate-500 uppercase tracking-wide print:text-black">
              {`All rights reserved ©${config.schoolName.toLowerCase().replace(/\s+/g, "")}.`}
            </p>
          </div>
        </footer>
      </div>
    </section>
  );
}

function SignatureBlock({ label, isDarkUi }: { label: string; isDarkUi: boolean }) {
  return (
    <div className="flex flex-col items-center">
      <div className={`flex h-12 w-full items-center justify-center rounded-sm border border-dashed ${isDarkUi ? "bg-slate-800/20 border-slate-700" : "bg-slate-50 border-slate-300"} print:border-black print:bg-white`}>
        {/* Reserved area for official stamp/signature */}
      </div>
      <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-slate-500 print:text-black">
        {label}
      </p>
    </div>
  );
}
