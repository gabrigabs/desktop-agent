import type { MessageBlock, Turn } from "@desktop-agent/shared";
import {
  AlertCircle,
  Check,
  ChevronDown,
  Clipboard,
  ExternalLink,
  RefreshCw,
  Sparkles,
  Wrench,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
        <Pet size={24} variant="compact" />
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
          {turn.blocks.map((block, i) => (
            <BlockRenderer
              key={`${block.type}-${i}`}
              block={block}
              isStreaming={isStreaming && i === turn.blocks.length - 1}
            />
          ))}

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

        {!isStreaming && (text || turn.status === "error" || turn.status === "cancelled") && (
          <div className="flex items-center gap-1 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
            {text && (
              <button
                type="button"
                onClick={handleCopy}
                className="h-6 px-2 rounded-md text-[10px] font-semibold text-faint hover:text-fg hover:bg-white/[0.04] transition-colors cursor-pointer flex items-center gap-1"
              >
                {copied ? <Check className="w-3 h-3" /> : <Clipboard className="w-3 h-3" />}
                {copied ? "Copiado" : "Copiar"}
              </button>
            )}
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

function WebSourceItem({ title, url, snippet }: { title?: string; url?: string; snippet?: string }) {
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
          title="Copiar URL"
        >
          {copied ? <Check className="w-3 h-3 text-good" /> : <Clipboard className="w-3 h-3" />}
        </button>
      </div>
      <div className="text-[9px] text-faint font-mono truncate mt-0.5">{url}</div>
      {snippet && <div className="text-[10px] text-mute mt-1 leading-relaxed line-clamp-2">{snippet}</div>}
    </div>
  );
}

function BlockRenderer({ block, isStreaming }: { block: MessageBlock; isStreaming: boolean }) {
  switch (block.type) {
    case "text":
      return (
        <div className="min-w-0 animate-fade-in">
          <MarkdownRenderer content={block.content} />
          {isStreaming && (
            <span className="inline-block w-1.5 h-4 ml-0.5 align-[-2px] rounded-sm bg-signal animate-pulse" />
          )}
        </div>
      );
    case "thinking":
      return <ThinkingBlock content={block.content} isStreaming={isStreaming} />;
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
              <div className="text-[9px] text-faint uppercase font-bold mb-1">Texto extraído</div>
              <p className="text-[10px] text-mute leading-relaxed line-clamp-4 font-mono">{ocrText}</p>
            </div>
          )}
          {isOcr && block.status === "done" && ocrEmpty && (
            <div className="mt-1.5 flex items-center gap-1.5 rounded-md bg-white/[0.03] border border-line px-2.5 py-2">
              <AlertCircle className="w-3 h-3 text-faint shrink-0" />
              <span className="text-[10px] text-faint">Nenhum texto detectado na imagem.</span>
            </div>
          )}
          {isOcr && block.status === "failed" && (
            <div className="mt-1.5 flex items-start gap-1.5 rounded-md bg-bad/5 border border-bad/20 px-2.5 py-1.5">
              <AlertCircle className="w-3 h-3 text-bad shrink-0 mt-0.5" />
              <span className="text-[10px] text-bad leading-relaxed">
                Falha no OCR. Verifique se o tesseract está instalado ou configure OCR_SPACE_API_KEY.
              </span>
            </div>
          )}
          {webResults && webResults.length > 0 && (
            <div className="mt-1.5 flex flex-col gap-1">
              <div className="text-[9px] text-faint uppercase font-bold flex items-center gap-1">
                <ExternalLink className="w-3 h-3" /> Fontes ({webResults.length})
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
                Não foi possível pesquisar agora. Verifique sua conexão.
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

function ThinkingBlock({ content, isStreaming }: { content: string; isStreaming: boolean }) {
  const [open, setOpen] = useState(false);
  const [height, setHeight] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isStreaming) {
      setOpen(true);
    }
  }, [isStreaming]);

  useEffect(() => {
    const el = contentRef.current;
    if (el) setHeight(el.scrollHeight);
  }, [content, open]);

  const toggle = () => setOpen((o) => !o);
  const count = content.length;

  return (
    <div className="my-2 rounded-lg border border-signal/20 bg-signal/5 overflow-hidden">
      <button
        type="button"
        onClick={toggle}
        className="w-full px-3 py-2 flex items-center gap-2 text-left transition-colors hover:bg-white/[0.03]"
        aria-expanded={open}
      >
        <Sparkles
          className={`w-3.5 h-3.5 shrink-0 ${isStreaming ? "text-signal animate-pulse" : "text-faint"}`}
        />
        <span className="text-[10px] font-medium text-signal uppercase tracking-wider">Raciocínio</span>
        <span className="ml-auto text-[9px] text-faint/70 font-mono">{count} car.</span>
        <ChevronDown
          className={`w-3 h-3 text-faint transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      <div
        className="overflow-hidden transition-all duration-300 ease-out"
        style={{ maxHeight: open ? `${height}px` : "0px", opacity: open ? 1 : 0 }}
      >
        <div ref={contentRef} className="px-3 pb-3 pt-0">
          <div className="rounded-md bg-ink/40 border border-line/60 px-3 py-2">
            <p className="text-[11px] leading-relaxed font-mono text-mute/90 whitespace-pre-wrap">
              {content}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
