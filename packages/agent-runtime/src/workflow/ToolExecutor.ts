import type { AgentEvent, ExecutionGrant, PermissionLevel, ToolResult } from "@desktop-agent/shared";
import { createInteraction, getDb } from "@desktop-agent/storage";
import { registry } from "@desktop-agent/tool-registry";
import { grantKey, hashToolInput } from "./ExecutionGrant";

export class ToolApprovalRequiredError extends Error {
  constructor(
    public readonly toolName: string,
    public readonly permissionLevel: PermissionLevel,
  ) {
    super("EXPLICIT_APPROVAL_REQUIRED");
    this.name = "ToolApprovalRequiredError";
  }
}

export class ToolSecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ToolSecurityError";
  }
}

export class ToolExecutor {
  constructor(
    private emit: (event: AgentEvent) => void,
    private getProviderId: () => string,
  ) {}

  private consumedGrants = new Set<string>();

  async execute(
    requestId: string,
    toolName: string,
    input: unknown,
    grant?: ExecutionGrant,
  ): Promise<ToolResult> {
    const tool = registry.get(toolName);
    if (!tool) {
      const error = `Unknown tool: ${toolName}`;
      this.emit({ type: "tool.failed", requestId, toolName, error });
      throw new ToolSecurityError(error);
    }

    if (tool.executionPolicy === "explicit_approval") {
      if (!grant) throw new ToolApprovalRequiredError(toolName, tool.permissionLevel);
      const grantError = this.validateGrant(toolName, tool.permissionLevel, input, grant);
      if (grantError) {
        this.emit({ type: "tool.failed", requestId, toolName, error: grantError });
        throw new ToolSecurityError(grantError);
      }
    }

    const parsedInput = tool.inputSchema ? tool.inputSchema.parse(input) : input;

    this.emit({ type: "tool.started", requestId, toolName, input: parsedInput });
    const startedAt = Date.now();

    try {
      const output = await tool.handler(parsedInput);
      const durationMs = Date.now() - startedAt;

      const result: ToolResult = {
        toolName,
        input: parsedInput,
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
          inputPreview: JSON.stringify(parsedInput).slice(0, 500),
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

  private validateGrant(
    toolName: string,
    permissionLevel: PermissionLevel,
    input: unknown,
    grant?: ExecutionGrant,
  ): string | null {
    if (!grant) return "EXPLICIT_APPROVAL_REQUIRED: this tool needs a one-shot approval grant";
    if (grant.toolName !== toolName || grant.permissionLevel !== permissionLevel) {
      return "INVALID_EXECUTION_GRANT: tool or permission does not match";
    }
    if (grant.expiresAt <= Date.now()) return "EXECUTION_GRANT_EXPIRED: approval grant has expired";
    if (grant.inputHash !== hashToolInput(input))
      return "INVALID_EXECUTION_GRANT: input does not match approval";
    const key = grantKey(grant);
    if (this.consumedGrants.has(key)) return "EXECUTION_GRANT_REUSED: approval grant was already consumed";
    this.consumedGrants.add(key);
    return null;
  }

  list(allowlist?: string[]): ReturnType<typeof registry.list> {
    const tools = registry.list();
    if (!allowlist || allowlist.length === 0) return tools;
    return tools.filter((t) => allowlist.includes(t.name));
  }
}
