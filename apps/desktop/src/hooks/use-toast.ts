import { useCallback, useState } from "react";
import type { ToastItem, ToastType } from "../components/ui/toast";

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function useToast(maxItems = 3) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback(
    (type: ToastType, message: string, duration = 2500) => {
      setToasts((current) => {
        const next = [...current, { id: generateId(), type, message, duration }];
        if (next.length > maxItems) {
          return next.slice(next.length - maxItems);
        }
        return next;
      });
    },
    [maxItems],
  );

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const clear = useCallback(() => {
    setToasts([]);
  }, []);

  const success = useCallback(
    (message: string, duration?: number) => addToast("success", message, duration),
    [addToast],
  );
  const info = useCallback(
    (message: string, duration?: number) => addToast("info", message, duration),
    [addToast],
  );
  const warning = useCallback(
    (message: string, duration?: number) => addToast("warning", message, duration),
    [addToast],
  );
  const error = useCallback(
    (message: string, duration?: number) => addToast("error", message, duration),
    [addToast],
  );

  return { toasts, addToast, dismiss, clear, success, info, warning, error };
}
