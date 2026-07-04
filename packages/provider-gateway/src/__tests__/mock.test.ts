import { describe, expect, test } from "bun:test";
import { MockProvider } from "../providers/mock";

describe("MockProvider Tests", () => {
  test("Should complete chat request", async () => {
    const provider = new MockProvider();
    const response = await provider.complete({
      model: "mock-model",
      messages: [{ role: "user", content: "text.rewrite: please improve this text" }],
    });

    expect(response.content).toContain("Melhorias aplicadas");
    expect(response.usage).toBeDefined();
    expect(response.usage?.promptTokens).toBeGreaterThan(0);
  });

  test("Should stream chunks", async () => {
    const provider = new MockProvider();
    const chunks: string[] = [];

    for await (const chunk of provider.stream({
      model: "mock-model",
      messages: [{ role: "user", content: "text.rewrite: please improve this text" }],
    })) {
      chunks.push(chunk.content);
      if (chunk.done) break;
    }

    expect(chunks.length).toBeGreaterThan(0);
    const fullText = chunks.join("");
    expect(fullText).toContain("Melhorias aplicadas");
  });
});
