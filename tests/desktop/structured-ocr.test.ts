import { describe, expect, test } from "bun:test";
import { structureVisionText } from "../../apps/desktop/src/lib/structured-ocr";

describe("structured OCR", () => {
  test("orders observations spatially and preserves semantic groups", () => {
    const result = structureVisionText({
      content: "Status: Ativo\nHELIX CAPTURE\n• Janela ativa\n• Região",
      truncated: false,
      observations: [
        { text: "• Região", confidence: 0.91, boundingBox: { x: 0.1, y: 0.52, width: 0.3, height: 0.04 } },
        { text: "HELIX CAPTURE", confidence: 0.98, boundingBox: { x: 0.1, y: 0.1, width: 0.5, height: 0.08 } },
        { text: "Status: Ativo", confidence: 0.95, boundingBox: { x: 0.1, y: 0.3, width: 0.4, height: 0.04 } },
        { text: "• Janela ativa", confidence: 0.93, boundingBox: { x: 0.1, y: 0.45, width: 0.4, height: 0.04 } },
      ],
    });

    expect(result?.lines.map((line) => line.text)).toEqual([
      "HELIX CAPTURE",
      "Status: Ativo",
      "• Janela ativa",
      "• Região",
    ]);
    expect(result?.blocks.map((block) => block.kind)).toEqual(["heading", "key_value", "list"]);
    expect(result?.markdown).toContain("## HELIX CAPTURE");
    expect(result?.markdown).toContain("**Status:** Ativo");
    expect(result?.markdown).toContain("- Janela ativa\n- Região");
  });

  test("orders items on the same visual row from left to right", () => {
    const result = structureVisionText({
      content: "Segundo\nPrimeiro\nPróxima linha",
      truncated: false,
      observations: [
        { text: "Segundo", confidence: 0.9, boundingBox: { x: 0.55, y: 0.1, width: 0.2, height: 0.04 } },
        { text: "Próxima linha", confidence: 0.9, boundingBox: { x: 0.1, y: 0.2, width: 0.3, height: 0.04 } },
        { text: "Primeiro", confidence: 0.9, boundingBox: { x: 0.1, y: 0.105, width: 0.2, height: 0.04 } },
      ],
    });

    expect(result?.lines.map((line) => line.text)).toEqual(["Primeiro", "Segundo", "Próxima linha"]);
  });

  test("falls back to extracted content when Vision has no observations", () => {
    const result = structureVisionText({ content: "Texto sem coordenadas", observations: [], truncated: true });
    expect(result?.plainText).toBe("Texto sem coordenadas");
    expect(result?.blocks).toHaveLength(1);
    expect(result?.truncated).toBe(true);
  });
});
