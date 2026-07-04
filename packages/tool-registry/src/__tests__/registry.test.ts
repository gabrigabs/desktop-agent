import { describe, expect, test } from "bun:test";
import { z } from "zod";
import type { RegisteredTool } from "../registry";
import { ToolRegistry } from "../registry";

describe("Tool Registry Tests", () => {
  test("Should register and retrieve tools", () => {
    const registry = new ToolRegistry();
    const tool: RegisteredTool = {
      name: "test.tool",
      description: "A test tool",
      category: "text",
      permissionLevel: "local.read",
      inputSchema: z.object({ text: z.string() }),
      handler: async (input) => input,
    };

    registry.register(tool);

    expect(registry.get("test.tool")).toBe(tool);
    expect(registry.list()).toContainEqual({
      name: "test.tool",
      description: "A test tool",
      category: "text",
      permissionLevel: "local.read",
      inputSchema: tool.inputSchema,
    });
  });

  test("Should throw when registering a duplicate tool", () => {
    const registry = new ToolRegistry();
    const tool: RegisteredTool = {
      name: "test.tool",
      description: "A test tool",
      category: "text",
      permissionLevel: "local.read",
      inputSchema: z.object({ text: z.string() }),
      handler: async (input) => input,
    };

    registry.register(tool);
    expect(() => registry.register(tool)).toThrow();
  });

  test("Should list tools by category", () => {
    const registry = new ToolRegistry();
    const tool1: RegisteredTool = {
      name: "text.tool1",
      description: "A text tool",
      category: "text",
      permissionLevel: "local.read",
      inputSchema: z.object({}),
      handler: async () => ({}),
    };
    const tool2: RegisteredTool = {
      name: "system.tool2",
      description: "A system tool",
      category: "system",
      permissionLevel: "local.write",
      inputSchema: z.object({}),
      handler: async () => ({}),
    };

    registry.register(tool1);
    registry.register(tool2);

    const textTools = registry.listByCategory("text");
    expect(textTools.length).toBe(1);
    expect(textTools[0]?.name).toBe("text.tool1");

    const systemTools = registry.listByCategory("system");
    expect(systemTools.length).toBe(1);
    expect(systemTools[0]?.name).toBe("system.tool2");
  });
});
