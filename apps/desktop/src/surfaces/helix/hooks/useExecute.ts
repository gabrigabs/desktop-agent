import { readText as readClipboard, writeText as writeClipboard } from "@tauri-apps/plugin-clipboard-manager";
import { useCallback, useEffect, useRef, useState } from "react";
import { getAgent, setActiveRequestId as setRpcActiveRequestId } from "../../../lib/rpc";
import { isTauriRuntime } from "../../../lib/window";
import { useAgentStore } from "../../../stores/agent";
import { callAgentWithRuntimeRefresh, isStaleRuntimeError, QUICK_ACTIONS } from "../constants";

export function useExecute() {
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
    };
  }, []);

  const saveConversationToStorage = useCallback(async () => {
    const store = useAgentStore.getState();
    const convId = store.currentConversationId;
    const turns = store.messages;
    if (!convId || turns.length === 0) return;

    try {
      const api = await getAgent();
      await api.saveConversation({ conversationId: convId, turns });
    } catch (err) {
      console.error("Failed to save conversation:", err);
    }
  }, []);

  const handleExecute = useCallback(
    async (forceInstruction?: string) => {
      const store = useAgentStore.getState();
      const activeQuery = typeof forceInstruction === "string" ? forceInstruction : store.query;
      if (typeof activeQuery !== "string" || !activeQuery.trim()) return;

      if (store.streaming) {
        store.finalizeAssistantTurn("cancelled");
      }
      store.setResult(null);
      store.setError(null);
      store.setStreaming(true);
      store.setWorkflowRun(null);
      store.clearAgentLogs();
      let requestId: string | null = null;
      let runId: string | null = null;
      try {
        const clipboardContent = store.clipboardText;
        const sourceMode: "free" | "clipboard" = clipboardContent.trim() ? "clipboard" : "free";
        store.startUserTurn(activeQuery, sourceMode);
        store.setQuery("");

        requestId = crypto.randomUUID();
        setRpcActiveRequestId(requestId);
        setActiveRequestId(requestId);
        setActiveRunId(null);

        const runInput = {
          requestId,
          prompt: activeQuery,
          mode: store.executionMode,
          sourceMode,
          clipboardText: clipboardContent,
          maxSteps: store.executionMode === "workflow" ? 8 : 1,
        };

        const res = await callAgentWithRuntimeRefresh("startRun", (runtimeApi) =>
          runtimeApi.startRun(runInput),
        ).catch(async (err) => {
          if (store.executionMode === "simple" && isStaleRuntimeError(err)) {
            const fallbackApi = await getAgent();
            const fallback = await fallbackApi.runAgent({
              requestId: requestId || crypto.randomUUID(),
              query: activeQuery,
              clipboardText: clipboardContent,
            });
            return {
              run: {
                id: requestId || crypto.randomUUID(),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                mode: "simple" as const,
                status: "completed" as const,
                prompt: activeQuery,
                sourceMode,
                clipboardPreview: clipboardContent.slice(0, 500),
                providerId: store.settings.activeProvider,
                model: store.settings.model,
                maxSteps: 1,
                currentStep: 1,
                result: fallback.result,
                metadata: {},
                steps: [],
              },
              events: fallback.events,
            };
          }
          throw err;
        });

        runId = res.run.id;
        setActiveRunId(runId);
        store.setWorkflowRun(res.run);
        store.setResult(res.run.result || "");
        if (res.run.status === "failed" || res.run.status === "cancelled") {
          const msg = res.run.errorMessage || "Workflow encerrado sem resultado.";
          store.setError(msg);
          store.finalizeAssistantTurn(res.run.status === "failed" ? "error" : "cancelled", msg);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erro ao executar comando";
        store.finalizeAssistantTurn("error", msg);
        store.setError(msg);
        store.addAgentLog({ type: "tool_fail", text: msg });
      } finally {
        useAgentStore.getState().setStreaming(false);
        setActiveRequestId((current) => (current === requestId ? null : current));
        setActiveRunId((current) => (current === runId ? null : current));
        void saveConversationToStorage();
      }
    },
    [saveConversationToStorage],
  );

  const handleCopyResult = useCallback(async () => {
    const result = useAgentStore.getState().result;
    if (!result) return;
    if (isTauriRuntime()) {
      await writeClipboard(result);
    } else {
      await navigator.clipboard?.writeText(result);
    }
    setCopied(true);
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(false), 2000);
  }, []);

  const handleAbort = useCallback(async () => {
    const store = useAgentStore.getState();
    const runId = activeRunId || store.workflowRun?.id;
    if (!activeRequestId && !runId) return;

    try {
      const api = await getAgent();
      if (runId) {
        await callAgentWithRuntimeRefresh("cancelRun", (runtimeApi) => runtimeApi.cancelRun({ runId })).catch(
          async (err) => {
            if (activeRequestId && isStaleRuntimeError(err)) {
              const fallbackApi = await getAgent();
              await fallbackApi.cancelAgent({ requestId: activeRequestId });
              return;
            }
            throw err;
          },
        );
      } else if (activeRequestId) {
        await api.cancelAgent({ requestId: activeRequestId });
      }
    } catch (err) {
      console.error("Failed to cancel request:", err);
    } finally {
      store.finalizeAssistantTurn("cancelled");
      setRpcActiveRequestId(null);
      store.setError("Execução abortada pelo usuário.");
      store.setStreaming(false);
      store.addAgentLog({ type: "tool_fail", text: "Execução abortada pelo usuário" });
      setActiveRequestId(null);
      setActiveRunId(null);
    }
  }, [activeRequestId, activeRunId]);

  const handleApproval = useCallback(async (approved: boolean) => {
    const store = useAgentStore.getState();
    const workflowRun = store.workflowRun;
    if (!workflowRun) return;

    const requestId = crypto.randomUUID();
    setActiveRequestId(requestId);
    setActiveRunId(workflowRun.id);
    store.setStreaming(approved);
    store.setError(null);

    try {
      const res = await callAgentWithRuntimeRefresh("resumeRun", (api) =>
        api.resumeRun({ requestId, runId: workflowRun.id, approved }),
      );
      store.setWorkflowRun(res.run);
      store.setResult(res.run.result || "");
      if (res.run.status === "failed" || res.run.status === "cancelled") {
        store.setError(res.run.errorMessage || "Workflow encerrado.");
      }
    } catch (err) {
      store.setError(err instanceof Error ? err.message : "Erro ao retomar workflow");
      store.addAgentLog({ type: "tool_fail", text: err instanceof Error ? err.message : String(err) });
    } finally {
      useAgentStore.getState().setStreaming(false);
      setActiveRequestId((current) => (current === requestId ? null : current));
      setActiveRunId((current) => (current === workflowRun.id ? null : current));
    }
  }, []);

  const handleQuickAction = useCallback(
    async (actionId: string) => {
      const action = QUICK_ACTIONS.find((item) => item.id === actionId);
      if (!action) return;
      const store = useAgentStore.getState();
      if (isTauriRuntime()) {
        try {
          const text = await readClipboard();
          store.setClipboardText(text ?? "");
        } catch {
          // keep existing store value
        }
      }
      store.setQuery(action.prompt);
      await handleExecute(action.prompt);
    },
    [handleExecute],
  );

  const handleStarterAction = useCallback(
    (
      prompt: string,
      modeOverride?: "simple" | "workflow",
      textareaRef?: React.RefObject<HTMLTextAreaElement | null>,
    ) => {
      const store = useAgentStore.getState();
      if (modeOverride) store.setExecutionMode(modeOverride);
      store.setQuery(prompt);
      requestAnimationFrame(() => textareaRef?.current?.focus());
    },
    [],
  );

  const handleNewTask = useCallback(() => {
    const store = useAgentStore.getState();
    store.reset();
    store.setWorkflowRun(null);
    store.setCurrentConversationId(null);
    setRpcActiveRequestId(null);
    setActiveRunId(null);
    setActiveRequestId(null);
  }, []);

  return {
    activeRequestId,
    activeRunId,
    handleExecute,
    handleCopyResult,
    handleAbort,
    handleApproval,
    handleQuickAction,
    handleStarterAction,
    handleNewTask,
    copied,
  };
}
