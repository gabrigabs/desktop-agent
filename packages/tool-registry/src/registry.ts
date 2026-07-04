import type { AgentEvent, ToolDefinition } from "@desktop-agent/shared";

export type ToolHandler = (input: unknown) => Promise<unknown> | AsyncIterable<unknown>;

export type RegisteredTool = ToolDefinition & {
  handler: ToolHandler;
  streamHandler?: ToolHandler;
};

export type ToolExecutionContext = {
  emitEvent(event: AgentEvent): void;
};

export class ToolRegistry {
  private tools = new Map<string, RegisteredTool>();

  register(tool: RegisteredTool): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool "${tool.name}" is already registered`);
    }
    this.tools.set(tool.name, tool);
  }

  get(name: string): RegisteredTool | undefined {
    return this.tools.get(name);
  }

  list(): ToolDefinition[] {
    return Array.from(this.tools.values()).map(
      ({ name, description, category, permissionLevel, inputSchema }) => ({
        name,
        description,
        category,
        permissionLevel,
        inputSchema,
      }),
    );
  }

  listByCategory(category: string): ToolDefinition[] {
    return this.list().filter((t) => t.category === category);
  }
}

export const registry = new ToolRegistry();
