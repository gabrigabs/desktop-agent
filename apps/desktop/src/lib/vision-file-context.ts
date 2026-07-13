import type { FileContextInput, VisionAnalysis } from "@desktop-agent/shared";
import { analyzeNativeImage } from "./rpc";

function percentage(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export async function enrichFileContextWithAppleVision(
  file: FileContextInput,
  analyze: typeof analyzeNativeImage = analyzeNativeImage,
): Promise<FileContextInput> {
  if (file.parsedFormat !== "image" && !file.mimeType.startsWith("image/")) return file;

  try {
    const analysis: VisionAnalysis = await analyze({
      path: file.path,
      displayName: file.displayName,
      features: ["text", "classification", "barcode"],
    });
    const text = analysis.text?.content.trim() ?? "";
    const labels = (analysis.classifications ?? []).filter((item) => item.confidence >= 0.15).slice(0, 8);
    const barcodes = (analysis.barcodes ?? []).filter((item) => item.payload);
    const sections: string[] = [];
    if (text) sections.push(`## Apple Vision — extracted text\n\n${text}`);
    if (labels.length > 0) {
      sections.push(
        `## Visual classifications\n\n${labels
          .map((item) => `- ${item.identifier} (${percentage(item.confidence)})`)
          .join("\n")}`,
      );
    }
    if (barcodes.length > 0) {
      sections.push(
        `## Detected codes\n\n${barcodes.map((item) => `- ${item.symbology}: ${item.payload}`).join("\n")}`,
      );
    }
    const existingContent = file.content?.trim();
    if (sections.length === 0 && existingContent) sections.push(existingContent);
    const content = sections.join("\n\n");
    const observations = analysis.text?.observations ?? [];
    const averageTextConfidence = observations.length
      ? observations.reduce((sum, item) => sum + item.confidence, 0) / observations.length
      : undefined;

    return {
      ...file,
      encoding: "parsed",
      content,
      preview: content.slice(0, 1_000),
      parsedFormat: "image",
      parsedMetadata: {
        ...file.parsedMetadata,
        ocrApplied: Boolean(text),
        vision: {
          processedOnDevice: true,
          labels,
          barcodes,
          averageTextConfidence,
        },
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ...file,
      parsedFormat: "image",
      preview: `Apple Vision unavailable: ${message}`,
      parsedMetadata: {
        ...file.parsedMetadata,
        visionError: message,
      },
    };
  }
}
