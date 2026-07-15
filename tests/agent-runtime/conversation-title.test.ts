import { describe, expect, test } from "bun:test";
import { sanitizeConversationTitle } from "../../packages/agent-runtime/src/conversation-title";

describe("sanitizeConversationTitle", () => {
  test("redacts common API keys from history titles", () => {
    expect(sanitizeConversationTitle("Melhore este texto sk-example_12345678901234567890")).toBe(
      "Melhore este texto [credencial removida]",
    );
  });

  test("redacts bearer tokens and normalizes line breaks", () => {
    expect(sanitizeConversationTitle("Teste\nBearer abcdefghijklmnopqrstuvwxyz.1234")).toBe(
      "Teste [credencial removida]",
    );
  });

  test("keeps ordinary titles readable and bounded", () => {
    expect(sanitizeConversationTitle("  Primeira mensagem\ncom contexto  ")).toBe(
      "Primeira mensagem com contexto",
    );
    expect(sanitizeConversationTitle("a".repeat(120))).toHaveLength(80);
  });
});
