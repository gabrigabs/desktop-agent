import { RPCChannel } from "kkrpc";
import { tauriShellStdioTransport } from "kkrpc/tauri";
import { Command } from "@tauri-apps/plugin-shell";
import type { AgentApi, AgentEvent } from "@desktop-agent/shared";
import { useAgentStore } from "../stores/agent";

type FrontendApi = {
  onEvent(event: { type: string; toolName?: string; error?: string }): Promise<void>;
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
        store.addEvent({
          type: event.type as AgentEvent["type"],
          requestId: "",
          toolName: event.toolName ?? "",
          error: event.error ?? "",
        } as AgentEvent);
      },
    },
  });

  agent = channel.getAPI();

  try {
    const ping = await agent.ping();
    if (ping.status === "ok") {
      store.setConnected(true);
    }

    const tools = await agent.listTools();
    store.setTools(tools);
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
