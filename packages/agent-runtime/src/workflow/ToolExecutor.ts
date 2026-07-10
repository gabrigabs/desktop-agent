import type { AgentEvent, ToolResult } from "@desktop-agent/shared";
import { createInteraction, getDb } from "@desktop-agent/storage";
import { registry } from "@desktop-agent/tool-registry";

export class ToolExecutor {
  constructor(
    private emit: (event: AgentEvent) => void,
    private getProviderId: () => string,
  ) {}

  async execute(requestId: string, toolName: string, input: unknown): Promise<ToolResult> {
    const tool = registry.get(toolName);
    if (!tool) {
      const error = `Unknown tool: ${toolName}`;
      this.emit({ type: "tool.failed", requestId, toolName, error });
      throw new Error(error);
    }

    this.emit({ type: "tool.started", requestId, toolName, input });
    const startedAt = Date.now();

    try {
      const output = await tool.handler(input);
      const durationMs = Date.now() - startedAt;

      const result: ToolResult = {
        toolName,
        input,
        output,
        providerId: this.getProviderId(),
        durationMs,
      };

      this.emit({ type: "tool.completed", requestId, toolName, output });

      try {
        createInteraction(getDb(), {
          toolName,
          providerId: this.getProviderId(),
          permissionLevel: tool.permissionLevel,
          inputPreview: JSON.stringify(input).slice(0, 500),
          outputPreview: JSON.stringify(output).slice(0, 500),
          durationMs,
          success: true,
        });
      } catch {
        // Audit log failure is non-fatal
      }

      return result;
    } catch (err) {
      const durationMs = Date.now() - startedAt;
      const errorMessage = err instanceof Error ? err.message : String(err);

      this.emit({ type: "tool.failed", requestId, toolName, error: errorMessage });

      try {
        createInteraction(getDb(), {
          toolName,
          providerId: this.getProviderId(),
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

      throw err;
    }
  }

  list(allowlist?: string[]): ReturnType<typeof registry.list> {
    const tools = registry.list();
    if (!allowlist || allowlist.length === 0) return tools;
    return tools.filter((t) => allowlist.includes(t.name));
  }
}
