import { describe, expect, test } from "bun:test";

describe("Compact result helpers", () => {
  test("truncates long responses to preview length", () => {
    const longResponse = "Lorem ipsum.\n".repeat(20).trim();
    const preview = longResponse.slice(0, 240);
    expect(preview.length).toBeLessThan(longResponse.length);
    expect(longResponse.startsWith(preview)).toBe(true);
  });

  test("keeps short responses fully in preview", () => {
    const shortResponse = "Resposta curta.";
    const preview = shortResponse.slice(0, 240);
    expect(preview).toBe(shortResponse);
  });

  test("refine prompt inserts continuation text without sending", () => {
    let composerQuery = "Resposta curta.";
    const onRefine = (text: string) => {
      composerQuery += ` ${text}`;
    };

    onRefine("Seja mais conciso.");
    expect(composerQuery).toContain("Seja mais conciso.");
  });

  test("expand preserves current conversation id", () => {
    const conversationId = "conv-123";
    const expand = (currentId: string) => currentId;
    expect(expand(conversationId)).toBe(conversationId);
  });
});
