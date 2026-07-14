import type { ContextAttachment, NativeBoundingBox, NativeCapturePreview } from "@desktop-agent/shared";
import {
  Check,
  Copy,
  Crop,
  Eye,
  FileText,
  Hand,
  Info,
  RotateCcw,
  Trash2,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { StructuredOcr } from "../../../lib/structured-ocr";

interface CapturePreviewModalProps {
  context: ContextAttachment;
  preview?: NativeCapturePreview | null;
  onClose: () => void;
  onCrop?: () => void;
  onRecapture?: () => void;
  onRemove?: () => void;
  pendingConfirmation?: boolean;
  onConfirm?: () => void;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 8;

export function CapturePreviewModal({
  context,
  preview,
  onClose,
  onCrop,
  onRecapture,
  onRemove,
  pendingConfirmation = false,
  onConfirm,
}: CapturePreviewModalProps) {
  const { t } = useTranslation("helix");
  const [tab, setTab] = useState<"image" | "text" | "metadata">("image");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [mode, setMode] = useState<"select" | "pan">("pan");
  const panStart = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const imgWrapperRef = useRef<HTMLDivElement>(null);

  const imageDataUrl = context.imageDataUrl ?? preview?.previewDataUrl;
  const meta = context.metadata as Record<string, unknown> | undefined;
  const modeLabel = meta?.mode as string | undefined;
  const width = (meta?.width as number) ?? preview?.width;
  const height = (meta?.height as number) ?? preview?.height;
  const crop = meta?.crop as NativeBoundingBox | undefined;
  const processedOnDevice = meta?.processedOnDevice as boolean | undefined;
  const structuredOcr = meta?.structuredOcr as StructuredOcr | null | undefined;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const delta = -e.deltaY * 0.002;
    setZoom((z) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z + delta)));
  };

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const tabs = [
    { id: "image" as const, icon: Eye, label: t("helix:capturePreview.tabs.image") },
    { id: "text" as const, icon: FileText, label: t("helix:capturePreview.tabs.text") },
    { id: "metadata" as const, icon: Info, label: t("helix:capturePreview.tabs.metadata") },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black/95 backdrop-blur-md">
      <header className="flex items-center justify-between gap-4 border-b border-line/40 px-4 py-2.5 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <h2 className="text-sm font-semibold text-fg truncate">{context.label}</h2>
          {pendingConfirmation && (
            <span className="rounded-full border border-signal/20 bg-signal/[0.07] px-2 py-0.5 text-[9px] font-medium text-signal">
              {t("helix:capturePreview.reviewBadge")}
            </span>
          )}
          {width && height && (
            <span className="text-[10px] text-faint shrink-0">
              {width}×{height}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {onCrop && (
            <button
              type="button"
              onClick={onCrop}
              className="flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1 text-[10px] font-medium text-mute transition-colors hover:bg-white/[0.04] hover:text-fg"
            >
              <Crop className="h-3 w-3" />
              {t("helix:capturePreview.crop")}
            </button>
          )}
          {onRecapture && (
            <button
              type="button"
              onClick={onRecapture}
              className="flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1 text-[10px] font-medium text-mute transition-colors hover:bg-white/[0.04] hover:text-fg"
            >
              <RotateCcw className="h-3 w-3" />
              {t("helix:capturePreview.recapture")}
            </button>
          )}
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="flex items-center gap-1.5 rounded-lg border border-red-500/30 px-2.5 py-1 text-[10px] font-medium text-red-400/80 transition-colors hover:bg-red-500/10 hover:text-red-400"
            >
              <Trash2 className="h-3 w-3" />
              {t("helix:capturePreview.remove")}
            </button>
          )}
          <div className="w-px h-5 bg-line/40 mx-0.5" />
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-mute transition-colors hover:bg-white/[0.06] hover:text-fg"
            aria-label={t("helix:capturePreview.close")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="flex items-center gap-1 border-b border-line/30 px-3 py-1.5 shrink-0">
        {tabs.map((tb) => {
          const Icon = tb.icon;
          return (
            <button
              key={tb.id}
              type="button"
              onClick={() => setTab(tb.id)}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[10px] font-medium transition-colors ${
                tab === tb.id ? "bg-signal/12 text-signal" : "text-mute hover:bg-white/[0.04] hover:text-fg"
              }`}
            >
              <Icon className="h-3 w-3" />
              {tb.label}
            </button>
          );
        })}
      </div>

      {tab === "image" && imageDataUrl && (
        <>
          <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-line/30 shrink-0">
            <button
              type="button"
              onClick={() => setMode("pan")}
              className={`rounded-lg p-1.5 transition-colors ${
                mode === "pan" ? "bg-signal/15 text-signal" : "text-mute hover:bg-white/[0.06] hover:text-fg"
              }`}
              title={t("helix:composer.screenRegion.panMode")}
            >
              <Hand className="h-3.5 w-3.5" />
            </button>
            <div className="w-px h-5 bg-line/40 mx-0.5" />
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z - 0.5))}
              disabled={zoom <= MIN_ZOOM}
              className="rounded-lg p-1.5 text-mute transition-colors hover:bg-white/[0.06] hover:text-fg disabled:opacity-30"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <span className="text-[10px] text-mute tabular-nums w-9 text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z + 0.5))}
              disabled={zoom >= MAX_ZOOM}
              className="rounded-lg p-1.5 text-mute transition-colors hover:bg-white/[0.06] hover:text-fg disabled:opacity-30"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={resetView}
              className="rounded-lg p-1.5 text-mute transition-colors hover:bg-white/[0.06] hover:text-fg"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          </div>
          <div
            className="relative flex-1 min-h-0 overflow-hidden bg-black"
            style={{ cursor: mode === "pan" ? "grab" : "default" }}
            onWheel={handleWheel}
            onPointerDown={(e) => {
              if (mode !== "pan") return;
              e.currentTarget.setPointerCapture(e.pointerId);
              panStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
              e.currentTarget.style.cursor = "grabbing";
            }}
            onPointerMove={(e) => {
              if (mode !== "pan" || !panStart.current) return;
              const dx = (e.clientX - panStart.current.x) / zoom;
              const dy = (e.clientY - panStart.current.y) / zoom;
              setPan({ x: panStart.current.panX + dx, y: panStart.current.panY + dy });
            }}
            onPointerUp={(e) => {
              if (mode !== "pan") return;
              panStart.current = null;
              e.currentTarget.style.cursor = "grab";
              e.currentTarget.releasePointerCapture(e.pointerId);
            }}
          >
            <div
              ref={imgWrapperRef}
              className="absolute inset-0"
              style={{
                transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
                transformOrigin: "center",
              }}
            >
              <img
                src={imageDataUrl}
                alt={context.label}
                className="block h-full w-full object-contain"
                draggable={false}
              />
            </div>
          </div>
        </>
      )}

      {tab === "text" && (
        <div className="flex-1 min-h-0 overflow-y-auto bg-[radial-gradient(circle_at_top_left,rgba(196,153,244,0.06),transparent_38%)] px-4 py-4">
          {structuredOcr?.blocks?.length ? (
            <StructuredOcrView ocr={structuredOcr} />
          ) : context.content ? (
            <div className="mx-auto max-w-3xl rounded-xl border border-line/60 bg-black/20 p-4">
              <pre className="whitespace-pre-wrap break-words font-mono text-[12px] leading-relaxed text-fg">
                {context.content}
              </pre>
            </div>
          ) : (
            <p className="text-[11px] text-mute">{t("helix:capturePreview.noText")}</p>
          )}
        </div>
      )}

      {tab === "metadata" && (
        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3">
          <dl className="space-y-1.5">
            <MetaRow label={t("helix:capturePreview.meta.mode")} value={modeLabel} />
            <MetaRow
              label={t("helix:capturePreview.meta.dimensions")}
              value={width && height ? `${width}×${height}` : undefined}
            />
            {crop && (
              <MetaRow
                label={t("helix:capturePreview.meta.crop")}
                value={`${Math.round(crop.x * 100)},${Math.round(crop.y * 100)} · ${Math.round(crop.width * 100)}×${Math.round(crop.height * 100)}%`}
              />
            )}
            <MetaRow
              label={t("helix:capturePreview.meta.onDevice")}
              value={processedOnDevice !== undefined ? (processedOnDevice ? "✓" : "—") : undefined}
            />
            {preview && (
              <MetaRow
                label={t("helix:capturePreview.meta.expires")}
                value={new Date(preview.expiresAt).toLocaleTimeString()}
              />
            )}
          </dl>
        </div>
      )}

      {pendingConfirmation && onConfirm && (
        <footer className="flex shrink-0 items-center justify-between gap-4 border-t border-line/40 bg-[#100e16]/95 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-fg">{t("helix:capturePreview.reviewTitle")}</p>
            <p className="mt-0.5 truncate text-[9px] text-mute">
              {t("helix:capturePreview.reviewDescription")}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-line px-3 py-1.5 text-[10px] font-medium text-mute transition-colors hover:bg-white/[0.04] hover:text-fg"
            >
              {t("helix:capturePreview.cancel")}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="flex items-center gap-1.5 rounded-lg border border-signal/40 bg-signal px-3.5 py-1.5 text-[10px] font-semibold text-ink shadow-[0_0_18px_-5px_rgba(196,153,244,0.55)] transition-all hover:bg-signal/85 active:scale-[0.98] motion-reduce:transition-none"
            >
              <Check className="h-3 w-3" />
              {t("helix:capturePreview.addToChat")}
            </button>
          </div>
        </footer>
      )}
    </div>
  );
}

function StructuredOcrView({ ocr }: { ocr: StructuredOcr }) {
  const { t } = useTranslation("helix");
  const [copied, setCopied] = useState(false);
  const confidence = Math.round(ocr.averageConfidence * 100);

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(ocr.plainText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-3">
      <section className="flex items-center justify-between gap-4 rounded-xl border border-signal/15 bg-signal/[0.045] px-3 py-2.5">
        <div className="flex items-center gap-5">
          <OcrMetric value={ocr.blocks.length} label={t("helix:capturePreview.ocr.blocks")} />
          <OcrMetric value={ocr.lines.length} label={t("helix:capturePreview.ocr.lines")} />
          <OcrMetric value={`${confidence}%`} label={t("helix:capturePreview.ocr.confidence")} />
        </div>
        <button
          type="button"
          onClick={() => void copyText()}
          className="flex items-center gap-1.5 rounded-lg border border-line-strong bg-black/20 px-2.5 py-1.5 text-[10px] font-medium text-mute transition-all hover:border-signal/30 hover:text-fg active:scale-[0.98] motion-reduce:transition-none"
        >
          {copied ? <Check className="h-3 w-3 text-good" /> : <Copy className="h-3 w-3" />}
          {copied ? t("helix:capturePreview.ocr.copied") : t("helix:capturePreview.ocr.copy")}
        </button>
      </section>

      <div className="overflow-hidden rounded-xl border border-line/60 bg-black/20 shadow-[0_18px_50px_-38px_rgba(196,153,244,0.45)]">
        {ocr.blocks.map((block, index) => (
          <article
            key={block.id}
            className="group relative px-4 py-3.5 transition-colors hover:bg-white/[0.025] motion-reduce:transition-none [&:not(:last-child)]:border-b [&:not(:last-child)]:border-line/40"
          >
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[8px] tabular-nums text-signal/60">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-signal/75">
                  {t(`helix:capturePreview.ocr.kind.${block.kind}`)}
                </span>
              </div>
              <span className="font-mono text-[9px] tabular-nums text-faint">
                {Math.round(block.confidence * 100)}%
              </span>
            </div>
            <p
              className={`whitespace-pre-wrap break-words text-fg select-text ${
                block.kind === "heading"
                  ? "text-[14px] font-semibold leading-snug"
                  : "text-[12px] leading-relaxed"
              }`}
            >
              {block.text}
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}

function OcrMetric({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <strong className="font-mono text-[12px] font-semibold tabular-nums text-fg">{value}</strong>
      <span className="text-[9px] text-faint">{label}</span>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="flex items-center justify-between gap-4 text-[11px]">
      <dt className="text-mute shrink-0">{label}</dt>
      <dd className="text-fg text-right truncate">{value}</dd>
    </div>
  );
}
