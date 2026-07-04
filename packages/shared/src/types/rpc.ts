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
  | { type: "tool.started"; requestId: string; toolName: string }
  | { type: "tool.completed"; requestId: string; toolName: string }
  | { type: "tool.failed"; requestId: string; toolName: string; error: string }
  | { type: "permission.required"; permission: string }
  | { type: "agent.completed"; requestId: string };

export type PermissionLevel = "local.read" | "local.write" | "external";

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
  category: "text" | "desktop" | "system";
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

export type CompletionInput = {
  model: string;
  messages: { role: "system" | "user" | "assistant"; content: string }[];
  maxTokens?: number;
  temperature?: number;
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
