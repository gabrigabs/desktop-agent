import { ArrowUp, ChevronDown, ChevronUp, Clipboard, X } from "lucide-react";
import { type RefObject, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ContextBar } from "../../components/ui/context-bar";
import { ContextChipBar } from "./ContextChipBar";
import type { ContextChipItem } from "./hooks/useContextChips";

const CLIPBOARD_MARKER = "[CLIPBOARD]";

interface ComposerProps {
  query: string;
  setQuery: (q: string) => void;
  placeholder: string;
  disabled: boolean;
  streaming: boolean;
  clipboardText: string;
  hasClipboard: boolean;
  ignoreClipboard: boolean;
  setIgnoreClipboard: (v: boolean) => void;
  onPasteClipboard: (text: string) => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  chips?: ContextChipItem[];
  starterChips?: ContextChipItem[];
  clipboardActions?: ContextChipItem[];
  onChipClick?: (chip: ContextChipItem) => void;
  onReloadClipboard: () => void;
  onExecute: () => void;
}

export function Composer({
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
  chips,
  starterChips,
  clipboardActions,
  onChipClick,
  onReloadClipboard,
  onExecute,
}: ComposerProps) {
  const { t } = useTranslation("helix");
  const [clipboardExpanded, setClipboardExpanded] = useState(false);
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    const hasText = query.trim().length > 0;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, hasText ? 120 : 56)}px`;
  }, [textareaRef, query]);

  const canSend = !streaming && query.trim().length > 0;
  const hasClipboardMarker = query.includes(CLIPBOARD_MARKER);
  const activePlaceholder = streaming ? t("helix:composer.waiting") : placeholder;
  const clipboardEnabled = hasClipboard && !ignoreClipboard;

  const insertClipboardMarker = () => {
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
  };

  const removeClipboardMarker = () => {
    const marker = new RegExp(`\\s?\\${CLIPBOARD_MARKER}\\s?`, "g");
    setQuery(query.replace(marker, ""));
    setIgnoreClipboard(true);
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setQuery(e.target.value);
    if (!ignoreClipboard && !e.target.value.includes(CLIPBOARD_MARKER)) {
      setIgnoreClipboard(true);
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

  const handleClipboardAction = (chip: ContextChipItem) => {
    const el = textareaRef.current;
    const prefix = chip.prompt ? `${chip.prompt} ` : "";
    const next = prefix + CLIPBOARD_MARKER;
    setQuery(next);
    setIgnoreClipboard(false);
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      el.setSelectionRange(next.length, next.length);
    });
  };

  const visibleStarterChips = starterChips ?? chips;

  return (
    <div className="w-full flex flex-col gap-2.5">
      <ContextBar
        text={clipboardText}
        enabled={clipboardEnabled}
        onEnable={insertClipboardMarker}
        onDisable={removeClipboardMarker}
        onReload={onReloadClipboard}
        clipboardActions={clipboardActions}
        onClipboardAction={handleClipboardAction}
      />
      <div className="composer-field flex items-end gap-3 px-4 py-3.5 rounded-2xl border border-line-strong bg-white/[0.05] transition-colors shadow-[0_0_0_1px_rgba(196,153,244,0.08)]">
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
          className="flex-1 min-w-0 bg-transparent border-0 text-[15px] leading-relaxed text-fg placeholder:text-mute resize-none focus-visible:outline-none select-text"
          style={{ minHeight: "56px", maxHeight: "120px", overflow: "hidden" }}
          disabled={disabled}
          rows={1}
          aria-label={t("helix:composer.message")}
        />
        <button
          type="button"
          onClick={onExecute}
          disabled={!canSend}
          className={`composer-send shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer disabled:cursor-default ${canSend ? "bg-signal text-ink hover:brightness-110 active:scale-90" : "bg-white/[0.06] text-faint"}`}
          title={t("helix:composer.send")}
          aria-label={t("helix:composer.send")}
        >
          <ArrowUp className="w-5 h-5 stroke-[2.5]" />
        </button>
      </div>
      {hasClipboardMarker && (
        <div className="overflow-hidden rounded-xl border border-signal/20 bg-signal/[0.035] shadow-[inset_3px_0_0_rgba(196,153,244,0.45)]">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setClipboardExpanded((v) => !v)}
              className="flex flex-1 items-center gap-2.5 px-3 py-2.5 text-left text-xs text-mute transition-colors hover:bg-white/[0.025] hover:text-fg"
            >
              <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-signal/15 bg-signal/10 text-signal">
                <Clipboard className="h-3.5 w-3.5" />
              </span>
              <span className="min-w-0 flex-1">
                {clipboardExpanded
                  ? t("helix:composer.hideClipboard")
                  : t("helix:composer.showClipboard", { count: clipboardText.length })}
              </span>
              {clipboardExpanded ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </button>
            <button
              type="button"
              onClick={removeClipboardMarker}
              className="mr-2 rounded-lg p-1.5 text-faint transition-colors hover:bg-white/[0.06] hover:text-fg"
              title={t("helix:composer.removeClipboard")}
              aria-label={t("helix:composer.removeClipboard")}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          {clipboardExpanded && (
            <div className="border-t border-signal/10 bg-black/10 px-3 py-2.5">
              <p className="max-h-36 overflow-y-auto whitespace-pre-wrap font-mono text-[10px] leading-relaxed text-mute select-text">
                {clipboardText}
              </p>
            </div>
          )}
        </div>
      )}
      {visibleStarterChips && visibleStarterChips.length > 0 && onChipClick && (
        <div className="flex flex-col items-center gap-1.5">
          <span className="text-[10px] text-faint uppercase tracking-wider font-medium">
            {t("helix:composer.startLikeThis")}
          </span>
          <ContextChipBar chips={visibleStarterChips} disabled={disabled} onChipClick={onChipClick} />
        </div>
      )}
    </div>
  );
}
