import { Clipboard, Code, FileText, Globe, RefreshCw, Type } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ContextChipItem } from "../../surfaces/helix/hooks/useContextChips";

interface ContextBarProps {
  text: string;
  enabled: boolean;
  onEnable: () => void;
  onDisable: () => void;
  onReload: () => void;
  clipboardActions?: ContextChipItem[];
  onClipboardAction?: (chip: ContextChipItem) => void;
}

function detectIcon(text: string): React.ElementType {
  const trimmed = text.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return Globe;
  }
  if (
    trimmed.includes("{") ||
    trimmed.includes("function") ||
    trimmed.includes("class ") ||
    trimmed.includes("import ")
  ) {
    return Code;
  }
  if (trimmed.length > 120) {
    return FileText;
  }
  return Type;
}

export function ContextBar({
  text,
  enabled,
  onEnable,
  onDisable,
  onReload,
  clipboardActions,
  onClipboardAction,
}: ContextBarProps) {
  const { t } = useTranslation("helix");
  const hasText = text.trim().length > 0;
  const Icon = detectIcon(text);

  if (!hasText) {
    return (
      <div className="flex items-center gap-2 text-[10px] text-faint select-none px-1">
        <Clipboard className="w-3 h-3" />
        <span>{t("helix:contextBar.copyTextHint")}</span>
      </div>
    );
  }

  return (
    <div
      className={`rounded-lg border p-1.5 transition-colors ${
        enabled ? "bg-signal/[0.04] border-signal/20" : "bg-transparent border-line"
      }`}
    >
      <div className="flex items-center gap-2">
        <Icon className={`w-3.5 h-3.5 shrink-0 ${enabled ? "text-signal" : "text-faint"}`} />
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <span className={`text-[10px] font-medium ${enabled ? "text-signal" : "text-faint"}`}>
            {t("helix:contextBar.clipboard")}
          </span>
          <span className="text-[10px] text-faint font-mono">
            {text.length} {t("helix:contextBar.characters")}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onReload}
            className="p-1 rounded-md text-faint hover:text-fg hover:bg-white/5 transition-colors"
            title={t("helix:contextBar.reloadClipboard")}
            aria-label={t("helix:contextBar.reloadClipboard")}
          >
            <RefreshCw className="w-3 h-3" />
          </button>
          {enabled ? (
            <button
              type="button"
              onClick={onDisable}
              className="text-[10px] font-medium px-2 py-1 rounded-md bg-signal/10 text-signal hover:bg-signal/20 transition-colors"
              title={t("helix:contextBar.removeClipboard")}
            >
              {t("helix:contextBar.included")}
            </button>
          ) : (
            <button
              type="button"
              onClick={onEnable}
              className="text-[10px] font-medium px-2 py-1 rounded-md bg-white/[0.04] text-mute hover:bg-white/[0.08] hover:text-fg transition-colors"
              title={t("helix:contextBar.includeClipboard")}
            >
              {t("helix:contextBar.include")}
            </button>
          )}
        </div>
      </div>

      {clipboardActions && clipboardActions.length > 0 && onClipboardAction && (
        <div className="mt-1.5 pt-1.5 border-t border-line/40 flex flex-wrap items-center gap-1.5">
          {clipboardActions.map((action) => {
            const ActionIcon = action.icon;
            return (
              <button
                key={action.id}
                type="button"
                onClick={() => onClipboardAction(action)}
                className="flex items-center gap-1 px-2 py-1 rounded-full border border-line bg-white/[0.03] text-[10px] text-mute hover:text-fg hover:border-signal/30 hover:bg-white/[0.06] transition-colors"
                title={action.prompt}
              >
                <ActionIcon className={`w-3 h-3 ${action.accent}`} />
                {action.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
