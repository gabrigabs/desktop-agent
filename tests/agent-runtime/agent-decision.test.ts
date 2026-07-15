import { describe, expect, test } from "bun:test";
import { parseAgentDecision, unwrapAgentResponse } from "../../packages/shared/src/agent-decision";

describe("parseAgentDecision", () => {
  test("unwraps only the outer JSON fence", () => {
    const response = [
      "```json",
      JSON.stringify({
        toolName: null,
        toolInput: null,
        directResponse: "Exemplo:\n\n```typescript\nconst value = 1;\n```",
      }),
      "```",
    ].join("\n");

    expect(parseAgentDecision(response)).toMatchObject({
      directResponse: "Exemplo:\n\n```typescript\nconst value = 1;\n```",
      structured: true,
    });
  });

  test("falls back to the provider text when it is not JSON", () => {
    expect(parseAgentDecision("Resposta direta.")).toEqual({
      toolName: null,
      toolInput: null,
      directResponse: "Resposta direta.",
      structured: false,
    });
  });

  test("rejects invalid decision field types", () => {
    expect(parseAgentDecision('{"toolName":42,"directResponse":false}')).toEqual({
      toolName: null,
      toolInput: null,
      directResponse: null,
      structured: true,
    });
  });

  test("extracts a decision after provider reasoning", () => {
    const response = [
      "The user asked for a greeting. I should return the requested JSON.",
      '{"toolName":null,"toolInput":null,"directResponse":"Olá! Como posso ajudar?"}',
    ].join("\n\n");

    expect(parseAgentDecision(response)).toEqual({
      toolName: null,
      toolInput: null,
      directResponse: "Olá! Como posso ajudar?",
      structured: true,
    });
  });

  test("keeps braces and code fences inside directResponse", () => {
    const response = [
      "Análise antes da resposta.",
      JSON.stringify({
        toolName: null,
        toolInput: null,
        directResponse: "```json\n{\"ok\": true}\n```",
      }),
    ].join("\n");

    expect(parseAgentDecision(response).directResponse).toBe("```json\n{\"ok\": true}\n```");
  });

  test("uses the last valid decision when the provider repeats the schema", () => {
    const response = [
      '{"toolName":null,"toolInput":null,"directResponse":null}',
      '{"toolName":null,"toolInput":null,"directResponse":"Resposta final"}',
    ].join("\n");

    expect(parseAgentDecision(response).directResponse).toBe("Resposta final");
  });

  test("removes explicit thinking markup from a plain fallback", () => {
    expect(parseAgentDecision("<think>análise interna</think>Resposta útil")).toMatchObject({
      directResponse: "Resposta útil",
      structured: false,
    });
  });

  test("unwraps structured output for historical rendering", () => {
    const response = [
      "Análise que não deve aparecer.",
      '{"toolName":null,"toolInput":null,"directResponse":"# Título\\n\\nResposta."}',
    ].join("\n");

    expect(unwrapAgentResponse(response)).toBe("# Título\n\nResposta.");
  });
});
