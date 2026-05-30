import { useEffect } from "react";

export type ToastType = "success" | "error" | "warning";

export type ToastProps = {
  message: string;
  type: ToastType;
  onClose: () => void;
};

const ICON: Record<ToastType, string> = {
  success: "✅",
  error: "❌",
  warning: "⚠️",
};

const STYLE: Record<ToastType, string> = {
  success: "bg-emerald-50/90 text-emerald-800 ring-1 ring-emerald-200",
  error: "bg-red-50/90 text-red-800 ring-1 ring-red-200",
  warning: "bg-amber-50/90 text-amber-800 ring-1 ring-amber-200",
};

export function Toast({ message, type, onClose }: ToastProps) {
  useEffect(() => {
    const timer = window.setTimeout(onClose, 5000);
    return () => window.clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl px-5 py-3 text-sm font-semibold shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-4 fade-in duration-300 ${STYLE[type]}`}
      role="status"
      aria-live="polite"
    >
      <span className="text-lg">{ICON[type]}</span>
      <span>{message}</span>
      <button
        type="button"
        onClick={onClose}
        className="ml-2 rounded-full p-1 opacity-70 hover:bg-black/5 hover:opacity-100 transition"
        aria-label="Dismiss notification"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

