import type { FileContextInput, VisionAnalysis } from "@desktop-agent/shared";
import { describe, expect, test } from "bun:test";
import { enrichFileContextWithAppleVision } from "../../apps/desktop/src/lib/vision-file-context";

const image: FileContextInput = {
  path: "/tmp/message.png",
  displayName: "message.png",
  size: 32,
  mimeType: "image/png",
  encoding: "binary",
  preview: "",
  parsedFormat: "image",
};

describe("Apple Vision file context", () => {
  test("turns an image into structured on-device chat context", async () => {
    const analysis: VisionAnalysis = {
      processedOnDevice: true,
      features: ["text", "classification", "barcode"],
      text: {
        content: "Meeting at 10:30",
        observations: [{ text: "Meeting at 10:30", confidence: 0.92 }],
        truncated: false,
      },
      classifications: [{ identifier: "screenshot", confidence: 0.8 }],
      barcodes: [{ payload: "HELIX-42", symbology: "qr", confidence: 0.99 }],
      source: { kind: "file", displayName: "message.png" },
      durationMs: 5,
    };

    const enriched = await enrichFileContextWithAppleVision(image, async () => analysis);

    expect(enriched.encoding).toBe("parsed");
    expect(enriched.content).toContain("Meeting at 10:30");
    expect(enriched.content).toContain("HELIX-42");
    expect(enriched.parsedMetadata?.vision).toMatchObject({ processedOnDevice: true });
    expect(enriched.parsedMetadata?.vision?.averageTextConfidence).toBeCloseTo(0.92);
  });

  test("marks the image as a Vision failure without routing it back to LiteParse", async () => {
    const enriched = await enrichFileContextWithAppleVision(image, async () => {
      throw new Error("Vision unavailable");
    });
    expect(enriched.parsedFormat).toBe("image");
    expect(enriched.parsedMetadata?.visionError).toBe("Vision unavailable");
    expect(enriched.preview).toContain("Apple Vision unavailable");
  });
});
