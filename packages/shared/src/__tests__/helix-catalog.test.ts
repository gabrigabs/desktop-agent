import { describe, expect, test } from "bun:test";
import { getHelixAction, HELIX_ACTIONS } from "../helix";

describe("Helix action catalog", () => {
  test("exposes the six primary radial intentions with unique ids", () => {
    expect(HELIX_ACTIONS.map((action) => action.category)).toEqual([
      "ask",
      "clipboard",
      "screen",
      "web",
      "workflow",
      "follow_up",
    ]);
    expect(new Set(HELIX_ACTIONS.map((action) => action.id)).size).toBe(HELIX_ACTIONS.length);
    expect(getHelixAction("follow-up")?.title).toBe("Acompanhamento");
  });
});
