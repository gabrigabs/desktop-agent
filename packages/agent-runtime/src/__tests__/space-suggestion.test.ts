import { describe, expect, test } from "bun:test";
import { normalizeSpaceSuggestion } from "../space-suggestion";

const input = {
  name: "Lançamento",
  purpose: "Coordenar o lançamento do produto",
  profiles: [{ id: "product", name: "Product" }],
};

describe("normalizeSpaceSuggestion", () => {
  test("accepts fenced JSON and rejects unknown profile ids", () => {
    const result = normalizeSpaceSuggestion(
      '```json\n{"instructions":"Priorize riscos.","preferredLayout":"collections","profileId":"unknown","memoryEnabled":true,"collections":[{"name":"Tarefas","fields":[{"name":"Status","type":"select","required":true,"options":["Aberta","Feita"]}]}]}\n```',
      input,
    );

    expect(result.profileId).toBeUndefined();
    expect(result.collections[0]?.fields[0]?.options).toEqual(["Aberta", "Feita"]);
  });

  test("returns an editable deterministic fallback for malformed output", () => {
    const result = normalizeSpaceSuggestion("not-json", input);

    expect(result.instructions).toContain(input.purpose);
    expect(result.preferredLayout).toBe("chat");
    expect(result.profileId).toBe("product");
  });
});
