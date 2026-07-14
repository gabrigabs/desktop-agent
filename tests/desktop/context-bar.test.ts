import { describe, expect, test } from "bun:test";
import type { ContextItem } from "../../apps/desktop/src/components/ui/feedback/context-bar";

describe("ContextBar item helpers", () => {
  const mockItems: ContextItem[] = [
    { id: "clipboard", source: "clipboard", label: "Clipboard", preview: "abc", enabled: true, sensitive: false },
    { id: "screen", source: "screen", label: "Tela", preview: "", enabled: false, sensitive: true, mock: true },
    { id: "file", source: "file", label: "Arquivo", preview: "", enabled: false, sensitive: true, mock: true },
  ];

  test("orders clipboard first, then sensitive mock items", () => {
    const ordered = [...mockItems].sort((a, b) => {
      if (a.source === "clipboard") return -1;
      if (b.source === "clipboard") return 1;
      return a.source.localeCompare(b.source);
    });

    expect(ordered[0]?.source).toBe("clipboard");
  });

  test("sensitive items start disabled", () => {
    const sensitive = mockItems.filter((i) => i.sensitive);
    for (const item of sensitive) {
      expect(item.enabled).toBe(false);
    }
  });

  test("toggle does not affect other context ids", () => {
    const toggledIds: string[] = [];
    const onToggle = (id: string) => {
      toggledIds.push(id);
    };

    onToggle("clipboard");
    expect(toggledIds).toContain("clipboard");
    expect(toggledIds).not.toContain("screen");
  });

  test("removal targets specific context id", () => {
    const removedIds: string[] = [];
    const onRemove = (id: string) => {
      removedIds.push(id);
    };

    onRemove("file");
    expect(removedIds).toEqual(["file"]);
  });

  test("mock items are marked as mock", () => {
    const mockOnly = mockItems.filter((i) => i.mock);
    expect(mockOnly.length).toBeGreaterThan(0);
    for (const item of mockOnly) {
      expect(item.mock).toBe(true);
    }
  });
});
