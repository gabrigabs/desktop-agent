import { ChevronDown, ChevronUp, Clipboard, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

interface ClipboardPreviewProps {
  text: string;
  onClear?: () => void;
}

export function ClipboardPreview({ text, onClear }: ClipboardPreviewProps) {
  const { t } = useTranslation("helix");
  const [expanded, setExpanded] = useState(false);
  const hasText = text.trim().length > 0;

  if (!hasText) {
    return (
      <div className="flex items-center gap-2 text-[10px] text-faint select-none">
        <Clipboard className="w-3 h-3" />
        <span>{t("helix:clipboardPreview.hint")}</span>
      </div>
    );
  }

  const display = expanded ? text : `${text.slice(0, 120)}${text.length > 120 ? "…" : ""}`;

  return (
    <div className="rounded-lg border border-line bg-white/[0.02] p-2.5 flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 text-[10px] text-mute">
          <Clipboard className="w-3.5 h-3.5 text-good" />
          <span className="uppercase font-semibold tracking-wide">Clipboard</span>
          <span className="font-mono text-faint">
            {text.length} {t("helix:clipboardPreview.characters")}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="p-1 rounded text-faint hover:text-fg hover:bg-white/5 transition-colors"
            title={expanded ? t("helix:clipboardPreview.collapse") : t("helix:clipboardPreview.expand")}
            aria-label={expanded ? t("helix:clipboardPreview.collapse") : t("helix:clipboardPreview.expand")}
          >
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {onClear && (
            <button
              type="button"
              onClick={onClear}
              className="p-1 rounded text-faint hover:text-bad hover:bg-bad/5 transition-colors"
              title={t("helix:clipboardPreview.ignoreClipboard")}
              aria-label={t("helix:clipboardPreview.ignoreClipboard")}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
      <p className="text-[11px] text-mute leading-relaxed select-text whitespace-pre-wrap">{display}</p>
    </div>
  );
}
