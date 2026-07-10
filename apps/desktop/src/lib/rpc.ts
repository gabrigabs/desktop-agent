import type { AgentApi, AgentEvent } from "@desktop-agent/shared";
import { type Child, Command } from "@tauri-apps/plugin-shell";
import { RPCChannel } from "kkrpc";
import { tauriShellStdioTransport } from "kkrpc/tauri";
import i18n from "../i18n";
import { useAgentStore } from "../stores/agent";

type FrontendApi = {
  onEvent(event: AgentEvent): Promise<void>;
};

let agent: AgentApi | null = null;
let channel: RPCChannel<FrontendApi, AgentApi> | null = null;
let child: Child | null = null;
let beforeUnloadHandler: (() => void) | null = null;
let activeRequestId: string | null = null;
let bootPromise: Promise<AgentApi> | null = null;
let sidecarVersion: string | null = null;
let bootAttempt = 0;

const BOOT_TIMEOUT_MS = 10000;

export function setActiveRequestId(id: string | null) {
  activeRequestId = id;
}

export function clearActiveRequestId(id: string | null) {
  if (id && activeRequestId === id) activeRequestId = null;
}

export function isMissingRpcMethodError(err: unknown, method?: string) {
  const message = err instanceof Error ? err.message : String(err);
  const normalized = message.toLowerCase();
  const matchesMethod = method ? normalized.includes(method.toLowerCase()) : true;

  return (
    matchesMethod &&
    (normalized.includes("is not a function") ||
      normalized.includes("method not found") ||
      normalized.includes("unknown method"))
  );
}

function reportBootError(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  const store = useAgentStore.getState();
  store.setConnected(false);
  store.setBootState("error");
  store.setBootError(message);
  window.dispatchEvent(new CustomEvent("agent-connection-error", { detail: message }));
}

async function doInitializeRpc(attempt: number): Promise<AgentApi> {
  const store = useAgentStore.getState();
  store.setBootState("booting");
  store.setBootError(null);

  const cmd = Command.sidecar("binaries/agent-runtime");
  const spawnedChild = await cmd.spawn();
  if (attempt !== bootAttempt) {
    await spawnedChild.kill().catch(() => undefined);
    throw new Error(i18n.t("helix:rpcLogs.bootSuperseded"));
  }
  child = spawnedChild;

  if (!beforeUnloadHandler) {
    beforeUnloadHandler = () => {
      void destroyRpc();
    };
    window.addEventListener("beforeunload", beforeUnloadHandler);
  }

  const transport = tauriShellStdioTransport({
    stdout: cmd.stdout,
    child,
  });

  channel = new RPCChannel<FrontendApi, AgentApi>(transport, {
    expose: {
      async onEvent(event) {
        // Forward event to native events store
        store.addEvent(event as AgentEvent);

        // Filter stale events from cancelled/superseded requests
        if ("requestId" in event && event.requestId !== activeRequestId) {
          return;
        }

        // Map events to user-friendly console timeline logs
        switch (event.type) {
          case "agent.started":
            activeRequestId = event.requestId;
            store.addAgentLog({ type: "info", text: i18n.t("helix:rpcLogs.preparingResponse") });
            break;
          case "agent.thought":
            store.addAgentLog({ type: "thought", text: event.thought });
            break;
          case "agent.chunk": {
            store.appendAssistantChunk(event.chunk);
            break;
          }
          case "workflow.started":
            activeRequestId = event.requestId;
            store.addAgentLog({
              type: "info",
              text:
                event.mode === "workflow"
                  ? i18n.t("helix:rpcLogs.workflowStarted")
                  : i18n.t("helix:rpcLogs.simpleModeStarted"),
            });
            store.setWorkflowRun({
              id: event.runId,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              mode: event.mode,
              status: "running",
              prompt: "",
              sourceMode: "free",
              clipboardPreview: "",
              providerId: "",
              model: "",
              maxSteps: event.mode === "workflow" ? 8 : 1,
              currentStep: 0,
              result: "",
              metadata: {},
              steps: [],
            });
            store.setResult("");
            break;
          case "workflow.step":
            store.upsertWorkflowStep(event.step);
            break;
          case "workflow.approval_required":
            store.setWorkflowApproval(event.approval);
            store.addAgentLog({ type: "info", text: i18n.t("helix:rpcLogs.waitingApprovalToContinue") });
            break;
          case "workflow.completed":
            store.setWorkflowStatus(event.status);
            store.addAgentLog({
              type:
                event.status === "completed"
                  ? "info"
                  : event.status === "waiting_approval"
                    ? "thought"
                    : "tool_fail",
              text:
                event.status === "completed"
                  ? i18n.t("helix:rpcLogs.workflowCompleted")
                  : event.status === "waiting_approval"
                    ? i18n.t("helix:rpcLogs.workflowPaused")
                    : i18n.t("helix:rpcLogs.workflowEnded"),
            });
            break;
          case "tool.started":
            store.addAgentLog({
              type: "tool_start",
              text: i18n.t("helix:rpcLogs.usingTool", { toolName: event.toolName }),
            });
            break;
          case "tool.completed":
            store.addAgentLog({
              type: "tool_complete",
              text: i18n.t("helix:rpcLogs.toolCompleted", { toolName: event.toolName }),
            });
            break;
          case "tool.failed":
            store.addAgentLog({
              type: "tool_fail",
              text: i18n.t("helix:rpcLogs.toolFailed", { toolName: event.toolName, error: event.error }),
            });
            break;
          case "agent.cancelled":
            if (event.requestId === activeRequestId) activeRequestId = null;
            store.finalizeAssistantTurn("cancelled");
            store.addAgentLog({ type: "tool_fail", text: i18n.t("helix:rpcLogs.executionAbortedByUser") });
            store.setError(i18n.t("helix:rpcLogs.executionAbortedByUserWithPeriod"));
            break;
          case "agent.completed":
            store.finalizeAssistantTurn("complete");
            store.addAgentLog({ type: "info", text: i18n.t("helix:rpcLogs.responseReady") });
            break;
        }
      },
    },
    timeout: 0,
  });

  agent = channel.getAPI();

  try {
    const ping = await agent.ping();
    if (attempt !== bootAttempt) throw new Error(i18n.t("helix:rpcLogs.bootSuperseded"));

    sidecarVersion = await agent.getVersion();
    if (attempt !== bootAttempt) throw new Error(i18n.t("helix:rpcLogs.bootSuperseded"));

    const [tools, settings] = await Promise.all([agent.listTools(), agent.getSettings()]);
    if (attempt !== bootAttempt) throw new Error(i18n.t("helix:rpcLogs.bootSuperseded"));

    store.setTools(tools);
    store.setSettings(settings);

    if (ping.status === "ok") {
      store.setConnected(true);
      store.setBootState("ready");
      store.setBootError(null);
    }
  } catch (err) {
    if (attempt === bootAttempt) {
      reportBootError(err);
      console.error("Failed to connect to agent runtime:", err);
      await destroyRpc();
    }
    throw err;
  }

  return agent;
}

export async function initializeRpc(): Promise<AgentApi> {
  if (bootPromise) return bootPromise;
  if (agent && sidecarVersion && useAgentStore.getState().connected) return agent;

  const attempt = ++bootAttempt;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      if (attempt !== bootAttempt) return;

      const err = new Error(i18n.t("helix:rpcLogs.bootTimeout"));
      reportBootError(err);
      void destroyRpc();
      reject(err);
    }, BOOT_TIMEOUT_MS);
  });

  const promise = Promise.race([doInitializeRpc(attempt), timeout]);
  bootPromise = promise;

  try {
    return await promise;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
    if (bootPromise === promise) bootPromise = null;
  }
}

export async function getAgent(): Promise<AgentApi> {
  try {
    return await initializeRpc();
  } catch (err) {
    if (isMissingRpcMethodError(err, "getVersion")) {
      console.warn("Runtime sidecar is stale, restarting to load updated sidecar...");
      return restartRpc();
    }
    throw err;
  }
}

export async function restartRpc(): Promise<AgentApi> {
  sidecarVersion = null;
  await destroyRpc();
  return initializeRpc();
}

export async function destroyRpc(): Promise<void> {
  bootAttempt += 1;
  bootPromise = null;
  sidecarVersion = null;
  if (beforeUnloadHandler) {
    window.removeEventListener("beforeunload", beforeUnloadHandler);
    beforeUnloadHandler = null;
  }
  if (channel) {
    channel.destroy();
    channel = null;
  }
  if (child) {
    await child.kill().catch(() => undefined);
    child = null;
  }
  agent = null;
  useAgentStore.getState().setConnected(false);
}
