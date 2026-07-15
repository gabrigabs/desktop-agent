import {
  type ContextAttachment,
  type FileContextInput,
  type NativeBoundingBox,
  type NativeCapturePreview,
  type NativeCaptureTarget,
  normalizeNativeError,
  type VisionAnalysis,
} from "@desktop-agent/shared";
import {
  AlertCircle,
  ArrowUp,
  Eye,
  FileText,
  Loader2,
  Monitor,
  Paperclip,
  Plus,
  RotateCcw,
  Sparkles,
  Square,
  X,
} from "lucide-react";
import { type RefObject, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  CONTEXT_SOURCES,
  ContextMenuPopup,
  type ContextMenuSource,
} from "../../../components/ui/feedback/context-menu-popup";
import { HelixQuickActions, type QuickActionItem } from "../../../components/ui/helix/helix-quick-actions";
import { ModelSelector } from "../../../components/ui/identity/model-selector";
import { CapturePreviewModal } from "../../../components/ui/media/capture-preview";
import { ClipboardModal } from "../../../components/ui/media/clipboard-modal";
import { ScreenRegionModal } from "../../../components/ui/media/screen-region-modal";
import {
  analyzeNativeCapture,
  cropNativeCapture,
  discardNativeCapture,
  getNativeActiveWindow,
  prepareNativeCapture,
  requestNativePermission,
} from "../../../lib/rpc";
import { type StructuredOcr, structureVisionText } from "../../../lib/structured-ocr";
import { hideMainWindowForCapture, setWindowMode } from "../../../lib/window";
import { useAgentStore } from "../../../stores/agent";
import { useModelSelector } from "../hooks/useModelSelector";
import { ApprovalCard, type ApprovalViewModel } from "../response/ApprovalCard";
import { SpaceSwitcher } from "../space/SpaceSwitcher";

const CLIPBOARD_MARKER = "[CLIPBOARD]";
type ScreenAction = "screen-read" | "screen-capture" | "screen-region" | "screen-window";
type ScreenEditorAction = Exclude<ScreenAction, "screen-read">;
type ScreenEditorIntent = "capture" | "extract_text";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function formatNativeError(error: unknown, fallback: string): string {
  const normalized = normalizeNativeError(error);
  return normalized.message && normalized.message !== "[object Object]" ? normalized.message : fallback;
}

function screenAnalysisContent(analysis: VisionAnalysis, structuredOcr: StructuredOcr | null): string {
  const parts: string[] = [];
  const text = structuredOcr?.markdown ?? analysis.text?.content.trim();
  if (text) parts.push(text);

  const classifications = analysis.classifications?.slice(0, 5) ?? [];
  if (classifications.length > 0) {
    parts.push(
      `Elementos visuais: ${classifications
        .map((item) => `${item.identifier} (${Math.round(item.confidence * 100)}%)`)
        .join(", ")}`,
    );
  }

  const barcodes = analysis.barcodes?.filter((item) => item.payload) ?? [];
  if (barcodes.length > 0) {
    parts.push(`Códigos detectados: ${barcodes.map((item) => item.payload).join(", ")}`);
  }

  return parts.join("\n\n");
}

interface ComposerProps {
  mode: "normal" | "expanded";
  query: string;
  setQuery: (q: string) => void;
  placeholder?: string;
  disabled: boolean;
  streaming: boolean;
  clipboardText: string;
  hasClipboard: boolean;
  ignoreClipboard: boolean;
  setIgnoreClipboard: (v: boolean) => void;
  onPasteClipboard: (text: string) => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  quickActions?: QuickActionItem[];
  onQuickAction?: (action: QuickActionItem) => void;
  onExecute: () => void;
  onAbort?: () => void;
  showQuickActions?: boolean;
  onContextMenuOpenChange?: (open: boolean) => void;
  fileContext?: FileContextInput[];
  onAttachFiles?: (paths: string[]) => void;
  onRemoveFile?: (path: string) => void;
  isDraggingFile?: boolean;
  approval?: ApprovalViewModel;
  onApproval?: (approved: boolean) => void;
}

export function Composer({
  mode,
  query,
  setQuery,
  placeholder,
  disabled,
  streaming,
  clipboardText,
  hasClipboard,
  ignoreClipboard,
  setIgnoreClipboard,
  onPasteClipboard,
  textareaRef,
  quickActions,
  onQuickAction,
  onExecute,
  onAbort,
  showQuickActions = true,
  onContextMenuOpenChange,
  fileContext,
  onAttachFiles,
  onRemoveFile,
  isDraggingFile,
  approval,
  onApproval,
}: ComposerProps) {
  const { t } = useTranslation("helix");
  const [contextMenuOpen, setContextMenuOpen] = useState(false);
  const [clipboardModalOpen, setClipboardModalOpen] = useState(false);
  const [contextError, setContextError] = useState<string | null>(null);
  const [screenBusy, setScreenBusy] = useState(false);
  const [previewModalContext, setPreviewModalContext] = useState<ContextAttachment | null>(null);
  const contexts = useAgentStore((state) => state.contexts);
  const connectors = useAgentStore((state) => state.connectors);
  const addContext = useAgentStore((state) => state.addContext);
  const toggleContext = useAgentStore((state) => state.toggleContext);
  const removeContext = useAgentStore((state) => state.removeContext);
  const pendingScreenAction = useAgentStore((state) => state.pendingScreenAction);
  const setPendingScreenAction = useAgentStore((state) => state.setPendingScreenAction);
  const setScreenCapture = useAgentStore((state) => state.setScreenCapture);
  const clearScreenCapture = useAgentStore((state) => state.clearScreenCapture);
  const screenCapture = useAgentStore((state) => state.screenCapture);
  const activeActionId = useAgentStore((state) => state.activeComposerActionId);
  const setActiveActionId = useAgentStore((state) => state.setActiveComposerActionId);

  useEffect(() => {
    onContextMenuOpenChange?.(contextMenuOpen);
  }, [contextMenuOpen, onContextMenuOpenChange]);

  const startScreenActionRef = useRef<(action: ScreenAction) => Promise<void>>(async () => {});

  useEffect(() => {
    if (!pendingScreenAction) return;
    setPendingScreenAction(null);
    void startScreenActionRef.current(pendingScreenAction);
  }, [pendingScreenAction, setPendingScreenAction]);

  const contextButtonRef = useRef<HTMLButtonElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const [hoveringSend, setHoveringSend] = useState(false);
  const modelSelector = useModelSelector();

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "100%";
  }, [textareaRef]);

  const canSend = !streaming && query.trim().length > 0;
  const clipboardEnabled = hasClipboard && !ignoreClipboard;

  const activeAction = useMemo(
    () => quickActions?.find((a) => a.id === activeActionId) ?? quickActions?.[0],
    [quickActions, activeActionId],
  );

  const activePlaceholder = useMemo(() => {
    if (streaming) return t("helix:composer.waiting");
    if (placeholder) return placeholder;
    if (clipboardEnabled && activeAction?.placeholder) {
      const clipboardDefault = t("helix:composer.placeholderClipboard");
      return activeAction.requiredContext?.includes("clipboard")
        ? activeAction.placeholder
        : clipboardDefault;
    }
    return activeAction?.placeholder ?? t("helix:composer.placeholderDefault");
  }, [streaming, placeholder, clipboardEnabled, activeAction, t]);

  const insertClipboardMarker = useCallback(() => {
    const el = textareaRef.current;
    const start = el?.selectionStart ?? query.length;
    const end = el?.selectionEnd ?? query.length;
    const before = query.slice(0, start);
    const after = query.slice(end);
    const prefix = before.length && !before.endsWith(" ") && !before.endsWith("\n") ? " " : "";
    const suffix = after.length && !after.startsWith(" ") && !after.startsWith("\n") ? " " : "";
    const next = before + prefix + CLIPBOARD_MARKER + suffix + after;
    setQuery(next);
    setIgnoreClipboard(false);
    requestAnimationFrame(() => {
      if (!el) return;
      const pos = start + prefix.length + CLIPBOARD_MARKER.length + suffix.length;
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  }, [query, setQuery, setIgnoreClipboard, textareaRef]);

  const removeClipboardMarker = useCallback(() => {
    const marker = new RegExp(`\\s?\\${CLIPBOARD_MARKER}\\s?`, "g");
    setQuery(query.replace(marker, ""));
    setIgnoreClipboard(true);
  }, [query, setQuery, setIgnoreClipboard]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setQuery(e.target.value);
      if (!ignoreClipboard && !e.target.value.includes(CLIPBOARD_MARKER)) {
        setIgnoreClipboard(true);
      }
      if (e.target.value.trim().length === 0) {
        setActiveActionId("pergunta-livre");
      }
    },
    [setQuery, ignoreClipboard, setIgnoreClipboard, setActiveActionId],
  );

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const pastedText = e.clipboardData.getData("text/plain");
    if (!pastedText.trim()) return;

    e.preventDefault();
    onPasteClipboard(pastedText);
    const el = textareaRef.current;
    const start = e.currentTarget.selectionStart;
    const end = e.currentTarget.selectionEnd;
    const before = query.slice(0, start).trimEnd();
    const after = query.slice(end).trimStart();
    const next = [before, CLIPBOARD_MARKER, after].filter(Boolean).join(" ");
    setQuery(next);
    setIgnoreClipboard(false);
    requestAnimationFrame(() => {
      if (!el) return;
      const markerEnd = next.indexOf(CLIPBOARD_MARKER) + CLIPBOARD_MARKER.length;
      el.focus();
      el.setSelectionRange(markerEnd, markerEnd);
    });
  };

  const handleQuickAction = useCallback(
    (action: QuickActionItem) => {
      const el = textareaRef.current;
      const usesClipboard = action.requiredContext?.includes("clipboard");
      const prefix = action.prompt ? `${action.prompt} ` : "";
      const next = usesClipboard ? `${prefix}${CLIPBOARD_MARKER}`.trim() : action.prompt;
      setActiveActionId(action.id);
      setQuery(next);
      setIgnoreClipboard(!usesClipboard);
      requestAnimationFrame(() => {
        if (!el) return;
        el.focus();
        el.setSelectionRange(next.length, next.length);
      });
      onQuickAction?.(action);
    },
    [textareaRef, setActiveActionId, setQuery, setIgnoreClipboard, onQuickAction],
  );

  const ensureScreenPermission = async () => {
    const permission = await requestNativePermission("screen_recording");
    if (permission !== "granted") {
      throw new Error(t("helix:composer.screenCapture.permissionDenied"));
    }
  };

  const analyzeScreenCapture = async (
    preview: NativeCapturePreview,
    action: ScreenAction,
    crop?: NativeBoundingBox,
    croppedPreview?: { previewDataUrl: string; width: number; height: number },
    intent: ScreenEditorIntent = "capture",
  ) => {
    const isRead = action === "screen-read" || intent === "extract_text";
    const analysis = await analyzeNativeCapture({
      captureId: preview.captureId,
      features: isRead ? ["text"] : ["text", "classification", "barcode", "saliency"],
      crop,
      displayName:
        action === "screen-window"
          ? "active-window"
          : crop
            ? "selected-region"
            : `display-${preview.displayId}`,
    });
    const structuredOcr = structureVisionText(analysis.text);
    const content = screenAnalysisContent(analysis, structuredOcr);
    const labelKey =
      intent === "extract_text" && crop
        ? "screenRegionTextLabel"
        : action === "screen-read"
          ? "screenReadLabel"
          : action === "screen-window"
            ? "screenWindowLabel"
            : action === "screen-region"
              ? "screenRegionLabel"
              : "screenCaptureLabel";

    const imageDataUrl = croppedPreview?.previewDataUrl ?? preview.previewDataUrl;
    const imageWidth = croppedPreview?.width ?? preview.width;
    const imageHeight = croppedPreview?.height ?? preview.height;

    const draft: ContextAttachment = {
      id: action,
      source: "screen",
      label: t(`helix:composer.screenCapture.${labelKey}`),
      preview:
        content.slice(0, 180) ||
        t("helix:composer.screenCapture.noVisibleContent", {
          width: imageWidth,
          height: imageHeight,
        }),
      content,
      imageDataUrl,
      metadata: {
        mode: action,
        displayId: preview.displayId,
        width: imageWidth,
        height: imageHeight,
        crop,
        analysisIntent: intent,
        structuredOcr,
        processedOnDevice: analysis.processedOnDevice,
      },
      policy: "include",
      sensitive: true,
      enabled: true,
    };
    setScreenCapture({
      preview: { ...preview, previewDataUrl: imageDataUrl, width: imageWidth, height: imageHeight },
      busy: false,
      error: null,
      editorAction: null,
      failedAction: null,
      draft,
      crop: null,
    });
  };

  const startScreenAction = async (action: ScreenAction, target?: NativeCaptureTarget) => {
    setContextError(null);
    setScreenBusy(true);
    setScreenCapture({
      busy: true,
      error: null,
      editorAction: null,
      failedAction: null,
      draft: null,
      crop: null,
    });
    let restoreWindow: (() => Promise<void>) | null = null;
    try {
      await ensureScreenPermission();
      if (action === "screen-window") {
        const accessibility = await requestNativePermission("accessibility");
        if (accessibility !== "granted") {
          throw new Error(t("helix:composer.screenCapture.accessibilityDenied"));
        }
      }
      restoreWindow = await hideMainWindowForCapture();
      const captureTarget: NativeCaptureTarget =
        target ?? (action === "screen-window" ? "active_window" : "display");
      const preview = await prepareNativeCapture({ excludeHelix: true, captureTarget });
      if (action !== "screen-read") {
        const editorAction = action as ScreenEditorAction;
        setScreenCapture({
          preview,
          busy: false,
          error: null,
          editorAction,
          failedAction: null,
          crop: editorAction === "screen-region" ? null : { x: 0, y: 0, width: 1, height: 1 },
        });
        return;
      }
      try {
        await analyzeScreenCapture(preview, action, undefined, undefined, "extract_text");
      } finally {
        await discardNativeCapture(preview.captureId).catch(() => undefined);
      }
    } catch (error) {
      const message = formatNativeError(error, t("helix:composer.screenCapture.failed"));
      setContextError(message);
      setScreenCapture({
        preview: null,
        busy: false,
        error: message,
        editorAction: null,
        failedAction: action,
        draft: null,
        crop: null,
      });
    } finally {
      setScreenBusy(false);
      if (restoreWindow) await restoreWindow();
    }
  };
  startScreenActionRef.current = startScreenAction;

  const queueScreenAction = async (action: ScreenAction) => {
    if (mode === "expanded") {
      await startScreenAction(action);
      return;
    }
    const { settings } = useAgentStore.getState();
    await setWindowMode("expanded", { alwaysOnTop: settings.alwaysOnTop });
    useAgentStore.setState({ uiMode: "expanded", pendingScreenAction: action });
  };

  const cancelRegionCapture = useCallback(() => {
    const capture = screenCapture.preview;
    setScreenBusy(false);
    clearScreenCapture();
    if (capture) void discardNativeCapture(capture.captureId).catch(() => undefined);
  }, [screenCapture.preview, clearScreenCapture]);

  const confirmRegionCapture = async (crop: NativeBoundingBox, intent: ScreenEditorIntent) => {
    const preview = screenCapture.preview;
    const action = screenCapture.editorAction;
    if (!preview || !action) return;
    setScreenBusy(true);
    setScreenCapture({ busy: true, error: null });
    setContextError(null);
    try {
      const croppedPreview = await cropNativeCapture({ captureId: preview.captureId, crop });
      await analyzeScreenCapture(preview, action, crop, croppedPreview, intent);
    } catch (error) {
      const message = formatNativeError(error, t("helix:composer.screenCapture.failed"));
      setContextError(message);
      setScreenCapture({
        preview: null,
        busy: false,
        error: message,
        editorAction: null,
        failedAction: action,
        draft: null,
        crop: null,
      });
    } finally {
      await discardNativeCapture(preview.captureId).catch(() => undefined);
      setScreenBusy(false);
    }
  };

  const handleContextToggle = async (src: ContextMenuSource) => {
    if (src.id === "clipboard") {
      if (clipboardEnabled) {
        removeClipboardMarker();
      } else {
        insertClipboardMarker();
      }
    } else if (src.id === "file") {
      await handleAttachFile();
    } else if (src.id === "folder") {
      await handleAttachFolder();
    } else if (
      src.id === "screen-read" ||
      src.id === "screen-capture" ||
      src.id === "screen-region" ||
      src.id === "screen-window"
    ) {
      await queueScreenAction(src.id);
    } else if (src.id === "active-app") {
      try {
        setContextError(null);
        const permission = await requestNativePermission("accessibility");
        if (permission !== "granted") {
          removeContext("active-app");
          throw new Error(`PERMISSION_${permission.toUpperCase()}`);
        }
        const snapshot = await getNativeActiveWindow();
        const hasVisibleText = Boolean(snapshot.content.trim());
        addContext({
          id: "active-app",
          source: "active_app",
          label: snapshot.appName || t("helix:composer.activeAppLabel"),
          preview: hasVisibleText ? snapshot.content.slice(0, 180) : t("helix:composer.activeAppNoText"),
          content: hasVisibleText ? snapshot.content : undefined,
          metadata: {
            bundleId: snapshot.bundleId,
            pid: snapshot.pid,
            windowTitle: snapshot.windowTitle,
            truncated: snapshot.truncated,
            redactions: snapshot.redactedCount,
            fallbackAvailable: !hasVisibleText,
          },
          policy: "include",
          sensitive: true,
          enabled: true,
        });
      } catch (error) {
        setContextError(formatNativeError(error, t("helix:composer.activeAppFailed")));
      }
    } else if (src.id === "connector") {
      const connector = connectors.find((item) => item.enabled);
      if (!connector) {
        setContextError(t("helix:composer.noConnectorEnabled"));
      } else {
        addContext({
          id: "connector",
          source: "connector",
          label: connector.name,
          preview: t("helix:composer.connectorSelected"),
          metadata: { mcpAllowlist: [connector.id], serverId: connector.id },
          policy: "reference",
          sensitive: true,
          enabled: true,
        });
      }
    }
    setContextMenuOpen(false);
  };

  const slashEntries = (() => {
    if (!query.trimStart().startsWith("/")) return [];
    const search = query.trimStart().slice(1).toLocaleLowerCase();
    const actions = (quickActions ?? []).map((action) => ({
      id: `action:${action.id}`,
      label: action.label,
      description: action.prompt,
      icon: action.icon,
      run: () => handleQuickAction(action),
    }));
    const sources = CONTEXT_SOURCES.map((source) => ({
      id: `source:${source.id}`,
      label: t(`helix:${source.labelKey}`),
      description: t(`helix:${source.descriptionKey}`),
      icon: source.icon,
      run: () => {
        setQuery("");
        void handleContextToggle(source);
      },
    }));
    return [...actions, ...sources]
      .filter(
        (entry) => !search || `${entry.label} ${entry.description}`.toLocaleLowerCase().includes(search),
      )
      .slice(0, 8);
  })();

  const activeSources = useMemo(() => {
    const set = new Set<string>();
    if (clipboardEnabled) set.add("clipboard");
    for (const context of contexts) {
      set.add(context.id);
    }
    return set;
  }, [clipboardEnabled, contexts]);

  const activeSourceItems = useMemo(
    () => CONTEXT_SOURCES.filter((s) => activeSources.has(s.id)),
    [activeSources],
  );

  const handleSendClick = () => {
    if (streaming && onAbort) {
      onAbort();
      return;
    }
    if (canSend) onExecute();
  };

  const handleAttachFile = useCallback(async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({ multiple: true });
      if (selected) {
        const paths = Array.isArray(selected) ? selected : [selected];
        onAttachFiles?.(paths);
      }
    } catch {
      // Dialog not available outside Tauri
    }
  }, [onAttachFiles]);

  const handleAttachFolder = useCallback(async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({ directory: true, multiple: false });
      if (selected) onAttachFiles?.([selected]);
    } catch {
      // Dialog not available outside Tauri
    }
  }, [onAttachFiles]);

  const shellClasses = mode === "expanded" ? "mx-auto w-full min-h-[180px]" : "w-full min-h-[132px]";

  const widthClass = mode === "expanded" ? "max-w-[var(--composer-expanded-width)]" : "";

  const inputPadding = mode === "expanded" ? "px-5 pt-5 pb-3" : "px-4 pt-4 pb-2";
  const inputText = "text-[14px] leading-relaxed";
  const inputHeight = mode === "expanded" ? "h-[120px]" : "h-[80px]";
  const toolbarPadding = mode === "expanded" ? "px-3 py-2" : "px-2.5 py-1.5";
  const contextSize = mode === "expanded" ? "w-8 h-8" : "w-7 h-7";
  const sendSize = mode === "expanded" ? "w-9 h-9" : "w-8 h-8";
  const contextIconSize = mode === "expanded" ? "w-4 h-4" : "w-3.5 h-3.5";
  const sendIconSize = mode === "expanded" ? "w-4 h-4" : "w-4 h-4";
  const inspectorContext = screenCapture.draft ?? previewModalContext;
  const isReviewingDraft = Boolean(screenCapture.draft);

  return (
    <div className={`w-full flex flex-col gap-2.5 ${widthClass}`}>
      {screenCapture.editorAction && screenCapture.preview && (
        <ScreenRegionModal
          preview={screenCapture.preview}
          busy={screenBusy || screenCapture.busy}
          onCancel={cancelRegionCapture}
          onConfirm={(crop, intent) => void confirmRegionCapture(crop, intent)}
          initialCrop={screenCapture.crop}
          onCropChange={(crop) => setScreenCapture({ crop })}
          onCaptureFull={() => setScreenCapture({ crop: { x: 0, y: 0, width: 1, height: 1 } })}
        />
      )}
      {inspectorContext && (
        <CapturePreviewModal
          context={inspectorContext}
          preview={screenCapture.preview}
          pendingConfirmation={isReviewingDraft}
          onConfirm={
            isReviewingDraft
              ? () => {
                  const draft = useAgentStore.getState().screenCapture.draft;
                  if (!draft) return;
                  addContext(draft);
                  clearScreenCapture();
                }
              : undefined
          }
          onClose={() => {
            if (isReviewingDraft) clearScreenCapture();
            else setPreviewModalContext(null);
          }}
          onCrop={() => {
            const ctx = inspectorContext;
            if (isReviewingDraft) clearScreenCapture();
            setPreviewModalContext(null);
            if (ctx) void queueScreenAction("screen-region");
          }}
          onRecapture={() => {
            const ctx = inspectorContext;
            if (isReviewingDraft) clearScreenCapture();
            setPreviewModalContext(null);
            if (ctx) void queueScreenAction((ctx.metadata?.mode as ScreenAction) ?? "screen-read");
          }}
          onRemove={() => {
            const ctx = inspectorContext;
            setPreviewModalContext(null);
            if (ctx) {
              if (!isReviewingDraft) removeContext(ctx.id);
              clearScreenCapture();
            }
          }}
        />
      )}
      {isDraggingFile && (
        <div className="absolute inset-0 z-50 rounded-xl border-2 border-dashed border-signal/50 bg-signal/10 backdrop-blur-sm flex items-center justify-center pointer-events-none">
          <div className="flex items-center gap-2 text-signal">
            <Paperclip className="w-5 h-5" />
            <span className="text-sm font-medium">{t("helix:composer.dropFiles")}</span>
          </div>
        </div>
      )}
      {mode === "expanded" && <SpaceSwitcher />}
      {approval && onApproval && (
        <ApprovalCard approval={approval} onDecision={onApproval} compact busy={streaming} />
      )}
      {contextError && (
        <div
          role="alert"
          className="flex items-start justify-between gap-3 rounded-xl border border-bad/20 bg-bad/[0.055] px-3 py-2.5"
        >
          <div className="flex min-w-0 items-start gap-2">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-bad" />
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-fg">
                {t("helix:composer.screenCapture.errorTitle")}
              </p>
              <p className="mt-0.5 text-[10px] leading-relaxed text-mute">{contextError}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {screenCapture.failedAction && (
              <button
                type="button"
                onClick={() => void queueScreenAction(screenCapture.failedAction as ScreenAction)}
                className="flex items-center gap-1 rounded-lg border border-line-strong px-2 py-1 text-[9px] font-medium text-mute transition-colors hover:border-signal/30 hover:text-fg"
              >
                <RotateCcw className="h-2.5 w-2.5" />
                {t("helix:composer.screenCapture.retry")}
              </button>
            )}
            {screenCapture.failedAction === "screen-window" && (
              <button
                type="button"
                onClick={() => void queueScreenAction("screen-capture")}
                className="flex items-center gap-1 rounded-lg border border-signal/25 bg-signal/[0.06] px-2 py-1 text-[9px] font-medium text-signal transition-colors hover:bg-signal/10"
              >
                <Monitor className="h-2.5 w-2.5" />
                {t("helix:composer.screenCapture.useDisplay")}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setContextError(null);
                setScreenCapture({ error: null, failedAction: null });
              }}
              className="rounded-md p-1 text-faint transition-colors hover:bg-white/[0.05] hover:text-fg"
              aria-label={t("helix:composer.screenCapture.dismissError")}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}
      {activeSourceItems.length > 0 && (
        <div className="flex items-center gap-1.5 px-0.5 flex-wrap">
          {activeSourceItems.map((src) => {
            const Icon = src.icon;
            const isClipboard = src.id === "clipboard";
            const context = contexts.find((item) => item.id === src.id);
            const isScreen = context?.source === "screen" && context?.imageDataUrl;
            return (
              <div
                key={src.id}
                className={`group flex items-center gap-1.5 rounded-lg border border-signal/25 bg-signal/10 pl-2 pr-1 ${mode === "expanded" ? "h-7" : "h-6"} shrink-0 transition-all hover:border-signal/40 hover:bg-signal/15 animate-chip-enter`}
              >
                {isScreen && context?.imageDataUrl ? (
                  <img
                    src={context.imageDataUrl}
                    alt={context.label}
                    className="h-4 w-4 shrink-0 rounded object-cover ring-1 ring-signal/30"
                    draggable={false}
                  />
                ) : (
                  <Icon className="h-3 w-3 text-signal shrink-0" />
                )}
                {isClipboard ? (
                  <button
                    type="button"
                    onClick={() => setClipboardModalOpen(true)}
                    className="flex items-center gap-1 text-signal transition-opacity"
                    title={t("helix:contextBar.viewClipboard")}
                    aria-label={t("helix:contextBar.viewClipboard")}
                  >
                    <span
                      className={`text-[10px] font-medium truncate ${mode === "expanded" ? "max-w-[140px]" : "max-w-[80px]"}`}
                    >
                      {clipboardText.length} {t("helix:contextBar.characters")}
                    </span>
                    <Eye className="h-2.5 w-2.5 text-signal/60 transition-colors group-hover:text-signal" />
                  </button>
                ) : isScreen && context ? (
                  <button
                    type="button"
                    onClick={() => setPreviewModalContext(context)}
                    className={`text-[10px] font-medium truncate ${
                      context.enabled ? "text-signal" : "text-mute"
                    } ${mode === "expanded" ? "max-w-[120px]" : "max-w-[60px]"}`}
                    title={context.preview}
                  >
                    {context.label}
                  </button>
                ) : context ? (
                  <button
                    type="button"
                    onClick={() => toggleContext(context.id)}
                    className={`text-[10px] font-medium truncate ${
                      context.enabled ? "text-signal" : "text-mute"
                    } ${mode === "expanded" ? "max-w-[120px]" : "max-w-[60px]"}`}
                    title={context.preview}
                  >
                    {context.label}
                  </button>
                ) : (
                  <span
                    className={`text-[10px] font-medium text-signal truncate ${mode === "expanded" ? "max-w-[120px]" : "max-w-[60px]"}`}
                  >
                    {t(`helix:${src.labelKey}`)}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (!isClipboard && context) {
                      removeContext(context.id);
                      if (isScreen) clearScreenCapture();
                    } else void handleContextToggle(src);
                  }}
                  className="rounded p-0.5 text-signal/40 transition-all hover:text-bad hover:bg-bad/10 shrink-0"
                  aria-label={t("helix:contextBar.remove")}
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
      {fileContext && fileContext.length > 0 && (
        <div className="flex items-center gap-1.5 px-0.5 flex-wrap">
          {fileContext.map((file) => (
            <div
              key={file.path}
              className={`group flex items-center gap-1.5 rounded-lg border border-line-strong bg-white/[0.06] pl-2 pr-1 ${mode === "expanded" ? "h-7" : "h-6"} shrink-0 transition-all hover:border-signal/30`}
            >
              <FileText className="h-3 w-3 text-fg shrink-0" />
              <span
                className={`text-[10px] font-medium text-fg truncate ${mode === "expanded" ? "max-w-[160px]" : "max-w-[100px]"}`}
                title={file.path}
              >
                {file.displayName}
              </span>
              <span className="text-[9px] text-mute shrink-0">
                {file.encoding === "binary"
                  ? "BIN"
                  : file.encoding === "unsupported"
                    ? "LARGE"
                    : file.encoding === "parsed"
                      ? file.parsedFormat?.toUpperCase()
                      : formatFileSize(file.size)}
              </span>
              {file.parsedMetadata && (
                <span className="text-[9px] text-signal/70 shrink-0">
                  {file.parsedMetadata.pages != null && `${file.parsedMetadata.pages}p`}
                  {file.parsedMetadata.sheets &&
                    file.parsedMetadata.sheets.length > 0 &&
                    `${file.parsedMetadata.sheets.length}s`}
                  {file.parsedMetadata.rows != null && `${file.parsedMetadata.rows}r`}
                  {file.parsedMetadata.columns != null && `${file.parsedMetadata.columns}c`}
                  {file.parsedMetadata.headings && `${file.parsedMetadata.headings.length}h`}
                  {file.parsedMetadata.truncated && " ⋯"}
                </span>
              )}
              {onRemoveFile && (
                <button
                  type="button"
                  onClick={() => onRemoveFile(file.path)}
                  className="rounded p-0.5 text-mute transition-all hover:text-bad hover:bg-bad/10 shrink-0"
                  aria-label={t("helix:contextBar.remove")}
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {slashEntries.length > 0 && (
        <div
          className="overflow-hidden rounded-xl border border-line bg-ink/95 p-1 shadow-xl ring-1 ring-white/[0.03]"
          role="listbox"
          aria-label={t("helix:composer.contextMenu.title")}
        >
          <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-line/30 mb-1">
            <Sparkles className="h-3 w-3 text-signal shrink-0" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-mute">
              {t("helix:composer.slashMenu.title")}
            </span>
          </div>
          {slashEntries.map((entry) => {
            const Icon = entry.icon;
            return (
              <button
                key={entry.id}
                type="button"
                onClick={entry.run}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-white/[0.055] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/45"
              >
                <Icon className="h-4 w-4 shrink-0 text-signal" />
                <span className="min-w-0">
                  <span className="block truncate text-xs font-medium text-fg">{entry.label}</span>
                  <span className="block truncate text-[10px] text-faint">{entry.description}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
      <div className="relative">
        <div
          ref={composerRef}
          className={`composer-field group flex flex-col rounded-2xl border border-line-strong bg-ink/60 shadow-lg transition-colors duration-200 focus-within:border-signal/55 focus-within:bg-ink/70 focus-within:ring-1 focus-within:ring-signal/25 ${
            clipboardEnabled ? "border-signal/25 bg-signal/[0.02]" : ""
          } ${shellClasses}`}
        >
          <div className={`flex flex-col ${inputPadding} ${inputHeight}`}>
            <textarea
              ref={textareaRef}
              value={query}
              onChange={handleChange}
              onPaste={handlePaste}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (canSend) onExecute();
                }
              }}
              placeholder={activePlaceholder}
              className={`min-w-0 flex-1 bg-transparent border-0 ${inputText} text-fg placeholder:text-mute resize-none focus-visible:outline-none select-text py-0.5 text-left [
                &::-webkit-scrollbar]:w-1
                [&::-webkit-scrollbar-track]:bg-transparent
                [&::-webkit-scrollbar-thumb]:rounded-full
                [&::-webkit-scrollbar-thumb]:bg-line/30
                [&::-webkit-scrollbar-thumb:hover]:bg-line/50
              `}
              style={{
                overflowY: "auto",
              }}
              disabled={disabled}
              rows={1}
              aria-label={t("helix:composer.message")}
            />
          </div>

          <div
            className={`flex items-center justify-between gap-2 border-t ${contextMenuOpen ? "border-signal/20 bg-signal/[0.04]" : mode === "expanded" ? "border-line/40" : "border-line/20"} transition-colors duration-200 ${toolbarPadding}`}
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <button
                ref={contextButtonRef}
                type="button"
                onClick={() => setContextMenuOpen((v) => !v)}
                className={`shrink-0 ${contextSize} rounded-xl flex items-center justify-center border transition-all duration-200 cursor-pointer ${
                  contextMenuOpen
                    ? "border-signal/40 bg-signal/10 text-signal rotate-0"
                    : "border-line-strong bg-ink/40 text-fg hover:text-signal hover:border-signal/30 hover:bg-signal/5"
                }`}
                title={t("helix:composer.contextMenu.title")}
                aria-label={t("helix:composer.contextMenu.title")}
                aria-expanded={contextMenuOpen}
              >
                <Plus
                  className={`${contextIconSize} transition-transform duration-300 ease-out ${contextMenuOpen ? "rotate-45 scale-110" : "rotate-0 scale-100"}`}
                />
              </button>
              {!contextMenuOpen && (
                <span className="text-[10px] text-mute truncate hidden sm:inline animate-fade-in">
                  {t("helix:composer.contextMenu.title")}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {mode === "expanded" && (
                <ModelSelector
                  provider={modelSelector.provider}
                  providerOptions={modelSelector.providerOptions}
                  onProviderChange={(value) => modelSelector.setProvider(value)}
                  model={modelSelector.model}
                  modelOptions={modelSelector.modelOptions}
                  onModelChange={(value) => modelSelector.setModel(value)}
                  displayLabel={modelSelector.displayLabel}
                  needsApiKey={modelSelector.needsApiKey}
                  disabled={disabled}
                />
              )}

              <button
                type="button"
                onClick={handleSendClick}
                disabled={!canSend && !streaming}
                onMouseEnter={() => setHoveringSend(true)}
                onMouseLeave={() => setHoveringSend(false)}
                className={`shrink-0 ${sendSize} rounded-xl flex items-center justify-center transition-all duration-200 cursor-pointer disabled:cursor-default ${
                  streaming
                    ? "bg-signal/20 text-signal hover:bg-bad/20 hover:text-bad"
                    : canSend
                      ? "bg-signal text-ink hover:bg-signal/90 hover:shadow-[0_0_20px_-4px_var(--color-signal,theme(colors.signal.DEFAULT))] active:scale-95"
                      : "bg-ink/40 text-mute border border-line-strong hover:text-fg active:scale-95"
                }`}
                title={
                  streaming
                    ? hoveringSend && onAbort
                      ? t("helix:composer.stop")
                      : t("helix:composer.loading")
                    : t("helix:composer.send")
                }
                aria-label={
                  streaming
                    ? hoveringSend && onAbort
                      ? t("helix:composer.stop")
                      : t("helix:composer.loading")
                    : t("helix:composer.send")
                }
              >
                {streaming ? (
                  hoveringSend && onAbort ? (
                    <Square className={`${sendIconSize} fill-current`} />
                  ) : (
                    <Loader2 className={`${sendIconSize} animate-spin`} />
                  )
                ) : (
                  <ArrowUp className={`${sendIconSize} stroke-[2.5]`} />
                )}
              </button>
            </div>
          </div>
          <ContextMenuPopup
            open={contextMenuOpen}
            onClose={() => setContextMenuOpen(false)}
            activeSources={activeSources}
            onToggle={handleContextToggle}
            anchorRef={contextButtonRef}
            composerRef={composerRef}
          />
        </div>
      </div>

      <ClipboardModal
        text={clipboardText}
        open={clipboardModalOpen}
        onClose={() => setClipboardModalOpen(false)}
        onRemove={removeClipboardMarker}
      />

      {showQuickActions && quickActions && quickActions.length > 0 && (
        <HelixQuickActions
          actions={quickActions}
          mode={mode}
          disabled={disabled}
          onAction={handleQuickAction}
        />
      )}
    </div>
  );
}
