import { AlertTriangle, CheckCircle, Info, X, XCircle } from "lucide-react";
import { useEffect } from "react";

export type ToastType = "success" | "info" | "warning" | "error";

export type ToastItem = {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
};

type ToastProps = {
  toast: ToastItem;
  onDismiss: (id: string) => void;
};

const ICONS: Record<ToastType, typeof CheckCircle> = {
  success: CheckCircle,
  info: Info,
  warning: AlertTriangle,
  error: XCircle,
};

const STYLES: Record<ToastType, string> = {
  success: "bg-good/10 border-good/30 text-good",
  info: "bg-signal/10 border-signal/30 text-signal",
  warning: "bg-warn/10 border-warn/30 text-warn",
  error: "bg-bad/10 border-bad/30 text-bad",
};

export function Toast({ toast, onDismiss }: ToastProps) {
  useEffect(() => {
    if (toast.duration === 0) return;
    const duration = toast.duration ?? 2500;
    const timer = setTimeout(() => onDismiss(toast.id), duration);
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onDismiss]);

  const Icon = ICONS[toast.type];

  return (
    <div
      role="status"
      aria-live="polite"
      className={`pointer-events-auto flex items-center gap-2.5 px-3 py-2.5 rounded-xl border shadow-lg backdrop-blur-sm min-w-[220px] max-w-[340px] motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 ${STYLES[toast.type]}`}
    >
      <Icon className="w-4 h-4 shrink-0" />
      <span className="text-xs font-medium flex-1 leading-snug">{toast.message}</span>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="p-1 rounded-md hover:bg-white/10 transition-colors shrink-0"
        aria-label="Fechar notificação"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

type ToastContainerProps = {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
};

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 items-center pointer-events-none">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
