import type { Turn } from "@desktop-agent/shared";
import { Check, Clipboard, Pencil } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

interface QueryBubbleProps {
  turn: Turn;
  onEditPrompt?: (text: string) => void;
  onToastSuccess?: (message: string, duration?: number) => void;
  onToastError?: (message: string, duration?: number) => void;
}

function getPromptText(turn: Turn): string {
  const textBlock = turn.blocks.find((b) => b.type === "text");
  return textBlock?.type === "text" ? textBlock.content : "";
}

function useRelativeTime(): (timestamp: number) => string {
  const { t } = useTranslation("helix");
  return (timestamp: number): string => {
    const diff = Date.now() - timestamp;
    if (diff < 30_000) return t("helix:queryBubble.now");
    if (diff < 120_000) return t("helix:queryBubble.oneMinute");
    const mins = Math.floor(diff / 60_000);
    if (mins < 60) return t("helix:queryBubble.minutes", { count: mins });
    const hrs = Math.floor(mins / 60);
    return t("helix:queryBubble.hours", { count: hrs });
  };
}

export function QueryBubble({ turn, onEditPrompt, onToastSuccess, onToastError }: QueryBubbleProps) {
  const { t } = useTranslation("helix");
  const relativeTime = useRelativeTime();
  const [copied, setCopied] = useState(false);
  const text = getPromptText(turn);

  const handleCopy = async () => {
    try {
      await navigator.clipboard?.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      onToastSuccess?.(t("helix:queryBubble.promptCopied"));
    } catch {
      onToastError?.(t("helix:queryBubble.copyError"));
    }
  };

  return (
    <div className="flex justify-end group">
      <div className="max-w-[78%]">
        <div className="flex items-center justify-end gap-2 mb-1">
          <span className="text-[10px] text-faint">{relativeTime(turn.timestamp)}</span>
          <span className="text-[10px] text-mute font-medium tracking-tight">
            {t("helix:queryBubble.you")}
          </span>
        </div>
        <div className="bg-white/[0.05] rounded-2xl rounded-br-sm px-3.5 py-2.5 border border-line">
          <p className="text-sm leading-relaxed text-fg whitespace-pre-wrap select-text">{text}</p>
        </div>
        <div className="flex items-center justify-end gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={handleCopy}
            className="h-6 px-2 rounded-md text-[10px] font-semibold text-faint hover:text-fg hover:bg-white/[0.04] transition-colors cursor-pointer flex items-center gap-1"
          >
            {copied ? <Check className="w-3 h-3" /> : <Clipboard className="w-3 h-3" />}
            {copied ? t("helix:queryBubble.copied") : t("helix:queryBubble.copy")}
          </button>
          {onEditPrompt && (
            <button
              type="button"
              onClick={() => onEditPrompt(text)}
              className="h-6 px-2 rounded-md text-[10px] font-semibold text-faint hover:text-fg hover:bg-white/[0.04] transition-colors cursor-pointer flex items-center gap-1"
            >
              <Pencil className="w-3 h-3" />
              {t("helix:queryBubble.edit")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
