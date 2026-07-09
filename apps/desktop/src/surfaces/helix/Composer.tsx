import { ArrowUp } from "lucide-react";
import { type RefObject, useEffect } from "react";
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
  textareaRef,
  chips,
  starterChips,
  clipboardActions,
  onChipClick,
  onReloadClipboard,
  onExecute,
}: ComposerProps) {
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    const hasText = query.trim().length > 0;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, hasText ? 120 : 56)}px`;
  }, [textareaRef, query]);

  const canSend = !streaming && query.trim().length > 0;
  const activePlaceholder = streaming ? "Aguardando resposta..." : placeholder;
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
          aria-label="Mensagem"
        />
        <button
          type="button"
          onClick={onExecute}
          disabled={!canSend}
          className={`composer-send shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer disabled:cursor-default ${canSend ? "bg-signal text-ink hover:brightness-110 active:scale-90" : "bg-white/[0.06] text-faint"}`}
          title="Enviar"
          aria-label="Enviar"
        >
          <ArrowUp className="w-5 h-5 stroke-[2.5]" />
        </button>
      </div>
      {visibleStarterChips && visibleStarterChips.length > 0 && onChipClick && (
        <div className="flex flex-col items-center gap-1.5">
          <span className="text-[10px] text-faint uppercase tracking-wider font-medium">Começar assim</span>
          <ContextChipBar chips={visibleStarterChips} disabled={disabled} onChipClick={onChipClick} />
        </div>
      )}
    </div>
  );
}
