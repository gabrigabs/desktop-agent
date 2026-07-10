import { describe, expect, test } from "bun:test";
import { parseAssistantContent } from "../../apps/desktop/src/lib/assistant-content";

describe("parseAssistantContent", () => {
  test("preserves response punctuation and spacing", () => {
    const content = "Use api.example.com/v1?q=1.5 e execute fn(valor).\n\nSem alterações.";

    expect(parseAssistantContent(content, false)).toEqual([{ type: "text", content }]);
  });

  test("keeps a thinking tag split between streaming chunks out of the answer", () => {
    const first = parseAssistantContent("Resposta inicial.<thi", true);
    const complete = parseAssistantContent(
      "Resposta inicial.<thinking>checando detalhes</thinking>\n\nResposta final.",
      true,
    );

    expect(first).toEqual([{ type: "text", content: "Resposta inicial." }]);
    expect(complete).toEqual([
      { type: "text", content: "Resposta inicial." },
      { type: "thinking", content: "checando detalhes", collapsed: true },
      { type: "text", content: "Resposta final." },
    ]);
  });

  test("recognizes providers that omit the opening thinking tag", () => {
    expect(parseAssistantContent("checando contexto</think>Resposta útil", false)).toEqual([
      { type: "thinking", content: "checando contexto", collapsed: true },
      { type: "text", content: "Resposta útil" },
    ]);
  });

  test("shows an incomplete tag as text once streaming finishes", () => {
    expect(parseAssistantContent("Resposta <thi", false)).toEqual([
      { type: "text", content: "Resposta <thi" },
    ]);
  });
});
