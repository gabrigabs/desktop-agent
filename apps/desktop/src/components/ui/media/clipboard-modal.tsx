import { Clipboard, Copy, Trash2, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

interface ClipboardModalProps {
  text: string;
  open: boolean;
  onClose: () => void;
  onRemove: () => void;
}

export function ClipboardModal({ text, open, onClose, onRemove }: ClipboardModalProps) {
  const { t } = useTranslation("helix");
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error("Failed to copy clipboard content:", err);
    }
  };

  const handleRemove = () => {
    onRemove();
    onClose();
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t("helix:clipboardModal.title")}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 bg-ink/60 backdrop-blur-sm animate-backdrop-fade"
        aria-label={t("helix:clipboardModal.close")}
      />
      <div
        ref={panelRef}
        className="relative w-full max-w-lg rounded-2xl border border-line-strong bg-ink/95 p-4 shadow-2xl shadow-black/40 backdrop-blur-xl animate-modal-enter"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-fg">
            <Clipboard className="h-4 w-4 text-signal" />
            <span>{t("helix:clipboardModal.title")}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-faint transition-colors hover:bg-white/[0.06] hover:text-fg"
            aria-label={t("helix:clipboardModal.close")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-1 text-[10px] text-mute">
          {text.length} {t("helix:clipboardModal.characters")}
        </p>

        <div className="mt-3 max-h-[60vh] overflow-y-auto rounded-xl border border-line bg-white/[0.02] p-3">
          <p className="whitespace-pre-wrap break-words text-xs leading-relaxed text-mute select-text">
            {text}
          </p>
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-fg transition-all hover:bg-white/[0.06] active:scale-95"
          >
            <Copy className="h-3.5 w-3.5" />
            {t("helix:clipboardModal.copyAgain")}
          </button>
          <button
            type="button"
            onClick={handleRemove}
            className="flex items-center gap-1.5 rounded-lg border border-bad/30 bg-bad/10 px-3 py-2 text-xs font-medium text-bad transition-all hover:bg-bad/20 active:scale-95"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {t("helix:clipboardModal.removeContext")}
          </button>
        </div>
      </div>
    </div>
  );
}
