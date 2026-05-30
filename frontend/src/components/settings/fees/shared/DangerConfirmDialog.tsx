export function DangerConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Yes, proceed",
  cancelLabel = "Cancel",
  busy,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4">
      <div
        className="max-w-md w-full rounded-2xl border border-rose-200 bg-white p-6 shadow-xl"
        role="alertdialog"
        aria-labelledby="danger-title"
      >
        <h4 id="danger-title" className="text-lg font-bold text-rose-900">
          {title}
        </h4>
        <p className="mt-2 text-sm text-slate-600 whitespace-pre-wrap">{message}</p>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            className="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            onClick={onCancel}
            disabled={busy}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className="rounded-full bg-rose-600 px-5 py-2 text-sm font-bold text-white hover:bg-rose-700 disabled:opacity-60"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
