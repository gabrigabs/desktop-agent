import { ArrowUp } from "lucide-react";
import { type RefObject, useEffect } from "react";
import { ContextChipBar } from "./ContextChipBar";
import type { InputMode } from "./constants";
import type { ContextChipItem } from "./hooks/useContextChips";

interface ComposerProps {
  query: string;
  setQuery: (q: string) => void;
  placeholder: string;
  disabled: boolean;
  streaming: boolean;
  inputMode: InputMode;
  hasClipboard: boolean;
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
  inputMode,
  hasClipboard,
  textareaRef,
  chips,
  onChipClick,
  onExecute,
}: ComposerProps) {
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 96)}px`;
  }, [textareaRef]);

  const canSend = !streaming && query.trim().length > 0 && !(inputMode === "clipboard" && !hasClipboard);
  const activePlaceholder = streaming ? "Aguardando resposta..." : placeholder;

  return (
    <div className="w-full flex flex-col gap-2">
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
          className="flex-1 min-w-0 bg-transparent border-0 text-sm leading-relaxed text-fg placeholder:text-faint resize-none focus-visible:outline-none select-text"
          style={{ minHeight: "40px", maxHeight: "96px", overflow: "hidden" }}
          disabled={disabled}
          rows={1}
          aria-label={inputMode === "clipboard" ? "Interagir com clipboard" : "Conteúdo avulso"}
        />
        <button
          type="button"
          onClick={onExecute}
          disabled={!canSend}
          className={`composer-send shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer disabled:cursor-default ${canSend ? "bg-signal text-ink hover:brightness-110 active:scale-90" : "bg-white/[0.04] text-faint"}`}
          title="Enviar pedido"
          aria-label="Enviar pedido"
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
