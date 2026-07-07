import type { MessageBlock, Turn } from "@desktop-agent/shared";
import { Check, Clipboard, RefreshCw, Wrench } from "lucide-react";
import { useState } from "react";
import { MarkdownRenderer } from "../../components/ui/markdown-renderer";
import { Pet } from "../../components/ui/pet";

interface ResponseBubbleProps {
  turn: Turn;
  onCopyText?: (text: string) => void;
  onRegenerate?: () => void;
  onToastSuccess?: (message: string, duration?: number) => void;
  onToastError?: (message: string, duration?: number) => void;
}

function getResponseText(turn: Turn): string {
  return turn.blocks
    .filter((b): b is { type: "text"; content: string } => b.type === "text")
    .map((b) => b.content)
    .join("");
}

function relativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  if (diff < 30_000) return "agora";
  if (diff < 120_000) return "há 1min";
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `há ${mins}min`;
  const hrs = Math.floor(mins / 60);
  return `há ${hrs}h`;
}

export function ResponseBubble({
  turn,
  onCopyText,
  onRegenerate,
  onToastSuccess,
  onToastError,
}: ResponseBubbleProps) {
  const [copied, setCopied] = useState(false);
  const isStreaming = turn.status === "streaming";
  const text = getResponseText(turn);

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
      onToastSuccess?.("Resposta copiada");
    } catch {
      onToastError?.("Erro ao copiar resposta");
    }
  };

  return (
    <div className="flex gap-2.5 group">
      <div className="shrink-0 mt-1">
        <Pet size={14} variant="dot" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] text-mute font-medium tracking-tight">Helix</span>
          <span className="text-[10px] text-faint">{relativeTime(turn.timestamp)}</span>
          {turn.status === "error" && (
            <span className="text-[10px] font-mono uppercase text-bad">falhou</span>
          )}
          {turn.status === "cancelled" && (
            <span className="text-[10px] font-mono uppercase text-faint">cancelado</span>
          )}
        </div>

        <div className="text-sm leading-relaxed text-fg">
          {turn.blocks.map((block, i) => {
            const blockKey = `${block.type}-${
              block.type === "text"
                ? block.content.slice(0, 40)
                : block.type === "thinking"
                  ? block.content.slice(0, 40)
                  : block.type === "tool_call"
                    ? block.toolName
                    : block.type === "error"
                      ? block.message.slice(0, 40)
                      : ""
            }`;
            return (
              <BlockRenderer
                key={blockKey}
                block={block}
                isStreaming={isStreaming && i === turn.blocks.length - 1}
              />
            );
          })}

          {isStreaming && text === "" && (
            <div className="flex items-center gap-1.5 text-mute py-1">
              <span className="text-xs">pensando</span>
              <span className="flex items-center gap-0.5">
                <span className="w-1 h-1 rounded-full bg-current animate-thinking-1" />
                <span className="w-1 h-1 rounded-full bg-current animate-thinking-2" />
                <span className="w-1 h-1 rounded-full bg-current animate-thinking-3" />
              </span>
            </div>
          )}
        </div>

        {!isStreaming && text && (
          <div className="flex items-center gap-1 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={handleCopy}
              className="h-6 px-2 rounded-md text-[10px] font-semibold text-faint hover:text-fg hover:bg-white/[0.04] transition-colors cursor-pointer flex items-center gap-1"
            >
              {copied ? <Check className="w-3 h-3" /> : <Clipboard className="w-3 h-3" />}
              {copied ? "Copiado" : "Copiar"}
            </button>
            {onRegenerate && (
              <button
                type="button"
                onClick={onRegenerate}
                className="h-6 px-2 rounded-md text-[10px] font-semibold text-faint hover:text-fg hover:bg-white/[0.04] transition-colors cursor-pointer flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                Regenerar
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function BlockRenderer({ block, isStreaming }: { block: MessageBlock; isStreaming: boolean }) {
  switch (block.type) {
    case "text":
      return (
        <div className="min-w-0">
          <MarkdownRenderer content={block.content} />
          {isStreaming && (
            <span className="inline-block w-1.5 h-4 ml-0.5 align-[-2px] rounded-sm bg-signal animate-pulse" />
          )}
        </div>
      );
    case "thinking":
      return (
        <details className="my-2 group/think">
          <summary className="text-[10px] text-faint cursor-pointer hover:text-mute transition-colors select-none flex items-center gap-1.5">
            <span className="w-1 h-1 rounded-full bg-faint group-open/think:bg-signal transition-colors" />
            Pensamento
          </summary>
          <p className="text-xs text-mute italic mt-1.5 pl-3 border-l border-line leading-relaxed">
            {block.content}
          </p>
        </details>
      );
    case "tool_call":
      return (
        <div className="flex items-center gap-2 my-1.5 px-2.5 py-1.5 rounded-md bg-white/[0.04] border border-line">
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
      );
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
