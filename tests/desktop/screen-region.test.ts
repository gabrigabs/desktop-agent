import { describe, expect, test } from "bun:test";
import { normalizeScreenCrop } from "../../apps/desktop/src/components/ui/screen-region-modal";

describe("screen region selection", () => {
  test("normalizes a reverse drag into a Vision crop", () => {
    const crop = normalizeScreenCrop({ x: 0.8, y: 0.7 }, { x: 0.2, y: 0.1 });
    expect(crop.x).toBe(0.2);
    expect(crop.y).toBe(0.1);
    expect(crop.width).toBeCloseTo(0.6);
    expect(crop.height).toBeCloseTo(0.6);
  });
});
