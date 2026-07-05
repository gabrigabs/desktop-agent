import { execFile } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import type { RegisteredTool } from "@desktop-agent/tool-registry";
import { z } from "zod";

const execFileAsync = promisify(execFile);

export type OcrToolContext = {
  runOcr?: (input: { imagePath: string; language: string }) => Promise<string>;
  captureScreenshot?: () => Promise<string>;
  getEnv?: (key: string) => string | undefined;
};

const imageSchema = z.object({
  imagePath: z.string().min(1),
  language: z.string().optional(),
  apiKey: z.string().optional(),
});

const screenshotSchema = z.object({
  instruction: z.string().optional(),
  language: z.string().optional(),
  apiKey: z.string().optional(),
});

function getEnv(ctx: OcrToolContext | undefined, key: string) {
  if (ctx?.getEnv) return ctx.getEnv(key);
  return process.env[key];
}

async function runTesseract(imagePath: string, language: string) {
  try {
    const { stdout } = await execFileAsync("tesseract", [imagePath, "stdout", "-l", language]);
    return stdout.trim();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(
      `OCR local indisponível. Instale tesseract ou configure OCR_SPACE_API_KEY. Detalhe: ${message}`,
    );
  }
}

async function runOcrSpace(imagePath: string, language: string, apiKey: string) {
  const form = new FormData();
  form.append("apikey", apiKey);
  form.append("language", language);
  form.append("isOverlayRequired", "false");
  form.append("file", Bun.file(imagePath));

  const res = await fetch("https://api.ocr.space/parse/image", {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    throw new Error(`OCR.space retornou HTTP ${res.status}`);
  }

  const data = (await res.json()) as {
    IsErroredOnProcessing?: boolean;
    ErrorMessage?: string | string[];
    ParsedResults?: Array<{ ParsedText?: string }>;
  };
  if (data.IsErroredOnProcessing) {
    const error = Array.isArray(data.ErrorMessage) ? data.ErrorMessage.join("; ") : data.ErrorMessage;
    throw new Error(error || "OCR.space não conseguiu processar a imagem.");
  }

  return (data.ParsedResults ?? [])
    .map((item) => item.ParsedText ?? "")
    .join("\n")
    .trim();
}

async function captureScreenshot() {
  const dir = await mkdtemp(join(tmpdir(), "desktop-agent-ocr-"));
  const imagePath = join(dir, "screenshot.png");
  await execFileAsync("screencapture", ["-x", imagePath]);
  return imagePath;
}

async function runOcr(ctx: OcrToolContext | undefined, imagePath: string, language: string, apiKey?: string) {
  if (ctx?.runOcr) {
    return ctx.runOcr({ imagePath, language });
  }

  const ocrSpaceKey = apiKey || getEnv(ctx, "OCR_SPACE_API_KEY");
  if (ocrSpaceKey) {
    return runOcrSpace(imagePath, language, ocrSpaceKey);
  }

  return runTesseract(imagePath, language);
}

export function createOcrImageTool(ctx?: OcrToolContext): RegisteredTool {
  return {
    name: "ocr.image",
    description: "Extrai texto de uma imagem local usando OCR local ou OCR.space opcional",
    category: "ocr",
    permissionLevel: "local.read",
    inputSchema: imageSchema,
    async handler(input) {
      const parsed = imageSchema.parse(input);
      const language = parsed.language ?? "por";
      const text = await runOcr(ctx, parsed.imagePath, language, parsed.apiKey);
      return {
        imagePath: parsed.imagePath,
        language,
        text,
        empty: text.trim().length === 0,
      };
    },
  };
}

export function createScreenshotOcrTool(ctx?: OcrToolContext): RegisteredTool {
  return {
    name: "ocr.screenshot",
    description: "Captura a tela e extrai texto com OCR após permissão explícita",
    category: "ocr",
    permissionLevel: "screen.read",
    inputSchema: screenshotSchema,
    async handler(input) {
      const parsed = screenshotSchema.parse(input);
      const imagePath = ctx?.captureScreenshot ? await ctx.captureScreenshot() : await captureScreenshot();
      const language = parsed.language ?? "por";
      const text = await runOcr(ctx, imagePath, language, parsed.apiKey);
      return {
        imagePath,
        language,
        text,
        empty: text.trim().length === 0,
        instruction: parsed.instruction ?? "",
      };
    },
  };
}
