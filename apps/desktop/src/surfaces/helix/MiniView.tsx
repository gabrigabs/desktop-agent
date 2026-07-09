import { Check, Clipboard, Maximize2, X } from "lucide-react";
import { FREE_ACTIONS, QUICK_ACTIONS } from "./constants";

type Props = {
  error: string | null;
  result: string | null;
  streaming: boolean;
  taskActive: boolean;
  taskStatus: string;
  taskModeLabel: string;
  latestLogText: string | undefined;
  clipboardText: string;
  hasClipboard: boolean;
  activeRequestId: string | null;
  copied: boolean;
  onAbort: () => void;
  onCopy: () => void;
  onOpenMode: (m: "normal" | "expanded") => void;
  onQuickAction: (action: { id: string; prompt: string }) => void;
  onStarterAction: (action: { id: string; prompt: string; executionMode?: "simple" | "workflow" }) => void;
};

export function MiniView(p: Props) {
  const clipboardActions = QUICK_ACTIONS.slice(0, 6);
  const freeActions = FREE_ACTIONS.filter((a) => ["pergunta", "plano", "pesquisar-web"].includes(a.id));
  const clipboardPreview = p.clipboardText.slice(0, 120) + (p.clipboardText.length > 120 ? "…" : "");

  return (
    <div className="flex h-full w-full flex-col text-fg relative">
      <div className="flex-1 overflow-y-auto px-3 pt-3 pb-3 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[10px] text-mute font-medium tracking-tight">Ações rápidas</div>
          </div>
          <span
            className={`px-2 py-1 rounded-full text-[9px] font-medium ${p.error ? "text-bad bg-bad/10" : p.streaming ? "text-warn bg-warn/10" : p.result ? "text-good bg-good/10" : "text-faint bg-white/5"}`}
          >
            {p.taskStatus}
          </span>
        </div>

        <div
          className={`h-0.5 rounded-full ${p.streaming ? "bg-warn animate-pulse" : p.result ? "bg-good" : p.error ? "bg-bad" : "bg-signal/60"}`}
        />

        {p.taskActive && (
          <div className="flex flex-col gap-2.5 rounded-lg border border-line bg-white/[0.02] p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[9px] font-mono uppercase text-faint">Execução</span>
              <span className="text-[9px] font-mono text-faint">{p.taskModeLabel}</span>
            </div>
            <p
              className={`text-xs leading-relaxed line-clamp-4 select-text ${p.error ? "text-bad" : p.result ? "text-fg" : "text-mute"}`}
            >
              {p.error || p.result || p.latestLogText || "A resposta aparece aqui quando o agente começar."}
            </p>
            <div className="flex items-center gap-2">
              {p.streaming && (
                <button
                  type="button"
                  onClick={p.onAbort}
                  disabled={!p.activeRequestId}
                  className="h-8 px-2.5 rounded-md bg-bad/10 border border-bad/20 text-[10px] font-semibold text-bad hover:text-bad/80 transition-colors cursor-pointer disabled:opacity-40 flex items-center gap-1.5"
                >
                  <X className="w-3.5 h-3.5" /> Parar
                </button>
              )}
              {p.result && (
                <button
                  type="button"
                  onClick={p.onCopy}
                  className={`h-8 px-2.5 rounded-md text-[10px] font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${p.copied ? "bg-good/15 text-good" : "border border-line text-mute hover:text-fg"}`}
                >
                  {p.copied ? <Check className="w-3.5 h-3.5" /> : <Clipboard className="w-3.5 h-3.5" />}
                  {p.copied ? "Copiado" : "Copiar"}
                </button>
              )}
            </div>
          </div>
        )}

        <hr className="helix-rule" />

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-[10px] text-mute uppercase tracking-wider font-bold">
              <Clipboard className={`w-3.5 h-3.5 ${p.hasClipboard ? "text-good" : "text-faint"}`} /> Clipboard
            </span>
            <span className="text-[9px] font-mono text-faint">
              {p.hasClipboard ? `${p.clipboardText.length} car.` : "vazio"}
            </span>
          </div>

          {p.hasClipboard ? (
            <div className="rounded-lg border border-line bg-white/[0.02] p-2.5 flex flex-col gap-2">
              <p className="text-[10px] text-mute leading-relaxed line-clamp-3 select-text">
                {clipboardPreview}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {clipboardActions.map((action) => {
                  const Icon = action.icon;
                  const disabled = p.streaming || !p.hasClipboard;
                  return (
                    <button
                      key={action.id}
                      type="button"
                      onClick={() => p.onQuickAction(action)}
                      disabled={disabled}
                      className="min-h-[44px] rounded-md border border-line bg-white/[0.03] text-mute hover:text-fg hover:border-signal/30 hover:bg-white/[0.06] transition-all cursor-pointer flex items-center gap-2 px-2 py-1.5 text-left disabled:opacity-40 disabled:pointer-events-none"
                    >
                      <Icon className={`w-3.5 h-3.5 shrink-0 ${action.accent}`} />
                      <span className="min-w-0">
                        <span className="block text-[10px] font-semibold leading-tight truncate">
                          {action.label}
                        </span>
                        <span className="block text-[9px] text-faint leading-tight truncate">
                          {action.description}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-line/60 border-dashed bg-white/[0.01] p-3 flex items-center gap-2 text-faint">
              <Clipboard className="w-3.5 h-3.5" />
              <span className="text-[10px]">Copie um texto para ver ações rápidas</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2">
          {freeActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                type="button"
                onClick={() => p.onStarterAction(action)}
                disabled={p.streaming}
                className="min-h-[52px] rounded-lg border border-line text-mute hover:text-fg hover:border-signal/30 transition-colors cursor-pointer flex flex-col items-center justify-center gap-1 disabled:opacity-40 disabled:pointer-events-none"
                title={action.description}
              >
                <Icon className={`w-4 h-4 ${action.accent}`} />
                <span className="text-[9px] font-semibold leading-tight">{action.label}</span>
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-2 mt-auto">
          <button
            type="button"
            onClick={() => p.onOpenMode("normal")}
            className="h-9 rounded-lg border border-line text-[11px] font-semibold text-mute hover:text-fg hover:border-signal/30 transition-colors cursor-pointer"
          >
            Modo normal
          </button>
          <button
            type="button"
            onClick={() => p.onOpenMode("expanded")}
            className="h-9 rounded-lg bg-signal/15 border border-signal/30 text-[11px] font-semibold text-signal hover:brightness-125 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
          >
            <Maximize2 className="w-3.5 h-3.5" /> Expandido
          </button>
        </div>
      </div>
    </div>
  );
}
