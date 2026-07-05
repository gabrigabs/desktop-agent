import type { AgentApi, AgentEvent } from "@desktop-agent/shared";
import { Command } from "@tauri-apps/plugin-shell";
import { RPCChannel } from "kkrpc";
import { tauriShellStdioTransport } from "kkrpc/tauri";
import { useAgentStore } from "../stores/agent";

type FrontendApi = {
  onEvent(event: any): Promise<void>;
};

let agent: AgentApi | null = null;
let channel: RPCChannel<FrontendApi, AgentApi> | null = null;

export async function initializeRpc(): Promise<AgentApi> {
  if (agent) return agent;

  const store = useAgentStore.getState();

  const cmd = Command.sidecar("binaries/agent-runtime");
  const child = await cmd.spawn();

  const transport = tauriShellStdioTransport({
    stdout: cmd.stdout,
    child,
  });

  channel = new RPCChannel<FrontendApi, AgentApi>(transport, {
    expose: {
      async onEvent(event) {
        // Forward event to native events store
        store.addEvent(event as AgentEvent);

        // Map events to user-friendly console timeline logs
        switch (event.type) {
          case "agent.started":
            store.addAgentLog({ type: "info", text: "🧠 Agente iniciado" });
            store.setResult(""); // Clear previous result to start streaming fresh
            break;
          case "agent.thought":
            store.addAgentLog({ type: "thought", text: event.thought });
            break;
          case "agent.chunk": {
            const currentResult = useAgentStore.getState().result || "";
            store.setResult(currentResult + event.chunk);
            break;
          }
          case "tool.started":
            store.addAgentLog({ type: "tool_start", text: `🔧 Executando ${event.toolName}...` });
            break;
          case "tool.completed":
            store.addAgentLog({ type: "tool_complete", text: `✅ ${event.toolName} concluído` });
            break;
          case "tool.failed":
            store.addAgentLog({ type: "tool_fail", text: `❌ Falha em ${event.toolName}: ${event.error}` });
            break;
          case "agent.completed":
            store.addAgentLog({ type: "info", text: "✨ Agente concluído" });
            break;
        }
      },
    },
    timeout: 0,
  });

  agent = channel.getAPI();

  try {
    const ping = await agent.ping();
    if (ping.status === "ok") {
      store.setConnected(true);
    }

    // Load initial tools list
    const tools = await agent.listTools();
    store.setTools(tools);

    // Load settings from database
    const settings = await agent.getSettings();
    store.setSettings(settings);
  } catch (err) {
    store.setConnected(false);
    console.error("Failed to connect to agent runtime:", err);
  }

  return agent;
}

export async function getAgent(): Promise<AgentApi> {
  if (!agent) {
    return initializeRpc();
  }
  return agent;
}

export async function destroyRpc(): Promise<void> {
  if (channel) {
    channel.destroy();
    channel = null;
  }
  agent = null;
}
