import { useEffect } from "react";

type ConfirmModalProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string; // default: "Confirm"
  cancelLabel?: string; // default: "Cancel"
  variant?: "danger" | "warning" | "info"; // default: "danger"
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !loading) onCancel();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, loading, onCancel]);

  if (!open) return null;

  const confirmBtnClass =
    variant === "warning"
      ? "flex-1 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 py-3 text-sm font-bold text-white shadow-lg shadow-amber-200 hover:shadow-xl disabled:opacity-50"
      : variant === "info"
        ? "flex-1 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-200 hover:shadow-xl disabled:opacity-50"
        : "flex-1 rounded-xl bg-gradient-to-r from-red-500 to-red-600 py-3 text-sm font-bold text-white shadow-lg shadow-red-200 hover:shadow-xl disabled:opacity-50";

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      onClick={() => (loading ? null : onCancel())}
    >
      <div
        className="w-full max-w-md rounded-3xl border border-slate-200 bg-white shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-5 border-b border-slate-100 bg-slate-50">
          <h2 className="text-base font-black text-[#0c2340]">{title}</h2>
          <p className="mt-1 text-sm font-medium text-slate-500">{description}</p>
        </div>
        <div className="flex gap-3 px-6 py-4 bg-slate-50/80 border-t border-slate-100">
          <button
            type="button"
            disabled={loading}
            onClick={onCancel}
            className="flex-1 rounded-xl border border-slate-200 bg-white py-3 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className={confirmBtnClass}
          >
            {loading ? (
              <span className="inline-flex items-center justify-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/80 border-t-transparent" />
                Working...
              </span>
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

