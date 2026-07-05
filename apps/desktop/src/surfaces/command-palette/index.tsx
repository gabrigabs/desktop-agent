import { readText as readClipboard, writeText as writeClipboard } from "@tauri-apps/plugin-clipboard-manager";
import {
  AlertCircle,
  Check,
  Clipboard,
  Clock,
  Cpu,
  Database,
  Eye,
  EyeOff,
  FileText,
  Info,
  KeyRound,
  Languages,
  Layers,
  Link,
  Play,
  Settings,
  Sparkles,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { getAgent } from "../../lib/rpc";
import { setWindowMode } from "../../lib/window";
import { useAgentStore } from "../../stores/agent";
import { HistoryList } from "./history-list";
import { ResultPreview } from "./result-preview";

const GLOBAL_SHORTCUT_LABEL = "Control+Shift+Space";

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
  const [clipSuggestion, setClipSuggestion] = useState<boolean>(false);
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
    try {
      const text = await readClipboard();
      if (text && text.trim().length > 0) {
        setClipboardText(text);
        setClipSuggestion(true);
      } else {
        setClipSuggestion(false);
      }
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
      setClipSuggestion(false);
      clearAgentLogs();

      try {
        const api = await getAgent();
        const clipboardContent = await readClipboard();
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
    [query, setClipboardText, setError, setResult, setStreaming, clearAgentLogs, addAgentLog],
  );

  const handleCopyResult = useCallback(async () => {
    if (result) {
      await writeClipboard(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [result]);

  const handleQuickAction = async (action: string) => {
    let prompt = "";
    if (action === "melhorar") prompt = "Melhorar a clareza, tom e legibilidade deste texto";
    if (action === "resumir") prompt = "Resumir este texto em tópicos concisos";
    if (action === "traduzir") prompt = "Traduzir este texto para o inglês mantendo o tom original";

    setQuery(prompt);
    await handleExecute(prompt);
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
        model: formModel,
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
          setClipSuggestion(false);
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
    const name = settings.activeProvider.toUpperCase();
    const model = settings.model ? `: ${settings.model}` : "";
    return `${name}${model}`;
  };

  return (
    <div className="flex flex-col h-full w-full bg-zinc-950/20 text-zinc-150 font-sans relative">
      {/* Active Provider Badge Banner - highly intuitive indicator of status */}
      <div className="mx-4 mt-3 px-3 py-1.5 rounded-lg bg-indigo-950/20 border border-indigo-900/35 flex items-center justify-between font-mono text-[10px] text-indigo-300">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
          <span>
            Ativo: <strong className="text-zinc-200 select-all">{getActiveBadgeText()}</strong>
          </span>
        </div>
        <button
          type="button"
          onClick={() => setShowSettings(true)}
          className="text-[9px] underline hover:text-indigo-200 cursor-pointer"
        >
          configurar
        </button>
      </div>

      {/* Mode Select Tabs & Settings Trigger */}
      <div className="flex items-center justify-between p-3 border-b border-zinc-900/40 bg-zinc-950/25 mt-1">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setMode("command")}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all duration-200 cursor-pointer ${
              mode === "command"
                ? "bg-zinc-800/70 text-zinc-100 shadow-inner border border-zinc-700/30"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            COMMAND CORE
          </button>
          <button
            type="button"
            onClick={() => setMode("history")}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all duration-200 cursor-pointer ${
              mode === "history"
                ? "bg-zinc-800/70 text-zinc-100 shadow-inner border border-zinc-700/30"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            LOGS
          </button>
        </div>
        <button
          type="button"
          onClick={() => setShowSettings(!showSettings)}
          className={`p-1.5 rounded-lg hover:bg-zinc-850/80 transition-colors cursor-pointer border border-transparent hover:border-zinc-800 ${
            showSettings ? "text-indigo-400 bg-zinc-800/60" : "text-zinc-500 hover:text-zinc-300"
          }`}
          title="Configurações de Conexão"
        >
          <Settings className="w-4 h-4 animate-hover-spin" />
        </button>
      </div>

      {/* Tab Contents */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {mode === "command" ? (
          <div className="flex flex-col gap-4">
            {/* Terminal Command Input area */}
            <div className="relative group flex flex-col">
              <span className="text-[10px] text-zinc-500 font-mono font-bold uppercase mb-1 flex items-center gap-1 select-none">
                <Cpu className="w-3.5 h-3.5 text-zinc-500" />
                Instrução do Agente
              </span>
              <div className="relative w-full">
                <div className="absolute top-3 left-3 text-zinc-650 font-mono text-xs select-none font-bold">
                  $
                </div>
                <textarea
                  ref={textareaRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="O que você quer reescrever, traduzir ou analisar no clipboard?"
                  className="w-full min-h-[96px] bg-zinc-950/70 border border-zinc-900 rounded-xl pl-7 pr-12 py-2.5 text-sm font-mono text-zinc-100 placeholder:text-zinc-700 placeholder:font-mono focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-950/50 resize-none transition-all duration-200 select-text"
                  disabled={streaming}
                  rows={3}
                />
                <button
                  type="button"
                  onClick={() => handleExecute()}
                  disabled={streaming || !query.trim()}
                  className="absolute right-3.5 bottom-3.5 p-2 rounded-lg bg-indigo-950/40 border border-indigo-900/65 text-indigo-400 hover:text-indigo-200 hover:bg-indigo-900/80 hover:border-indigo-500/50 transition-all cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
                  title="Executar Comando"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                </button>
              </div>
            </div>

            {/* Agent Logs - Premium Retro-console design style */}
            {agentLogs.length > 0 && (
              <div className="bg-zinc-950 border border-zinc-900 rounded-xl overflow-hidden font-mono text-[11px] leading-relaxed shadow-lg">
                {/* Visual Dev Window Header */}
                <div className="bg-zinc-900/60 px-3 py-1.5 border-b border-zinc-900/80 flex items-center justify-between select-none">
                  <div className="flex gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500/60" />
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500/60" />
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/60" />
                  </div>
                  <span className="text-[9px] uppercase tracking-wider text-zinc-500 font-bold">
                    AGY EXECUTION CONSOLE
                  </span>
                </div>
                <div className="p-3.5 flex flex-col gap-2.5 max-h-48 overflow-y-auto custom-scrollbar select-text selection:bg-indigo-950">
                  {agentLogs.map((log) => (
                    <div key={log.id} className="flex gap-2.5 items-start">
                      <div className="mt-0.5 select-none flex-shrink-0">
                        {log.type === "thought" && (
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 inline-block animate-pulse shadow-md shadow-indigo-500/50" />
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
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />
                        )}
                      </div>
                      <div className="flex-1 text-zinc-400">
                        {log.type === "thought" && (
                          <span className="text-indigo-400 font-bold">pensamento: </span>
                        )}
                        {log.type === "tool_start" && (
                          <span className="text-amber-400 font-bold">ferramenta: </span>
                        )}
                        {log.type === "tool_complete" && (
                          <span className="text-emerald-400 font-bold">sucesso: </span>
                        )}
                        {log.type === "tool_fail" && <span className="text-rose-400 font-bold">falha: </span>}
                        <span>{log.text}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Action Suggestion Panel */}
            {clipSuggestion && clipboardText && !result && !streaming && (
              <div className="p-4 bg-zinc-950/70 rounded-xl border border-zinc-900 flex flex-col gap-3 font-mono">
                <div className="flex justify-between items-center text-zinc-500 text-[10px] uppercase tracking-wider font-bold select-none">
                  <span className="flex items-center gap-1.5 text-zinc-400">
                    <Clipboard className="w-3.5 h-3.5 text-indigo-400" />
                    Conteúdo do Clipboard
                  </span>
                  <span className="text-[9px] bg-zinc-900 border border-zinc-850 px-2 py-0.5 rounded text-zinc-500">
                    {clipboardText.length} caracteres
                  </span>
                </div>

                {/* Clipboard content preview block */}
                <div className="bg-zinc-900/40 border border-zinc-900/60 rounded-lg p-2.5 text-[11px] text-zinc-400 leading-normal italic truncate">
                  "{clipboardText.slice(0, 150)}"
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => handleQuickAction("melhorar")}
                    className="py-2.5 rounded-lg bg-zinc-900 border border-zinc-850 hover:border-amber-500/25 text-zinc-300 hover:text-zinc-150 hover:bg-zinc-850/80 transition-all cursor-pointer flex flex-col items-center justify-center gap-1.5 text-[10px]"
                  >
                    <Sparkles className="w-4.5 h-4.5 text-amber-500" />
                    <span>Melhorar</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickAction("resumir")}
                    className="py-2.5 rounded-lg bg-zinc-900 border border-zinc-850 hover:border-blue-500/25 text-zinc-300 hover:text-zinc-150 hover:bg-zinc-850/80 transition-all cursor-pointer flex flex-col items-center justify-center gap-1.5 text-[10px]"
                  >
                    <FileText className="w-4.5 h-4.5 text-blue-500" />
                    <span>Resumir</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickAction("traduzir")}
                    className="py-2.5 rounded-lg bg-zinc-900 border border-zinc-850 hover:border-emerald-500/25 text-zinc-300 hover:text-zinc-150 hover:bg-zinc-850/80 transition-all cursor-pointer flex flex-col items-center justify-center gap-1.5 text-[10px]"
                  >
                    <Languages className="w-4.5 h-4.5 text-emerald-500" />
                    <span>Traduzir</span>
                  </button>
                </div>
              </div>
            )}

            {/* Error box card */}
            {error && (
              <div className="p-3.5 bg-rose-950/20 border border-rose-900/40 rounded-xl text-rose-300 text-xs font-mono flex gap-2.5 items-start">
                <AlertCircle className="w-4.5 h-4.5 text-rose-500 flex-shrink-0 mt-0.5" />
                <div className="select-text">
                  <strong className="text-rose-400 font-bold mr-1">ERROR:</strong>
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

            {/* Output Result Card */}
            {result && (
              <div className="mt-1 flex flex-col gap-2 font-mono">
                <div className="flex items-center justify-between select-none">
                  <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">
                    [ RESULTADO DA EXECUÇÃO ]
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyResult}
                    className={`px-3 py-1.5 text-[10px] font-bold rounded-lg border transition-all duration-150 active:scale-95 cursor-pointer flex items-center gap-1.5 ${
                      copied
                        ? "bg-emerald-950/30 border-emerald-800 text-emerald-400"
                        : "bg-zinc-900 border-zinc-800 text-zinc-350 hover:text-zinc-100 hover:bg-zinc-850"
                    }`}
                  >
                    {copied ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Clipboard className="w-3.5 h-3.5 text-indigo-400" />
                    )}
                    <span>{copied ? "COPIADO" : "COPIAR"}</span>
                  </button>
                </div>
                <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-4 text-xs text-zinc-200 leading-relaxed whitespace-pre-wrap max-h-60 overflow-y-auto custom-scrollbar select-text selection:bg-indigo-950 select-all border-l-2 border-l-indigo-500">
                  {result}
                </div>
              </div>
            )}

            {/* Hotkeys tips bar */}
            <div className="mt-2 p-3.5 rounded-xl bg-zinc-950/30 border border-zinc-900/50 text-[10px] font-mono text-zinc-600 space-y-1.5 select-none leading-normal">
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[9px] text-zinc-400 font-sans shadow-sm font-bold">
                    Enter
                  </kbd>
                  Executar comando
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[9px] text-zinc-400 font-sans shadow-sm font-bold">
                    Esc
                  </kbd>
                  Limpar tela / Minimizar
                </span>
              </div>
              <div className="flex justify-between items-center pt-1 border-t border-zinc-900/30">
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[9px] text-zinc-400 font-sans shadow-sm font-bold">
                    Shift+Enter
                  </kbd>
                  Nova linha
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[9px] text-zinc-400 font-sans shadow-sm font-bold">
                    {GLOBAL_SHORTCUT_LABEL}
                  </kbd>
                  Atalho global do app
                </span>
              </div>
            </div>
          </div>
        ) : (
          <HistoryList />
        )}
      </div>

      {/* Settings Overlay Drawer Panel */}
      {showSettings && (
        <div className="absolute inset-0 bg-zinc-950/95 backdrop-blur-lg z-30 flex flex-col p-4 font-mono select-none animate-fade-in border border-zinc-900 rounded-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-900/70 pb-3 mb-3">
            <span className="text-xs font-bold text-zinc-300 flex items-center gap-2">
              <Settings className="w-5 h-5 text-indigo-400" />
              CONFIGURAÇÃO DE CONEXÃO
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
            {/* Provider Selection Option */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] text-zinc-500 uppercase font-bold flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-zinc-500" />
                Provedor de Modelagem
              </span>
              <select
                value={formProvider}
                onChange={(e) => {
                  setFormProvider(e.target.value);
                  if (e.target.value === "mock") setFormModel("mock-model");
                  else if (e.target.value === "pinstripes") setFormModel("ps/warp");
                }}
                className="w-full bg-zinc-900/90 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:border-indigo-500/50 outline-none cursor-pointer hover:bg-zinc-850"
              >
                <option value="mock">Mock Provedor (Local / Off-line)</option>
                <option value="openai">OpenAI Compatible (Cloud/Custom)</option>
                <option value="gemini">Gemini Compatible (Google API)</option>
                <option value="pinstripes">Pinstripes API</option>
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

            {/* Dynamic model dropdown list or direct input */}
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

            {/* Static models labels */}
            {(formProvider === "mock" || formProvider === "pinstripes") && (
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] text-zinc-500 uppercase font-bold flex items-center gap-1">
                  <Database className="w-3.5 h-3.5 text-zinc-500" />
                  Modelo Ativo
                </span>
                <div className="bg-zinc-900 border border-zinc-850 rounded-xl px-3 py-2 text-xs text-zinc-500 font-bold select-none">
                  {formProvider === "mock" ? "mock-model" : "ps/warp (Automático)"}
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
