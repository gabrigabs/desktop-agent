import type { ConnectorConfig, Turn, WorkflowStep } from "@desktop-agent/shared";
import {
  AlertCircle,
  ArrowLeft,
  Bot,
  Check,
  Clipboard,
  Clock,
  Layers,
  Settings,
  Workflow,
  X,
} from "lucide-react";
import type { RefObject } from "react";
import { ChatView } from "./ChatView";
import { Composer } from "./Composer";
import { ConnectorsPanel } from "./ConnectorsPanel";
import { FREE_ACTIONS, type InputMode, QUICK_ACTIONS } from "./constants";
import { HistoryList } from "./history-list";

type Props = {
  error: string | null;
  result: string | null;
  streaming: boolean;
  query: string;
  clipboardText: string;
  hasClipboard: boolean;
  taskActive: boolean;
  taskStatus: string;
  taskModeLabel: string;
  inputModeLabel: string;
  composerPlaceholder: string;
  inputMode: InputMode;
  executionMode: "simple" | "workflow";
  mode: "command" | "history" | "connectors";
  activeRequestId: string | null;
  copied: boolean;
  messages: Turn[];
  workflowSteps: WorkflowStep[];
  visibleLogs: { id: string; type: string; text: string }[];
  latestLogText: string | undefined;
  connectors: ConnectorConfig[];
  testingConnectorId: string | null;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  badgeText: string;
  showSettings: boolean;
  setMode: (m: "command" | "history" | "connectors") => void;
  setInputMode: (m: InputMode) => void;
  setExecutionMode: (m: "simple" | "workflow") => void;
  setQuery: (q: string) => void;
  setShowSettings: (v: boolean) => void;
  onExecute: () => void;
  onAbort: () => void;
  onCopy: () => void;
  onNewTask: () => void;
  onOpenMode: (m: "normal" | "mini") => void;
  onStarterAction: (prompt: string, modeOverride?: "simple" | "workflow") => void;
  onQuickAction: (id: string) => void;
  onTestConnector: (id: string) => void;
  onToggleConnector: (id: string) => void;
  onEditPrompt: (text: string) => void;
  onCopyResponse: (text: string) => void;
  onRegenerate: () => void;
  onToastSuccess?: (message: string, duration?: number) => void;
  onToastError?: (message: string, duration?: number) => void;
};

export function ExpandedView(p: Props) {
  return (
    <div className="grid h-full w-full grid-cols-[220px_minmax(0,1fr)_300px] text-fg relative">
      <aside className="min-w-0 border-r border-line p-4 flex flex-col gap-3.5 bg-white/[0.01]">
        <section className="flex flex-col gap-2">
          <div className="text-[9px] font-mono uppercase text-faint tracking-wider">Helix</div>
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-semibold text-fg truncate">Modo expandido</div>
            <button
              type="button"
              onClick={() => p.setShowSettings(true)}
              className={`p-1.5 rounded-md border transition-colors cursor-pointer ${p.showSettings ? "border-signal/30 bg-signal/10 text-signal" : "border-line text-mute hover:text-fg hover:border-line-strong"}`}
              title="Configurações"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="text-[11px] text-mute truncate font-mono">{p.badgeText}</div>
        </section>

        <nav className="grid gap-1.5">
          {(
            [
              ["command", "Perguntar", Bot],
              ["history", "Histórico", Clock],
              ["connectors", "Conectores", Layers],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => p.setMode(id)}
              className={`h-10 rounded-lg px-3 text-left transition-colors cursor-pointer flex items-center gap-2 ${p.mode === id ? "bg-white/8 text-fg border border-line-strong" : "text-mute hover:text-fg hover:bg-white/[0.04]"}`}
            >
              <Icon className="w-4 h-4" />
              <span className="text-xs font-semibold">{label}</span>
            </button>
          ))}
        </nav>

        <section className="rounded-xl border border-line p-3 flex flex-col gap-2 bg-white/[0.02]">
          <div className="text-[9px] font-mono uppercase text-faint">Execução</div>
          <div className="grid grid-cols-1 gap-1">
            <button
              type="button"
              onClick={() => p.setExecutionMode("simple")}
              className={`h-9 rounded-lg px-3 text-left transition-colors cursor-pointer ${p.executionMode === "simple" ? "bg-white/8 text-fg" : "text-mute hover:text-fg hover:bg-white/[0.04]"}`}
            >
              <span className="block text-xs font-semibold">Simples</span>
              <span className="block text-[9px] text-faint">Resposta rápida</span>
            </button>
            <button
              type="button"
              onClick={() => p.setExecutionMode("workflow")}
              className={`h-9 rounded-lg px-3 text-left transition-colors cursor-pointer ${p.executionMode === "workflow" ? "bg-signal/15 text-signal border border-signal/30" : "text-mute hover:text-fg hover:bg-white/[0.04]"}`}
            >
              <span className="block text-xs font-semibold">Workflow</span>
              <span className="block text-[9px] text-faint">Plano e aprovação</span>
            </button>
          </div>
        </section>

        <section className="rounded-xl border border-line p-3 flex flex-col gap-2 bg-white/[0.02]">
          <div className="text-[9px] font-mono uppercase text-faint">Contexto</div>
          <button
            type="button"
            onClick={() => p.setInputMode("free")}
            className={`h-9 rounded-lg px-3 text-left transition-colors cursor-pointer ${p.inputMode === "free" ? "bg-signal/15 text-fg border border-signal/30" : "text-mute hover:text-fg hover:bg-white/[0.04]"}`}
          >
            <span className="text-xs font-semibold">Livre</span>
          </button>
          <button
            type="button"
            onClick={() => p.setInputMode("clipboard")}
            className={`h-9 rounded-lg px-3 text-left transition-colors cursor-pointer ${p.inputMode === "clipboard" ? "bg-good/10 text-fg border border-good/30" : "text-mute hover:text-fg hover:bg-white/[0.04]"}`}
          >
            <span className="text-xs font-semibold">Clipboard</span>
            <span className="ml-2 text-[9px] text-faint font-mono">
              {p.hasClipboard ? p.clipboardText.length : 0}
            </span>
          </button>
        </section>

        <div className="mt-auto grid gap-2">
          <button
            type="button"
            onClick={() => p.onOpenMode("normal")}
            className="h-9 rounded-lg border border-line text-[11px] font-semibold text-mute hover:text-fg hover:border-signal/30 transition-colors cursor-pointer"
          >
            Modo normal
          </button>
          <button
            type="button"
            onClick={() => p.onOpenMode("mini")}
            className="h-9 rounded-lg border border-line text-[11px] font-semibold text-faint hover:text-fg transition-colors cursor-pointer"
          >
            Modo mini
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex flex-col">
        <div className="h-[58px] border-b border-line px-5 flex items-center justify-between gap-4 bg-white/[0.012]">
          <div className="min-w-0">
            <div className="text-[9px] font-mono uppercase text-faint tracking-wider">
              {p.mode === "history" ? "Histórico" : p.mode === "connectors" ? "Conectores" : "Command center"}
            </div>
            <div className="text-sm font-semibold text-fg truncate">
              {p.mode === "history"
                ? "Execuções recentes"
                : p.mode === "connectors"
                  ? "Capacidades conectadas"
                  : p.taskActive
                    ? "Execução em andamento"
                    : "Nova tarefa"}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => p.setShowSettings(true)}
              className={`h-8 px-2.5 rounded-md border text-[10px] font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${p.showSettings ? "border-signal/30 bg-signal/10 text-signal" : "border-line text-mute hover:text-fg hover:border-line-strong"}`}
              title="Configurações"
            >
              <Settings className="w-3.5 h-3.5" /> Configurar
            </button>
            <span
              className={`px-2.5 py-1 rounded-md text-[10px] font-mono uppercase border ${p.error ? "bg-bad/10 text-bad border-bad/20" : p.streaming ? "bg-warn/10 text-warn border-warn/20" : p.result ? "bg-good/10 text-good border-good/20" : "bg-white/5 text-faint border-line"}`}
            >
              {p.taskStatus}
            </span>
            {p.taskActive && (
              <button
                type="button"
                onClick={p.onNewTask}
                disabled={p.streaming}
                className="h-8 px-2.5 rounded-md border border-line text-[10px] font-semibold text-mute hover:text-fg transition-colors cursor-pointer disabled:opacity-40 flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Nova
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {p.mode === "history" ? (
            <HistoryList />
          ) : p.mode === "connectors" ? (
            <ConnectorsPanel
              connectors={p.connectors.slice(0, 7)}
              testingConnectorId={p.testingConnectorId}
              onTest={p.onTestConnector}
              onToggle={p.onToggleConnector}
              variant="grid"
            />
          ) : p.taskActive && p.messages.length > 0 ? (
            <div className="min-h-full flex flex-col gap-4">
              <div className="flex items-center justify-between gap-3 shrink-0">
                <button
                  type="button"
                  onClick={p.onNewTask}
                  disabled={p.streaming}
                  className="h-8 px-2.5 rounded-md border border-line text-[10px] font-semibold text-mute hover:text-fg transition-colors cursor-pointer disabled:opacity-40 flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Nova
                </button>
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
              </div>

              {p.error && (
                <section className="p-4 bg-bad/10 rounded-xl text-bad text-sm flex gap-3 items-start border border-bad/20 shrink-0">
                  <AlertCircle className="w-5 h-5 text-bad flex-shrink-0 mt-0.5" />
                  <div className="select-text">
                    <strong className="font-bold mr-1">Erro:</strong>
                    {p.error}
                  </div>
                </section>
              )}

              <ChatView
                turns={p.messages}
                streaming={p.streaming}
                onEditPrompt={p.onEditPrompt}
                onCopyResponse={p.onCopyResponse}
                onRegenerate={p.onRegenerate}
                onToastSuccess={p.onToastSuccess}
                onToastError={p.onToastError}
              />

              <div className="shrink-0">
                <Composer
                  query={p.query}
                  setQuery={p.setQuery}
                  placeholder={p.composerPlaceholder}
                  disabled={p.streaming}
                  streaming={p.streaming}
                  inputMode={p.inputMode}
                  hasClipboard={p.hasClipboard}
                  textareaRef={p.textareaRef}
                  onExecute={p.onExecute}
                />
              </div>
            </div>
          ) : p.taskActive ? (
            <div className="min-h-full flex flex-col gap-4">
              <section className="rounded-2xl border border-line p-4 bg-white/[0.02]">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-[10px] text-faint font-mono uppercase mb-1">Pedido</div>
                    <p className="text-sm leading-relaxed text-fg select-text whitespace-pre-wrap">
                      {p.query}
                    </p>
                  </div>
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
                </div>
              </section>

              {p.error && (
                <section className="p-4 bg-bad/10 rounded-xl text-bad text-sm flex gap-3 items-start border border-bad/20">
                  <AlertCircle className="w-5 h-5 text-bad flex-shrink-0 mt-0.5" />
                  <div className="select-text">
                    <strong className="font-bold mr-1">Erro:</strong>
                    {p.error}
                  </div>
                </section>
              )}

              <section className="flex-1 min-h-[420px] rounded-2xl border border-line bg-white/[0.03] overflow-hidden flex flex-col">
                <div className="px-4 py-3 flex items-center justify-between bg-white/[0.03] border-b border-line">
                  <span className="text-[10px] uppercase tracking-wider text-faint font-bold">
                    {p.streaming ? "Resposta em andamento" : "Resultado"}
                  </span>
                  {p.result && (
                    <button
                      type="button"
                      onClick={p.onCopy}
                      className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${p.copied ? "bg-good/15 text-good" : "text-mute hover:text-fg"}`}
                    >
                      {p.copied ? (
                        <Check className="w-3.5 h-3.5" />
                      ) : (
                        <Clipboard className="w-3.5 h-3.5 text-signal" />
                      )}
                      <span>{p.copied ? "Copiado" : "Copiar"}</span>
                    </button>
                  )}
                </div>
                <div className="flex-1 p-5 text-sm text-fg leading-relaxed whitespace-pre-wrap overflow-y-auto select-text">
                  {p.result ? (
                    <>
                      {p.result}
                      {p.streaming && (
                        <span className="inline-block w-1.5 h-4 ml-1 align-[-2px] rounded-sm bg-warn animate-pulse" />
                      )}
                    </>
                  ) : (
                    <span className="text-faint">
                      A resposta aparece aqui assim que o agente começar a escrever.
                    </span>
                  )}
                </div>
              </section>
            </div>
          ) : (
            <div className="min-h-full flex flex-col gap-4">
              <section className="rounded-2xl border border-line overflow-hidden bg-white/[0.02]">
                <div className="px-4 py-3 border-b border-line bg-white/[0.03] flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase text-faint">{p.inputModeLabel}</span>
                  <span className="text-[10px] text-faint font-mono">{p.taskModeLabel}</span>
                </div>
                <div className="p-4">
                  <Composer
                    query={p.query}
                    setQuery={p.setQuery}
                    placeholder={p.composerPlaceholder}
                    disabled={p.streaming}
                    streaming={p.streaming}
                    inputMode={p.inputMode}
                    hasClipboard={p.hasClipboard}
                    textareaRef={p.textareaRef}
                    onExecute={p.onExecute}
                  />
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <span className="text-[10px] text-faint">
                      {p.inputMode === "clipboard" && p.hasClipboard
                        ? `${p.clipboardText.length} caracteres no clipboard`
                        : "Pronto para uma nova solicitação"}
                    </span>
                  </div>
                </div>
              </section>

              <section className="grid grid-cols-3 gap-3 auto-rows-[96px] content-start">
                {(p.inputMode === "clipboard" ? QUICK_ACTIONS : FREE_ACTIONS).map((action) => {
                  const Icon = action.icon;
                  const disabled =
                    p.inputMode === "clipboard" &&
                    "requiresClipboard" in action &&
                    action.requiresClipboard &&
                    !p.hasClipboard;
                  const actionExecutionMode =
                    "executionMode" in action &&
                    (action.executionMode === "simple" || action.executionMode === "workflow")
                      ? action.executionMode
                      : undefined;
                  return (
                    <button
                      key={action.id}
                      type="button"
                      onClick={() =>
                        p.inputMode === "clipboard"
                          ? p.onQuickAction(action.id)
                          : p.onStarterAction(action.prompt, actionExecutionMode)
                      }
                      disabled={disabled || p.streaming}
                      className="h-full rounded-xl border border-line bg-white/[0.012] text-mute hover:text-fg hover:border-signal/30 hover:bg-white/[0.035] transition-all cursor-pointer flex flex-col items-start justify-center gap-2 px-3 py-3 text-left disabled:opacity-40 disabled:pointer-events-none"
                      title={disabled ? "Copie um texto primeiro" : action.description}
                    >
                      <Icon className={`w-5 h-5 ${action.accent}`} />
                      <span className="text-xs font-semibold leading-tight">{action.label}</span>
                      <span className="text-[10px] text-faint leading-tight">{action.description}</span>
                    </button>
                  );
                })}
              </section>
            </div>
          )}
        </div>
      </main>

      <aside className="min-w-0 border-l border-line p-4 flex flex-col gap-4 overflow-y-auto">
        <section className="rounded-xl border border-line p-3 bg-white/[0.02]">
          <div className="text-[9px] font-mono uppercase text-faint mb-2">Estado</div>
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${p.error ? "bg-bad" : p.streaming ? "bg-warn animate-pulse" : p.result ? "bg-good" : "bg-signal"}`}
            />
            <span className="text-xs font-semibold text-fg">{p.taskStatus}</span>
          </div>
          {p.latestLogText && (
            <p className="mt-2 text-[11px] leading-relaxed text-mute line-clamp-3">{p.latestLogText}</p>
          )}
        </section>

        {p.workflowSteps.length > 0 && (
          <section className="rounded-xl border border-line p-3 flex flex-col gap-2.5 bg-white/[0.02]">
            <div className="text-[9px] font-mono uppercase text-faint flex items-center gap-1.5">
              <Workflow className="w-3.5 h-3.5 text-signal" /> Timeline
            </div>
            {p.workflowSteps.map((step) => (
              <div
                key={step.id}
                className="grid grid-cols-[14px_1fr] gap-2 rounded-lg bg-white/[0.03] px-2.5 py-2"
              >
                <span
                  className={`mt-1.5 w-2 h-2 rounded-full ${step.status === "completed" ? "bg-good" : step.status === "running" ? "bg-warn animate-pulse" : step.status === "waiting_approval" ? "bg-signal animate-pulse" : step.status === "failed" ? "bg-bad" : "bg-faint"}`}
                />
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-fg truncate">{step.title}</div>
                  <div className="text-[10px] text-mute leading-relaxed line-clamp-2">
                    {step.detail || step.kind}
                  </div>
                </div>
              </div>
            ))}
          </section>
        )}

        <section className="rounded-xl border border-line p-3 flex flex-col gap-3 bg-white/[0.02]">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[9px] font-mono uppercase text-faint">Clipboard</span>
            <span className="text-[9px] font-mono text-faint">
              {p.hasClipboard ? `${p.clipboardText.length}` : "vazio"}
            </span>
          </div>
          <p className="min-h-16 rounded-lg bg-white/[0.03] border border-line p-2.5 text-[11px] text-mute leading-relaxed line-clamp-4 select-text">
            {p.hasClipboard
              ? `"${p.clipboardText.slice(0, 260)}${p.clipboardText.length > 260 ? "..." : ""}"`
              : "Nenhum texto detectado."}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {QUICK_ACTIONS.slice(0, 4).map((action) => {
              const Icon = action.icon;
              const disabled = p.streaming || !p.hasClipboard;
              return (
                <button
                  key={action.id}
                  type="button"
                  onClick={() => p.onQuickAction(action.id)}
                  disabled={disabled}
                  className="h-10 rounded-lg border border-line text-mute hover:text-fg hover:border-signal/30 transition-colors cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:pointer-events-none"
                  title={disabled ? "Copie um texto primeiro" : action.description}
                >
                  <Icon className={`w-3.5 h-3.5 ${action.accent}`} />
                  <span className="text-[9px] font-semibold truncate">{action.label}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-xl border border-line p-3 bg-white/[0.02]">
          <div className="text-[9px] font-mono uppercase text-faint mb-2">Conectores</div>
          <div className="grid gap-2">
            {p.connectors.slice(0, 5).map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-mute truncate">{c.name}</span>
                <span className={`w-2 h-2 rounded-full ${c.enabled ? "bg-good" : "bg-faint"}`} />
              </div>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}
