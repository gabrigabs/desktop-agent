import type { Turn } from "@desktop-agent/shared";
import { unwrapAgentResponse } from "@desktop-agent/shared";
import { readText as readClipboard, writeText as writeClipboard } from "@tauri-apps/plugin-clipboard-manager";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  clearActiveRequestId as clearRpcActiveRequestId,
  getAgent,
  restartRpc,
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

class RuntimeRequestTimeoutError extends Error {}

async function withRuntimeTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new RuntimeRequestTimeoutError(message)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

function buildHistory(
  messages: Turn[],
  limit = 10,
): { role: "user" | "assistant" | "system"; content: string }[] {
  const history: { role: "user" | "assistant" | "system"; content: string }[] = [];
  for (const turn of messages) {
    if (turn.status !== "complete") continue;
    const textParts: string[] = turn.blocks
      .filter((b): b is { type: "text"; content: string } => b.type === "text")
      .map((b) => (turn.role === "assistant" ? unwrapAgentResponse(b.content) : b.content));
    const contextParts: string[] = turn.blocks
      .filter((b) => b.type === "context")
      .map(
        (b) =>
          (b as Extract<Turn["blocks"][number], { type: "context" }>).content ??
          (b as Extract<Turn["blocks"][number], { type: "context" }>).preview,
      );
    const parts = [...textParts, ...contextParts].filter(Boolean);
    if (parts.length === 0) continue;
    history.push({ role: turn.role, content: parts.join("\n\n").trim() });
  }
  return history.slice(-limit);
}

function cleanPrompt(text: string): string {
  return text
    .replace(CLIPBOARD_MARKER, "")
    .replace(/^[ \t]+$/gm, "")
    .trim();
}

function formatFileContext(files: ReturnType<typeof useAgentStore.getState>["fileContext"]): string {
  if (files.length === 0) return "";
  return files
    .map((file) => {
      const meta = [
        `--- Arquivo anexado: ${file.displayName} ---`,
        `Path: ${file.path}`,
        `Tipo MIME: ${file.mimeType}`,
        `Formato parseado: ${file.parsedFormat ?? "não identificado"}`,
        `Codificação: ${file.encoding}`,
        `Tamanho: ${file.size} bytes`,
      ];
      if (file.parsedMetadata?.pages != null) meta.push(`Páginas: ${file.parsedMetadata.pages}`);
      if (file.parsedMetadata?.rows != null) meta.push(`Linhas: ${file.parsedMetadata.rows}`);
      if (file.parsedMetadata?.columns != null) meta.push(`Colunas: ${file.parsedMetadata.columns}`);
      if (file.parsedMetadata?.headings && file.parsedMetadata.headings.length > 0) {
        meta.push(`Seções: ${file.parsedMetadata.headings.slice(0, 10).join(", ")}`);
      }
      if (file.preview) meta.push(`Preview: ${file.preview.slice(0, 500)}`);
      return meta.join("\n");
    })
    .join("\n\n");
}

export function useExecute(activeProfileId?: string | null) {
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
        let resolvedPrompt = cleanPrompt(activeQuery);
        if (!resolvedPrompt) {
          if (!hasClipboard) return;
          resolvedPrompt = t("helix:composer.clipboardOnlyPrompt");
        }
        const history = buildHistory(store.messages);
        const userBlocks: Turn["blocks"] = [{ type: "text", content: resolvedPrompt }];
        if (hasClipboard) {
          userBlocks.push({
            type: "context",
            source: "clipboard",
            preview: rawClipboardText.slice(0, 500),
            content: rawClipboardText,
            policy: "include",
          });
        }
        const fileContext = store.fileContext;
        if (fileContext.length > 0) {
          for (const file of fileContext) {
            userBlocks.push({
              type: "context",
              source: "file",
              preview: file.preview,
              content: file.encoding === "text" || file.encoding === "parsed" ? file.content : undefined,
              policy:
                file.encoding === "text" || file.encoding === "parsed"
                  ? "include"
                  : file.encoding === "binary"
                    ? "summary"
                    : "reference",
              metadata: {
                path: file.path,
                displayName: file.displayName,
                size: file.size,
                mimeType: file.mimeType,
                encoding: file.encoding,
              },
            });
          }
        }
        store.startUserTurn({
          prompt: resolvedPrompt,
          sourceMode,
          blocks: userBlocks,
          profileId: store.currentProfileId ?? activeProfileId ?? undefined,
        });
        store.setQuery("");
        store.setIgnoreClipboard(true);
        store.clearFileContext();

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
          contextText: formatFileContext(fileContext),
          fileContext,
          maxSteps: store.executionMode === "workflow" ? 8 : undefined,
          history,
          profileId: store.currentProfileId ?? activeProfileId ?? undefined,
        };

        const timeoutMs = Math.max(store.settings.timeout, 10) * 1000 + 5000;
        const res = await withRuntimeTimeout(
          callAgentWithRuntimeRefresh(
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
          }),
          timeoutMs,
          t("helix:errors.runtimeTimeout"),
        );

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
        if (err instanceof RuntimeRequestTimeoutError) {
          void restartRpc().catch((restartError) => {
            console.error("Failed to restart unresponsive runtime:", restartError);
          });
        }
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
    [saveConversationToStorage, t, staleMessage, activeProfileId],
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
