import type { LlmProvider } from "@desktop-agent/provider-gateway";
import type { AgentEvent, CompletionInput, ToolCall } from "@desktop-agent/shared";
import type { ToolExecutor } from "./ToolExecutor";

export type AgentLoopConfig = {
  requestId: string;
  provider: LlmProvider;
  model: string;
  systemPrompt: string;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  toolExecutor: ToolExecutor;
  emit: (event: AgentEvent) => void;
  maxSteps?: number;
  temperature?: number;
  signal?: AbortSignal;
};

function stringifyToolInput(input: unknown): string {
  if (typeof input === "string") return input;
  try {
    return JSON.stringify(input);
  } catch {
    return String(input);
  }
}

function throwIfAborted(signal: AbortSignal | undefined) {
  if (signal?.aborted) {
    throw new Error("Execution aborted");
  }
}

function parseToolArguments(args: string): unknown {
  try {
    return JSON.parse(args);
  } catch {
    return args;
  }
}

export async function runAgentLoop(config: AgentLoopConfig): Promise<string> {
  const {
    requestId,
    provider,
    model,
    systemPrompt,
    toolExecutor,
    emit,
    maxSteps = 8,
    temperature = 0.2,
    signal,
  } = config;
  const messages: CompletionInput["messages"] = [
    { role: "system", content: systemPrompt },
    ...config.messages,
  ];

  const tools = toolExecutor.list();
  const openAiTools =
    tools.length > 0
      ? tools.map((tool) => ({
          type: "function" as const,
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.inputSchema
              ? zodToJsonSchema(tool.inputSchema as unknown as Record<string, unknown>)
              : { type: "object", properties: {} },
          },
        }))
      : undefined;

  let finalResult = "";
  let emittedFinalChunk = false;

  for (let step = 0; step < maxSteps; step++) {
    throwIfAborted(signal);

    emit({ type: "agent.thought", requestId, thought: "Analisando próxima ação..." });

    const response = await provider.complete({
      model,
      temperature,
      signal,
      messages,
      tools: openAiTools,
    });

    if (response.toolCalls && response.toolCalls.length > 0) {
      const assistantContent = response.content ?? null;
      const toolCallMessages: ToolCall[] = response.toolCalls;

      const assistantMessage = {
        role: "assistant" as const,
        content: assistantContent,
        tool_calls: toolCallMessages.map((call) => ({
          id: call.id,
          type: call.type,
          function: { name: call.function.name, arguments: call.function.arguments },
        })),
      };
      messages.push(assistantMessage as unknown as CompletionInput["messages"][number]);

      for (const call of toolCallMessages) {
        throwIfAborted(signal);

        emit({
          type: "agent.thought",
          requestId,
          thought: `Executando ferramenta: ${call.function.name}`,
        });

        const toolResult = await toolExecutor.execute(
          requestId,
          call.function.name,
          parseToolArguments(call.function.arguments),
        );
        const outputString = stringifyToolInput(toolResult.output);

        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: outputString,
        });
      }

      continue;
    }

    finalResult = response.content ?? "";
    emittedFinalChunk = false;

    emit({ type: "agent.thought", requestId, thought: "Preparando resposta final..." });

    for await (const chunk of provider.stream({
      model,
      temperature: 0.3,
      signal,
      messages,
    })) {
      throwIfAborted(signal);
      if (chunk.content) {
        finalResult += chunk.content;
        emittedFinalChunk = true;
        emit({ type: "agent.chunk", requestId, chunk: chunk.content });
      }
    }

    if (!emittedFinalChunk) {
      emit({ type: "agent.chunk", requestId, chunk: finalResult });
    }

    break;
  }

  return finalResult;
}

function zodToJsonSchema(schema: Record<string, unknown>): Record<string, unknown> {
  if (!schema || typeof schema !== "object") return { type: "object", properties: {} };

  const def = schema._def as Record<string, unknown> | undefined;
  const typeName = def?.typeName as string | undefined;

  if (typeName === "ZodObject") {
    const shape = schema.shape as Record<string, Record<string, unknown>>;
    const properties: Record<string, unknown> = {};
    const required: string[] = [];
    for (const [key, value] of Object.entries(shape)) {
      properties[key] = zodToJsonSchema(value);
      required.push(key);
    }
    return { type: "object", properties, required };
  }
  if (typeName === "ZodString") return { type: "string" };
  if (typeName === "ZodNumber") return { type: "number" };
  if (typeName === "ZodBoolean") return { type: "boolean" };
  if (typeName === "ZodArray") {
    const element = schema.element as Record<string, unknown>;
    return { type: "array", items: zodToJsonSchema(element) };
  }
  if (typeName === "ZodOptional" || typeName === "ZodDefault") {
    const innerDef = def as Record<string, unknown> | undefined;
    const innerType = innerDef?.innerType as Record<string, unknown> | undefined;
    return innerType ? zodToJsonSchema(innerType) : { type: "object", properties: {} };
  }
  return { type: "object", properties: {} };
}
