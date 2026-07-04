import { readText as readClipboard, writeText as writeClipboard } from "@tauri-apps/plugin-clipboard-manager";
import { useCallback, useEffect, useRef, useState } from "react";
import { getAgent } from "../../lib/rpc";
import { setWindowMode } from "../../lib/window";
import { useAgentStore } from "../../stores/agent";
import { HistoryList } from "./history-list";
import { ResultPreview } from "./result-preview";

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
  } = useAgentStore();

  const [mode, setMode] = useState<"command" | "history">("command");
  const [clipSuggestion, setClipSuggestion] = useState<boolean>(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load and check clipboard content on mount/focus
  const checkClipboard = useCallback(async () => {
    try {
      const text = await readClipboard();
      if (text && text.trim().length > 0) {
        setClipboardText(text);
        // Suggest quick actions if clipboard text is fresh and query is empty
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
    // Also poll clipboard when window gets focus (Tauri native focus event is even better, but simple focus event works)
    window.addEventListener("focus", checkClipboard);
    return () => window.removeEventListener("focus", checkClipboard);
  }, [checkClipboard]);

  const handleExecute = useCallback(
    async (forceInstruction?: string) => {
      const activeQuery = forceInstruction || query;
      if (!activeQuery.trim()) return;

      setResult(null);
      setError(null);
      setStreaming(true);
      setClipSuggestion(false);

      try {
        const api = await getAgent();
        const clipboardContent = await readClipboard();
        setClipboardText(clipboardContent);

        const requestId = crypto.randomUUID();
        const normalizedQuery = activeQuery.toLowerCase();

        if (
          normalizedQuery.includes("melhor") ||
          normalizedQuery.includes("rewrite") ||
          normalizedQuery.includes("corrig")
        ) {
          const execution = await api.execute({
            requestId,
            toolName: "text.rewrite",
            input: { text: clipboardContent, instruction: activeQuery },
          });

          const output = execution.result.output as { rewritten: string };
          setResult(output.rewritten);
        } else if (normalizedQuery.includes("resum")) {
          const execution = await api.execute({
            requestId,
            toolName: "text.summarize",
            input: { text: clipboardContent },
          });

          const output = execution.result.output as { summary: string };
          setResult(output.summary);
        } else if (normalizedQuery.includes("traduz")) {
          const execution = await api.execute({
            requestId,
            toolName: "text.translate",
            input: { text: clipboardContent, targetLanguage: "inglês" },
          });

          const output = execution.result.output as { translation: string };
          setResult(output.translation);
        } else {
          setError("Comando não reconhecido. Tente incluir palavras como: melhore, resuma, traduza.");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao executar comando");
      } finally {
        setStreaming(false);
      }
    },
    [query, setClipboardText, setError, setResult, setStreaming],
  );

  const handleCopyResult = useCallback(async () => {
    if (result) {
      await writeClipboard(result);
    }
  }, [result]);

  const handleQuickAction = async (action: string) => {
    let prompt = "";
    if (action === "melhorar") prompt = "Melhorar o estilo do texto";
    if (action === "resumir") prompt = "Resumir este texto";
    if (action === "traduzir") prompt = "Traduzir para o inglês";

    setQuery(prompt);
    await handleExecute(prompt);
  };

  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (!streaming) {
          handleExecute();
        }
      }
      if (e.key === "Escape") {
        if (query || result || error) {
          reset();
          setClipSuggestion(false);
        } else {
          // If already clean, collapse window back to Pet mode
          setUiMode("collapsed");
          await setWindowMode("collapsed");
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleExecute, streaming, query, result, error, reset, setUiMode]);

  // Auto focus textarea when mounting or mode changes
  useEffect(() => {
    if (mode === "command" && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [mode]);

  return (
    <div className="flex flex-col h-full w-full bg-zinc-950/20 text-zinc-100 font-sans">
      {/* Mode Select Tabs */}
      <div className="flex items-center gap-1.5 p-3 border-b border-zinc-900/60 bg-zinc-950/25">
        <button
          type="button"
          onClick={() => setMode("command")}
          className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all duration-200 ${
            mode === "command"
              ? "bg-zinc-800/80 text-zinc-100 shadow-sm border border-zinc-700/30"
              : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          COMMAND CORE
        </button>
        <button
          type="button"
          onClick={() => setMode("history")}
          className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all duration-200 ${
            mode === "history"
              ? "bg-zinc-800/80 text-zinc-100 shadow-sm border border-zinc-700/30"
              : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          LOGS
        </button>
      </div>

      {/* Tab Contents */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {mode === "command" ? (
          <div className="flex flex-col gap-4">
            {/* Text Prompt Input Box */}
            <div className="relative group">
              <div className="absolute top-3 left-3 text-zinc-600 font-mono text-xs select-none">$</div>
              <textarea
                ref={textareaRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="O que você deseja fazer com a área de transferência? (ex: melhore, resuma, traduza)..."
                className="w-full min-h-[96px] bg-zinc-950/80 border border-zinc-800/90 rounded-xl pl-7 pr-4 py-2.5 text-sm font-mono text-zinc-200 placeholder:text-zinc-700 placeholder:font-mono focus:outline-none focus:border-zinc-700/70 focus:ring-1 focus:ring-zinc-800/50 resize-none transition-all duration-200"
                disabled={streaming}
                rows={3}
              />
              {streaming && (
                <div className="absolute right-3.5 bottom-3.5">
                  <div className="w-3.5 h-3.5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>

            {/* Clipboard Detection and Suggestions */}
            {clipSuggestion && clipboardText && !result && !streaming && (
              <div className="p-3 bg-zinc-950/60 rounded-xl border border-zinc-900/80 font-mono text-xs">
                <div className="flex justify-between items-center text-zinc-500 text-[10px] mb-1.5 uppercase tracking-wider">
                  <span>Área de Transferência</span>
                  <span className="text-[8px] bg-zinc-900 px-1 py-0.5 rounded text-zinc-600">
                    {clipboardText.length} chars
                  </span>
                </div>
                <p className="text-zinc-400 truncate text-[11px] mb-2.5 italic">
                  "{clipboardText.slice(0, 120)}"
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleQuickAction("melhorar")}
                    className="px-2 py-1 rounded bg-zinc-900 border border-zinc-800/80 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800/50 hover:border-zinc-700/60 transition-all active:scale-95"
                  >
                    ⚡ Melhorar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickAction("resumir")}
                    className="px-2 py-1 rounded bg-zinc-900 border border-zinc-800/80 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800/50 hover:border-zinc-700/60 transition-all active:scale-95"
                  >
                    📝 Resumir
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickAction("traduzir")}
                    className="px-2 py-1 rounded bg-zinc-900 border border-zinc-800/80 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800/50 hover:border-zinc-700/60 transition-all active:scale-95"
                  >
                    🌐 Traduzir (EN)
                  </button>
                </div>
              </div>
            )}

            {/* Error Box */}
            {error && (
              <div className="p-3 bg-rose-950/20 border border-rose-900/40 rounded-xl text-rose-300 text-xs font-mono">
                <span className="text-rose-500 font-bold mr-1">ERROR:</span>
                {error}
              </div>
            )}

            {/* Loading Progress Bar */}
            {streaming && (
              <div className="w-full bg-zinc-900 h-1 rounded-full overflow-hidden">
                <div
                  className="bg-yellow-400 h-full w-1/2 rounded-full animate-pulse-gentle animate-spin-clockwise"
                  style={{ width: "100%", animationDuration: "1.5s" }}
                />
              </div>
            )}

            {/* Output Result Card */}
            {result && <ResultPreview content={result} onCopy={handleCopyResult} />}

            {/* Helper Guide Monospace Info */}
            <div className="mt-2 p-2 rounded bg-zinc-950/20 border border-zinc-900/30 text-[10px] font-mono text-zinc-600 space-y-1">
              <div className="flex justify-between">
                <span>[Enter] Executar</span>
                <span>[Esc] Limpar / Fechar</span>
              </div>
              <div className="flex justify-between">
                <span>[Shift+Enter] Nova Linha</span>
                <span>Copiar resultado automaticamente</span>
              </div>
            </div>
          </div>
        ) : (
          <HistoryList />
        )}
      </div>
    </div>
  );
}
