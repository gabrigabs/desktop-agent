import type { CompletionChunk, CompletionInput, CompletionOutput, ToolCall } from "@desktop-agent/shared";
import { afterEach, describe, expect, test } from "bun:test";
import { z } from "zod";
import type { LlmProvider } from "@desktop-agent/provider-gateway";
import { registry } from "@desktop-agent/tool-registry";
import { AgentLoopApprovalRequiredError, runAgentLoop, zodToJsonSchema } from "../AgentLoop";
import { createExecutionGrant } from "../ExecutionGrant";
import { ToolExecutor } from "../ToolExecutor";

const registered: string[] = [];

afterEach(() => {
  for (const name of registered.splice(0)) registry.unregister(name);
});

function registerTool(name: string, handler: (input: unknown) => Promise<unknown>, explicit = false): void {
  registry.register({
    name,
    description: `Tool ${name}`,
    category: "system",
    permissionLevel: explicit ? "local.write" : "local.read",
    executionPolicy: explicit ? "explicit_approval" : "standard",
    inputSchema: z.object({ value: z.string(), optional: z.number().optional() }),
    handler,
  });
  registered.push(name);
}

class SequenceProvider implements LlmProvider {
  name = "sequence";
  kind = "mock" as const;
  calls: CompletionInput[] = [];

  constructor(private readonly sequences: CompletionChunk[][]) {}

  async complete(_input: CompletionInput): Promise<CompletionOutput> {
    throw new Error("complete must not be called");
  }

  async *stream(input: CompletionInput): AsyncIterable<CompletionChunk> {
    this.calls.push(input);
    for (const chunk of this.sequences[this.calls.length - 1] ?? []) yield chunk;
  }
}

function call(id: string, name: string, value: string): ToolCall {
  return { id, type: "function", function: { name, arguments: JSON.stringify({ value }) } };
}

function config(provider: LlmProvider, toolExecutor: ToolExecutor) {
  return {
    requestId: "request-1",
    provider,
    model: "model",
    systemPrompt: "system",
    messages: [{ role: "user" as const, content: "hello" }],
    toolExecutor,
    emit: () => {},
  };
}

describe("AgentLoop streaming tool state machine", () => {
  test("returns a direct streamed response without a second completion", async () => {
    const provider = new SequenceProvider([[{ content: "Olá", done: true }]]);
    const result = await runAgentLoop(config(provider, new ToolExecutor(() => {}, () => provider.name)));
    expect(result).toBe("Olá");
    expect(provider.calls).toHaveLength(1);
  });

  test("executes multiple standard tools and continues with structured tool messages", async () => {
    const values: string[] = [];
    registerTool("test.one", async (input) => { values.push((input as { value: string }).value); return { saved: true }; });
    registerTool("test.two", async (input) => { values.push((input as { value: string }).value); return { read: true }; });
    const provider = new SequenceProvider([
      [{ content: "", done: true, toolCalls: [call("1", "test.one", "a"), call("2", "test.two", "b")] }],
      [{ content: "Concluído", done: true }],
    ]);

    const result = await runAgentLoop(config(provider, new ToolExecutor(() => {}, () => provider.name)));
    expect(result).toBe("Concluído");
    expect(values).toEqual(["a", "b"]);
    expect(provider.calls[1]?.messages.filter((message) => message.role === "tool")).toHaveLength(2);
  });

  test("respects the allowlist sent to the provider", async () => {
    registerTool("test.allowed", async () => ({}));
    registerTool("test.hidden", async () => ({}));
    const provider = new SequenceProvider([[{ content: "ok", done: true }]]);
    await runAgentLoop({
      ...config(provider, new ToolExecutor(() => {}, () => provider.name)),
      toolAllowlist: ["test.allowed"],
    });
    expect(provider.calls[0]?.tools?.map((tool) => tool.function.name)).toEqual(["test.allowed"]);
  });

  test("pauses an explicit tool and resumes once with an input-bound grant", async () => {
    let executions = 0;
    registerTool("test.approved", async () => { executions += 1; return { ok: true }; }, true);
    const provider = new SequenceProvider([
      [{ content: "", done: true, toolCalls: [call("approval", "test.approved", "safe")] }],
      [{ content: "feito", done: true }],
    ]);
    const toolExecutor = new ToolExecutor(() => {}, () => provider.name);
    let approval: AgentLoopApprovalRequiredError | null = null;
    try {
      await runAgentLoop(config(provider, toolExecutor));
    } catch (error) {
      if (error instanceof AgentLoopApprovalRequiredError) approval = error;
      else throw error;
    }

    expect(approval).not.toBeNull();
    expect(executions).toBe(0);
    const grant = createExecutionGrant("test.approved", "local.write", { value: "safe" }, "step-1");
    const result = await runAgentLoop({
      ...config(provider, toolExecutor),
      checkpoint: approval?.checkpoint,
      executionGrant: grant,
    });
    expect(result).toBe("feito");
    expect(executions).toBe(1);
  });

  test("returns invalid arguments to the model as a structured tool result", async () => {
    let executions = 0;
    registerTool("test.arguments", async () => { executions += 1; return {}; });
    const invalidCall: ToolCall = {
      id: "invalid",
      type: "function",
      function: { name: "test.arguments", arguments: "{" },
    };
    const provider = new SequenceProvider([
      [{ content: "", done: true, toolCalls: [invalidCall] }],
      [{ content: "corrigido", done: true }],
    ]);
    const result = await runAgentLoop(config(provider, new ToolExecutor(() => {}, () => provider.name)));
    expect(result).toBe("corrigido");
    expect(executions).toBe(0);
    expect((provider.calls[1]?.messages.at(-1) as { content: string }).content).toContain("INVALID_ARGUMENTS");
  });

  test("fails explicitly for unknown tools and the step limit", async () => {
    const unknownProvider = new SequenceProvider([[
      { content: "", done: true, toolCalls: [call("unknown", "test.unknown", "x")] },
    ]]);
    await expect(runAgentLoop(config(unknownProvider, new ToolExecutor(() => {}, () => unknownProvider.name))))
      .rejects.toThrow("Unknown tool: test.unknown");

    registerTool("test.loop", async () => ({}));
    const loopProvider = new SequenceProvider([[
      { content: "", done: true, toolCalls: [call("loop", "test.loop", "x")] },
    ]]);
    await expect(runAgentLoop({
      ...config(loopProvider, new ToolExecutor(() => {}, () => loopProvider.name)),
      maxSteps: 1,
    })).rejects.toThrow("AGENT_STEP_LIMIT_EXCEEDED:1");
  });

  test("stops before provider execution when cancelled", async () => {
    const provider = new SequenceProvider([[{ content: "never", done: true }]]);
    const controller = new AbortController();
    controller.abort();
    await expect(runAgentLoop({
      ...config(provider, new ToolExecutor(() => {}, () => provider.name)),
      signal: controller.signal,
    })).rejects.toThrow("EXECUTION_ABORTED");
    expect(provider.calls).toHaveLength(0);
  });
});

describe("zodToJsonSchema", () => {
  test("preserves optional fields, enums, arrays, and nested objects", () => {
    const schema = z.object({
      required: z.string(),
      optional: z.number().optional(),
      mode: z.enum(["a", "b"]),
      items: z.array(z.object({ enabled: z.boolean() })),
    });
    const json = zodToJsonSchema(schema);
    expect(json.required).toEqual(["required", "mode", "items"]);
    expect((json.properties as Record<string, Record<string, unknown>>).mode?.enum).toEqual(["a", "b"]);
    expect((json.properties as Record<string, Record<string, unknown>>).items?.type).toBe("array");
  });
});
