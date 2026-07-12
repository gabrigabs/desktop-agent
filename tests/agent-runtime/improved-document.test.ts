import { describe, expect, test } from "bun:test";
import {
  hasMaterialDocumentChange,
  normalizeImprovedDocument,
} from "../../packages/agent-runtime/src/parser/improvedDocument";

describe("improved document response", () => {
  test("unwraps agent envelopes and Markdown fences", () => {
    const response = JSON.stringify({
      directResponse: "```markdown\n# Organized\n\n- Item\n```",
      toolName: null,
      toolInput: null,
    });
    expect(normalizeImprovedDocument(response)).toBe("# Organized\n\n- Item");
  });

  test("rejects whitespace-only changes", () => {
    expect(hasMaterialDocumentChange("Name  Ada\nRole Engineer", "Name Ada Role Engineer")).toBe(false);
    expect(hasMaterialDocumentChange("Name Ada", "# Profile\n\nName Ada")).toBe(true);
  });
});
