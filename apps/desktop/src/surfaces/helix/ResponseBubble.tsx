import type { MessageBlock, Turn } from "@desktop-agent/shared";
import { unwrapAgentResponse } from "@desktop-agent/shared";
import { AlertCircle, Check, Clipboard, ExternalLink, RefreshCw, Sparkles, Wrench } from "lucide-react";
import { memo, useState } from "react";
import { useTranslation } from "react-i18next";
import { MarkdownRenderer } from "../../components/ui/markdown-renderer";
import { Pet } from "../../components/ui/pet";

interface ResponseBubbleProps {
  turn: Turn;
  onCopyText?: (text: string) => void;
  onRegenerate?: () => void;
  onToastSuccess?: (message: string, duration?: number) => void;
  onToastError?: (message: string, duration?: number) => void;
}

function blockKey(block: MessageBlock, index: number): string {
  switch (block.type) {
    case "text":
    case "thinking":
      return `block-${block.type}-${block.content.slice(0, 40)}-${index}`;
    case "tool_call":
      return `block-tool_call-${block.toolName}-${index}`;
    case "error":
      return `block-error-${block.message.slice(0, 40)}-${index}`;
    default:
      return `block-${index}`;
  }
}

function getResponseText(turn: Turn): string {
  return turn.blocks
    .filter((b): b is { type: "text"; content: string } => b.type === "text")
    .map((b) => unwrapAgentResponse(b.content))
    .join("");
}

function useRelativeTime(): (timestamp: number) => string {
  const { t } = useTranslation("helix");
  return (timestamp: number): string => {
    const diff = Date.now() - timestamp;
    if (diff < 30_000) return t("helix:responseBubble.now");
    if (diff < 120_000) return t("helix:responseBubble.oneMinute");
    const mins = Math.floor(diff / 60_000);
    if (mins < 60) return t("helix:responseBubble.minutes", { count: mins });
    const hrs = Math.floor(mins / 60);
    return t("helix:responseBubble.hours", { count: hrs });
  };
}

export function ResponseBubble({
  turn,
  onCopyText,
  onRegenerate,
  onToastSuccess,
  onToastError,
}: ResponseBubbleProps) {
  const { t } = useTranslation("helix");
  const relativeTime = useRelativeTime();
  const [copied, setCopied] = useState(false);
  const isStreaming = turn.status === "streaming";
  const text = getResponseText(turn);

  const lastBlock = turn.blocks[turn.blocks.length - 1];
  const lastBlockType = lastBlock?.type;
  const isThinkingPhase = isStreaming && (lastBlockType === "thinking" || !lastBlockType);
  const isTypingPhase = isStreaming && lastBlockType === "text" && text !== "";

  const handleCopy = async () => {
    if (!text) return;
    try {
      if (onCopyText) {
        onCopyText(text);
      } else {
        await navigator.clipboard?.writeText(text);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      onToastSuccess?.(t("helix:responseBubble.responseCopied"));
    } catch {
      onToastError?.(t("helix:responseBubble.copyError"));
    }
  };

  return (
    <div className="flex gap-2.5 group">
      <div className="shrink-0 mt-1">
        <Pet size={24} variant="compact" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] text-mute font-medium tracking-tight">Helix</span>
          <span className="text-[10px] text-faint">{relativeTime(turn.timestamp)}</span>
          {turn.status === "error" && (
            <span className="text-[10px] font-mono uppercase text-bad">
              {t("helix:responseBubble.failed")}
            </span>
          )}
          {turn.status === "cancelled" && (
            <span className="text-[10px] font-mono uppercase text-faint">
              {t("helix:responseBubble.cancelled")}
            </span>
          )}
        </div>

        <div className="text-sm leading-relaxed text-fg">
          {turn.blocks.map((block, i) => (
            <MemoizedBlockRenderer
              key={blockKey(block, i)}
              block={block}
              isStreaming={isStreaming && i === turn.blocks.length - 1}
            />
          ))}

          {isThinkingPhase && (
            <div className="flex items-center gap-1.5 text-mute py-1 animate-status-enter">
              <span className="text-xs font-medium">{t("helix:responseBubble.thinkingLabel")}</span>
              <span className="flex items-center gap-0.5">
                <span className="w-1 h-1 rounded-full bg-current animate-thinking-1" />
                <span className="w-1 h-1 rounded-full bg-current animate-thinking-2" />
                <span className="w-1 h-1 rounded-full bg-current animate-thinking-3" />
              </span>
            </div>
          )}

          {isTypingPhase && (
            <div className="flex items-center gap-1.5 text-signal/70 py-1 animate-status-enter">
              <span className="text-[10px] font-medium">{t("helix:responseBubble.typingResponse")}</span>
              <span className="inline-block w-[2px] h-3 bg-signal animate-typing-cursor rounded-sm" />
            </div>
          )}
        </div>

        {!isStreaming && (text || turn.status === "error" || turn.status === "cancelled") && (
          <div className="flex items-center gap-1 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
            {text && (
              <button
                type="button"
                onClick={handleCopy}
                className="h-6 px-2 rounded-md text-[10px] font-semibold text-faint hover:text-fg hover:bg-white/[0.04] transition-colors cursor-pointer flex items-center gap-1"
              >
                {copied ? <Check className="w-3 h-3" /> : <Clipboard className="w-3 h-3" />}
                {copied ? t("helix:responseBubble.copied") : t("helix:responseBubble.copy")}
              </button>
            )}
            {onRegenerate && (
              <button
                type="button"
                onClick={onRegenerate}
                className="h-6 px-2 rounded-md text-[10px] font-semibold text-faint hover:text-fg hover:bg-white/[0.04] transition-colors cursor-pointer flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                {t("helix:responseBubble.regenerate")}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function WebSourceItem({ title, url, snippet }: { title?: string; url?: string; snippet?: string }) {
  const { t } = useTranslation("helix");
  const [copied, setCopied] = useState(false);
  if (!url) return null;

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard?.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div className="rounded-md bg-white/[0.03] border border-line px-2.5 py-1.5">
      <div className="flex items-start gap-1.5">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] font-semibold text-fg hover:text-signal transition-colors truncate flex-1 min-w-0"
        >
          {title || url}
        </a>
        <button
          type="button"
          onClick={handleCopy}
          className="shrink-0 p-1 rounded text-faint hover:text-fg hover:bg-white/5 transition-colors cursor-pointer"
          title={t("helix:responseBubble.copyUrl")}
        >
          {copied ? <Check className="w-3 h-3 text-good" /> : <Clipboard className="w-3 h-3" />}
        </button>
      </div>
      <div className="text-[9px] text-faint font-mono truncate mt-0.5">{url}</div>
      {snippet && <div className="text-[10px] text-mute mt-1 leading-relaxed line-clamp-2">{snippet}</div>}
    </div>
  );
}

function StreamingTextBlock({ content, isStreaming }: { content: string; isStreaming: boolean }) {
  if (!isStreaming) {
    return (
      <div className="min-w-0 animate-fade-in">
        <MarkdownRenderer content={unwrapAgentResponse(content)} />
      </div>
    );
  }
  return (
    <div className="min-w-0 text-sm leading-relaxed text-fg break-words whitespace-pre-wrap animate-text-fade">
      {unwrapAgentResponse(content)}
      <span className="inline-block w-[2px] h-4 ml-0.5 bg-signal animate-typing-cursor align-text-bottom rounded-sm" />
    </div>
  );
}

function BlockRenderer({ block, isStreaming }: { block: MessageBlock; isStreaming: boolean }) {
  const { t } = useTranslation("helix");
  switch (block.type) {
    case "text":
      return <StreamingTextBlock content={block.content} isStreaming={isStreaming} />;
    case "thinking":
      return <ThinkingBlock isStreaming={isStreaming} />;
    case "tool_call": {
      const isWebSearch = block.toolName === "web.search";
      const webResults =
        isWebSearch && block.output
          ? (block.output as { results?: Array<{ title?: string; url?: string; snippet?: string }> }).results
          : undefined;
      const isOcr = block.toolName === "ocr.screenshot" || block.toolName === "ocr.image";
      const ocrText =
        isOcr && block.output ? (block.output as { text?: string; empty?: boolean }).text : undefined;
      const ocrEmpty = isOcr && block.output ? (block.output as { empty?: boolean }).empty : undefined;
      return (
        <div className="my-1.5">
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-white/[0.04] border border-line">
            <Wrench className="w-3 h-3 text-mute shrink-0" />
            <span className="text-[10px] font-mono text-mute truncate">{block.toolName}</span>
            <span
              className={`text-[9px] font-mono uppercase ml-auto shrink-0 ${
                block.status === "done" ? "text-good" : block.status === "failed" ? "text-bad" : "text-warn"
              }`}
            >
              {block.status}
            </span>
          </div>
          {isOcr && block.status === "done" && ocrText && !ocrEmpty && (
            <div className="mt-1.5 rounded-md bg-white/[0.03] border border-line px-2.5 py-2">
              <div className="text-[9px] text-faint uppercase font-bold mb-1">
                {t("helix:responseBubble.extractedText")}
              </div>
              <p className="text-[10px] text-mute leading-relaxed line-clamp-4 font-mono">{ocrText}</p>
            </div>
          )}
          {isOcr && block.status === "done" && ocrEmpty && (
            <div className="mt-1.5 flex items-center gap-1.5 rounded-md bg-white/[0.03] border border-line px-2.5 py-2">
              <AlertCircle className="w-3 h-3 text-faint shrink-0" />
              <span className="text-[10px] text-faint">{t("helix:responseBubble.noTextDetected")}</span>
            </div>
          )}
          {isOcr && block.status === "failed" && (
            <div className="mt-1.5 flex items-start gap-1.5 rounded-md bg-bad/5 border border-bad/20 px-2.5 py-1.5">
              <AlertCircle className="w-3 h-3 text-bad shrink-0 mt-0.5" />
              <span className="text-[10px] text-bad leading-relaxed">
                {t("helix:responseBubble.ocrFailed")}
              </span>
            </div>
          )}
          {webResults && webResults.length > 0 && (
            <div className="mt-1.5 flex flex-col gap-1">
              <div className="text-[9px] text-faint uppercase font-bold flex items-center gap-1">
                <ExternalLink className="w-3 h-3" />{" "}
                {t("helix:responseBubble.sources", { count: webResults.length })}
              </div>
              {webResults.map((src) => (
                <WebSourceItem
                  key={src.url ?? src.title ?? src.snippet ?? JSON.stringify(src)}
                  title={src.title}
                  url={src.url}
                  snippet={src.snippet}
                />
              ))}
            </div>
          )}
          {isWebSearch && block.status === "failed" && (
            <div className="mt-1.5 flex items-start gap-1.5 rounded-md bg-bad/5 border border-bad/20 px-2.5 py-1.5">
              <AlertCircle className="w-3 h-3 text-bad shrink-0 mt-0.5" />
              <span className="text-[10px] text-bad leading-relaxed">
                {t("helix:responseBubble.searchFailed")}
              </span>
            </div>
          )}
        </div>
      );
    }
    case "error":
      return (
        <div className="text-xs text-bad bg-bad/8 rounded-md px-3 py-2 my-1 border border-bad/15">
          {block.message}
        </div>
      );
    default:
      return null;
  }
}

const MemoizedBlockRenderer = memo(BlockRenderer, (prev, next) => {
  if (prev.isStreaming !== next.isStreaming) return false;
  if (prev.block === next.block) return true;
  if (prev.block.type !== next.block.type) return false;
  if (prev.block.type === "text" && next.block.type === "text") {
    return prev.block.content === next.block.content;
  }
  if (prev.block.type === "thinking" && next.block.type === "thinking") {
    return prev.block.content === next.block.content;
  }
  return false;
});

function ThinkingBlock({ isStreaming }: { isStreaming: boolean }) {
  const { t } = useTranslation("helix");
  return (
    <div className="my-2 flex items-center gap-2 rounded-md border border-line bg-white/[0.025] px-2.5 py-1.5 animate-status-enter">
      <Sparkles className={`w-3 h-3 ${isStreaming ? "text-signal" : "text-faint"}`} />
      <span className="text-[10px] text-mute">
        {isStreaming
          ? t("helix:responseBubble.analyzingContext")
          : t("helix:responseBubble.analysisComplete")}
      </span>
      {isStreaming && (
        <span className="flex items-center gap-0.5 ml-0.5">
          <span className="w-1 h-1 rounded-full bg-signal animate-thinking-1" />
          <span className="w-1 h-1 rounded-full bg-signal animate-thinking-2" />
          <span className="w-1 h-1 rounded-full bg-signal animate-thinking-3" />
        </span>
      )}
    </div>
  );
}
