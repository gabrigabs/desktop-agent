import { readText as readClipboard, writeText as writeClipboard } from "@tauri-apps/plugin-clipboard-manager";
import {
  AlertCircle,
  ArrowLeft,
  Bot,
  Check,
  CheckSquare,
  Clipboard,
  Clock,
  Database,
  Eye,
  EyeOff,
  FileText,
  KeyRound,
  Languages,
  Layers,
  Link,
  ListChecks,
  Maximize2,
  MessageSquare,
  PenLine,
  Play,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Workflow,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { getAgent } from "../../lib/rpc";
import { isTauriRuntime, setWindowMode } from "../../lib/window";
import { useAgentStore } from "../../stores/agent";
import { HistoryList } from "./history-list";

const GLOBAL_SHORTCUT_LABEL = "Control+Shift+Space";

type InputMode = "free" | "clipboard";

const PINSTRIPES_MODELS = [
  {
    id: "ps/warp",
    name: "Warp",
    description: "Rápido e melhor custo",
  },
  {
    id: "ps/thinking",
    name: "Thinking",
    description: "Raciocínio mais profundo",
  },
  {
    id: "ps/pro",
    name: "Pro",
    description: "Respostas mais deliberadas",
  },
];

const QUICK_ACTIONS = [
  {
    id: "melhorar",
    label: "Melhorar texto",
    description: "Clareza e tom",
    icon: Sparkles,
    accent: "text-amber-400",
    requiresClipboard: true,
    prompt: "Melhorar a clareza, tom e legibilidade deste texto",
  },
  {
    id: "resumir",
    label: "Resumir",
    description: "Bullets curtos",
    icon: FileText,
    accent: "text-sky-400",
    requiresClipboard: true,
    prompt: "Resumir este texto em tópicos concisos",
  },
  {
    id: "traduzir",
    label: "Traduzir",
    description: "Para inglês",
    icon: Languages,
    accent: "text-emerald-400",
    requiresClipboard: true,
    prompt: "Traduzir este texto para o inglês mantendo o tom original",
  },
  {
    id: "explicar",
    label: "Explicar",
    description: "Em linguagem simples",
    icon: Search,
    accent: "text-violet-400",
    requiresClipboard: true,
    prompt: "Explique este conteúdo em linguagem simples, com contexto e exemplos curtos",
  },
  {
    id: "tarefas",
    label: "Extrair tarefas",
    description: "Ações e donos",
    icon: ListChecks,
    accent: "text-lime-400",
    requiresClipboard: true,
    prompt:
      "Extraia tarefas acionáveis deste conteúdo, separando prioridade, responsável quando existir e próximo passo",
  },
  {
    id: "responder",
    label: "Responder",
    description: "Mensagem pronta",
    icon: MessageSquare,
    accent: "text-rose-400",
    requiresClipboard: true,
    prompt: "Escreva uma resposta curta, natural e educada para esta mensagem",
  },
];

const FREE_ACTIONS = [
  {
    id: "pesquisar-web",
    label: "Pesquisar web",
    description: "Jina + fontes",
    icon: Search,
    accent: "text-cyan-400",
    prompt: "Pesquise na web com fontes e próximos passos sobre: ",
    executionMode: "workflow",
  },
  {
    id: "ler-url",
    label: "Ler URL",
    description: "r.jina.ai",
    icon: Link,
    accent: "text-emerald-400",
    prompt: "Leia e extraia os pontos importantes desta URL: ",
    executionMode: "workflow",
  },
  {
    id: "ocr-tela",
    label: "Ler tela",
    description: "OCR com aprovação",
    icon: Eye,
    accent: "text-amber-400",
    prompt: "Use OCR para ler a tela e extrair tarefas acionáveis",
    executionMode: "workflow",
  },
  {
    id: "pergunta",
    label: "Pergunta livre",
    description: "Sem contexto",
    icon: Bot,
    accent: "text-violet-400",
    prompt: "",
  },
  {
    id: "plano",
    label: "Montar plano",
    description: "Passos claros",
    icon: CheckSquare,
    accent: "text-emerald-400",
    prompt: "Monte um plano prático para: ",
  },
  {
    id: "rascunho",
    label: "Rascunhar texto",
    description: "Primeira versão",
    icon: PenLine,
    accent: "text-sky-400",
    prompt: "Rascunhe um texto curto sobre: ",
  },
  {
    id: "checklist",
    label: "Checklist",
    description: "Itens acionáveis",
    icon: ListChecks,
    accent: "text-lime-400",
    prompt: "Transforme este objetivo em uma checklist prática: ",
  },
  {
    id: "ideias",
    label: "Explorar ideias",
    description: "Opções úteis",
    icon: Sparkles,
    accent: "text-amber-400",
    prompt: "Liste ideias práticas e diferentes para: ",
  },
  {
    id: "decidir",
    label: "Comparar opções",
    description: "Prós e contras",
    icon: Layers,
    accent: "text-fuchsia-400",
    prompt: "Compare as opções e recomende um caminho para: ",
  },
];

export function CommandPalette() {
  const {
    query,
    result,
    streaming,
    error,
    setQuery,
    setResult,
    setStreaming,
    setError,
    setClipboardText,
    clipboardText,
    reset,
    setUiMode,
    settings,
    setSettings,
    agentLogs,
    addAgentLog,
    clearAgentLogs,
    executionMode,
    setExecutionMode,
    workflowRun,
    setWorkflowRun,
    connectors,
    setConnectors,
    uiMode,
  } = useAgentStore();

  const [mode, setMode] = useState<"command" | "history" | "connectors">("command");
  const [inputMode, setInputMode] = useState<InputMode>("free");
  const [activeTaskMode, setActiveTaskMode] = useState<InputMode>("free");
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [showKey, setShowKey] = useState<boolean>(false);

  // Local state for Settings form
  const [formProvider, setFormProvider] = useState(settings.activeProvider);
  const [formApiKey, setFormApiKey] = useState(settings.apiKey);
  const [formBaseUrl, setFormBaseUrl] = useState(settings.baseUrl);
  const [formModel, setFormModel] = useState(settings.model);
  const [formHidePet, setFormHidePet] = useState(settings.hidePet);
  const [formTimeout, setFormTimeout] = useState(settings.timeout || 120);

  const [fetchedModels, setFetchedModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [copied, setCopied] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [testingConnectorId, setTestingConnectorId] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync settings when panel opens
  useEffect(() => {
    if (showSettings) {
      setFormProvider(settings.activeProvider);
      setFormApiKey(settings.apiKey);
      setFormBaseUrl(settings.baseUrl);
      setFormModel(settings.model);
      setFormHidePet(settings.hidePet);
      setFormTimeout(settings.timeout || 120);
    }
  }, [showSettings, settings]);

  const refreshCapabilities = useCallback(async () => {
    try {
      const api = await getAgent();
      const capabilities = await api.listCapabilities();
      setConnectors(capabilities.connectors);
    } catch (err) {
      console.error("Failed to refresh capabilities:", err);
    }
  }, [setConnectors]);

  useEffect(() => {
    refreshCapabilities();
  }, [refreshCapabilities]);

  // Load and check clipboard content on mount/focus
  const checkClipboard = useCallback(async () => {
    if (!isTauriRuntime()) {
      setClipboardText("");
      return;
    }

    try {
      const text = await readClipboard();
      setClipboardText(text ?? "");
    } catch (err) {
      console.error("Erro ao ler clipboard:", err);
    }
  }, [setClipboardText]);

  useEffect(() => {
    checkClipboard();
    window.addEventListener("focus", checkClipboard);
    return () => window.removeEventListener("focus", checkClipboard);
  }, [checkClipboard]);

  // Fetch models dynamically when provider or credentials change
  useEffect(() => {
    if (formProvider === "mock" || formProvider === "pinstripes") {
      setFetchedModels([]);
      return;
    }

    if (!formApiKey) {
      setFetchedModels([]);
      return;
    }

    let active = true;
    async function fetchModels() {
      setLoadingModels(true);
      try {
        const api = await getAgent();
        const models = await api.fetchModels(formProvider, formApiKey, formBaseUrl);
        if (active) {
          setFetchedModels(models);
          if (!models.includes(formModel) && models.length > 0) {
            setFormModel(models[0] || "");
          }
        }
      } catch (err) {
        console.error("Failed to fetch models dynamically:", err);
      } finally {
        if (active) setLoadingModels(false);
      }
    }

    const timer = setTimeout(fetchModels, 500);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [formProvider, formApiKey, formBaseUrl, formModel]);

  const handleExecute = useCallback(
    async (forceInstruction?: string, forceInputMode?: InputMode) => {
      const activeQuery = forceInstruction || query;
      if (!activeQuery.trim()) return;

      const sourceMode = forceInputMode || inputMode;
      setResult(null);
      setError(null);
      setStreaming(true);
      setActiveTaskMode(sourceMode);
      setWorkflowRun(null);
      clearAgentLogs();

      let requestId: string | null = null;
      let runId: string | null = null;
      try {
        const api = await getAgent();
        const clipboardContent =
          sourceMode === "clipboard" ? (isTauriRuntime() ? await readClipboard() : clipboardText) : "";
        if (sourceMode === "clipboard") {
          setClipboardText(clipboardContent);
        }

        if (sourceMode === "clipboard" && !clipboardContent.trim()) {
          throw new Error("Não há texto no clipboard para usar nesta tarefa.");
        }

        requestId = crypto.randomUUID();
        setActiveRequestId(requestId);
        setActiveRunId(null);

        const res = await api.startRun({
          requestId,
          prompt: activeQuery,
          mode: executionMode,
          sourceMode,
          clipboardText: clipboardContent,
          maxSteps: executionMode === "workflow" ? 8 : 1,
        });

        runId = res.run.id;
        setActiveRunId(runId);
        setWorkflowRun(res.run);
        setResult(res.run.result || "");
        if (res.run.status === "failed" || res.run.status === "cancelled") {
          setError(res.run.errorMessage || "Workflow encerrado sem resultado.");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao executar comando");
        addAgentLog({ type: "tool_fail", text: err instanceof Error ? err.message : String(err) });
      } finally {
        setStreaming(false);
        setActiveRequestId((current) => (current === requestId ? null : current));
        setActiveRunId((current) => (current === runId ? null : current));
      }
    },
    [
      query,
      inputMode,
      executionMode,
      clipboardText,
      setClipboardText,
      setError,
      setResult,
      setStreaming,
      setWorkflowRun,
      clearAgentLogs,
      addAgentLog,
    ],
  );

  const handleCopyResult = useCallback(async () => {
    if (result) {
      if (isTauriRuntime()) {
        await writeClipboard(result);
      } else {
        await navigator.clipboard?.writeText(result);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [result]);

  const handleAbort = useCallback(async () => {
    const runId = activeRunId || workflowRun?.id;
    if (!activeRequestId && !runId) return;

    try {
      const api = await getAgent();
      if (runId) {
        await api.cancelRun({ runId });
      } else if (activeRequestId) {
        await api.cancelAgent({ requestId: activeRequestId });
      }
    } catch (err) {
      console.error("Failed to cancel request:", err);
    } finally {
      setError("Execução abortada pelo usuário.");
      setStreaming(false);
      addAgentLog({ type: "tool_fail", text: "Execução abortada pelo usuário" });
      setActiveRequestId(null);
      setActiveRunId(null);
    }
  }, [activeRequestId, activeRunId, workflowRun?.id, setError, setStreaming, addAgentLog]);

  const handleApproval = useCallback(
    async (approved: boolean) => {
      if (!workflowRun) return;

      const requestId = crypto.randomUUID();
      setActiveRequestId(requestId);
      setActiveRunId(workflowRun.id);
      setStreaming(approved);
      setError(null);

      try {
        const api = await getAgent();
        const res = await api.resumeRun({ requestId, runId: workflowRun.id, approved });
        setWorkflowRun(res.run);
        setResult(res.run.result || "");
        if (res.run.status === "failed" || res.run.status === "cancelled") {
          setError(res.run.errorMessage || "Workflow encerrado.");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao retomar workflow");
        addAgentLog({ type: "tool_fail", text: err instanceof Error ? err.message : String(err) });
      } finally {
        setStreaming(false);
        setActiveRequestId((current) => (current === requestId ? null : current));
        setActiveRunId((current) => (current === workflowRun.id ? null : current));
      }
    },
    [workflowRun, setError, setResult, setStreaming, setWorkflowRun, addAgentLog],
  );

  const handleQuickAction = async (actionId: string) => {
    const action = QUICK_ACTIONS.find((item) => item.id === actionId);
    if (!action) return;

    setInputMode("clipboard");
    setQuery(action.prompt);
    await handleExecute(action.prompt, "clipboard");
  };

  const handleStarterAction = (prompt: string, modeOverride?: "simple" | "workflow") => {
    setInputMode("free");
    if (modeOverride) {
      setExecutionMode(modeOverride);
    }
    setQuery(prompt);
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
  };

  const handleNewTask = () => {
    reset();
    setWorkflowRun(null);
    setActiveRunId(null);
    setMode("command");
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
  };

  const handleWorkspaceMode = async () => {
    const nextMode = uiMode === "workspace" ? "expanded" : "workspace";
    setUiMode(nextMode);
    await setWindowMode(nextMode);
  };

  const handleToggleConnector = async (connectorId: string) => {
    const connector = connectors.find((item) => item.id === connectorId);
    if (!connector?.command) return;

    try {
      const api = await getAgent();
      await api.saveMcpServer({
        server: {
          id: connector.id,
          name: connector.name,
          command: connector.command,
          args: connector.args,
          enabled: !connector.enabled,
          preset: connector.preset,
          permissionPolicy: connector.permissionPolicy,
        },
      });
      await refreshCapabilities();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao atualizar conector");
    }
  };

  const handleTestConnector = async (connectorId: string) => {
    setTestingConnectorId(connectorId);
    try {
      const api = await getAgent();
      const result = await api.testMcpServer({ id: connectorId });
      if (!result.ok) {
        addAgentLog({ type: "tool_fail", text: result.error || "Conector não passou no teste" });
      } else {
        addAgentLog({ type: "info", text: "Conector pronto" });
      }
      await refreshCapabilities();
    } catch (err) {
      addAgentLog({ type: "tool_fail", text: err instanceof Error ? err.message : String(err) });
    } finally {
      setTestingConnectorId(null);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const api = await getAgent();
      const newSettings = {
        activeProvider: formProvider,
        apiKey: formApiKey,
        baseUrl: formBaseUrl,
        model: formProvider === "pinstripes" ? formModel || "ps/warp" : formModel,
        hidePet: formHidePet,
        timeout: Number(formTimeout),
      };
      await api.saveSettings(newSettings);
      setSettings(newSettings);
      setShowSettings(false);
    } catch (err) {
      console.error("Failed to save settings:", err);
    } finally {
      setSavingSettings(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (!streaming && !showSettings) {
          handleExecute();
        }
      }
      if (e.key === "Escape") {
        if (showSettings) {
          setShowSettings(false);
        } else if (query || result || error) {
          reset();
        } else {
          setUiMode("collapsed");
          await setWindowMode("collapsed");
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleExecute, streaming, query, result, error, reset, setUiMode, showSettings]);

  useEffect(() => {
    if (mode === "command" && textareaRef.current && !showSettings) {
      textareaRef.current.focus();
    }
  }, [mode, showSettings]);

  // Display name of active provider/model
  const getActiveBadgeText = () => {
    if (settings.activeProvider === "mock") return "Provedor Local (Mock)";
    if (settings.activeProvider === "pinstripes") {
      const model = PINSTRIPES_MODELS.find((item) => item.id === settings.model);
      return `Pinstripes · ${model?.name ?? (settings.model || "Warp")}`;
    }
    const name = settings.activeProvider.toUpperCase();
    const model = settings.model ? `: ${settings.model}` : "";
    return `${name}${model}`;
  };

  const hasClipboard = clipboardText.trim().length > 0;
  const taskActive =
    streaming || result !== null || Boolean(error) || agentLogs.length > 0 || Boolean(workflowRun);
  const latestLog = agentLogs.length > 0 ? agentLogs[agentLogs.length - 1] : undefined;
  const visibleLogs = agentLogs.slice(-4).reverse();
  const inputModeLabel = inputMode === "clipboard" ? "Interagir com clipboard" : "Conteúdo avulso";
  const taskModeLabel = `${executionMode === "workflow" ? "Workflow" : "Simples"} · ${
    activeTaskMode === "clipboard" ? "Clipboard" : "Livre"
  }`;
  const composerPlaceholder =
    inputMode === "clipboard"
      ? "Diga o que fazer com o texto copiado."
      : "Pergunte algo, peça um rascunho ou comece por uma ação abaixo.";
  const taskStatus =
    workflowRun?.status === "waiting_approval"
      ? "Aguardando aprovação"
      : error
        ? "Algo falhou"
        : streaming
          ? latestLog?.type === "tool_start"
            ? "Usando ferramenta"
            : "Pensando"
          : result
            ? "Resultado pronto"
            : "Preparando";
  const workflowSteps = workflowRun?.steps ?? [];
  const approval = workflowRun?.approval;
  const visibleConnectors = connectors.slice(0, 7);
  const workspaceMode = uiMode === "workspace";

  return (
    <div className="flex flex-col h-full w-full bg-zinc-950/20 text-zinc-100 font-sans relative">
      <div className="px-4 pt-3 pb-2">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] font-mono uppercase text-zinc-500">Modelo ativo</div>
            <div className="truncate text-xs font-semibold text-zinc-100 select-all">
              {getActiveBadgeText()}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowSettings(true)}
            className="px-2.5 py-1.5 rounded-md bg-zinc-900/70 border border-zinc-800 text-[10px] font-semibold text-zinc-300 hover:text-zinc-100 hover:border-violet-500/40 transition-colors cursor-pointer"
          >
            Configurar
          </button>
        </div>
        <div
          className={`mt-2 h-0.5 rounded-full ${
            streaming
              ? "bg-amber-400 animate-pulse"
              : result
                ? "bg-emerald-400"
                : error
                  ? "bg-rose-400"
                  : "bg-violet-400/70"
          }`}
        />
      </div>

      <div className="flex items-center justify-between px-4 py-2 border-y border-zinc-900/60 bg-zinc-950/25">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setMode("command")}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-200 cursor-pointer ${
              mode === "command"
                ? "bg-zinc-800 text-zinc-100 border border-zinc-700/70"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            Perguntar
          </button>
          <button
            type="button"
            onClick={() => setMode("history")}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-200 cursor-pointer ${
              mode === "history"
                ? "bg-zinc-800 text-zinc-100 border border-zinc-700/70"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            Histórico
          </button>
          <button
            type="button"
            onClick={() => setMode("connectors")}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-200 cursor-pointer ${
              mode === "connectors"
                ? "bg-zinc-800 text-zinc-100 border border-zinc-700/70"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            Conectores
          </button>
        </div>
        <button
          type="button"
          onClick={() => setShowSettings(!showSettings)}
          className={`p-1.5 rounded-md transition-colors cursor-pointer border border-transparent hover:border-zinc-800 ${
            showSettings ? "text-violet-300 bg-zinc-800/60" : "text-zinc-500 hover:text-zinc-300"
          }`}
          title="Configurações"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {/* Tab Contents */}
      <div className={`flex-1 overflow-y-auto custom-scrollbar ${workspaceMode ? "p-5" : "p-4"}`}>
        {mode === "command" ? (
          taskActive ? (
            <div
              className={
                workspaceMode
                  ? "min-h-full grid grid-cols-[minmax(0,1fr)_340px] gap-4 items-start"
                  : "min-h-full flex flex-col gap-4"
              }
            >
              <div className={`${workspaceMode ? "col-span-2" : ""} flex items-center justify-between gap-3`}>
                <button
                  type="button"
                  onClick={handleNewTask}
                  disabled={streaming}
                  className="h-8 px-2.5 rounded-md bg-zinc-900/80 border border-zinc-800 text-[10px] font-semibold text-zinc-400 hover:text-zinc-100 hover:border-violet-500/30 transition-colors cursor-pointer disabled:opacity-40 disabled:pointer-events-none flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Nova tarefa
                </button>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-1 rounded-md bg-zinc-950/70 border border-zinc-800 text-[10px] font-mono uppercase tracking-wider text-zinc-400">
                    {taskModeLabel}
                  </span>
                  <span
                    className={`text-[10px] font-mono uppercase tracking-wider ${
                      error ? "text-rose-300" : streaming ? "text-amber-300" : "text-emerald-300"
                    }`}
                  >
                    {taskStatus}
                  </span>
                  {streaming && (
                    <button
                      type="button"
                      onClick={handleAbort}
                      disabled={!activeRequestId}
                      className="h-7 px-2 rounded-md bg-rose-950/25 border border-rose-900/40 text-[10px] font-semibold text-rose-300 hover:text-rose-100 hover:border-rose-500/50 transition-colors cursor-pointer disabled:opacity-40 disabled:pointer-events-none flex items-center gap-1.5"
                    >
                      <X className="w-3.5 h-3.5" />
                      Parar
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleWorkspaceMode}
                    className={`h-7 px-2 rounded-md border text-[10px] font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                      uiMode === "workspace"
                        ? "bg-violet-950/30 border-violet-700/50 text-violet-200"
                        : "bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:text-zinc-100"
                    }`}
                    title={uiMode === "workspace" ? "Voltar ao painel compacto" : "Abrir workspace"}
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                    Workspace
                  </button>
                </div>
              </div>

              <section className="rounded-2xl bg-zinc-950/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-[10px] text-zinc-500 font-mono font-bold uppercase mb-1">Pedido</div>
                    <p className="text-sm leading-relaxed text-zinc-100 select-text whitespace-pre-wrap">
                      {query}
                    </p>
                  </div>
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      error
                        ? "bg-rose-950/45 text-rose-300"
                        : streaming
                          ? "bg-amber-950/45 text-amber-300"
                          : "bg-emerald-950/45 text-emerald-300"
                    }`}
                  >
                    {streaming ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : error ? (
                      <AlertCircle className="w-4 h-4" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {["Preparando", "Pensando", "Resultado"].map((step, index) => {
                    const active =
                      (index === 0 && !result && !error) ||
                      (index === 1 && streaming) ||
                      (index === 2 && (Boolean(result) || Boolean(error)));

                    return (
                      <div
                        key={step}
                        className={`h-1.5 rounded-full transition-colors ${
                          active
                            ? error && index === 2
                              ? "bg-rose-400"
                              : streaming && index === 1
                                ? "bg-amber-400"
                                : "bg-violet-400"
                            : "bg-zinc-800"
                        }`}
                        title={step}
                      />
                    );
                  })}
                </div>
              </section>

              {workflowSteps.length > 0 && (
                <section
                  className={`${workspaceMode ? "col-start-2 row-span-2" : ""} rounded-xl bg-zinc-950/55 border border-zinc-900/70 p-3 flex flex-col gap-2.5`}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] text-zinc-500 font-mono uppercase font-bold flex items-center gap-1.5">
                      <Workflow className="w-3.5 h-3.5 text-violet-300" />
                      Timeline
                    </div>
                    <span className="text-[9px] text-zinc-600 font-mono">{workflowSteps.length} passos</span>
                  </div>
                  <div className="grid gap-2">
                    {workflowSteps.map((step) => (
                      <div
                        key={step.id}
                        className="grid grid-cols-[18px_1fr_auto] items-start gap-2 rounded-lg bg-zinc-900/45 px-2.5 py-2"
                      >
                        <span
                          className={`mt-1.5 w-2 h-2 rounded-full ${
                            step.status === "completed"
                              ? "bg-emerald-400"
                              : step.status === "running"
                                ? "bg-amber-400 animate-pulse"
                                : step.status === "waiting_approval"
                                  ? "bg-violet-400 animate-pulse"
                                  : step.status === "failed"
                                    ? "bg-rose-400"
                                    : "bg-zinc-700"
                          }`}
                        />
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-zinc-200 truncate">{step.title}</div>
                          <div className="text-[10px] text-zinc-500 leading-relaxed line-clamp-2">
                            {step.detail || step.kind}
                          </div>
                        </div>
                        <span className="text-[9px] font-mono uppercase text-zinc-600">{step.kind}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {approval && (
                <section
                  className={`${workspaceMode ? "col-start-2" : ""} rounded-xl bg-violet-950/20 border border-violet-800/40 p-3.5 flex flex-col gap-3`}
                >
                  <div className="flex items-start gap-2.5">
                    <ShieldCheck className="w-4.5 h-4.5 text-violet-300 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-violet-100">Aprovação necessária</div>
                      <p className="text-[11px] text-violet-200/80 leading-relaxed mt-1">
                        {approval.reason} Permissão: {approval.permissionLevel}.
                      </p>
                      <p className="text-[10px] text-zinc-500 mt-1 truncate">{approval.inputPreview}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleApproval(true)}
                      disabled={streaming}
                      className="h-8 px-3 rounded-md bg-violet-500 text-zinc-950 text-[11px] font-bold hover:bg-violet-300 transition-colors cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
                    >
                      Aprovar e continuar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApproval(false)}
                      disabled={streaming}
                      className="h-8 px-3 rounded-md bg-zinc-950/70 border border-zinc-800 text-[11px] font-semibold text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
                    >
                      Recusar
                    </button>
                  </div>
                </section>
              )}

              {visibleLogs.length > 0 && (
                <section
                  className={`${workspaceMode ? "col-start-2" : ""} rounded-xl bg-zinc-950/45 p-3 flex flex-col gap-2`}
                >
                  <div className="text-[10px] text-zinc-500 font-mono uppercase font-bold">
                    Execução ao vivo
                  </div>
                  {visibleLogs.map((log) => (
                    <div key={log.id} className="flex items-start gap-2.5 min-w-0">
                      <span
                        className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${
                          log.type === "tool_fail"
                            ? "bg-rose-400"
                            : log.type === "tool_start"
                              ? "bg-amber-400 animate-pulse"
                              : log.type === "tool_complete"
                                ? "bg-emerald-400"
                                : "bg-violet-400"
                        }`}
                      />
                      <p className="text-xs text-zinc-300 leading-relaxed truncate min-w-0">{log.text}</p>
                    </div>
                  ))}
                </section>
              )}

              {error && (
                <section className="p-3.5 bg-rose-950/20 rounded-xl text-rose-300 text-xs flex gap-2.5 items-start">
                  <AlertCircle className="w-4.5 h-4.5 text-rose-500 flex-shrink-0 mt-0.5" />
                  <div className="select-text">
                    <strong className="text-rose-400 font-bold mr-1">Erro:</strong>
                    {error}
                  </div>
                </section>
              )}

              <section
                className={`${workspaceMode ? "min-h-[480px]" : "flex-1 min-h-[260px]"} rounded-2xl bg-zinc-950/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] overflow-hidden flex flex-col`}
              >
                <div className="px-4 py-3 flex items-center justify-between bg-zinc-900/40">
                  <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">
                    {streaming ? "Resposta em andamento" : "Resultado"}
                  </span>
                  {result && (
                    <button
                      type="button"
                      onClick={handleCopyResult}
                      className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all duration-150 active:scale-95 cursor-pointer flex items-center gap-1.5 ${
                        copied
                          ? "bg-emerald-950/40 text-emerald-300"
                          : "bg-zinc-950/80 text-zinc-300 hover:text-zinc-100"
                      }`}
                    >
                      {copied ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Clipboard className="w-3.5 h-3.5 text-violet-300" />
                      )}
                      <span>{copied ? "Copiado" : "Copiar"}</span>
                    </button>
                  )}
                </div>
                <div className="flex-1 p-4 text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap overflow-y-auto custom-scrollbar select-text selection:bg-violet-950">
                  {result ? (
                    <>
                      {result}
                      {streaming && (
                        <span className="inline-block w-1.5 h-4 ml-1 align-[-2px] rounded-sm bg-amber-300 animate-pulse" />
                      )}
                    </>
                  ) : (
                    <span className="text-zinc-600">
                      A resposta aparece aqui assim que o agente começar a escrever.
                    </span>
                  )}
                </div>
              </section>
            </div>
          ) : (
            <div
              className={
                workspaceMode
                  ? "grid grid-cols-[340px_minmax(0,1fr)] gap-4 items-start"
                  : "flex flex-col gap-4"
              }
            >
              <section
                className={`${workspaceMode ? "col-span-2" : ""} rounded-xl bg-zinc-950/65 border border-zinc-900 p-1 grid grid-cols-2 gap-1`}
              >
                <button
                  type="button"
                  onClick={() => setExecutionMode("simple")}
                  className={`min-h-12 rounded-lg px-3 text-left transition-colors cursor-pointer ${
                    executionMode === "simple"
                      ? "bg-zinc-800 text-zinc-100"
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  <div className="text-xs font-semibold">Simples</div>
                  <div className="text-[10px] text-zinc-600">Resposta rápida</div>
                </button>
                <button
                  type="button"
                  onClick={() => setExecutionMode("workflow")}
                  className={`min-h-12 rounded-lg px-3 text-left transition-colors cursor-pointer ${
                    executionMode === "workflow"
                      ? "bg-violet-950/35 text-violet-100 border border-violet-800/30"
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  <div className="text-xs font-semibold flex items-center gap-1.5">
                    <Workflow className="w-3.5 h-3.5" />
                    Workflow
                  </div>
                  <div className="text-[10px] text-zinc-600">Loop com plano e aprovação</div>
                </button>
              </section>

              <section
                className={`${workspaceMode ? "col-span-2" : ""} rounded-xl bg-zinc-950/45 border border-zinc-900 px-3 py-2 flex items-center justify-between gap-3`}
              >
                <div className="min-w-0 flex items-center gap-2 overflow-hidden">
                  <span className="text-[10px] font-mono uppercase text-zinc-500 shrink-0">MCPs</span>
                  <div className="flex items-center gap-1.5 overflow-hidden">
                    {visibleConnectors.slice(0, workspaceMode ? 6 : 3).map((connector) => (
                      <span
                        key={connector.id}
                        className={`px-2 py-1 rounded-md text-[9px] font-semibold whitespace-nowrap ${
                          connector.enabled
                            ? "bg-emerald-950/30 text-emerald-300 border border-emerald-800/30"
                            : "bg-zinc-900 text-zinc-500 border border-zinc-800"
                        }`}
                      >
                        {connector.name}
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setMode("connectors")}
                  className="h-7 px-2 rounded-md bg-zinc-900 border border-zinc-800 text-[10px] font-semibold text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer"
                >
                  Gerenciar
                </button>
              </section>

              <section className={`${workspaceMode ? "col-start-1" : ""} grid grid-cols-2 gap-2`}>
                <button
                  type="button"
                  onClick={() => setInputMode("free")}
                  className={`min-h-16 rounded-xl border p-3 text-left transition-all cursor-pointer ${
                    inputMode === "free"
                      ? "border-violet-500/45 bg-violet-950/20 text-zinc-100"
                      : "border-zinc-900 bg-zinc-950/50 text-zinc-500 hover:text-zinc-300 hover:border-zinc-800"
                  }`}
                >
                  <Bot className="w-4 h-4 text-violet-300 mb-2" />
                  <div className="text-xs font-semibold">Conteúdo avulso</div>
                  <div className="text-[10px] text-zinc-600 mt-0.5">Pergunta, plano ou rascunho</div>
                </button>
                <button
                  type="button"
                  onClick={() => setInputMode("clipboard")}
                  className={`min-h-16 rounded-xl border p-3 text-left transition-all cursor-pointer ${
                    inputMode === "clipboard"
                      ? "border-emerald-500/45 bg-emerald-950/15 text-zinc-100"
                      : "border-zinc-900 bg-zinc-950/50 text-zinc-500 hover:text-zinc-300 hover:border-zinc-800"
                  }`}
                >
                  <Clipboard
                    className={`w-4 h-4 mb-2 ${hasClipboard ? "text-emerald-300" : "text-zinc-600"}`}
                  />
                  <div className="text-xs font-semibold">Clipboard</div>
                  <div className="text-[10px] text-zinc-600 mt-0.5">
                    {hasClipboard
                      ? `${clipboardText.length} caracteres detectados`
                      : "Copie texto para ativar"}
                  </div>
                </button>
              </section>

              <div
                className={`${workspaceMode ? "col-start-2 row-span-2" : ""} relative group flex flex-col`}
              >
                <span className="text-[10px] text-zinc-500 font-mono font-bold uppercase mb-1 flex items-center gap-1.5 select-none">
                  {inputMode === "clipboard" ? (
                    <Clipboard className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Bot className="w-3.5 h-3.5 text-violet-400" />
                  )}
                  {inputModeLabel}
                </span>
                <div className="relative w-full">
                  <textarea
                    ref={textareaRef}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={composerPlaceholder}
                    className="w-full min-h-[104px] bg-zinc-950/70 border border-zinc-900 rounded-xl pl-3 pr-12 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-950/50 resize-none transition-all duration-200 select-text"
                    disabled={streaming}
                    aria-label={inputModeLabel}
                    rows={3}
                  />
                  <button
                    type="button"
                    onClick={() => handleExecute()}
                    disabled={streaming || !query.trim() || (inputMode === "clipboard" && !hasClipboard)}
                    className="absolute right-3.5 bottom-3.5 p-2 rounded-lg bg-violet-950/50 border border-violet-800/70 text-violet-300 hover:text-violet-100 hover:bg-violet-900/80 hover:border-violet-500/60 transition-all cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
                    title="Enviar pedido"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                  </button>
                </div>
              </div>

              {inputMode === "clipboard" && (
                <section
                  className={`${workspaceMode ? "col-start-1" : ""} p-3.5 rounded-xl bg-zinc-950/65 border border-zinc-900 flex flex-col gap-3`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-1.5 text-[10px] text-zinc-400 uppercase tracking-wider font-bold select-none">
                      <Clipboard
                        className={`w-3.5 h-3.5 ${hasClipboard ? "text-emerald-400" : "text-zinc-600"}`}
                      />
                      {hasClipboard ? "Clipboard detectado" : "Sem clipboard"}
                    </span>
                    <span className="text-[9px] font-mono bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded text-zinc-500">
                      {hasClipboard ? `${clipboardText.length} caracteres` : "aguardando texto"}
                    </span>
                  </div>
                  <div className="bg-zinc-900/40 border border-zinc-900/60 rounded-lg p-2.5 text-[11px] text-zinc-400 leading-normal min-h-10 select-text">
                    {hasClipboard
                      ? `"${clipboardText.slice(0, 220)}${clipboardText.length > 220 ? "..." : ""}"`
                      : "Copie um texto em qualquer app e volte para usar as ações de contexto."}
                  </div>
                </section>
              )}

              <section className={`${workspaceMode ? "col-start-2" : ""} flex flex-col gap-2`}>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-zinc-500 font-mono font-bold uppercase select-none">
                    {inputMode === "clipboard" ? "Ações com clipboard" : "Ações livres"}
                  </span>
                  {inputMode === "clipboard" && !hasClipboard && (
                    <span className="text-[10px] text-zinc-600 select-none">copie texto para liberar</span>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(inputMode === "clipboard" ? QUICK_ACTIONS : FREE_ACTIONS).map((action) => {
                    const Icon = action.icon;
                    const disabled =
                      inputMode === "clipboard" &&
                      "requiresClipboard" in action &&
                      Boolean(action.requiresClipboard) &&
                      !hasClipboard;
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
                          inputMode === "clipboard"
                            ? handleQuickAction(action.id)
                            : handleStarterAction(action.prompt, actionExecutionMode)
                        }
                        disabled={disabled || streaming}
                        className="min-h-[72px] rounded-lg bg-zinc-900/80 border border-zinc-800 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800/80 hover:border-violet-500/30 transition-all cursor-pointer flex flex-col items-start justify-center gap-1 px-2.5 py-2 text-left disabled:opacity-40 disabled:pointer-events-none"
                        title={disabled ? "Copie um texto primeiro" : action.description}
                      >
                        <Icon className={`w-4 h-4 ${action.accent}`} />
                        <span className="text-[10px] font-semibold leading-tight">{action.label}</span>
                        <span className="text-[9px] text-zinc-600 leading-tight">{action.description}</span>
                      </button>
                    );
                  })}
                </div>
              </section>
            </div>
          )
        ) : mode === "history" ? (
          <HistoryList />
        ) : (
          <div className="flex flex-col gap-3">
            <section className="rounded-xl bg-zinc-950/60 border border-zinc-900 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold text-zinc-200">Conectores e capacidades</div>
                  <div className="text-[10px] text-zinc-600 mt-0.5">
                    MCPs ficam desligados por padrão. Ações sensíveis pedem aprovação no workflow.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={refreshCapabilities}
                  className="h-8 px-2.5 rounded-md bg-zinc-900 border border-zinc-800 text-[10px] font-semibold text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Atualizar
                </button>
              </div>
            </section>

            <div className="grid gap-2">
              {visibleConnectors.map((connector) => (
                <section
                  key={connector.id}
                  className="rounded-xl bg-zinc-950/55 border border-zinc-900 p-3 flex items-start justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-zinc-200 truncate">{connector.name}</div>
                    <div className="text-[10px] text-zinc-600 mt-1 truncate">
                      {connector.command || connector.kind}
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {connector.permissionPolicy.map((permission) => (
                        <span
                          key={permission}
                          className="px-1.5 py-0.5 rounded bg-zinc-900 text-[9px] font-mono text-zinc-500"
                        >
                          {permission}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-2">
                    <span
                      className={`px-2 py-1 rounded-md text-[9px] font-mono uppercase ${
                        connector.enabled
                          ? "bg-emerald-950/35 text-emerald-300 border border-emerald-800/30"
                          : "bg-zinc-900 text-zinc-500 border border-zinc-800"
                      }`}
                    >
                      {connector.enabled ? "Ativo" : "Desligado"}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleTestConnector(connector.id)}
                        disabled={testingConnectorId === connector.id}
                        className="h-7 px-2 rounded-md bg-zinc-900 border border-zinc-800 text-[10px] font-semibold text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
                      >
                        {testingConnectorId === connector.id ? "Testando" : "Testar"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleConnector(connector.id)}
                        className="h-7 px-2 rounded-md bg-zinc-900 border border-zinc-800 text-[10px] font-semibold text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer"
                      >
                        {connector.enabled ? "Desligar" : "Ligar"}
                      </button>
                    </div>
                  </div>
                </section>
              ))}
              {visibleConnectors.length === 0 && (
                <section className="rounded-xl bg-zinc-950/55 border border-zinc-900 p-4 text-xs text-zinc-500">
                  Nenhum conector carregado ainda.
                </section>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Settings Overlay Drawer Panel */}
      {showSettings && (
        <div className="absolute inset-0 bg-zinc-950/95 backdrop-blur-lg z-30 flex flex-col p-4 font-mono select-none animate-fade-in border border-zinc-900 rounded-2xl">
          <div className="flex items-center justify-between border-b border-zinc-900/70 pb-3 mb-3">
            <span className="text-xs font-bold text-zinc-300 flex items-center gap-2">
              <Settings className="w-5 h-5 text-violet-400" />
              Configurações
            </span>
            <button
              type="button"
              onClick={() => setShowSettings(false)}
              className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSaveSettings} className="flex-1 flex flex-col gap-4 overflow-y-auto pr-1">
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] text-zinc-500 uppercase font-bold flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-zinc-500" />
                Provedor
              </span>
              <select
                value={formProvider}
                onChange={(e) => {
                  const nextProvider = e.target.value;
                  setFormProvider(nextProvider);
                  if (nextProvider === "mock") setFormModel("mock-model");
                  else if (nextProvider === "pinstripes") {
                    const currentModel = PINSTRIPES_MODELS.some((model) => model.id === formModel);
                    setFormModel(currentModel ? formModel : "ps/warp");
                  }
                }}
                className="w-full bg-zinc-900/90 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:border-indigo-500/50 outline-none cursor-pointer hover:bg-zinc-850"
              >
                <option value="pinstripes">Pinstripes API</option>
                <option value="mock">Mock local</option>
                <option value="openai">OpenAI Compatible</option>
                <option value="gemini">Gemini Compatible (Google API)</option>
              </select>
            </div>

            {/* API Key inputs */}
            {formProvider !== "mock" && (
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] text-zinc-500 uppercase font-bold flex items-center gap-1">
                  <KeyRound className="w-3.5 h-3.5 text-zinc-500" />
                  Chave API (API Key)
                </span>
                <div className="relative">
                  <input
                    type={showKey ? "text" : "password"}
                    value={formApiKey}
                    onChange={(e) => setFormApiKey(e.target.value)}
                    placeholder="Insira ou cole sua chave de API secreta"
                    className="w-full bg-zinc-900/90 border border-zinc-800 rounded-xl pl-3 pr-9 py-2 text-xs text-zinc-200 focus:border-indigo-500/50 outline-none select-text"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-3 top-2.5 text-zinc-500 hover:text-zinc-300 cursor-pointer"
                  >
                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {/* Endpoint base url */}
            {(formProvider === "openai" || formProvider === "gemini") && (
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] text-zinc-500 uppercase font-bold flex items-center gap-1">
                  <Link className="w-3.5 h-3.5 text-zinc-500" />
                  URL Base Customizada
                </span>
                <input
                  type="text"
                  value={formBaseUrl}
                  onChange={(e) => setFormBaseUrl(e.target.value)}
                  placeholder={
                    formProvider === "openai"
                      ? "https://api.openai.com/v1"
                      : "https://generativetooling.googleapis.com/v1"
                  }
                  className="w-full bg-zinc-900/90 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:border-indigo-500/50 outline-none select-text"
                />
              </div>
            )}

            {formProvider !== "mock" && formProvider !== "pinstripes" && (
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] text-zinc-500 uppercase font-bold flex justify-between items-center">
                  <span className="flex items-center gap-1">
                    <Database className="w-3.5 h-3.5 text-zinc-500" />
                    Modelo de Linguagem (LLM)
                  </span>
                  {loadingModels && (
                    <span className="text-[8px] text-indigo-400 font-bold animate-pulse">
                      conectando api...
                    </span>
                  )}
                </span>
                {fetchedModels.length > 0 ? (
                  <select
                    value={formModel}
                    onChange={(e) => setFormModel(e.target.value)}
                    className="w-full bg-zinc-900/90 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:border-indigo-500/50 outline-none cursor-pointer hover:bg-zinc-850"
                  >
                    {fetchedModels.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={formModel}
                    onChange={(e) => setFormModel(e.target.value)}
                    placeholder="gpt-4o-mini ou modelo customizado..."
                    className="w-full bg-zinc-900/90 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:border-indigo-500/50 outline-none select-text"
                    required
                  />
                )}
              </div>
            )}

            {formProvider === "pinstripes" && (
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] text-zinc-500 uppercase font-bold flex items-center gap-1">
                  <Database className="w-3.5 h-3.5 text-zinc-500" />
                  Modelo Pinstripes
                </span>
                <select
                  value={formModel || "ps/warp"}
                  onChange={(e) => setFormModel(e.target.value)}
                  className="w-full bg-zinc-900/90 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:border-violet-500/50 outline-none cursor-pointer hover:bg-zinc-850"
                >
                  {PINSTRIPES_MODELS.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name} - {model.description}
                    </option>
                  ))}
                </select>
                <span className="text-[9px] text-zinc-600 leading-normal">
                  Warp para velocidade, Thinking para raciocínio e Pro para respostas mais deliberadas.
                </span>
              </div>
            )}

            {formProvider === "mock" && (
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] text-zinc-500 uppercase font-bold flex items-center gap-1">
                  <Database className="w-3.5 h-3.5 text-zinc-500" />
                  Modelo Ativo
                </span>
                <div className="bg-zinc-900 border border-zinc-850 rounded-xl px-3 py-2 text-xs text-zinc-500 font-bold select-none">
                  mock-model
                </div>
              </div>
            )}

            {/* Timeout Settings */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] text-zinc-500 uppercase font-bold flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-zinc-500" />
                Timeout da Requisição (segundos)
              </span>
              <input
                type="number"
                value={formTimeout}
                onChange={(e) => setFormTimeout(Number(e.target.value))}
                min={5}
                max={600}
                placeholder="120"
                className="w-full bg-zinc-900/90 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:border-indigo-500/50 outline-none select-text"
                required
              />
            </div>

            {/* Hide Floating Pet setting */}
            <div className="flex items-start gap-3 bg-zinc-900/40 border border-zinc-900 rounded-xl p-3 mt-1.5">
              <input
                type="checkbox"
                id="hidePet"
                checked={formHidePet}
                onChange={(e) => setFormHidePet(e.target.checked)}
                className="w-4 h-4 text-indigo-600 bg-zinc-950 border-zinc-800 rounded focus:ring-0 focus:ring-offset-0 cursor-pointer mt-0.5"
              />
              <label
                htmlFor="hidePet"
                className="text-[11px] text-zinc-400 font-bold cursor-pointer flex flex-col gap-0.5 leading-tight select-none"
              >
                <span>Ocultar Pet Flutuante</span>
                <span className="text-[9px] text-zinc-650 font-normal leading-normal">
                  Se ativado, o Pet flutuante desaparece da tela de trabalho e o App ficará rodando
                  discretamente em segundo plano, sendo exibido somente via atalho{" "}
                  <kbd className="px-1 py-0.2 bg-zinc-950 text-[8px] rounded border border-zinc-800 text-zinc-500">
                    {GLOBAL_SHORTCUT_LABEL}
                  </kbd>{" "}
                  ou clicando no ícone do menu bar do sistema.
                </span>
              </label>
            </div>

            {/* Settings buttons actions */}
            <div className="mt-auto pt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setShowSettings(false)}
                className="flex-1 px-3 py-2.5 rounded-xl border border-zinc-800 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 transition-colors cursor-pointer text-center font-bold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={savingSettings}
                className="flex-1 px-3 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 border border-indigo-500/30 text-xs text-zinc-100 transition-colors cursor-pointer text-center font-bold disabled:opacity-50"
              >
                {savingSettings ? "Salvando..." : "Salvar Configuração"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
