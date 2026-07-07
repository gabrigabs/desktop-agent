import { Play } from "lucide-react";
import { type RefObject, useEffect } from "react";
import type { InputMode } from "./constants";

interface ComposerProps {
  query: string;
  setQuery: (q: string) => void;
  placeholder: string;
  disabled: boolean;
  streaming: boolean;
  inputMode: InputMode;
  hasClipboard: boolean;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
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
    <div className="relative w-full">
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
        className="w-full bg-white/[0.03] border border-line rounded-xl pl-3.5 pr-11 py-2.5 text-sm text-fg placeholder:text-faint focus:border-signal/50 resize-none transition-all select-text"
        style={{ minHeight: "40px", maxHeight: "96px", overflow: "hidden" }}
        disabled={disabled}
        rows={1}
        aria-label={inputMode === "clipboard" ? "Interagir com clipboard" : "Conteúdo avulso"}
      />
      <button
        type="button"
        onClick={onExecute}
        disabled={!canSend}
        className="absolute right-2.5 bottom-2.5 p-1.5 rounded-lg bg-signal/20 border border-signal/40 text-signal hover:brightness-125 transition-all cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
        title="Enviar pedido"
      >
        <Play className="w-3.5 h-3.5 fill-current" />
      </button>
    </div>
  );
}
