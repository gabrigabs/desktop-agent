import type { z } from "zod";

export type RpcRequest = {
  id: string;
  method: string;
  params: unknown;
};

export type RpcResponse = {
  id: string;
  result?: unknown;
  error?: RpcError;
};

export type RpcError = {
  code: string;
  message: string;
  details?: unknown;
};

export type AgentEvent =
  | { type: "agent.started"; requestId: string }
  | { type: "agent.thought"; requestId: string; thought: string }
  | { type: "agent.chunk"; requestId: string; chunk: string }
  | { type: "agent.cancelled"; requestId: string }
  | { type: "agent.completed"; requestId: string }
  | { type: "error"; requestId: string; message: string }
  | { type: "workflow.started"; requestId: string; runId: string; mode: ExecutionMode; prompt?: string }
  | { type: "workflow.status"; requestId: string; runId: string; status: RunStatus }
  | { type: "workflow.step"; requestId: string; runId: string; step: WorkflowStep }
  | {
      type: "workflow.approval_required";
      requestId: string;
      runId: string;
      stepId: string;
      stepTitle: string;
      approval: ApprovalRequest;
    }
  | { type: "workflow.completed"; requestId: string; runId: string; status: RunStatus; result?: string }
  | { type: "tool.started"; requestId: string; toolName: string; input?: unknown }
  | { type: "tool.completed"; requestId: string; toolName: string; output?: unknown }
  | { type: "tool.finished"; requestId: string; toolName: string; output?: unknown }
  | { type: "tool.failed"; requestId: string; toolName: string; error: string }
  | { type: "permission.required"; permission: string };

export type PermissionLevel =
  | "local.read"
  | "local.write"
  | "network"
  | "browser.control"
  | "screen.read"
  | "external";

export type Permission = {
  id: string;
  level: PermissionLevel;
  description: string;
  granted: boolean;
  remembered: boolean;
};

export type ToolDefinition = {
  name: string;
  description: string;
  category: "text" | "desktop" | "system" | "web" | "ocr" | "mcp";
  permissionLevel: PermissionLevel;
  inputSchema: z.ZodType;
};

export type ToolResult = {
  toolName: string;
  input: unknown;
  output: unknown;
  providerId: string;
  durationMs: number;
};

export type ToolChunk = {
  type: "text" | "error" | "done";
  content?: string;
  error?: string;
};

export type ProviderKind = "mock" | "pinstripes" | "openai-compatible" | "anthropic-compatible" | "ollama";

export type ProviderConfig = {
  id: string;
  name: string;
  kind: ProviderKind;
  baseUrl: string;
  apiKeyEnv: string;
  models: string[];
};

export type CompletionSignal = {
  readonly aborted: boolean;
  addEventListener(type: "abort", listener: () => void, options?: { once?: boolean }): void;
  removeEventListener(type: "abort", listener: () => void): void;
};

export type CompletionInput = {
  model: string;
  messages: { role: "system" | "user" | "assistant"; content: string }[];
  maxTokens?: number;
  temperature?: number;
  signal?: CompletionSignal;
};

export type CompletionOutput = {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
  };
};

export type CompletionChunk = {
  content: string;
  done: boolean;
};

export type AuditEntry = {
  id: string;
  timestamp: string;
  toolName: string;
  providerId: string;
  permissionLevel: PermissionLevel;
  inputPreview: string;
  outputPreview: string;
  durationMs: number;
  success: boolean;
  errorMessage?: string;
};

export type WindowMode = "collapsed" | "normal" | "expanded";

export type AppSettings = {
  activeProvider: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  hidePet: boolean;
  alwaysOnTop: boolean;
  lastWindowMode: WindowMode;
  timeout: number;
  windowOpacity: number;
  petSize: number;
  language: "pt-BR" | "en";
};

export type ExecutionMode = "simple" | "workflow";

export type MessageBlock =
  | { type: "text"; content: string }
  | { type: "thinking"; content: string; collapsed?: boolean }
  | {
      type: "tool_call";
      toolName: string;
      status: "running" | "done" | "failed";
      input?: unknown;
      output?: unknown;
    }
  | { type: "error"; message: string }
  | {
      type: "context";
      source: "clipboard" | "screen" | "file" | "active_app" | "web" | "connector";
      preview: string;
      content?: string;
      policy: "include" | "reference" | "summary";
      metadata?: Record<string, unknown>;
    };

export type Turn = {
  id: string;
  role: "user" | "assistant" | "system";
  blocks: MessageBlock[];
  status: "streaming" | "complete" | "error" | "cancelled";
  timestamp: number;
  sourceMode: "free" | "clipboard";
  executionMode: ExecutionMode;
  profileId?: string;
};

export type Conversation = {
  id: string;
  title: string;
  profileId?: string;
  createdAt: string;
  updatedAt: string;
};

export type RunStatus = "queued" | "running" | "waiting_approval" | "completed" | "failed" | "cancelled";

export type WorkflowStepStatus =
  | "pending"
  | "running"
  | "waiting_approval"
  | "completed"
  | "failed"
  | "skipped";

export type WorkflowStepKind =
  | "plan"
  | "tool"
  | "observation"
  | "approval"
  | "response"
  | "hook"
  | "llm"
  | "mcp"
  | "skill";

export type WorkflowRun = {
  id: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  workflowTemplateId?: string;
  mode: ExecutionMode;
  status: RunStatus;
  prompt: string;
  sourceMode: "free" | "clipboard";
  clipboardPreview: string;
  providerId: string;
  model: string;
  maxSteps: number;
  currentStep: number;
  result: string;
  errorMessage?: string;
  approval?: ApprovalRequest;
  metadata: Record<string, unknown>;
  steps?: WorkflowStep[];
};

export type WorkflowStep = {
  id: string;
  runId: string;
  stepIndex: number;
  kind: WorkflowStepKind;
  status: WorkflowStepStatus;
  title: string;
  detail: string;
  toolName?: string;
  mcpServerId?: string;
  skillId?: string;
  permissionLevel?: PermissionLevel;
  config?: Record<string, unknown>;
  input: unknown;
  output: unknown;
  errorMessage?: string;
  requiresApproval: boolean;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
};

export type WorkflowTemplateSettings = {
  mode?: ExecutionMode;
  maxSteps?: number;
  approvalThreshold?: PermissionLevel | "none" | "all";
  toolAllowlist?: string[];
  mcpAllowlist?: string[];
  provider?: string;
  providerId?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
};

export type WorkflowStepTemplate = {
  id: string;
  templateId: string;
  stepIndex: number;
  name: string;
  kind: WorkflowStepKind;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type WorkflowTemplate = {
  id: string;
  name: string;
  description: string;
  prompt: string;
  settings: WorkflowTemplateSettings;
  steps: WorkflowStepTemplate[];
  mode: ExecutionMode;
  maxSteps: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Skill = {
  id: string;
  name: string;
  description: string;
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
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ConnectorKind = "mcp" | "api" | "local";

export type ConnectorConfig = {
  id: string;
  name: string;
  kind: ConnectorKind;
  enabled: boolean;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  preset?: boolean;
  permissionPolicy: PermissionLevel[];
  lastCheckedAt?: string;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
};

export type McpTestResult = {
  ok: boolean;
  error?: string;
  tools?: { name: string; description: string }[];
  durationMs?: number;
};

export type ApprovalRequest = {
  id: string;
  runId: string;
  stepId?: string;
  toolName?: string;
  permissionLevel: PermissionLevel;
  reason: string;
  inputPreview: string;
  createdAt: string;
};

export type PromptTemplate = {
  id: string;
  title: string;
  prompt: string;
  category: string;
  icon: string;
  executionMode: "simple" | "workflow";
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type AgentProfile = {
  id: string;
  name: string;
  systemPrompt: string;
  description: string;
  icon: string;
  tone: string;
  responseStyle: string;
  constraints: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type SavePromptInput = {
  id?: string;
  title: string;
  prompt: string;
  category?: string;
  icon?: string;
  executionMode?: "simple" | "workflow";
};

export type SaveProfileInput = {
  id?: string;
  name: string;
  systemPrompt?: string;
  description?: string;
  icon?: string;
  tone?: string;
  responseStyle?: string;
  constraints?: string;
};
