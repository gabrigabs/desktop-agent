import type { LlmProvider } from "@desktop-agent/provider-gateway";
import type { AgentEvent, CompletionInput, ExecutionGrant, PermissionLevel, ToolCall } from "@desktop-agent/shared";
import { ToolApprovalRequiredError, ToolSecurityError, type ToolExecutor } from "./ToolExecutor";

type LoopMessage = CompletionInput["messages"][number] | {
  role: "assistant";
  content: string;
  tool_calls: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
};

export type AgentLoopCheckpoint = {
  messages: LoopMessage[];
  pendingToolCalls: ToolCall[];
  callIndex: number;
  stepIndex: number;
};

export class AgentLoopApprovalRequiredError extends Error {
  constructor(
    public readonly checkpoint: AgentLoopCheckpoint,
    public readonly toolName: string,
    public readonly permissionLevel: PermissionLevel,
    public readonly input: unknown,
  ) {
    super("EXPLICIT_APPROVAL_REQUIRED");
    this.name = "AgentLoopApprovalRequiredError";
  }
}

export type AgentLoopConfig = {
  requestId: string;
  provider: LlmProvider;
  model: string;
  systemPrompt: string;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  toolExecutor: ToolExecutor;
  emit: (event: AgentEvent) => void;
  toolAllowlist?: string[];
  maxSteps?: number;
  temperature?: number;
  signal?: AbortSignal;
  checkpoint?: AgentLoopCheckpoint;
  executionGrant?: ExecutionGrant;
};

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw new Error("EXECUTION_ABORTED");
}

function parseToolArguments(args: string): unknown {
  try {
    return JSON.parse(args);
  } catch {
    throw new Error("TOOL_ARGUMENTS_INVALID_JSON");
  }
}

function toolMessage(call: ToolCall, payload: unknown): CompletionInput["messages"][number] {
  return {
    role: "tool",
    tool_call_id: call.id,
    content: JSON.stringify(payload),
  };
}

async function executeCalls(
  config: AgentLoopConfig,
  messages: LoopMessage[],
  calls: ToolCall[],
  startIndex: number,
  stepIndex: number,
): Promise<void> {
  for (let callIndex = startIndex; callIndex < calls.length; callIndex++) {
    throwIfAborted(config.signal);
    const call = calls[callIndex];
    if (!call) continue;

    let input: unknown;
    try {
      input = parseToolArguments(call.function.arguments);
    } catch (error) {
      messages.push(toolMessage(call, {
        ok: false,
        error: { code: "INVALID_ARGUMENTS", message: error instanceof Error ? error.message : String(error) },
      }));
      continue;
    }

    config.emit({
      type: "agent.thought",
      requestId: config.requestId,
      thought: `Executando ferramenta: ${call.function.name}`,
    });

    try {
      const result = await config.toolExecutor.execute(
        config.requestId,
        call.function.name,
        input,
        callIndex === startIndex ? config.executionGrant : undefined,
      );
      messages.push(toolMessage(call, { ok: true, toolName: result.toolName, output: result.output }));
    } catch (error) {
      if (error instanceof ToolApprovalRequiredError) {
        throw new AgentLoopApprovalRequiredError(
          { messages, pendingToolCalls: calls, callIndex, stepIndex },
          error.toolName,
          error.permissionLevel,
          input,
        );
      }
      if (error instanceof ToolSecurityError) throw error;
      messages.push(toolMessage(call, {
        ok: false,
        toolName: call.function.name,
        error: { code: "TOOL_EXECUTION_FAILED", message: error instanceof Error ? error.message : String(error) },
      }));
    }
  }
}

export async function runAgentLoop(config: AgentLoopConfig): Promise<string> {
  const maxSteps = config.maxSteps ?? 8;
  const messages: LoopMessage[] = config.checkpoint?.messages
    ? [...config.checkpoint.messages]
    : [{ role: "system", content: config.systemPrompt }, ...config.messages];
  const tools = config.toolExecutor.list(config.toolAllowlist);
  const providerTools = tools.map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema ? zodToJsonSchema(tool.inputSchema) : { type: "object", properties: {} },
    },
  }));

  let firstStep = config.checkpoint?.stepIndex ?? 0;
  if (config.checkpoint) {
    await executeCalls(
      config,
      messages,
      config.checkpoint.pendingToolCalls,
      config.checkpoint.callIndex,
      config.checkpoint.stepIndex,
    );
    firstStep += 1;
  }

  for (let stepIndex = firstStep; stepIndex < maxSteps; stepIndex++) {
    throwIfAborted(config.signal);
    config.emit({ type: "agent.thought", requestId: config.requestId, thought: "Analisando próxima ação..." });

    let content = "";
    let toolCalls: ToolCall[] = [];
    for await (const chunk of config.provider.stream({
      model: config.model,
      temperature: config.temperature ?? 0.2,
      signal: config.signal,
      messages: messages as CompletionInput["messages"],
      tools: providerTools.length > 0 ? providerTools : undefined,
    })) {
      throwIfAborted(config.signal);
      if (chunk.content) {
        content += chunk.content;
        config.emit({ type: "agent.chunk", requestId: config.requestId, chunk: chunk.content });
      }
      if (chunk.toolCalls) toolCalls = chunk.toolCalls;
    }

    if (toolCalls.length === 0) return content;

    messages.push({
      role: "assistant",
      content,
      tool_calls: toolCalls.map((call) => ({
        id: call.id,
        type: "function",
        function: { name: call.function.name, arguments: call.function.arguments },
      })),
    });
    await executeCalls(config, messages, toolCalls, 0, stepIndex);
    config.executionGrant = undefined;
  }

  throw new Error(`AGENT_STEP_LIMIT_EXCEEDED:${maxSteps}`);
}

type ZodLike = {
  _def?: Record<string, unknown>;
  shape?: Record<string, ZodLike> | (() => Record<string, ZodLike>);
  element?: ZodLike;
  description?: string;
  isOptional?: () => boolean;
};

function typeName(schema: ZodLike): string {
  const value = schema._def?.typeName ?? schema._def?.type;
  return typeof value === "string" ? value : "";
}

function isOptional(schema: ZodLike): boolean {
  const name = typeName(schema);
  return name === "ZodOptional" || name === "ZodDefault" || name === "optional" || name === "default"
    || schema.isOptional?.() === true;
}

export function zodToJsonSchema(schema: unknown): Record<string, unknown> {
  if (!schema || typeof schema !== "object") return {};
  const value = schema as ZodLike;
  const def = value._def ?? {};
  const name = typeName(value);
  let result: Record<string, unknown>;

  if (name === "ZodOptional" || name === "ZodDefault" || name === "ZodNullable" || name === "optional" || name === "default" || name === "nullable") {
    const inner = (def.innerType ?? def.type) as ZodLike | undefined;
    result = inner && typeof inner === "object" ? zodToJsonSchema(inner) : {};
    if (name === "ZodNullable" || name === "nullable") result = { anyOf: [result, { type: "null" }] };
  } else if (name === "ZodObject" || name === "object") {
    const rawShape = typeof value.shape === "function" ? value.shape() : value.shape;
    const shape = rawShape ?? (typeof def.shape === "function" ? (def.shape as () => Record<string, ZodLike>)() : def.shape) ?? {};
    const properties: Record<string, unknown> = {};
    const required: string[] = [];
    for (const [key, field] of Object.entries(shape as Record<string, ZodLike>)) {
      properties[key] = zodToJsonSchema(field);
      if (!isOptional(field)) required.push(key);
    }
    result = { type: "object", properties, additionalProperties: false };
    if (required.length > 0) result.required = required;
  } else if (name === "ZodString" || name === "string") result = { type: "string" };
  else if (name === "ZodNumber" || name === "number") result = { type: "number" };
  else if (name === "ZodBoolean" || name === "boolean") result = { type: "boolean" };
  else if (name === "ZodArray" || name === "array") {
    const element = value.element ?? (def.type as ZodLike | undefined) ?? (def.element as ZodLike | undefined);
    result = { type: "array", items: zodToJsonSchema(element) };
  } else if (name === "ZodEnum" || name === "enum") {
    const values = (def.values ?? def.entries) as string[] | Record<string, string> | undefined;
    result = { type: "string", enum: Array.isArray(values) ? values : Object.values(values ?? {}) };
  } else if (name === "ZodLiteral" || name === "literal") {
    result = { const: def.value ?? (Array.isArray(def.values) ? def.values[0] : undefined) };
  } else if (name === "ZodUnion" || name === "union") {
    result = { anyOf: ((def.options as ZodLike[] | undefined) ?? []).map(zodToJsonSchema) };
  } else if (name === "ZodRecord" || name === "record") {
    result = { type: "object", additionalProperties: zodToJsonSchema(def.valueType ?? def.value) };
  } else result = {};

  if (value.description) result.description = value.description;
  return result;
}
