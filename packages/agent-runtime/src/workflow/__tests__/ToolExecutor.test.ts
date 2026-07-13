import { describe, expect, test } from "bun:test";
import { registry } from "@desktop-agent/tool-registry";
import { z } from "zod";
import { createExecutionGrant } from "../ExecutionGrant";
import { ToolExecutor } from "../ToolExecutor";

describe("ToolExecutor explicit native grants", () => {
  test("does not call a sensitive tool without a grant", async () => {
    const toolName = "test.native.sensitive";
    let calls = 0;
    registry.register({
      name: toolName,
      description: "test",
      category: "desktop",
      permissionLevel: "screen.read",
      executionPolicy: "explicit_approval",
      inputSchema: z.object({ value: z.string() }),
      handler: async () => {
        calls++;
        return { ok: true };
      },
    });

    try {
      const executor = new ToolExecutor(
        () => undefined,
        () => "test",
      );
      await expect(executor.execute("request", toolName, { value: "one" })).rejects.toThrow(
        "EXPLICIT_APPROVAL_REQUIRED",
      );
      expect(calls).toBe(0);
    } finally {
      registry.unregister(toolName);
    }
  });

  test("binds a grant to the exact input and consumes it once", async () => {
    const toolName = "test.native.once";
    let calls = 0;
    registry.register({
      name: toolName,
      description: "test",
      category: "desktop",
      permissionLevel: "accessibility.read",
      executionPolicy: "explicit_approval",
      inputSchema: z.object({ value: z.string() }),
      handler: async () => {
        calls++;
        return { ok: true };
      },
    });

    try {
      const executor = new ToolExecutor(
        () => undefined,
        () => "test",
      );
      const input = { value: "one" };
      const grant = createExecutionGrant(toolName, "accessibility.read", input);
      await expect(executor.execute("request", toolName, { value: "two" }, grant)).rejects.toThrow(
        "input does not match",
      );
      await executor.execute("request", toolName, input, grant);
      await expect(executor.execute("request", toolName, input, grant)).rejects.toThrow(
        "EXECUTION_GRANT_REUSED",
      );
      expect(calls).toBe(1);
    } finally {
      registry.unregister(toolName);
    }
  });

  test("rejects expired grants before invoking the handler", async () => {
    const toolName = "test.native.expired";
    let calls = 0;
    registry.register({
      name: toolName,
      description: "test",
      category: "desktop",
      permissionLevel: "notification.send",
      executionPolicy: "explicit_approval",
      inputSchema: z.object({}),
      handler: async () => {
        calls++;
        return { ok: true };
      },
    });

    try {
      const executor = new ToolExecutor(
        () => undefined,
        () => "test",
      );
      const grant = { ...createExecutionGrant(toolName, "notification.send", {}), expiresAt: Date.now() - 1 };
      await expect(executor.execute("request", toolName, {}, grant)).rejects.toThrow(
        "EXECUTION_GRANT_EXPIRED",
      );
      expect(calls).toBe(0);
    } finally {
      registry.unregister(toolName);
    }
  });
});
