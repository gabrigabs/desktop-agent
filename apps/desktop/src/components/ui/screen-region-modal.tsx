import type { NativeBoundingBox, NativeCapturePreview } from "@desktop-agent/shared";
import { Crop, Loader2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

interface ScreenRegionModalProps {
  preview: NativeCapturePreview;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (crop: NativeBoundingBox) => void;
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

export function ScreenRegionModal({ preview, busy, onCancel, onConfirm }: ScreenRegionModalProps) {
  const { t } = useTranslation("helix");
  const dragStart = useRef<Point | null>(null);
  const [crop, setCrop] = useState<NativeBoundingBox | null>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onCancel();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [busy, onCancel]);

  const pointFromEvent = (event: React.PointerEvent<HTMLDivElement>): Point => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: clamp((event.clientX - bounds.left) / bounds.width),
      y: clamp((event.clientY - bounds.top) / bounds.height),
    };
  };

  const hasSelection = Boolean(crop && crop.width >= 0.01 && crop.height >= 0.01);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="screen-region-title"
        className="w-full max-w-2xl overflow-hidden rounded-2xl border border-signal/25 bg-ink shadow-[0_24px_80px_rgba(0,0,0,0.65)]"
      >
        <header className="flex items-start justify-between gap-4 border-b border-line/60 px-4 py-3">
          <div>
            <h2 id="screen-region-title" className="text-sm font-semibold text-fg">
              {t("helix:composer.screenRegion.title")}
            </h2>
            <p className="mt-0.5 text-[11px] text-mute">{t("helix:composer.screenRegion.description")}</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-lg p-1.5 text-mute transition-colors hover:bg-white/[0.06] hover:text-fg disabled:opacity-40"
            aria-label={t("helix:composer.screenRegion.cancel")}
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="p-3">
          <div
            className="relative cursor-crosshair touch-none select-none overflow-hidden rounded-xl border border-line bg-black"
            onPointerDown={(event) => {
              if (busy) return;
              event.currentTarget.setPointerCapture(event.pointerId);
              const point = pointFromEvent(event);
              dragStart.current = point;
              setCrop(normalizeScreenCrop(point, point));
            }}
            onPointerMove={(event) => {
              if (!dragStart.current || busy) return;
              setCrop(normalizeScreenCrop(dragStart.current, pointFromEvent(event)));
            }}
            onPointerUp={(event) => {
              if (!dragStart.current || busy) return;
              setCrop(normalizeScreenCrop(dragStart.current, pointFromEvent(event)));
              dragStart.current = null;
              event.currentTarget.releasePointerCapture(event.pointerId);
            }}
          >
            <img
              src={preview.previewDataUrl}
              alt={t("helix:composer.screenRegion.previewAlt")}
              className="block h-auto max-h-[58vh] w-full object-contain opacity-80"
              draggable={false}
            />
            {crop && (
              <div
                className="pointer-events-none absolute border border-signal bg-signal/10 shadow-[0_0_0_9999px_rgba(0,0,0,0.48),0_0_24px_rgba(196,153,244,0.35)]"
                style={{
                  left: `${crop.x * 100}%`,
                  top: `${crop.y * 100}%`,
                  width: `${crop.width * 100}%`,
                  height: `${crop.height * 100}%`,
                }}
              >
                <span className="absolute -left-px -top-px h-2 w-2 border-l-2 border-t-2 border-signal" />
                <span className="absolute -right-px -top-px h-2 w-2 border-r-2 border-t-2 border-signal" />
                <span className="absolute -bottom-px -left-px h-2 w-2 border-b-2 border-l-2 border-signal" />
                <span className="absolute -bottom-px -right-px h-2 w-2 border-b-2 border-r-2 border-signal" />
              </div>
            )}
          </div>
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-line/60 px-4 py-3">
          <span className="text-[10px] text-faint">
            {hasSelection
              ? t("helix:composer.screenRegion.selectionReady")
              : t("helix:composer.screenRegion.selectionHint")}
          </span>
          <div className="flex items-center gap-2">
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
              onClick={() => crop && onConfirm(crop)}
              disabled={!hasSelection || busy}
              className="flex items-center gap-1.5 rounded-lg border border-signal/35 bg-signal/15 px-3 py-1.5 text-[11px] font-semibold text-signal transition-colors hover:bg-signal/20 disabled:cursor-not-allowed disabled:opacity-35"
            >
              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Crop className="h-3 w-3" />}
              {t("helix:composer.screenRegion.confirm")}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}
