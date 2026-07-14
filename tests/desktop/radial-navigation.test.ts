import { describe, expect, test } from "bun:test";
import { HELIX_ACTIONS } from "../../packages/shared/src/helix";

describe("Radial navigation catalog", () => {
  test("exposes six primary radial intentions with unique ids", () => {
    const ids = HELIX_ACTIONS.map((a) => a.id);
    expect(ids).toHaveLength(6);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("clipboard action provides secondary quick actions", () => {
    const clipboard = HELIX_ACTIONS.find((a) => a.id === "clipboard");
    expect(clipboard).toBeDefined();
    expect(clipboard?.secondaryActions?.length).toBeGreaterThan(0);
  });

  test("follow-up is available as a primary action", () => {
    const followUp = HELIX_ACTIONS.find((action) => action.id === "follow-up");
    expect(followUp).toBeDefined();
    expect(followUp?.category).toBe("follow_up");
  });

  test("secondary action ids are unique within each primary action", () => {
    for (const action of HELIX_ACTIONS) {
      const secondaries = action.secondaryActions ?? [];
      const ids = secondaries.map((s) => s.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});
