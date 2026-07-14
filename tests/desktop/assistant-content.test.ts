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

  test("treats streaming content as thinking when no opening tag is sent (Pinstripes)", () => {
    const streaming = parseAssistantContent("checando contexto", true);
    expect(streaming).toEqual([
      { type: "thinking", content: "checando contexto", collapsed: true },
    ]);

    const withClosing = parseAssistantContent("checando contexto</think>Resposta útil", true);
    expect(withClosing).toEqual([
      { type: "thinking", content: "checando contexto", collapsed: true },
      { type: "text", content: "Resposta útil" },
    ]);
  });

  test("keeps partial opening tag content as text during streaming", () => {
    const partial = parseAssistantContent("Resposta inicial.<thi", true);
    expect(partial).toEqual([{ type: "text", content: "Resposta inicial." }]);
  });

  test("parses tool_call blocks from markup", () => {
    const content = 'Vou verificar<tool_call name="desktop.directory.list">{"path": "/docs"}</tool_call> agora.';
    expect(parseAssistantContent(content, false)).toEqual([
      { type: "text", content: "Vou verificar" },
      { type: "tool_call", toolName: "desktop.directory.list", status: "running", input: '{"path": "/docs"}' },
      { type: "text", content: " agora." },
    ]);
  });

  test("keeps incomplete tool_call as running block during streaming", () => {
    const partial = parseAssistantContent('Iniciando <tool_call name="desktop.file.read">{"path": "/x"', true);
    expect(partial).toEqual([
      { type: "text", content: "Iniciando " },
      { type: "tool_call", toolName: "desktop.file.read", status: "running", input: '{"path": "/x"' },
    ]);
  });
});
