import type { ConnectorConfig, Turn, WorkflowStep } from "@desktop-agent/shared";
import {
  AlertCircle,
  ArrowLeft,
  Bot,
  Check,
  Clipboard,
  Maximize2,
  Minus,
  RefreshCw,
  Settings,
  ShieldCheck,
  Workflow,
  X,
} from "lucide-react";
import type { RefObject } from "react";
import { ChatView } from "./ChatView";
import { Composer } from "./Composer";
import { ConnectorsPanel } from "./ConnectorsPanel";
import { FREE_ACTIONS, type InputMode, QUICK_ACTIONS } from "./constants";
import { HistoryList } from "./history-list";
import type { ContextChipItem } from "./hooks/useContextChips";

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
  expandedMode: boolean;
  activeRequestId: string | null;
  copied: boolean;
  messages: Turn[];
  workflowSteps: WorkflowStep[];
  approval: { reason: string; permissionLevel: string; inputPreview: string } | undefined;
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
  chips?: ContextChipItem[];
  onChipClick?: (chip: ContextChipItem) => void;
  onExecute: () => void;
  onAbort: () => void;
  onApproval: (approved: boolean) => void;
  onCopy: () => void;
  onNewTask: () => void;
  onExpandedMode: () => void;
  onClose: () => void;
  onMinimize: () => void;
  onToastSuccess?: (message: string, duration?: number) => void;
  onToastError?: (message: string, duration?: number) => void;
  onStarterAction: (prompt: string, modeOverride?: "simple" | "workflow") => void;
  onQuickAction: (id: string) => void;
  onTestConnector: (id: string) => void;
  onToggleConnector: (id: string) => void;
  onRefreshCapabilities: () => void;
  onEditPrompt: (text: string) => void;
  onCopyResponse: (text: string) => void;
  onRegenerate: () => void;
};

export function NormalCommandView(p: Props) {
  return (
    <div className="flex flex-col h-full w-full text-fg relative">
      <div className="px-4 pt-3 pb-2">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] text-mute font-medium tracking-tight">Modelo ativo</div>
            <div className="truncate text-xs font-medium text-fg select-all">{p.badgeText}</div>
          </div>
          <button
            type="button"
            onClick={() => p.setShowSettings(true)}
            className="px-2.5 py-1.5 rounded-md border border-line text-[10px] font-semibold text-mute hover:text-fg hover:border-signal/40 transition-colors cursor-pointer"
          >
            Configurar
          </button>
        </div>
        <div
          className={`mt-2 h-0.5 rounded-full ${p.streaming ? "bg-warn animate-pulse" : p.result ? "bg-good" : p.error ? "bg-bad" : "bg-signal/60"}`}
        />
      </div>

      <div className="flex items-center justify-between px-4 py-2 border-y border-line">
        <div className="flex items-center gap-1">
          {(
            [
              ["command", "Perguntar"],
              ["history", "Histórico"],
              ["connectors", "Conectores"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => p.setMode(id)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${p.mode === id ? "bg-white/8 text-fg border border-line-strong" : "text-mute hover:text-fg"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => p.setShowSettings(!p.showSettings)}
          className={`p-1.5 rounded-md transition-colors cursor-pointer border border-transparent hover:border-line ${p.showSettings ? "text-signal bg-signal/10" : "text-mute hover:text-fg"}`}
          title="Configurações"
        >
          <Settings className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={p.onMinimize}
          className="p-1.5 rounded-md transition-colors cursor-pointer border border-transparent hover:border-line text-mute hover:text-fg"
          title="Minimizar janela"
        >
          <Minus className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={p.onClose}
          className="p-1.5 rounded-md transition-colors cursor-pointer border border-transparent hover:border-line text-mute hover:text-bad"
          title="Fechar janela"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className={`flex-1 overflow-y-auto ${p.expandedMode ? "p-5" : "p-4"}`}>
        {p.mode === "command" ? (
          p.taskActive && p.messages.length > 0 ? (
            <ChatActiveView {...p} />
          ) : p.taskActive ? (
            <TaskActiveView {...p} />
          ) : (
            <CommandIdleView {...p} />
          )
        ) : p.mode === "history" ? (
          <HistoryList />
        ) : (
          <ConnectorsPanel
            connectors={p.connectors.slice(0, 7)}
            testingConnectorId={p.testingConnectorId}
            onTest={p.onTestConnector}
            onToggle={p.onToggleConnector}
            onRefresh={p.onRefreshCapabilities}
          />
        )}
      </div>
    </div>
  );
}

function ChatActiveView(p: Props) {
  return (
    <div className={`flex flex-col h-full min-h-0 ${p.expandedMode ? "gap-4" : "gap-3"}`}>
      <div className="flex items-center justify-between gap-3 shrink-0">
        <button
          type="button"
          onClick={p.onNewTask}
          disabled={p.streaming}
          className="h-8 px-2.5 rounded-md border border-line text-[10px] font-semibold text-mute hover:text-fg hover:border-signal/30 transition-colors cursor-pointer disabled:opacity-40 flex items-center gap-1.5"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Nova tarefa
        </button>
        <div className="flex items-center gap-2">
          <span className="px-2 py-1 rounded-md bg-white/5 border border-line text-[10px] font-mono text-mute">
            {p.taskModeLabel}
          </span>
          <span
            className={`text-[10px] font-mono uppercase ${p.error ? "text-bad" : p.streaming ? "text-warn" : "text-good"}`}
          >
            {p.taskStatus}
          </span>
          {p.streaming && (
            <button
              type="button"
              onClick={p.onAbort}
              disabled={!p.activeRequestId}
              className="h-7 px-2 rounded-md bg-bad/10 border border-bad/20 text-[10px] font-semibold text-bad hover:text-bad/80 transition-colors cursor-pointer disabled:opacity-40 flex items-center gap-1.5"
            >
              <X className="w-3.5 h-3.5" /> Parar
            </button>
          )}
          <button
            type="button"
            onClick={p.onExpandedMode}
            className="h-7 px-2 rounded-md border border-line text-[10px] font-semibold text-mute hover:text-fg transition-colors cursor-pointer flex items-center gap-1.5"
            title="Abrir modo expandido"
          >
            <Maximize2 className="w-3.5 h-3.5" /> Expandido
          </button>
        </div>
      </div>

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
          chips={p.chips}
          onChipClick={p.onChipClick}
          onExecute={p.onExecute}
        />
      </div>
    </div>
  );
}

function TaskActiveView(p: Props) {
  return (
    <div
      className={
        p.expandedMode
          ? "min-h-full grid grid-cols-[minmax(0,1fr)_340px] gap-4 items-start"
          : "min-h-full flex flex-col gap-4"
      }
    >
      <div className={`${p.expandedMode ? "col-span-2" : ""} flex items-center justify-between gap-3`}>
        <button
          type="button"
          onClick={p.onNewTask}
          disabled={p.streaming}
          className="h-8 px-2.5 rounded-md border border-line text-[10px] font-semibold text-mute hover:text-fg hover:border-signal/30 transition-colors cursor-pointer disabled:opacity-40 flex items-center gap-1.5"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Nova tarefa
        </button>
        <div className="flex items-center gap-2">
          <span className="px-2 py-1 rounded-md bg-white/5 border border-line text-[10px] font-mono text-mute">
            {p.taskModeLabel}
          </span>
          <span
            className={`text-[10px] font-mono uppercase ${p.error ? "text-bad" : p.streaming ? "text-warn" : "text-good"}`}
          >
            {p.taskStatus}
          </span>
          {p.streaming && (
            <button
              type="button"
              onClick={p.onAbort}
              disabled={!p.activeRequestId}
              className="h-7 px-2 rounded-md bg-bad/10 border border-bad/20 text-[10px] font-semibold text-bad hover:text-bad/80 transition-colors cursor-pointer disabled:opacity-40 flex items-center gap-1.5"
            >
              <X className="w-3.5 h-3.5" /> Parar
            </button>
          )}
          <button
            type="button"
            onClick={p.onExpandedMode}
            className="h-7 px-2 rounded-md border border-line text-[10px] font-semibold text-mute hover:text-fg transition-colors cursor-pointer flex items-center gap-1.5"
            title="Abrir modo expandido"
          >
            <Maximize2 className="w-3.5 h-3.5" /> Expandido
          </button>
        </div>
      </div>

      <section
        className={`rounded-2xl bg-white/[0.03] p-4 flex flex-col gap-3 ${p.expandedMode ? "" : "border border-line"}`}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[10px] text-mute font-medium tracking-tight mb-1">Pedido</div>
            <p className="text-sm leading-relaxed text-fg select-text whitespace-pre-wrap">{p.query}</p>
          </div>
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${p.error ? "bg-bad/10 text-bad" : p.streaming ? "bg-warn/10 text-warn" : "bg-good/10 text-good"}`}
          >
            {p.streaming ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : p.error ? (
              <AlertCircle className="w-4 h-4" />
            ) : (
              <Check className="w-4 h-4" />
            )}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {["Preparando", "Pensando", "Resultado"].map((step, i) => {
            const active =
              (i === 0 && !p.result && !p.error) ||
              (i === 1 && p.streaming) ||
              (i === 2 && (Boolean(p.result) || Boolean(p.error)));
            return (
              <div
                key={step}
                className={`h-1.5 rounded-full transition-colors ${active ? (p.error && i === 2 ? "bg-bad" : p.streaming && i === 1 ? "bg-warn" : "bg-signal") : "bg-white/5"}`}
                title={step}
              />
            );
          })}
        </div>
      </section>

      {p.workflowSteps.length > 0 && (
        <section
          className={`${p.expandedMode ? "col-start-2 row-span-2" : ""} rounded-xl border border-line p-3 flex flex-col gap-2.5 bg-white/[0.02]`}
        >
          <div className="flex items-center justify-between">
            <div className="text-[10px] text-mute font-medium tracking-tight flex items-center gap-1.5">
              <Workflow className="w-3.5 h-3.5 text-signal" /> Passos
            </div>
            <span className="text-[9px] text-faint font-mono">{p.workflowSteps.length} passos</span>
          </div>
          <div className="grid gap-2">
            {p.workflowSteps.map((step) => (
              <div
                key={step.id}
                className="grid grid-cols-[18px_1fr_auto] items-start gap-2 rounded-lg bg-white/[0.03] px-2.5 py-2"
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
                <span className="text-[9px] font-mono uppercase text-faint">{step.kind}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {p.approval && (
        <section
          className={`${p.expandedMode ? "col-start-2" : ""} rounded-xl bg-signal/10 border border-signal/30 p-3.5 flex flex-col gap-3`}
        >
          <div className="flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-signal mt-0.5 shrink-0" />
            <div className="min-w-0">
              <div className="text-xs font-semibold text-signal">Aprovação necessária</div>
              <p className="text-[11px] text-signal/80 leading-relaxed mt-1">
                {p.approval.reason} Permissão: {p.approval.permissionLevel}.
              </p>
              <p className="text-[10px] text-faint mt-1 truncate">{p.approval.inputPreview}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => p.onApproval(true)}
              disabled={p.streaming}
              className="h-8 px-3 rounded-md bg-signal text-ink text-[11px] font-bold hover:brightness-110 transition-colors cursor-pointer disabled:opacity-50"
            >
              Aprovar e continuar
            </button>
            <button
              type="button"
              onClick={() => p.onApproval(false)}
              disabled={p.streaming}
              className="h-8 px-3 rounded-md border border-line text-[11px] font-semibold text-mute hover:text-fg transition-colors cursor-pointer disabled:opacity-50"
            >
              Recusar
            </button>
          </div>
        </section>
      )}

      {p.visibleLogs.length > 0 && (
        <section
          className={`${p.expandedMode ? "col-start-2" : ""} rounded-xl bg-white/[0.02] p-3 flex flex-col gap-2 border border-line`}
        >
          <div className="text-[10px] text-mute font-medium tracking-tight">Atividade</div>
          {p.visibleLogs.map((log) => (
            <div key={log.id} className="flex items-start gap-2.5 min-w-0">
              <span
                className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${log.type === "tool_fail" ? "bg-bad" : log.type === "tool_start" ? "bg-warn animate-pulse" : log.type === "tool_complete" ? "bg-good" : "bg-signal"}`}
              />
              <p className="text-xs text-mute leading-relaxed truncate min-w-0">{log.text}</p>
            </div>
          ))}
        </section>
      )}

      {p.error && (
        <section className="p-3.5 bg-bad/10 rounded-xl text-bad text-xs flex gap-2.5 items-start border border-bad/20">
          <AlertCircle className="w-4 h-4 text-bad flex-shrink-0 mt-0.5" />
          <div className="select-text">
            <strong className="font-bold mr-1">Erro:</strong>
            {p.error}
          </div>
        </section>
      )}

      <section
        className={`${p.expandedMode ? "min-h-[480px]" : "flex-1 min-h-[260px]"} rounded-2xl bg-white/[0.03] overflow-hidden flex flex-col border border-line`}
      >
        <div className="px-4 py-3 flex items-center justify-between bg-white/[0.03]">
          <span className="text-[10px] text-mute font-medium tracking-tight">
            {p.streaming ? "Resposta" : "Resultado"}
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
        <div className="flex-1 p-4 text-sm text-fg leading-relaxed whitespace-pre-wrap overflow-y-auto select-text">
          {p.result ? (
            <>
              {p.result}
              {p.streaming && (
                <span className="inline-block w-1.5 h-4 ml-1 align-[-2px] rounded-sm bg-warn animate-pulse" />
              )}
            </>
          ) : (
            <span className="text-faint">A resposta aparece aqui assim que o agente começar a escrever.</span>
          )}
        </div>
      </section>
    </div>
  );
}

function CommandIdleView(p: Props) {
  return (
    <div
      className={
        p.expandedMode ? "grid grid-cols-[340px_minmax(0,1fr)] gap-4 items-start" : "flex flex-col gap-4"
      }
    >
      <section
        className={`${p.expandedMode ? "col-span-2" : ""} rounded-xl border border-line p-1 grid grid-cols-2 gap-1`}
      >
        <button
          type="button"
          onClick={() => p.setExecutionMode("simple")}
          className={`min-h-12 rounded-lg px-3 text-left transition-colors cursor-pointer ${p.executionMode === "simple" ? "bg-white/8 text-fg" : "text-mute hover:text-fg"}`}
        >
          <div className="text-xs font-semibold">Simples</div>
          <div className="text-[10px] text-faint">Resposta rápida</div>
        </button>
        <button
          type="button"
          onClick={() => p.setExecutionMode("workflow")}
          className={`min-h-12 rounded-lg px-3 text-left transition-colors cursor-pointer ${p.executionMode === "workflow" ? "bg-signal/15 text-signal border border-signal/30" : "text-mute hover:text-fg"}`}
        >
          <div className="text-xs font-semibold flex items-center gap-1.5">
            <Workflow className="w-3.5 h-3.5" /> Workflow
          </div>
          <div className="text-[10px] text-faint">Loop com plano e aprovação</div>
        </button>
      </section>

      <section
        className={`${p.expandedMode ? "col-span-2" : ""} rounded-xl border border-line px-3 py-2 flex items-center justify-between gap-3`}
      >
        <div className="min-w-0 flex items-center gap-2 overflow-hidden">
          <span className="text-[10px] font-mono uppercase text-faint shrink-0">MCPs</span>
          <div className="flex items-center gap-1.5 overflow-hidden">
            {p.connectors.slice(0, p.expandedMode ? 6 : 3).map((c) => (
              <span
                key={c.id}
                className={`px-2 py-1 rounded-md text-[9px] font-semibold whitespace-nowrap ${c.enabled ? "bg-good/10 text-good border border-good/20" : "bg-white/5 text-faint border border-line"}`}
              >
                {c.name}
              </span>
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={() => p.setMode("connectors")}
          className="h-7 px-2 rounded-md border border-line text-[10px] font-semibold text-mute hover:text-fg transition-colors cursor-pointer"
        >
          Gerenciar
        </button>
      </section>

      <section className={`${p.expandedMode ? "col-start-1" : ""} grid grid-cols-2 gap-2`}>
        <button
          type="button"
          onClick={() => p.setInputMode("free")}
          className={`min-h-16 rounded-xl border p-3 text-left transition-all cursor-pointer ${p.inputMode === "free" ? "border-signal/45 bg-signal/10 text-fg" : "border-line bg-white/[0.02] text-mute hover:text-fg"}`}
        >
          <Bot className="w-4 h-4 text-signal mb-2" />
          <div className="text-xs font-semibold">Conteúdo avulso</div>
          <div className="text-[10px] text-faint mt-0.5">Pergunta, plano ou rascunho</div>
        </button>
        <button
          type="button"
          onClick={() => p.setInputMode("clipboard")}
          className={`min-h-16 rounded-xl border p-3 text-left transition-all cursor-pointer ${p.inputMode === "clipboard" ? "border-good/45 bg-good/10 text-fg" : "border-line bg-white/[0.02] text-mute hover:text-fg"}`}
        >
          <Clipboard className={`w-4 h-4 mb-2 ${p.hasClipboard ? "text-good" : "text-faint"}`} />
          <div className="text-xs font-semibold">Clipboard</div>
          <div className="text-[10px] text-faint mt-0.5">
            {p.hasClipboard ? `${p.clipboardText.length} caracteres detectados` : "Copie texto para ativar"}
          </div>
        </button>
      </section>

      <div className={`${p.expandedMode ? "col-start-2 row-span-2" : ""} relative flex flex-col`}>
        <span className="text-[10px] text-faint font-mono uppercase mb-1 flex items-center gap-1.5 select-none">
          {p.inputMode === "clipboard" ? (
            <Clipboard className="w-3.5 h-3.5 text-good" />
          ) : (
            <Bot className="w-3.5 h-3.5 text-signal" />
          )}
          {p.inputModeLabel}
        </span>
        <Composer
          query={p.query}
          setQuery={p.setQuery}
          placeholder={p.composerPlaceholder}
          disabled={p.streaming}
          streaming={p.streaming}
          inputMode={p.inputMode}
          hasClipboard={p.hasClipboard}
          textareaRef={p.textareaRef}
          chips={p.chips}
          onChipClick={p.onChipClick}
          onExecute={p.onExecute}
        />
      </div>

      {p.inputMode === "clipboard" && (
        <section
          className={`${p.expandedMode ? "col-start-1" : ""} p-3.5 rounded-xl border border-line bg-white/[0.02] flex flex-col gap-3`}
        >
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-[10px] text-mute uppercase tracking-wider font-bold select-none">
              <Clipboard className={`w-3.5 h-3.5 ${p.hasClipboard ? "text-good" : "text-faint"}`} />
              {p.hasClipboard ? "Clipboard detectado" : "Sem clipboard"}
            </span>
            <span className="text-[9px] font-mono text-faint">
              {p.hasClipboard ? `${p.clipboardText.length} caracteres` : "aguardando"}
            </span>
          </div>
          <div className="bg-white/[0.03] border border-line rounded-lg p-2.5 text-[11px] text-mute leading-normal min-h-10 select-text">
            {p.hasClipboard
              ? `"${p.clipboardText.slice(0, 220)}${p.clipboardText.length > 220 ? "..." : ""}"`
              : "Copie um texto em qualquer app e volte para usar as ações de contexto."}
          </div>
        </section>
      )}

      <section className={`${p.expandedMode ? "col-start-2" : ""} flex flex-col gap-2`}>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-faint font-mono uppercase font-bold select-none">
            {p.inputMode === "clipboard" ? "Ações com clipboard" : "Ações livres"}
          </span>
          {p.inputMode === "clipboard" && !p.hasClipboard && (
            <span className="text-[10px] text-faint select-none">copie texto para liberar</span>
          )}
        </div>
        <div className="grid grid-cols-3 gap-2">
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
                className="min-h-[72px] rounded-lg border border-line text-mute hover:text-fg hover:border-signal/30 transition-all cursor-pointer flex flex-col items-start justify-center gap-1 px-2.5 py-2 text-left disabled:opacity-40 disabled:pointer-events-none"
                title={disabled ? "Copie um texto primeiro" : action.description}
              >
                <Icon className={`w-4 h-4 ${action.accent}`} />
                <span className="text-[10px] font-semibold leading-tight">{action.label}</span>
                <span className="text-[9px] text-faint leading-tight">{action.description}</span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
