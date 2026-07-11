import type {
  AgentEvent,
  AgentProfile,
  AppSettings,
  ConnectorConfig,
  Conversation,
  ExecutionMode,
  McpTestResult,
  PermissionLevel,
  PromptTemplate,
  ProviderConfig,
  SaveProfileInput,
  SavePromptInput,
  Skill,
  ToolResult,
  Turn,
  WorkflowRun,
  WorkflowStepTemplate,
  WorkflowTemplate,
  WorkflowTemplateSettings,
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

export type { SaveProfileInput, SavePromptInput };

export type AgentApi = {
  ping(): Promise<{ status: string }>;
  getVersion(): Promise<string>;
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
  startRun(input: {
    requestId: string;
    prompt: string;
    workflowId?: string;
    skillId?: string;
    mode?: ExecutionMode;
    sourceMode?: "free" | "clipboard";
    clipboardText?: string;
    maxSteps?: number;
    history?: { role: "user" | "assistant" | "system"; content: string }[];
    profileId?: string;
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
  testMcpServer(input: { id: string }): Promise<McpTestResult>;
  listConversations(input?: { limit?: number }): Promise<Conversation[]>;
  listTurns(input: { conversationId: string }): Promise<Turn[]>;
  saveConversation(input: { conversationId: string; turns: Turn[] }): Promise<void>;
  listPromptTemplates(): Promise<PromptTemplate[]>;
  savePromptTemplate(input: SavePromptInput): Promise<PromptTemplate>;
  deletePromptTemplate(input: { id: string }): Promise<void>;
  listAgentProfiles(): Promise<AgentProfile[]>;
  saveAgentProfile(input: SaveProfileInput): Promise<AgentProfile>;
  deleteAgentProfile(input: { id: string }): Promise<void>;
  setActiveProfile(input: { profileId: string | null }): Promise<void>;
  getActiveProfile(): Promise<AgentProfile | null>;
  listSkills(): Promise<Skill[]>;
  getSkill(input: { id: string }): Promise<Skill | null>;
  saveSkill(input: {
    id?: string;
    name: string;
    description?: string;
    prompt: string;
    systemPrompt?: string;
    provider?: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
    toolAllowlist?: string[];
    mcpAllowlist?: string[];
    maxSteps?: number;
    metadata?: Record<string, string>;
    compatibility?: string;
    enabled?: boolean;
  }): Promise<Skill>;
  deleteSkill(input: { id: string }): Promise<void>;
  listWorkflowTemplates(): Promise<WorkflowTemplate[]>;
  getWorkflowTemplate(input: { id: string }): Promise<WorkflowTemplate | null>;
  saveWorkflowTemplate(input: {
    id?: string;
    name: string;
    description?: string;
    prompt: string;
    settings?: WorkflowTemplateSettings;
    steps?: Array<Omit<WorkflowStepTemplate, "id" | "templateId" | "stepIndex" | "createdAt" | "updatedAt">>;
    enabled?: boolean;
  }): Promise<WorkflowTemplate>;
  deleteWorkflowTemplate(input: { id: string }): Promise<void>;
  shutdown(): Promise<void>;
};
