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

  test("artifacts action exposes all artifact spaces as secondary", () => {
    const artifacts = HELIX_ACTIONS.find((a) => a.id === "artifacts");
    expect(artifacts).toBeDefined();
    expect(artifacts?.secondaryActions?.length).toBeGreaterThanOrEqual(5);
  });

  test("secondary action ids are unique within each primary action", () => {
    for (const action of HELIX_ACTIONS) {
      const secondaries = action.secondaryActions ?? [];
      const ids = secondaries.map((s) => s.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});
