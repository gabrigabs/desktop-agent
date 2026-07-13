import { describe, expect, test } from "bun:test";
import { MockProvider } from "@desktop-agent/provider-gateway";
import { createMermaidGenerateTool } from "../mermaid";

describe("Mermaid generation tool", () => {
  test("returns validated Mermaid after removing provider fences", async () => {
    const tool = createMermaidGenerateTool({
      provider: new MockProvider(),
      validate: async (code) =>
        code.startsWith("Resposta mock") ? { valid: true } : { valid: false, error: "unexpected output" },
    });

    const result = (await tool.handler({ description: "um fluxo simples" })) as {
      code: string;
      attempts: number;
    };
    expect(result.code).toContain("Resposta mock");
    expect(result.attempts).toBe(1);
  });

  test("retries twice and returns a structured parse error", async () => {
    const tool = createMermaidGenerateTool({
      provider: new MockProvider(),
      validate: async () => ({ valid: false, error: "parse failed" }),
    });

    expect(tool.handler({ description: "diagrama inválido" })).rejects.toThrow("MERMAID_PARSE_ERROR");
  });
});
