import type { AgentEvent, AppSettings, ProviderConfig, ToolResult } from "./types/rpc";

export type AgentApi = {
  ping(): Promise<{ status: string }>;
  execute(input: { requestId: string; toolName: string; input: unknown }): Promise<{
    result: ToolResult;
    events: AgentEvent[];
  }>;
  listTools(): Promise<{ name: string; description: string; category: string }[]>;
  getProviders(): Promise<ProviderConfig[]>;
  getHistory(input?: { limit?: number }): Promise<unknown[]>;
  getSettings(): Promise<AppSettings>;
  saveSettings(settings: AppSettings): Promise<void>;
  fetchModels(provider: string, apiKey: string, baseUrl?: string): Promise<string[]>;
  runAgent(input: { requestId: string; query: string; clipboardText: string }): Promise<{
    result: string;
    events: AgentEvent[];
  }>;
  cancelAgent(input: { requestId: string }): Promise<{ cancelled: boolean }>;
  shutdown(): Promise<void>;
};
