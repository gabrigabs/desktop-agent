import { describe, expect, test } from "bun:test";
import { sanitizeMermaidSvg, svgToDataUrl } from "../../apps/desktop/src/lib/mermaid-utils";

describe("Mermaid SVG safety", () => {
  test("encodes safe SVG as an image data URL", () => {
    const url = svgToDataUrl('<svg xmlns="http://www.w3.org/2000/svg"><text>ok</text></svg>');
    expect(url).toStartWith("data:image/svg+xml;charset=utf-8,");
  });

  test("rejects executable SVG payloads", () => {
    expect(sanitizeMermaidSvg('<svg><script>alert(1)</script></svg>')).toBeNull();
    expect(sanitizeMermaidSvg('<svg><foreignObject>html</foreignObject></svg>')).toBeNull();
    expect(sanitizeMermaidSvg('<svg onload="alert(1)"></svg>')).toBeNull();
  });
});
