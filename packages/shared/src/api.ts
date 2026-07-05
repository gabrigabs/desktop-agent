import type {
  AgentEvent,
  AppSettings,
  ConnectorConfig,
  ExecutionMode,
  PermissionLevel,
  ProviderConfig,
  ToolResult,
  WorkflowRun,
  WorkflowTemplate,
} from "./types/rpc";

export type SaveMcpServerInput = {
  id?: string;
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  enabled?: boolean;
  preset?: boolean;
  permissionPolicy?: PermissionLevel[];
};

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
  startRun(input: {
    requestId: string;
    prompt: string;
    mode: ExecutionMode;
    sourceMode?: "free" | "clipboard";
    clipboardText?: string;
    maxSteps?: number;
  }): Promise<{
    run: WorkflowRun;
    events: AgentEvent[];
  }>;
  cancelRun(input: { runId: string }): Promise<{ cancelled: boolean }>;
  getRun(input: { runId: string }): Promise<WorkflowRun | null>;
  listRuns(input?: { limit?: number }): Promise<WorkflowRun[]>;
  resumeRun(input: { requestId: string; runId: string; approved: boolean }): Promise<{
    run: WorkflowRun;
    events: AgentEvent[];
  }>;
  listCapabilities(): Promise<{
    tools: { name: string; description: string; category: string; permissionLevel: PermissionLevel }[];
    connectors: ConnectorConfig[];
    templates: WorkflowTemplate[];
  }>;
  listMcpServers(): Promise<ConnectorConfig[]>;
  saveMcpServer(input: { server: SaveMcpServerInput }): Promise<ConnectorConfig>;
  deleteMcpServer(input: { id: string }): Promise<void>;
  testMcpServer(input: { id: string }): Promise<{ ok: boolean; error?: string }>;
  shutdown(): Promise<void>;
};
