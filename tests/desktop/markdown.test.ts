import { describe, expect, test } from "bun:test";
import { prepareMarkdown } from "../../apps/desktop/src/lib/markdown";

function hasMermaidBlock(content: string): boolean {
  return /```mermaid\n[\s\S]*?```/.test(content);
}

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

  test("preserves mermaid code blocks for renderer detection", () => {
    const content = [
      "Veja o diagrama:",
      "",
      "```mermaid",
      "flowchart TD",
      "  A[Início] --> B{Decisão}",
      "  B -->|Sim| C[OK]",
      "  B -->|Não| D[Erro]",
      "```",
    ].join("\n");

    const prepared = prepareMarkdown(content);
    expect(hasMermaidBlock(prepared)).toBe(true);
  });

  test("does not treat plain mermaid text as a block without fences", () => {
    const content = "mermaid flowchart TD A --> B";
    expect(hasMermaidBlock(prepareMarkdown(content))).toBe(false);
  });

  test("keeps other code blocks intact while preserving mermaid fences", () => {
    const content = [
      "```ts",
      "const x = 1;",
      "```",
      "",
      "```mermaid",
      "graph LR",
      "  A --> B",
      "```",
    ].join("\n");

    const prepared = prepareMarkdown(content);
    expect(prepared).toContain("```ts");
    expect(hasMermaidBlock(prepared)).toBe(true);
  });
});
