import { describe, expect, test } from "bun:test";
import { createWebExtractTool, createWebSearchTool } from "../index";

describe("web tools", () => {
  test("extracts text from html with injected fetch", async () => {
    const tool = createWebExtractTool({
      fetch: async () =>
        new Response(
          "<html><head><title>Example</title></head><body><h1>Hello</h1><script>bad()</script><p>World</p></body></html>",
          {
            headers: { "content-type": "text/html" },
          },
        ),
    });

    const result = (await tool.handler({ url: "https://example.com", maxCharacters: 500 })) as {
      title: string;
      content: string;
      provider: string;
    };

    expect(result.title).toBe("Example");
    expect(result.content).toContain("Hello");
    expect(result.content).toContain("World");
    expect(result.content).not.toContain("bad");
    expect(result.provider).toBe("local");
  });

  test("falls back to Jina Search when search keys are missing", async () => {
    const tool = createWebSearchTool({
      getEnv: () => undefined,
      fetch: async (input) => new Response(`Jina result for ${String(input)}`),
    });
    const result = (await tool.handler({ query: "desktop agent" })) as {
      provider: string;
      results: Array<{ snippet: string; url: string }>;
      content: string;
    };

    expect(result.provider).toBe("jina");
    expect(result.results[0]?.url).toContain("https://s.jina.ai/");
    expect(result.content).toContain("Jina result");
  });
});
