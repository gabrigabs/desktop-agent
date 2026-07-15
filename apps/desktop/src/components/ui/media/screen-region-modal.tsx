import type { NativeBoundingBox, NativeCapturePreview } from "@desktop-agent/shared";
import {
  Crop,
  Hand,
  Loader2,
  Maximize,
  MousePointer2,
  RotateCcw,
  ScanText,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

interface ScreenRegionModalProps {
  preview: NativeCapturePreview;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (crop: NativeBoundingBox, intent: "capture" | "extract_text") => void;
  onCaptureFull?: () => void;
  initialCrop?: NativeBoundingBox | null;
  onCropChange?: (crop: NativeBoundingBox | null) => void;
}

type Point = { x: number; y: number };

function clamp(value: number) {
  return Math.max(0, Math.min(1, value));
}

export function normalizeScreenCrop(start: Point, end: Point): NativeBoundingBox {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  };
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 6;

export function ScreenRegionModal({
  preview,
  busy,
  onCancel,
  onConfirm,
  onCaptureFull,
  initialCrop = null,
  onCropChange,
}: ScreenRegionModalProps) {
  const { t } = useTranslation("helix");
  const dragStart = useRef<Point | null>(null);
  const panStart = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const [crop, setCropState] = useState<NativeBoundingBox | null>(initialCrop);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [mode, setMode] = useState<"select" | "pan">("select");
  const imgWrapperRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [imageBounds, setImageBounds] = useState({ left: 0, top: 0, width: 0, height: 0 });

  const setCrop = useCallback(
    (next: NativeBoundingBox | null) => {
      setCropState(next);
      onCropChange?.(next);
    },
    [onCropChange],
  );

  useEffect(() => {
    setCropState(initialCrop);
  }, [initialCrop]);

  useEffect(() => {
    const wrapper = imgWrapperRef.current;
    const image = imageRef.current;
    if (!wrapper || !image) return;
    const updateBounds = () => {
      setImageBounds({
        left: image.offsetLeft,
        top: image.offsetTop,
        width: image.offsetWidth,
        height: image.offsetHeight,
      });
    };
    updateBounds();
    const observer = new ResizeObserver(updateBounds);
    observer.observe(wrapper);
    observer.observe(image);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onCancel();
      if (event.code === "Space") setMode((m) => (m === "select" ? "pan" : "select"));
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [busy, onCancel]);

  const pointFromEvent = useCallback((event: React.PointerEvent<HTMLDivElement>): Point => {
    const img = imageRef.current;
    if (!img) return { x: 0, y: 0 };
    const rect = img.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return { x: 0, y: 0 };
    return {
      x: clamp((event.clientX - rect.left) / rect.width),
      y: clamp((event.clientY - rect.top) / rect.height),
    };
  }, []);

  const hasSelection = Boolean(crop && crop.width >= 0.01 && crop.height >= 0.01);

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

  const selectionPx =
    crop && preview
      ? `${Math.round(crop.width * preview.width)}×${Math.round(crop.height * preview.height)}`
      : null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black/95 backdrop-blur-md">
      <header className="flex items-center justify-between gap-4 border-b border-line/40 px-4 py-2.5 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <h2 id="screen-region-title" className="text-sm font-semibold text-fg truncate">
            {t("helix:composer.screenRegion.title")}
          </h2>
          <span className="text-[10px] text-faint shrink-0">
            {preview.width}×{preview.height}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setMode("select")}
            disabled={busy}
            className={`rounded-lg p-1.5 transition-colors disabled:opacity-40 ${
              mode === "select" ? "bg-signal/15 text-signal" : "text-mute hover:bg-white/[0.06] hover:text-fg"
            }`}
            title={t("helix:composer.screenRegion.selectMode")}
            aria-label={t("helix:composer.screenRegion.selectMode")}
          >
            <MousePointer2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setMode("pan")}
            disabled={busy}
            className={`rounded-lg p-1.5 transition-colors disabled:opacity-40 ${
              mode === "pan" ? "bg-signal/15 text-signal" : "text-mute hover:bg-white/[0.06] hover:text-fg"
            }`}
            title={t("helix:composer.screenRegion.panMode")}
            aria-label={t("helix:composer.screenRegion.panMode")}
          >
            <Hand className="h-3.5 w-3.5" />
          </button>
          <div className="w-px h-5 bg-line/40 mx-0.5" />
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z - 0.5))}
            disabled={busy || zoom <= MIN_ZOOM}
            className="rounded-lg p-1.5 text-mute transition-colors hover:bg-white/[0.06] hover:text-fg disabled:opacity-30"
            title={t("helix:composer.screenRegion.zoomOut")}
            aria-label={t("helix:composer.screenRegion.zoomOut")}
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <span className="text-[10px] text-mute tabular-nums w-9 text-center shrink-0">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z + 0.5))}
            disabled={busy || zoom >= MAX_ZOOM}
            className="rounded-lg p-1.5 text-mute transition-colors hover:bg-white/[0.06] hover:text-fg disabled:opacity-30"
            title={t("helix:composer.screenRegion.zoomIn")}
            aria-label={t("helix:composer.screenRegion.zoomIn")}
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={resetView}
            disabled={busy}
            className="rounded-lg p-1.5 text-mute transition-colors hover:bg-white/[0.06] hover:text-fg disabled:opacity-30"
            title={t("helix:composer.screenRegion.resetView")}
            aria-label={t("helix:composer.screenRegion.resetView")}
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
          {onCaptureFull && (
            <>
              <div className="w-px h-5 bg-line/40 mx-0.5" />
              <button
                type="button"
                onClick={onCaptureFull}
                disabled={busy}
                className="flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1 text-[10px] font-medium text-mute transition-colors hover:bg-white/[0.04] hover:text-fg disabled:opacity-40"
              >
                <Maximize className="h-3 w-3" />
                {t("helix:composer.screenRegion.captureFull")}
              </button>
            </>
          )}
          <div className="w-px h-5 bg-line/40 mx-0.5" />
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-lg p-1.5 text-mute transition-colors hover:bg-white/[0.06] hover:text-fg disabled:opacity-40"
            aria-label={t("helix:composer.screenRegion.cancel")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div
        className="relative flex-1 min-h-0 overflow-hidden bg-black"
        style={{ cursor: mode === "pan" ? "grab" : "crosshair" }}
        onWheel={handleWheel}
        onPointerDown={(event) => {
          if (busy) return;
          if (mode === "pan") {
            event.currentTarget.setPointerCapture(event.pointerId);
            panStart.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y };
            event.currentTarget.style.cursor = "grabbing";
            return;
          }
          event.currentTarget.setPointerCapture(event.pointerId);
          const point = pointFromEvent(event);
          dragStart.current = point;
          setCrop(normalizeScreenCrop(point, point));
        }}
        onPointerMove={(event) => {
          if (busy) return;
          if (mode === "pan" && panStart.current) {
            const dx = (event.clientX - panStart.current.x) / zoom;
            const dy = (event.clientY - panStart.current.y) / zoom;
            setPan({ x: panStart.current.panX + dx, y: panStart.current.panY + dy });
            return;
          }
          if (!dragStart.current) return;
          setCrop(normalizeScreenCrop(dragStart.current, pointFromEvent(event)));
        }}
        onPointerUp={(event) => {
          if (mode === "pan") {
            panStart.current = null;
            event.currentTarget.style.cursor = "grab";
            event.currentTarget.releasePointerCapture(event.pointerId);
            return;
          }
          if (!dragStart.current) return;
          const point = pointFromEvent(event);
          setCrop(normalizeScreenCrop(dragStart.current, point));
          dragStart.current = null;
          event.currentTarget.releasePointerCapture(event.pointerId);
        }}
      >
        <div
          ref={imgWrapperRef}
          className="absolute inset-0 flex items-center justify-center"
          style={{
            transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
            transformOrigin: "center",
          }}
        >
          <img
            ref={imageRef}
            src={preview.previewDataUrl}
            alt={t("helix:composer.screenRegion.previewAlt")}
            className="block max-h-full max-w-full select-none"
            draggable={false}
            onLoad={() => {
              const image = imageRef.current;
              if (!image) return;
              setImageBounds({
                left: image.offsetLeft,
                top: image.offsetTop,
                width: image.offsetWidth,
                height: image.offsetHeight,
              });
            }}
          />
          {crop && (
            <div
              className="pointer-events-none absolute border border-signal bg-signal/10 shadow-[0_0_0_9999px_rgba(0,0,0,0.62),0_0_24px_rgba(196,153,244,0.35)] transition-[left,top,width,height] duration-75 motion-reduce:transition-none"
              style={{
                left: imageBounds.left + crop.x * imageBounds.width,
                top: imageBounds.top + crop.y * imageBounds.height,
                width: crop.width * imageBounds.width,
                height: crop.height * imageBounds.height,
              }}
            >
              <span className="absolute -left-px -top-px h-2.5 w-2.5 border-l-2 border-t-2 border-signal" />
              <span className="absolute -right-px -top-px h-2.5 w-2.5 border-r-2 border-t-2 border-signal" />
              <span className="absolute -bottom-px -left-px h-2.5 w-2.5 border-b-2 border-l-2 border-signal" />
              <span className="absolute -bottom-px -right-px h-2.5 w-2.5 border-b-2 border-r-2 border-signal" />
              {selectionPx && (
                <span className="absolute -top-6 left-0 text-[10px] font-medium text-signal bg-black/70 px-1.5 py-0.5 rounded whitespace-nowrap">
                  {selectionPx}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <footer className="flex items-center justify-between gap-3 border-t border-line/40 px-4 py-2.5 shrink-0">
        <span className="text-[10px] text-faint truncate">
          {hasSelection
            ? t("helix:composer.screenRegion.selectionReady")
            : t("helix:composer.screenRegion.selectionHint")}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          {hasSelection && (
            <button
              type="button"
              onClick={() => setCrop(null)}
              disabled={busy}
              className="rounded-lg border border-line px-2.5 py-1.5 text-[10px] font-medium text-mute transition-colors hover:bg-white/[0.04] hover:text-fg disabled:opacity-40"
            >
              {t("helix:composer.screenRegion.resetSelection")}
            </button>
          )}
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-lg border border-line px-3 py-1.5 text-[11px] font-medium text-mute transition-colors hover:bg-white/[0.04] hover:text-fg disabled:opacity-40"
          >
            {t("helix:composer.screenRegion.cancel")}
          </button>
          <button
            type="button"
            onClick={() => crop && onConfirm(crop, "extract_text")}
            disabled={!hasSelection || busy}
            className="flex items-center gap-1.5 rounded-lg border border-line-strong bg-white/[0.04] px-3 py-1.5 text-[11px] font-semibold text-fg transition-all hover:border-signal/30 hover:bg-white/[0.08] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-35 motion-reduce:transition-none"
          >
            {busy ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <ScanText className="h-3 w-3 text-signal" />
            )}
            {t("helix:composer.screenRegion.extractText")}
          </button>
          <button
            type="button"
            onClick={() => crop && onConfirm(crop, "capture")}
            disabled={!hasSelection || busy}
            className="flex items-center gap-1.5 rounded-lg border border-signal/35 bg-signal/15 px-3 py-1.5 text-[11px] font-semibold text-signal transition-all hover:bg-signal/20 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-35 motion-reduce:transition-none"
          >
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Crop className="h-3 w-3" />}
            {t("helix:composer.screenRegion.confirm")}
          </button>
        </div>
      </footer>
    </div>
  );
}
