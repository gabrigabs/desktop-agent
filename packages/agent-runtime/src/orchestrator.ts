import type { LlmProvider } from "@desktop-agent/provider-gateway";
import type { AgentEvent, ToolResult } from "@desktop-agent/shared";
import { closeDb, createInteraction, getDb, runMigrations } from "@desktop-agent/storage";
import { registry } from "@desktop-agent/tool-registry";

export type OrchestratorConfig = {
  provider: LlmProvider;
  model?: string;
  dbPath?: string;
};

export type ExecutionResult = {
  result: ToolResult;
  events: AgentEvent[];
};

export class Orchestrator {
  private provider: LlmProvider;
  private model: string;

  constructor(config: OrchestratorConfig) {
    this.provider = config.provider;
    this.model = config.model ?? "gpt-4o";

    const db = getDb(config.dbPath);
    runMigrations(db);
  }

  async execute(requestId: string, toolName: string, input: unknown): Promise<ExecutionResult> {
    const events: AgentEvent[] = [];

    const emit = (event: AgentEvent) => events.push(event);
    emit({ type: "agent.started", requestId });

    const tool = registry.get(toolName);
    if (!tool) {
      emit({
        type: "tool.failed",
        requestId,
        toolName,
        error: `Unknown tool: ${toolName}`,
      });
      emit({ type: "agent.completed", requestId });
      throw new Error(`Unknown tool: ${toolName}`);
    }

    emit({ type: "tool.started", requestId, toolName });
    const startedAt = Date.now();

    try {
      const output = await tool.handler(input);
      const durationMs = Date.now() - startedAt;

      emit({ type: "tool.completed", requestId, toolName });

      const result: ToolResult = {
        toolName,
        input,
        output,
        providerId: this.provider.name,
        durationMs,
      };

      try {
        createInteraction(getDb(), {
          toolName,
          providerId: this.provider.name,
          permissionLevel: tool.permissionLevel,
          inputPreview: JSON.stringify(input).slice(0, 500),
          outputPreview: JSON.stringify(output).slice(0, 500),
          durationMs,
          success: true,
        });
      } catch {
        // Audit log failure is non-fatal
      }

      emit({ type: "agent.completed", requestId });
      return { result, events };
    } catch (err) {
      const durationMs = Date.now() - startedAt;
      const errorMessage = err instanceof Error ? err.message : String(err);

      emit({ type: "tool.failed", requestId, toolName, error: errorMessage });

      try {
        createInteraction(getDb(), {
          toolName,
          providerId: this.provider.name,
          permissionLevel: tool.permissionLevel,
          inputPreview: JSON.stringify(input).slice(0, 500),
          outputPreview: "",
          durationMs,
          success: false,
          errorMessage,
        });
      } catch {
        // Audit log failure is non-fatal
      }

      emit({ type: "agent.completed", requestId });
      throw err;
    }
  }

  async *streamExecute(requestId: string, toolName: string, input: unknown): AsyncIterable<AgentEvent> {
    yield { type: "agent.started", requestId };

    const tool = registry.get(toolName);
    if (!tool) {
      yield {
        type: "tool.failed",
        requestId,
        toolName,
        error: `Unknown tool: ${toolName}`,
      };
      yield { type: "agent.completed", requestId };
      return;
    }

    yield { type: "tool.started", requestId, toolName };

    try {
      const handlerFn = tool.streamHandler ?? tool.handler;
      const res = await handlerFn(input);
      if (res && typeof res === "object" && Symbol.asyncIterator in res) {
        for await (const _chunk of res as AsyncIterable<unknown>) {
          yield { type: "tool.completed", requestId, toolName };
        }
      } else {
        yield { type: "tool.completed", requestId, toolName };
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      yield { type: "tool.failed", requestId, toolName, error: errorMessage };
    }

    yield { type: "agent.completed", requestId };
  }

  shutdown(): void {
    closeDb();
  }
}
