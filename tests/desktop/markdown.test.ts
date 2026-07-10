import { describe, expect, test } from "bun:test";
import { prepareMarkdown } from "../../apps/desktop/src/lib/markdown";

describe("prepareMarkdown", () => {
  test("preserves valid Markdown and prose byte for byte", () => {
    const content = [
      "### API v1.5",
      "",
      "Use `fn(valor)` em https://api.example.com/v1?q=1.5.",
      "",
      "- item com **ênfase**",
      "- item:sem alteração",
      "",
      "```tsx",
      "const App = () => <main>Olá</main>;",
      "```",
    ].join("\n");

    expect(prepareMarkdown(content)).toBe(content);
  });

  test("normalizes only transport line endings and invalid null bytes", () => {
    expect(prepareMarkdown("um\r\ndois\rtrês\u2028quatro\0")).toBe("um\ndois\ntrês\nquatro");
  });
});
