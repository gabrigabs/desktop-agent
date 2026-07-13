import type {
  HostBridgeApi,
  NativeCaptureAnalysisRequest,
  NativeCaptureRequest,
  VisionAnalysis,
  VisionFeature,
} from "@desktop-agent/shared";
import type { RegisteredTool } from "@desktop-agent/tool-registry";
import { z } from "zod";

export type VisionToolContext = {
  bridge?: HostBridgeApi;
  isPathAuthorized?: (path: string) => Promise<boolean>;
  /** Test-only compatibility hook. Production uses the on-device native bridge. */
  runOcr?: (input: { imagePath: string; language: string }) => Promise<string>;
  /** Test-only compatibility hook. Production uses the ephemeral native capture bridge. */
  captureScreenshot?: () => Promise<string>;
};

export type OcrToolContext = VisionToolContext;

const imageSchema = z.object({
  imagePath: z.string().min(1),
  language: z.string().optional(),
  features: z.array(z.enum(["text", "classification", "barcode", "saliency"])).optional(),
});

const captureSchema = z.object({
  instruction: z.string().optional(),
  displayId: z.number().int().positive().optional(),
  crop: z.object({ x: z.number(), y: z.number(), width: z.number(), height: z.number() }).optional(),
  features: z.array(z.enum(["text", "classification", "barcode", "saliency"])).optional(),
});

const visionFeatures = (features: VisionFeature[] | undefined): VisionFeature[] =>
  features?.length ? [...new Set(features)] : ["text"];

function requireBridge(ctx: VisionToolContext | undefined): HostBridgeApi {
  if (!ctx?.bridge) throw new Error("BRIDGE_UNAVAILABLE: native Vision bridge is not connected");
  return ctx.bridge;
}

function withAliasMetadata(analysis: VisionAnalysis, alias: string) {
  return { ...analysis, deprecatedAlias: alias };
}

async function analyzeImage(
  ctx: VisionToolContext | undefined,
  input: z.infer<typeof imageSchema>,
  features: VisionFeature[],
) {
  if (!ctx?.runOcr) {
    if (!ctx?.isPathAuthorized || !(await ctx.isPathAuthorized(input.imagePath))) {
      throw new Error(
        "INVALID_RESOURCE: a imagem precisa estar dentro de um arquivo autorizado pelo usuário",
      );
    }
  }
  if (ctx?.runOcr) {
    const text = await ctx.runOcr({ imagePath: input.imagePath, language: input.language ?? "por" });
    return {
      processedOnDevice: true as const,
      features: ["text" as const],
      text: { content: text, observations: [], truncated: false },
      source: { kind: "file" as const, displayName: input.imagePath },
      durationMs: 0,
    } satisfies VisionAnalysis;
  }
  return requireBridge(ctx).analyzeNativeImage({
    path: input.imagePath,
    features,
    displayName: input.imagePath.split(/[\\/]/).pop(),
  });
}

export function createVisionTextTool(ctx?: VisionToolContext): RegisteredTool {
  return {
    name: "vision.text",
    description: "Extrai texto de uma imagem usando o Apple Vision Framework no dispositivo",
    category: "ocr",
    permissionLevel: "local.read",
    inputSchema: imageSchema,
    async handler(input) {
      const parsed = imageSchema.parse(input);
      return analyzeImage(ctx, parsed, visionFeatures(parsed.features ?? ["text"]));
    },
  };
}

export function createVisionClassificationTool(ctx?: VisionToolContext): RegisteredTool {
  return {
    name: "vision.classify",
    description: "Classifica uma imagem local no dispositivo usando o Apple Vision Framework",
    category: "ocr",
    permissionLevel: "local.read",
    inputSchema: imageSchema,
    async handler(input) {
      const parsed = imageSchema.parse(input);
      return analyzeImage(ctx, parsed, visionFeatures(parsed.features ?? ["classification"]));
    },
  };
}

export function createVisionBarcodeTool(ctx?: VisionToolContext): RegisteredTool {
  return {
    name: "vision.barcode",
    description: "Detecta códigos de barras em uma imagem local sem enviar a imagem para a nuvem",
    category: "ocr",
    permissionLevel: "local.read",
    inputSchema: imageSchema,
    async handler(input) {
      const parsed = imageSchema.parse(input);
      return analyzeImage(ctx, parsed, visionFeatures(parsed.features ?? ["barcode"]));
    },
  };
}

export function createVisionSaliencyTool(ctx?: VisionToolContext): RegisteredTool {
  return {
    name: "vision.saliency",
    description: "Retorna regiões salientes de uma imagem sem persistir heatmaps",
    category: "ocr",
    permissionLevel: "local.read",
    inputSchema: imageSchema,
    async handler(input) {
      const parsed = imageSchema.parse(input);
      return analyzeImage(ctx, parsed, visionFeatures(parsed.features ?? ["saliency"]));
    },
  };
}

export function createOcrImageTool(ctx?: VisionToolContext): RegisteredTool {
  if (ctx?.runOcr) {
    return {
      name: "ocr.image",
      description: "Alias depreciado de vision.text; extrai texto com o Apple Vision Framework",
      category: "ocr",
      permissionLevel: "local.read",
      inputSchema: imageSchema,
      async handler(input) {
        const parsed = imageSchema.parse(input);
        const text = await ctx.runOcr?.({ imagePath: parsed.imagePath, language: parsed.language ?? "por" });
        return {
          imagePath: parsed.imagePath,
          language: parsed.language ?? "por",
          text: text ?? "",
          empty: !(text ?? "").trim(),
          deprecatedAlias: "ocr.image",
        };
      },
    };
  }
  return {
    ...createVisionTextTool(ctx),
    name: "ocr.image",
    description: "Alias depreciado de vision.text; extrai texto com o Apple Vision Framework",
  };
}

export function createScreenshotOcrTool(ctx?: VisionToolContext): RegisteredTool {
  if (ctx?.captureScreenshot && ctx.runOcr) {
    return {
      name: "ocr.screenshot",
      description: "Alias depreciado de vision.text para captura efêmera de tela após aprovação explícita",
      category: "ocr",
      permissionLevel: "screen.read",
      executionPolicy: "explicit_approval",
      inputSchema: captureSchema,
      async handler(input) {
        const parsed = captureSchema.parse(input);
        const imagePath = await ctx.captureScreenshot?.();
        const text = await ctx.runOcr?.({ imagePath: imagePath ?? "", language: "por" });
        return {
          imagePath,
          text: text ?? "",
          instruction: parsed.instruction ?? "",
          deprecatedAlias: "ocr.screenshot",
        };
      },
    };
  }
  return {
    name: "ocr.screenshot",
    description: "Alias depreciado de vision.text para captura efêmera de tela após aprovação explícita",
    category: "ocr",
    permissionLevel: "screen.read",
    executionPolicy: "explicit_approval",
    inputSchema: captureSchema,
    async handler(input) {
      const parsed = captureSchema.parse(input);
      if (ctx?.captureScreenshot) {
        const imagePath = await ctx.captureScreenshot();
        const analysis = await analyzeImage(ctx, { imagePath }, visionFeatures(parsed.features));
        return withAliasMetadata(analysis, "ocr.screenshot");
      }

      const bridge = requireBridge(ctx);
      const preview = await bridge.prepareNativeCapture({
        displayId: parsed.displayId,
        excludeHelix: true,
      } satisfies NativeCaptureRequest);
      const request = {
        captureId: preview.captureId,
        features: visionFeatures(parsed.features),
        crop: parsed.crop,
        displayName: `display-${preview.displayId}`,
      } satisfies NativeCaptureAnalysisRequest;
      try {
        const analysis = await bridge.analyzeNativeCapture(request);
        return { ...analysis, instruction: parsed.instruction ?? "", deprecatedAlias: "ocr.screenshot" };
      } finally {
        await bridge.discardNativeCapture({ captureId: preview.captureId }).catch(() => undefined);
      }
    },
  };
}
