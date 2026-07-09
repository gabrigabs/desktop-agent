import { Clipboard, Code, Eye, FileText, Globe, RefreshCw, Type, X } from "lucide-react";
import { useState } from "react";
import type { ContextChipItem } from "../../surfaces/helix/hooks/useContextChips";

interface ContextBarProps {
  text: string;
  enabled: boolean;
  onEnable: () => void;
  onDisable: () => void;
  onReload: () => void;
  clipboardActions?: ContextChipItem[];
  onClipboardAction?: (chip: ContextChipItem) => void;
}

function detectIcon(text: string): React.ElementType {
  const trimmed = text.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return Globe;
  }
  if (
    trimmed.includes("{") ||
    trimmed.includes("function") ||
    trimmed.includes("class ") ||
    trimmed.includes("import ")
  ) {
    return Code;
  }
  if (trimmed.length > 120) {
    return FileText;
  }
  return Type;
}

export function ContextBar({
  text,
  enabled,
  onEnable,
  onDisable,
  onReload,
  clipboardActions,
  onClipboardAction,
}: ContextBarProps) {
  const [open, setOpen] = useState(false);
  const hasText = text.trim().length > 0;
  const Icon = detectIcon(text);

  if (!hasText) {
    return (
      <div className="flex items-center gap-2 text-[10px] text-faint select-none px-1">
        <Clipboard className="w-3 h-3" />
        <span>Copie um texto para ver ações de contexto</span>
      </div>
    );
  }

  return (
    <>
      <div
        className={`rounded-lg border p-1.5 transition-colors ${
          enabled ? "bg-signal/[0.04] border-signal/20" : "bg-transparent border-line"
        }`}
      >
        <div className="flex items-center gap-2">
          <Icon className={`w-3.5 h-3.5 shrink-0 ${enabled ? "text-signal" : "text-faint"}`} />
          <div className="flex-1 min-w-0 flex items-center gap-2">
            <span className={`text-[10px] font-medium ${enabled ? "text-signal" : "text-faint"}`}>
              Clipboard
            </span>
            <span className="text-[10px] text-faint font-mono">{text.length} car.</span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="flex items-center gap-1 px-1.5 py-1 rounded-md text-[10px] font-medium text-mute hover:text-fg hover:bg-white/5 transition-colors"
              title="Ver conteúdo do clipboard"
              aria-label="Ver conteúdo do clipboard"
            >
              <Eye className="w-3 h-3" />
              Ver
            </button>
            <button
              type="button"
              onClick={onReload}
              className="p-1 rounded-md text-faint hover:text-fg hover:bg-white/5 transition-colors"
              title="Recarregar clipboard"
              aria-label="Recarregar clipboard"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
            {enabled ? (
              <button
                type="button"
                onClick={onDisable}
                className="text-[10px] font-medium px-2 py-1 rounded-md bg-signal/10 text-signal hover:bg-signal/20 transition-colors"
                title="Remover [CLIPBOARD] da mensagem"
              >
                Incluído
              </button>
            ) : (
              <button
                type="button"
                onClick={onEnable}
                className="text-[10px] font-medium px-2 py-1 rounded-md bg-white/[0.04] text-mute hover:bg-white/[0.08] hover:text-fg transition-colors"
                title="Incluir [CLIPBOARD] na mensagem"
              >
                Incluir
              </button>
            )}
          </div>
        </div>

        {clipboardActions && clipboardActions.length > 0 && onClipboardAction && (
          <div className="mt-1.5 pt-1.5 border-t border-line/40 flex flex-wrap items-center gap-1.5">
            {clipboardActions.map((action) => {
              const ActionIcon = action.icon;
              return (
                <button
                  key={action.id}
                  type="button"
                  onClick={() => onClipboardAction(action)}
                  className="flex items-center gap-1 px-2 py-1 rounded-full border border-line bg-white/[0.03] text-[10px] text-mute hover:text-fg hover:border-signal/30 hover:bg-white/[0.06] transition-colors"
                  title={action.prompt}
                >
                  <ActionIcon className={`w-3 h-3 ${action.accent}`} />
                  {action.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {open && (
        <button
          type="button"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm appearance-none border-0 bg-transparent"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
          }}
          aria-label="Fechar visualização do clipboard"
        >
          <div
            className="w-full max-w-xl max-h-[80vh] flex flex-col rounded-2xl border border-line bg-ink shadow-2xl overflow-hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Conteúdo do clipboard"
          >
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-line bg-white/[0.03]">
              <div className="flex items-center gap-2">
                <Icon className={`w-4 h-4 ${enabled ? "text-signal" : "text-faint"}`} />
                <span className="text-sm font-semibold text-fg">Clipboard</span>
                <span className="text-[10px] text-faint font-mono">{text.length} caracteres</span>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg text-faint hover:text-fg hover:bg-white/5 transition-colors"
                title="Fechar"
                aria-label="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto">
              <p className="text-sm text-fg leading-relaxed whitespace-pre-wrap select-text">{text}</p>
            </div>
          </div>
        </button>
      )}
    </>
  );
}
