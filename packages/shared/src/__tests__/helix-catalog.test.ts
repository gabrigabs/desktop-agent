import { describe, expect, test } from "bun:test";
import { getHelixAction, getHelixArtifact, HELIX_ACTIONS, HELIX_ARTIFACTS } from "../helix";

describe("Helix action catalog", () => {
  test("exposes the six primary radial intentions with unique ids", () => {
    expect(HELIX_ACTIONS.map((action) => action.category)).toEqual([
      "ask",
      "clipboard",
      "screen",
      "web",
      "workflow",
      "artifact",
    ]);
    expect(new Set(HELIX_ACTIONS.map((action) => action.id)).size).toBe(HELIX_ACTIONS.length);
    expect(getHelixAction("artifacts")?.title).toBe("Artefatos");
  });
});

describe("Helix artifact catalog", () => {
  test("provides the initial specialized assistants with usable quick actions", () => {
    expect(HELIX_ARTIFACTS.map((artifact) => artifact.id)).toEqual([
      "finance",
      "code",
      "study",
      "writing",
      "product",
    ]);
    expect(HELIX_ARTIFACTS.every((artifact) => artifact.quickActions.length > 0)).toBe(true);
    expect(getHelixArtifact("finance")?.ui.preferredMode).toBe("expanded");
  });
});
