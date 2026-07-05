import { readText as readClipboard, writeText as writeClipboard } from "@tauri-apps/plugin-clipboard-manager";
import {
  AlertCircle,
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
  MessageSquare,
  PenLine,
  Play,
  Search,
  Settings,
  Sparkles,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { getAgent } from "../../lib/rpc";
import { isTauriRuntime, setWindowMode } from "../../lib/window";
import { useAgentStore } from "../../stores/agent";
import { HistoryList } from "./history-list";

const GLOBAL_SHORTCUT_LABEL = "Control+Shift+Space";

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

const STARTER_ACTIONS = [
  {
    label: "Pergunta livre",
    icon: Bot,
    prompt: "",
  },
  {
    label: "Montar plano",
    icon: CheckSquare,
    prompt: "Monte um plano prático para: ",
  },
  {
    label: "Rascunhar texto",
    icon: PenLine,
    prompt: "Rascunhe um texto curto sobre: ",
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
  } = useAgentStore();

  const [mode, setMode] = useState<"command" | "history">("command");
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
    async (forceInstruction?: string) => {
      const activeQuery = forceInstruction || query;
      if (!activeQuery.trim()) return;

      setResult(null);
      setError(null);
      setStreaming(true);
      clearAgentLogs();

      try {
        const api = await getAgent();
        const clipboardContent = isTauriRuntime() ? await readClipboard() : clipboardText;
        setClipboardText(clipboardContent);

        const requestId = crypto.randomUUID();

        const res = await api.runAgent({
          requestId,
          query: activeQuery,
          clipboardText: clipboardContent,
        });

        setResult(res.result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao executar comando");
        addAgentLog({ type: "tool_fail", text: err instanceof Error ? err.message : String(err) });
      } finally {
        setStreaming(false);
      }
    },
    [query, clipboardText, setClipboardText, setError, setResult, setStreaming, clearAgentLogs, addAgentLog],
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

  const handleQuickAction = async (actionId: string) => {
    const action = QUICK_ACTIONS.find((item) => item.id === actionId);
    if (!action) return;

    setQuery(action.prompt);
    await handleExecute(action.prompt);
  };

  const handleStarterAction = (prompt: string) => {
    setQuery(prompt);
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
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
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {mode === "command" ? (
          <div className="flex flex-col gap-4">
            <div className="relative group flex flex-col">
              <span className="text-[10px] text-zinc-500 font-mono font-bold uppercase mb-1 flex items-center gap-1.5 select-none">
                <Bot className="w-3.5 h-3.5 text-violet-400" />
                Pedido
              </span>
              <div className="relative w-full">
                <textarea
                  ref={textareaRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Pergunte algo, peça um rascunho ou use uma ação rápida abaixo."
                  className="w-full min-h-[104px] bg-zinc-950/70 border border-zinc-900 rounded-xl pl-3 pr-12 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-950/50 resize-none transition-all duration-200 select-text"
                  disabled={streaming}
                  aria-label="Pedido para o agente"
                  rows={3}
                />
                <button
                  type="button"
                  onClick={() => handleExecute()}
                  disabled={streaming || !query.trim()}
                  className="absolute right-3.5 bottom-3.5 p-2 rounded-lg bg-violet-950/50 border border-violet-800/70 text-violet-300 hover:text-violet-100 hover:bg-violet-900/80 hover:border-violet-500/60 transition-all cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
                  title="Enviar pedido"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                </button>
              </div>
            </div>

            <section className="p-3.5 rounded-xl bg-zinc-950/65 border border-zinc-900 flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-1.5 text-[10px] text-zinc-400 uppercase tracking-wider font-bold select-none">
                  <Clipboard
                    className={`w-3.5 h-3.5 ${hasClipboard ? "text-emerald-400" : "text-zinc-600"}`}
                  />
                  {hasClipboard ? "Clipboard detectado" : "Sem clipboard"}
                </span>
                <span className="text-[9px] font-mono bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded text-zinc-500">
                  {hasClipboard ? `${clipboardText.length} caracteres` : "prompt livre"}
                </span>
              </div>
              <div className="bg-zinc-900/40 border border-zinc-900/60 rounded-lg p-2.5 text-[11px] text-zinc-400 leading-normal min-h-10 select-text">
                {hasClipboard
                  ? `"${clipboardText.slice(0, 180)}${clipboardText.length > 180 ? "..." : ""}"`
                  : "Digite uma pergunta acima ou comece com um dos atalhos abaixo. As ações de texto ativam quando houver conteúdo no clipboard."}
              </div>
            </section>

            <section className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-zinc-500 font-mono font-bold uppercase select-none">
                  Ações rápidas
                </span>
                {!hasClipboard && (
                  <span className="text-[10px] text-zinc-600 select-none">
                    copie texto para liberar ações de contexto
                  </span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {QUICK_ACTIONS.map((action) => {
                  const Icon = action.icon;
                  const disabled = action.requiresClipboard && !hasClipboard;

                  return (
                    <button
                      key={action.id}
                      type="button"
                      onClick={() => handleQuickAction(action.id)}
                      disabled={disabled || streaming}
                      className={`min-h-[68px] rounded-lg bg-zinc-900/80 border border-zinc-850 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-850/80 hover:border-violet-500/30 transition-all cursor-pointer flex flex-col items-start justify-center gap-1 px-2.5 py-2 text-left disabled:opacity-40 disabled:pointer-events-none`}
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

            <section className="flex flex-col gap-2">
              <span className="text-[10px] text-zinc-500 font-mono font-bold uppercase select-none">
                Começar sem clipboard
              </span>
              <div className="flex flex-wrap gap-2">
                {STARTER_ACTIONS.map((action) => {
                  const Icon = action.icon;

                  return (
                    <button
                      key={action.label}
                      type="button"
                      onClick={() => handleStarterAction(action.prompt)}
                      disabled={streaming}
                      className="px-2.5 py-1.5 rounded-md bg-zinc-950/70 border border-zinc-850 text-[10px] font-semibold text-zinc-400 hover:text-zinc-100 hover:border-violet-500/30 transition-colors cursor-pointer disabled:opacity-40 disabled:pointer-events-none flex items-center gap-1.5"
                    >
                      <Icon className="w-3.5 h-3.5 text-violet-400" />
                      {action.label}
                    </button>
                  );
                })}
              </div>
            </section>

            {agentLogs.length > 0 && (
              <section className="bg-zinc-950 border border-zinc-900 rounded-xl overflow-hidden text-[11px] leading-relaxed shadow-lg">
                <div className="bg-zinc-900/60 px-3 py-1.5 border-b border-zinc-900/80 flex items-center justify-between select-none">
                  <span className="text-[9px] uppercase tracking-wider text-zinc-500 font-bold">
                    Execução
                  </span>
                  <span className="text-[9px] text-zinc-600">{agentLogs.length} eventos</span>
                </div>
                <div className="p-3.5 flex flex-col gap-2.5 max-h-40 overflow-y-auto custom-scrollbar select-text selection:bg-violet-950">
                  {agentLogs.map((log) => (
                    <div key={log.id} className="flex gap-2.5 items-start">
                      <div className="mt-1 select-none flex-shrink-0">
                        {log.type === "thought" && (
                          <span className="w-1.5 h-1.5 rounded-full bg-violet-500 inline-block animate-pulse shadow-md shadow-violet-500/50" />
                        )}
                        {log.type === "tool_start" && (
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block animate-ping" />
                        )}
                        {log.type === "tool_complete" && (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                        )}
                        {log.type === "tool_fail" && (
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 inline-block" />
                        )}
                        {log.type === "info" && (
                          <span className="w-1.5 h-1.5 rounded-full bg-sky-500 inline-block" />
                        )}
                      </div>
                      <div className="flex-1 text-zinc-400">
                        {log.type === "thought" && (
                          <span className="text-violet-300 font-bold">pensando: </span>
                        )}
                        {log.type === "tool_start" && (
                          <span className="text-amber-400 font-bold">usando: </span>
                        )}
                        {log.type === "tool_complete" && (
                          <span className="text-emerald-400 font-bold">ok: </span>
                        )}
                        {log.type === "tool_fail" && <span className="text-rose-400 font-bold">falha: </span>}
                        <span>{log.text}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {error && (
              <div className="p-3.5 bg-rose-950/20 border border-rose-900/40 rounded-xl text-rose-300 text-xs flex gap-2.5 items-start">
                <AlertCircle className="w-4.5 h-4.5 text-rose-500 flex-shrink-0 mt-0.5" />
                <div className="select-text">
                  <strong className="text-rose-400 font-bold mr-1">Erro:</strong>
                  {error}
                </div>
              </div>
            )}

            {/* Spinner loader bar */}
            {streaming && agentLogs.length === 0 && (
              <div className="w-full bg-zinc-900 h-1 rounded-full overflow-hidden">
                <div
                  className="bg-indigo-500 h-full rounded-full animate-pulse-gentle"
                  style={{ width: "100%", animationDuration: "1.2s" }}
                />
              </div>
            )}

            {result && (
              <div className="mt-1 flex flex-col gap-2">
                <div className="flex items-center justify-between select-none">
                  <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">
                    Resultado
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyResult}
                    className={`px-3 py-1.5 text-[10px] font-bold rounded-lg border transition-all duration-150 active:scale-95 cursor-pointer flex items-center gap-1.5 ${
                      copied
                        ? "bg-emerald-950/30 border-emerald-800 text-emerald-400"
                        : "bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-850"
                    }`}
                  >
                    {copied ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Clipboard className="w-3.5 h-3.5 text-indigo-400" />
                    )}
                    <span>{copied ? "Copiado" : "Copiar"}</span>
                  </button>
                </div>
                <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-4 text-xs text-zinc-200 leading-relaxed whitespace-pre-wrap max-h-60 overflow-y-auto custom-scrollbar select-text selection:bg-violet-950 border-l-2 border-l-violet-500">
                  {result}
                </div>
              </div>
            )}
          </div>
        ) : (
          <HistoryList />
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
