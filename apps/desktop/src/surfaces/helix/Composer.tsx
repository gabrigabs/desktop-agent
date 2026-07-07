import { ArrowUp } from "lucide-react";
import { type RefObject, useEffect } from "react";
import { ClipboardPreview } from "../../components/ui/clipboard-preview";
import { ContextChipBar } from "./ContextChipBar";
import type { ContextChipItem } from "./hooks/useContextChips";

interface ComposerProps {
  query: string;
  setQuery: (q: string) => void;
  placeholder: string;
  disabled: boolean;
  streaming: boolean;
  clipboardText: string;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  chips?: ContextChipItem[];
  onChipClick?: (chip: ContextChipItem) => void;
  onExecute: () => void;
}

export function Composer({
  query,
  setQuery,
  placeholder,
  disabled,
  streaming,
  clipboardText,
  textareaRef,
  chips,
  onChipClick,
  onExecute,
}: ComposerProps) {
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    const hasText = query.trim().length > 0;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, hasText ? 96 : 40)}px`;
  }, [textareaRef, query]);

  const canSend = !streaming && query.trim().length > 0;
  const activePlaceholder = streaming ? "Aguardando resposta..." : placeholder;

  return (
    <div className="w-full flex flex-col gap-2.5">
      <ClipboardPreview text={clipboardText} />
      <div className="composer-field flex items-end gap-2.5 px-3.5 py-2.5 rounded-2xl border border-line bg-white/[0.03] transition-colors">
        <textarea
          ref={textareaRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (canSend) onExecute();
            }
          }}
          placeholder={activePlaceholder}
          className="flex-1 min-w-0 bg-transparent border-0 text-sm leading-relaxed text-fg placeholder:text-mute resize-none focus-visible:outline-none select-text"
          style={{ minHeight: "40px", maxHeight: "96px", overflow: "hidden" }}
          disabled={disabled}
          rows={1}
          aria-label="Mensagem para o Helix"
        />
        <button
          type="button"
          onClick={onExecute}
          disabled={!canSend}
          className={`composer-send shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer disabled:cursor-default ${canSend ? "bg-signal text-ink hover:brightness-110 active:scale-90" : "bg-white/[0.04] text-faint"}`}
          title="Enviar"
          aria-label="Enviar"
        >
          <ArrowUp className="w-4 h-4 stroke-[2.5]" />
        </button>
      </div>
      {chips && chips.length > 0 && onChipClick && (
        <ContextChipBar chips={chips} disabled={disabled} onChipClick={onChipClick} />
      )}
    </div>
  );
}
