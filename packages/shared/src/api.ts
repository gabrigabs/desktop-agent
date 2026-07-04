import type { AgentEvent, ProviderConfig, ToolResult } from "./types/rpc";

export type AgentApi = {
  ping(): Promise<{ status: string }>;
  execute(input: { requestId: string; toolName: string; input: unknown }): Promise<{
    result: ToolResult;
    events: AgentEvent[];
  }>;
  listTools(): Promise<{ name: string; description: string; category: string }[]>;
  getProviders(): Promise<ProviderConfig[]>;
  getHistory(input?: { limit?: number }): Promise<unknown[]>;
  shutdown(): Promise<void>;
};
