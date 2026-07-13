import { describe, expect, test } from "bun:test";
import { createOcrImageTool, createScreenshotOcrTool, createVisionTextTool } from "../index";

describe("ocr tools", () => {
  test("extracts text from image with injected OCR runner", async () => {
    const tool = createOcrImageTool({
      runOcr: async ({ imagePath, language }) => `${language}:${imagePath}:texto`,
    });

    const result = (await tool.handler({ imagePath: "/tmp/image.png", language: "eng" })) as {
      imagePath: string;
      language: string;
      text: string;
      empty: boolean;
    };

    expect(result.imagePath).toBe("/tmp/image.png");
    expect(result.language).toBe("eng");
    expect(result.text).toBe("eng:/tmp/image.png:texto");
    expect(result.empty).toBe(false);
  });

  test("captures screenshot through injected capture function", async () => {
    const tool = createScreenshotOcrTool({
      captureScreenshot: async () => "/tmp/screen.png",
      runOcr: async ({ imagePath }) => `lido:${imagePath}`,
    });

    const result = (await tool.handler({ instruction: "ler tela" })) as {
      imagePath: string;
      text: string;
      instruction: string;
    };

    expect(result.imagePath).toBe("/tmp/screen.png");
    expect(result.text).toBe("lido:/tmp/screen.png");
    expect(result.instruction).toBe("ler tela");
  });

  test("analyzes and discards the exact prepared native capture", async () => {
    let analyzedCaptureId = "";
    let discardedCaptureId = "";
    const tool = createScreenshotOcrTool({
      bridge: {
        prepareNativeCapture: async () => ({
          captureId: "capture-123",
          displayId: 7,
          width: 1440,
          height: 900,
          previewDataUrl: "data:image/jpeg;base64,preview",
          expiresAt: new Date().toISOString(),
        }),
        analyzeNativeCapture: async (input: { captureId: string }) => {
          analyzedCaptureId = input.captureId;
          return {
            processedOnDevice: true,
            features: ["text"],
            text: { content: "conteudo", observations: [], truncated: false },
            source: { kind: "capture", displayName: "display-7" },
            durationMs: 1,
          };
        },
        discardNativeCapture: async (input: { captureId: string }) => {
          discardedCaptureId = input.captureId;
        },
      } as never,
    });

    await tool.handler({ instruction: "ler tela" });

    expect(analyzedCaptureId).toBe("capture-123");
    expect(discardedCaptureId).toBe("capture-123");
  });

  test("rejects native image analysis outside an authorized path", async () => {
    const tool = createVisionTextTool({
      isPathAuthorized: async () => false,
      bridge: {
        analyzeNativeImage: async () => {
          throw new Error("must not be called");
        },
      } as never,
    });

    await expect(tool.handler({ imagePath: "/private/secret.png" })).rejects.toThrow("INVALID_RESOURCE");
  });
});
