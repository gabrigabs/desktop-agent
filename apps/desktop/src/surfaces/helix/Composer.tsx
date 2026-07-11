import { ArrowUp, Eye, Loader2, Plus, Square, X } from "lucide-react";
import { type RefObject, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ClipboardModal } from "../../components/ui/clipboard-modal";
import {
  CONTEXT_SOURCES,
  ContextMenuPopup,
  type ContextMenuSource,
} from "../../components/ui/context-menu-popup";
import { HelixQuickActions, type QuickActionItem } from "../../components/ui/helix-quick-actions";
import { ModelSelector } from "../../components/ui/model-selector";
import { useModelSelector } from "./hooks/useModelSelector";

const CLIPBOARD_MARKER = "[CLIPBOARD]";

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
}: ComposerProps) {
  const { t } = useTranslation("helix");
  const [contextMenuOpen, setContextMenuOpen] = useState(false);
  const [clipboardModalOpen, setClipboardModalOpen] = useState(false);

  useEffect(() => {
    onContextMenuOpenChange?.(contextMenuOpen);
  }, [contextMenuOpen, onContextMenuOpenChange]);
  const contextButtonRef = useRef<HTMLButtonElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const [hoveringSend, setHoveringSend] = useState(false);
  const [activeActionId, setActiveActionId] = useState<string>("pergunta-livre");
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

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setQuery(e.target.value);
    if (!ignoreClipboard && !e.target.value.includes(CLIPBOARD_MARKER)) {
      setIgnoreClipboard(true);
    }
    if (e.target.value.trim().length === 0) {
      setActiveActionId("pergunta-livre");
    }
  };

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

  const handleQuickAction = (action: QuickActionItem) => {
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
  };

  const handleContextToggle = (src: ContextMenuSource) => {
    if (src.id === "clipboard") {
      if (clipboardEnabled) {
        removeClipboardMarker();
      } else {
        insertClipboardMarker();
      }
    }
    setContextMenuOpen(false);
  };

  const activeSources = new Set<string>();
  if (clipboardEnabled) activeSources.add("clipboard");

  const activeSourceItems = useMemo(
    () => CONTEXT_SOURCES.filter((s) => activeSources.has(s.id) && !s.mock),
    [activeSources],
  );

  const handleSendClick = () => {
    if (streaming && onAbort) {
      onAbort();
      return;
    }
    if (canSend) onExecute();
  };

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

  return (
    <div className={`w-full flex flex-col gap-2.5 ${widthClass}`}>
      {activeSourceItems.length > 0 && (
        <div className="flex items-center gap-1.5 px-0.5 flex-wrap">
          {activeSourceItems.map((src) => {
            const Icon = src.icon;
            const isClipboard = src.id === "clipboard";
            return (
              <div
                key={src.id}
                className={`group flex items-center gap-1.5 rounded-lg border border-signal/25 bg-signal/10 pl-2 pr-1 ${mode === "expanded" ? "h-7" : "h-6"} shrink-0 transition-all hover:border-signal/40 hover:bg-signal/15`}
              >
                <Icon className="h-3 w-3 text-signal shrink-0" />
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
                ) : (
                  <span
                    className={`text-[10px] font-medium text-signal truncate ${mode === "expanded" ? "max-w-[120px]" : "max-w-[60px]"}`}
                  >
                    {t(`helix:${src.labelKey}`)}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => handleContextToggle(src)}
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
      <div className="relative">
        <div
          ref={composerRef}
          className={`composer-field flex flex-col rounded-xl border border-line bg-white/[0.04] transition-colors ${
            clipboardEnabled ? "border-signal/30 bg-signal/[0.03]" : ""
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
            className={`flex items-center justify-between gap-2 border-t ${contextMenuOpen ? "border-line/50 bg-black/[0.15]" : mode === "expanded" ? "border-line/40" : "border-line/20"} ${toolbarPadding}`}
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <button
                ref={contextButtonRef}
                type="button"
                onClick={() => setContextMenuOpen((v) => !v)}
                className={`shrink-0 ${contextSize} rounded-lg flex items-center justify-center border transition-all duration-200 cursor-pointer ${
                  contextMenuOpen
                    ? "border-signal/40 bg-signal/10 text-signal shadow-[0_0_12px_-2px_rgba(196,153,244,0.3)]"
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
                <span className="text-[10px] text-mute truncate hidden sm:inline">
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
                className={`shrink-0 ${sendSize} rounded-lg flex items-center justify-center transition-all duration-200 cursor-pointer disabled:cursor-default ${
                  streaming
                    ? "bg-signal/20 text-signal hover:bg-bad/20 hover:text-bad"
                    : canSend
                      ? "bg-signal text-ink hover:bg-signal/80 hover:shadow-[0_0_16px_-2px_rgba(196,153,244,0.4)] active:scale-95"
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
