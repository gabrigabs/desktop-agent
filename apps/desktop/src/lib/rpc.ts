import type {
  ActiveWindowSnapshot,
  AgentApi,
  AgentEvent,
  HostBridgeApi,
  NativeBoundingBox,
  NativeCaptureAnalysisRequest,
  NativeCapturePreview,
  NativeCaptureRequest,
  NativeCroppedPreview,
  NativeNotificationInput,
  NativePermissionKind,
  NativePermissionState,
  NativeSystemContext,
  VisionAnalysis,
} from "@desktop-agent/shared";
import { invoke } from "@tauri-apps/api/core";
import { type Child, Command } from "@tauri-apps/plugin-shell";
import { RPCChannel } from "kkrpc";
import { tauriShellStdioTransport } from "kkrpc/tauri";
import i18n from "../i18n";
import { useAgentStore } from "../stores/agent";
import { validateMermaid } from "./mermaid";

type FrontendApi = HostBridgeApi;

let agent: AgentApi | null = null;
let channel: RPCChannel<FrontendApi, AgentApi> | null = null;
let child: Child | null = null;
let beforeUnloadHandler: (() => void) | null = null;
let activeRequestId: string | null = null;
const knownRequestIds = new Set<string>();
let bootPromise: Promise<AgentApi> | null = null;
let sidecarVersion: string | null = null;
let bootAttempt = 0;

const BOOT_TIMEOUT_MS = 10000;
const CHUNK_FLUSH_MS = 40;

let chunkBuffer = "";
let chunkFlushTimer: ReturnType<typeof setTimeout> | null = null;

function flushChunkBuffer() {
  if (chunkBuffer) {
    useAgentStore.getState().appendAssistantChunk(chunkBuffer);
    chunkBuffer = "";
  }
  chunkFlushTimer = null;
}

function queueChunk(chunk: string) {
  chunkBuffer += chunk;
  if (!chunkFlushTimer) {
    chunkFlushTimer = setTimeout(flushChunkBuffer, CHUNK_FLUSH_MS);
  }
}

function flushChunksNow() {
  if (chunkFlushTimer) {
    clearTimeout(chunkFlushTimer);
    flushChunkBuffer();
  }
}

async function notifyNativeIfEnabled(input: NativeNotificationInput): Promise<void> {
  const settings = useAgentStore.getState().settings;
  if (!settings.notificationsEnabled) return;
  await invoke("send_native_notification", {
    input: {
      ...input,
      includePreview: Boolean(input.includePreview && settings.notificationContentMode === "preview"),
    },
  });
}

export function setActiveRequestId(id: string | null) {
  activeRequestId = id;
  if (id) knownRequestIds.add(id);
}

export function clearActiveRequestId(id: string | null) {
  if (id && activeRequestId === id) activeRequestId = null;
  if (id) knownRequestIds.delete(id);
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
      async validateMermaid(input) {
        return validateMermaid(input.code);
      },
      async getNativePermissionState(input): Promise<NativePermissionState> {
        return invoke("get_native_permission_state", { kind: input.kind });
      },
      async requestNativePermission(input): Promise<NativePermissionState> {
        return invoke("request_native_permission", { kind: input.kind });
      },
      async analyzeNativeImage(input): Promise<VisionAnalysis> {
        return invoke("analyze_native_image", { request: input });
      },
      async prepareNativeCapture(input?: NativeCaptureRequest): Promise<NativeCapturePreview> {
        return invoke("prepare_native_capture", { request: input ?? null });
      },
      async cropNativeCapture(input: {
        captureId: string;
        crop: NativeBoundingBox;
      }): Promise<NativeCroppedPreview> {
        return invoke("crop_native_capture", { request: input });
      },
      async analyzeNativeCapture(input: NativeCaptureAnalysisRequest): Promise<VisionAnalysis> {
        return invoke("analyze_native_capture", { request: input });
      },
      async discardNativeCapture(input: { captureId: string }): Promise<void> {
        await invoke("discard_native_capture", { request: { captureId: input.captureId } });
      },
      async snapshotActiveWindow(): Promise<ActiveWindowSnapshot> {
        return invoke("snapshot_active_window");
      },
      async getNativeSystemContext(): Promise<NativeSystemContext> {
        return invoke("get_native_system_context");
      },
      async sendNativeNotification(input: NativeNotificationInput) {
        if (!useAgentStore.getState().settings.notificationsEnabled) {
          throw new Error("NOTIFICATIONS_DISABLED: native notifications are disabled in settings");
        }
        await notifyNativeIfEnabled(input);
      },
      async onEvent(event) {
        // Forward event to native events store
        store.addEvent(event as AgentEvent);

        // Filter stale events from cancelled/superseded requests
        if (
          "requestId" in event &&
          event.requestId !== activeRequestId &&
          !knownRequestIds.has(event.requestId)
        ) {
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
            store.appendAssistantBlock({ type: "thinking", content: event.thought, collapsed: true });
            break;
          case "agent.chunk": {
            const store = useAgentStore.getState();
            const last = store.messages[store.messages.length - 1];
            if (last?.role === "assistant" && last.blocks[last.blocks.length - 1]?.type !== "text") {
              store.appendAssistantBlock({ type: "text", content: "" });
            }
            queueChunk(event.chunk);
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
            void notifyNativeIfEnabled({ kind: "approval" }).catch(() => undefined);
            break;
          case "workflow.completed":
            store.setWorkflowStatus(event.status);
            void notifyNativeIfEnabled({
              kind: event.status === "completed" ? "completed" : "failed",
            }).catch(() => undefined);
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
          case "tool.started": {
            store.addAgentLog({
              type: "tool_start",
              text: i18n.t("helix:rpcLogs.usingTool", { toolName: event.toolName }),
            });
            const runningIndex = store.messages[store.messages.length - 1]?.blocks?.findIndex(
              (b) => b.type === "tool_call" && b.toolName === event.toolName && b.status === "running",
            );
            if (runningIndex === -1) {
              store.appendAssistantBlock({
                type: "tool_call",
                toolName: event.toolName,
                status: "running",
                input: event.input,
              });
            }
            break;
          }
          case "tool.completed": {
            store.addAgentLog({
              type: "tool_complete",
              text: i18n.t("helix:rpcLogs.toolCompleted", { toolName: event.toolName }),
            });
            const blocks = store.messages[store.messages.length - 1]?.blocks ?? [];
            let lastIdx = -1;
            for (let i = blocks.length - 1; i >= 0; i--) {
              const b = blocks[i];
              if (b && b.type === "tool_call" && b.toolName === event.toolName && b.status === "running") {
                lastIdx = i;
                break;
              }
            }
            if (lastIdx !== -1) {
              store.updateAssistantBlock(lastIdx, { status: "done", output: event.output });
            }
            break;
          }
          case "tool.failed": {
            store.addAgentLog({
              type: "tool_fail",
              text: i18n.t("helix:rpcLogs.toolFailed", { toolName: event.toolName, error: event.error }),
            });
            const failBlocks = store.messages[store.messages.length - 1]?.blocks ?? [];
            let failIdx = -1;
            for (let i = failBlocks.length - 1; i >= 0; i--) {
              const b = failBlocks[i];
              if (b && b.type === "tool_call" && b.toolName === event.toolName && b.status === "running") {
                failIdx = i;
                break;
              }
            }
            if (failIdx !== -1) {
              store.updateAssistantBlock(failIdx, { status: "failed", output: event.error });
            }
            break;
          }
          case "agent.cancelled":
            flushChunksNow();
            if (event.requestId === activeRequestId) activeRequestId = null;
            store.finalizeAssistantTurn("cancelled");
            store.addAgentLog({ type: "tool_fail", text: i18n.t("helix:rpcLogs.executionAbortedByUser") });
            store.setError(i18n.t("helix:rpcLogs.executionAbortedByUserWithPeriod"));
            break;
          case "agent.completed":
            flushChunksNow();
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

export async function requestNativePermission(kind: NativePermissionKind): Promise<NativePermissionState> {
  return invoke("request_native_permission", { kind });
}

export async function prepareNativeCapture(request?: NativeCaptureRequest): Promise<NativeCapturePreview> {
  return invoke("prepare_native_capture", { request: request ?? null });
}

export async function cropNativeCapture(request: {
  captureId: string;
  crop: NativeBoundingBox;
}): Promise<NativeCroppedPreview> {
  return invoke("crop_native_capture", { request });
}

export async function analyzeNativeCapture(request: NativeCaptureAnalysisRequest): Promise<VisionAnalysis> {
  return invoke("analyze_native_capture", { request });
}

export async function analyzeNativeImage(input: {
  path: string;
  features: import("@desktop-agent/shared").VisionFeature[];
  displayName?: string;
}): Promise<VisionAnalysis> {
  return invoke("analyze_native_image", { request: input });
}

export async function discardNativeCapture(captureId: string): Promise<void> {
  await invoke("discard_native_capture", { request: { captureId } });
}

export async function getNativeActiveWindow(): Promise<ActiveWindowSnapshot> {
  return invoke("snapshot_active_window");
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
  flushChunksNow();
  if (chunkFlushTimer) {
    clearTimeout(chunkFlushTimer);
    chunkFlushTimer = null;
  }
  knownRequestIds.clear();
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
