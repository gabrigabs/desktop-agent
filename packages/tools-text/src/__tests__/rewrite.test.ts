import { describe, expect, test } from "bun:test";
import { MockProvider } from "@desktop-agent/provider-gateway";
import { createRewriteTool } from "../rewrite";

describe("Rewrite Tool Tests", () => {
  test("Should rewrite text using the mock provider", async () => {
    const provider = new MockProvider();
    const tool = createRewriteTool({ provider });

    const result = (await tool.handler({
      text: "Hello World",
      instruction: "Make it formal",
    })) as { rewritten: string };

    expect(result).toBeDefined();
    expect(result.rewritten).toContain("Resposta mock para");
  });

  test("Should fail if input text is empty", async () => {
    const provider = new MockProvider();
    const tool = createRewriteTool({ provider });

    expect(tool.handler({ text: "" })).rejects.toThrow();
  });
});
