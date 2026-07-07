import type { AgentApi, AgentEvent } from "@desktop-agent/shared";
import { type Child, Command } from "@tauri-apps/plugin-shell";
import { RPCChannel } from "kkrpc";
import { tauriShellStdioTransport } from "kkrpc/tauri";
import { useAgentStore } from "../stores/agent";

type FrontendApi = {
  onEvent(event: AgentEvent): Promise<void>;
};

let agent: AgentApi | null = null;
let channel: RPCChannel<FrontendApi, AgentApi> | null = null;
let child: Child | null = null;
let beforeUnloadHandler: (() => void) | null = null;
let activeRequestId: string | null = null;

export function setActiveRequestId(id: string | null) {
  activeRequestId = id;
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

export async function initializeRpc(): Promise<AgentApi> {
  if (agent) return agent;

  const store = useAgentStore.getState();

  const cmd = Command.sidecar("binaries/agent-runtime");
  child = await cmd.spawn();

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
        if ("requestId" in event && activeRequestId !== null && event.requestId !== activeRequestId) {
          return;
        }

        // Map events to user-friendly console timeline logs
        switch (event.type) {
          case "agent.started":
            activeRequestId = event.requestId;
            store.addAgentLog({ type: "info", text: "Preparando resposta" });
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
              text: event.mode === "workflow" ? "Workflow iniciado" : "Modo simples iniciado",
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
            store.addAgentLog({ type: "info", text: "Aguardando aprovação para continuar" });
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
                  ? "Workflow concluído"
                  : event.status === "waiting_approval"
                    ? "Workflow pausado"
                    : "Workflow encerrado",
            });
            break;
          case "tool.started":
            store.addAgentLog({ type: "tool_start", text: `Usando ${event.toolName}` });
            break;
          case "tool.completed":
            store.addAgentLog({ type: "tool_complete", text: `${event.toolName} concluído` });
            break;
          case "tool.failed":
            store.addAgentLog({ type: "tool_fail", text: `Falha em ${event.toolName}: ${event.error}` });
            break;
          case "agent.cancelled":
            if (event.requestId === activeRequestId) activeRequestId = null;
            store.finalizeAssistantTurn("cancelled");
            store.addAgentLog({ type: "tool_fail", text: "Execução abortada pelo usuário" });
            store.setError("Execução abortada pelo usuário.");
            break;
          case "agent.completed":
            if (event.requestId === activeRequestId) activeRequestId = null;
            store.finalizeAssistantTurn("complete");
            store.addAgentLog({ type: "info", text: "Resposta pronta" });
            break;
        }
      },
    },
    timeout: 0,
  });

  agent = channel.getAPI();

  try {
    const ping = await agent.ping();

    // Load initial tools list
    const tools = await agent.listTools();
    store.setTools(tools);

    // Load settings from database
    const settings = await agent.getSettings();
    store.setSettings(settings);

    if (ping.status === "ok") {
      store.setConnected(true);
    }

    try {
      const capabilities = await agent.listCapabilities();
      store.setConnectors(capabilities.connectors);
    } catch (err) {
      if (!isMissingRpcMethodError(err, "listCapabilities")) {
        console.error("Failed to load agent capabilities:", err);
      }
    }
  } catch (err) {
    store.setConnected(false);
    console.error("Failed to connect to agent runtime:", err);
    window.dispatchEvent(new CustomEvent("agent-connection-error", { detail: String(err) }));
  }

  return agent;
}

export async function getAgent(): Promise<AgentApi> {
  if (!agent) {
    return initializeRpc();
  }
  return agent;
}

export async function restartRpc(): Promise<AgentApi> {
  await destroyRpc();
  return initializeRpc();
}

export async function destroyRpc(): Promise<void> {
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
}
