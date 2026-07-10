import type { Turn } from "@desktop-agent/shared";
import { unwrapAgentResponse } from "@desktop-agent/shared";
import { readText as readClipboard, writeText as writeClipboard } from "@tauri-apps/plugin-clipboard-manager";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  clearActiveRequestId as clearRpcActiveRequestId,
  getAgent,
  setActiveRequestId as setRpcActiveRequestId,
} from "../../../lib/rpc";
import { isTauriRuntime } from "../../../lib/window";
import { useAgentStore } from "../../../stores/agent";
import {
  callAgentWithRuntimeRefresh,
  isStaleRuntimeError,
  useQuickActions,
  useStaleRuntimeMessage,
} from "../constants";

const CLIPBOARD_MARKER = /[ \t]*\\?\[CLIPBOARD\][ \t]*/g;

function buildHistory(
  messages: Turn[],
  limit = 10,
): { role: "user" | "assistant" | "system"; content: string }[] {
  const history: { role: "user" | "assistant" | "system"; content: string }[] = [];
  for (const turn of messages) {
    if (turn.status !== "complete") continue;
    const text = turn.blocks
      .filter((b) => b.type === "text")
      .map((b) => (turn.role === "assistant" ? unwrapAgentResponse(b.content) : b.content))
      .join("\n")
      .trim();
    if (!text) continue;
    history.push({ role: turn.role, content: text });
  }
  return history.slice(-limit);
}

function cleanPrompt(text: string): string {
  return text
    .replace(CLIPBOARD_MARKER, "")
    .replace(/^[ \t]+$/gm, "")
    .trim();
}

export function useExecute() {
  const { t } = useTranslation("helix");
  const quickActions = useQuickActions();
  const staleMessage = useStaleRuntimeMessage();
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
        const rawClipboardText = store.clipboardText || "";
        const hasClipboard = rawClipboardText.trim().length > 0 && !store.ignoreClipboard;
        const sourceMode: "free" | "clipboard" = hasClipboard ? "clipboard" : "free";
        const resolvedPrompt = cleanPrompt(activeQuery);
        if (!resolvedPrompt) return;
        const history = buildHistory(store.messages);
        store.startUserTurn(resolvedPrompt, sourceMode);
        store.setQuery("");
        store.setIgnoreClipboard(true);

        requestId = crypto.randomUUID();
        setRpcActiveRequestId(requestId);
        setActiveRequestId(requestId);
        setActiveRunId(null);

        const clipboardText = hasClipboard ? rawClipboardText : "";
        const runInput = {
          requestId,
          prompt: resolvedPrompt,
          mode: store.executionMode,
          workflowId: store.selectedWorkflowId ?? undefined,
          skillId: store.selectedSkillId ?? undefined,
          sourceMode,
          clipboardText,
          maxSteps: store.executionMode === "workflow" ? 8 : undefined,
          history,
        };

        const res = await callAgentWithRuntimeRefresh(
          "startRun",
          (runtimeApi) => runtimeApi.startRun(runInput),
          staleMessage,
        ).catch(async (err) => {
          if (isStaleRuntimeError(err, staleMessage)) {
            const fallbackApi = await getAgent();
            const fallback = await fallbackApi.startRun(runInput);
            return fallback;
          }
          throw err;
        });

        runId = res.run.id;
        setActiveRunId(runId);
        store.setWorkflowRun(res.run);
        store.setResult(res.run.result || "");
        if (res.run.status === "failed" || res.run.status === "cancelled") {
          const msg = res.run.errorMessage || t("helix:errors.workflowEndedNoResult");
          store.setError(msg);
          store.finalizeAssistantTurn(res.run.status === "failed" ? "error" : "cancelled", msg);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : t("helix:errors.executeError");
        store.finalizeAssistantTurn("error", msg);
        store.setError(msg);
        store.addAgentLog({ type: "tool_fail", text: msg });
      } finally {
        useAgentStore.getState().setStreaming(false);
        clearRpcActiveRequestId(requestId);
        setActiveRequestId((current) => (current === requestId ? null : current));
        setActiveRunId((current) => (current === runId ? null : current));
        void saveConversationToStorage();
      }
    },
    [saveConversationToStorage, t, staleMessage],
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
      if (runId) {
        await callAgentWithRuntimeRefresh(
          "cancelRun",
          (runtimeApi) => runtimeApi.cancelRun({ runId }),
          staleMessage,
        ).catch(async (err) => {
          if (isStaleRuntimeError(err, staleMessage)) {
            const fallbackApi = await getAgent();
            await fallbackApi.cancelRun({ runId });
            return;
          }
          throw err;
        });
      }
    } catch (err) {
      console.error("Failed to cancel request:", err);
    } finally {
      store.finalizeAssistantTurn("cancelled");
      setRpcActiveRequestId(null);
      store.setError(t("helix:errors.abortedByUser"));
      store.setStreaming(false);
      store.addAgentLog({ type: "tool_fail", text: t("helix:errors.abortedByUser") });
      setActiveRequestId(null);
      setActiveRunId(null);
    }
  }, [activeRequestId, activeRunId, t, staleMessage]);

  const handleApproval = useCallback(
    async (approved: boolean) => {
      const store = useAgentStore.getState();
      const workflowRun = store.workflowRun;
      if (!workflowRun) return;

      const requestId = crypto.randomUUID();
      setRpcActiveRequestId(requestId);
      setActiveRequestId(requestId);
      setActiveRunId(workflowRun.id);
      store.setStreaming(approved);
      store.setError(null);

      try {
        const res = await callAgentWithRuntimeRefresh(
          "resumeRun",
          (api) => api.resumeRun({ requestId, runId: workflowRun.id, approved }),
          staleMessage,
        );
        store.setWorkflowRun(res.run);
        store.setResult(res.run.result || "");
        if (res.run.status === "failed" || res.run.status === "cancelled") {
          store.setError(res.run.errorMessage || t("helix:errors.workflowEnded"));
        }
      } catch (err) {
        store.setError(err instanceof Error ? err.message : t("helix:errors.resumeError"));
        store.addAgentLog({ type: "tool_fail", text: err instanceof Error ? err.message : String(err) });
      } finally {
        useAgentStore.getState().setStreaming(false);
        clearRpcActiveRequestId(requestId);
        setActiveRequestId((current) => (current === requestId ? null : current));
        setActiveRunId((current) => (current === workflowRun.id ? null : current));
      }
    },
    [t, staleMessage],
  );

  const handleQuickAction = useCallback(
    async (actionId: string) => {
      const action = quickActions.find((item) => item.id === actionId);
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
      store.setIgnoreClipboard(!action.requiresClipboard);
      store.setQuery(action.prompt);
      await handleExecute(action.prompt);
    },
    [handleExecute, quickActions],
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
