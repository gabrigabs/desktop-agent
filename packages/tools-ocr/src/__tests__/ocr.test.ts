import { describe, expect, test } from "bun:test";
import { createOcrImageTool, createScreenshotOcrTool } from "../index";

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
});
