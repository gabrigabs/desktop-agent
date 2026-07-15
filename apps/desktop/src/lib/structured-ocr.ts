import type { NativeBoundingBox, VisionAnalysis, VisionTextObservation } from "@desktop-agent/shared";

export type OcrBlockKind = "heading" | "list" | "key_value" | "paragraph";

export type StructuredOcrLine = {
  text: string;
  confidence: number;
  boundingBox?: NativeBoundingBox;
};

export type StructuredOcrBlock = {
  id: string;
  kind: OcrBlockKind;
  text: string;
  confidence: number;
  lines: StructuredOcrLine[];
};

export type StructuredOcr = {
  plainText: string;
  markdown: string;
  lines: StructuredOcrLine[];
  blocks: StructuredOcrBlock[];
  averageConfidence: number;
  truncated: boolean;
};

type PositionedLine = StructuredOcrLine & { sourceIndex: number };

function median(values: number[]): number {
  if (values.length === 0) return 0.025;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const right = sorted[middle] ?? 0.025;
  const left = sorted[middle - 1] ?? right;
  return sorted.length % 2 === 0 ? (left + right) / 2 : right;
}

function lineKind(line: StructuredOcrLine, medianHeight: number): OcrBlockKind {
  const text = line.text.trim();
  if (/^(?:[-*•‣◦▪]|\d+[.)])\s+/.test(text)) return "list";
  if (/^[^:\n]{1,42}:\s+\S/.test(text)) return "key_value";
  const height = line.boundingBox?.height ?? medianHeight;
  const letters = text.replace(/[^\p{L}]/gu, "");
  const isUppercase = letters.length >= 3 && letters === letters.toLocaleUpperCase();
  if (text.length <= 80 && (height >= medianHeight * 1.28 || isUppercase)) return "heading";
  return "paragraph";
}

function blockMarkdown(block: StructuredOcrBlock): string {
  if (block.kind === "heading") return block.lines.map((line) => `## ${line.text}`).join("\n");
  if (block.kind === "list") {
    return block.lines.map((line) => `- ${line.text.replace(/^(?:[-*•‣◦▪]|\d+[.)])\s+/, "")}`).join("\n");
  }
  if (block.kind === "key_value") {
    return block.lines
      .map((line) => {
        const separator = line.text.indexOf(":");
        return separator > 0
          ? `**${line.text.slice(0, separator).trim()}:** ${line.text.slice(separator + 1).trim()}`
          : line.text;
      })
      .join("\n");
  }
  return block.lines.map((line) => line.text).join("\n");
}

function orderByVisualRows(lines: PositionedLine[]): StructuredOcrLine[] {
  const positioned = lines
    .filter((line) => line.boundingBox)
    .sort((a, b) => {
      const vertical = (a.boundingBox?.y ?? 0) - (b.boundingBox?.y ?? 0);
      if (Math.abs(vertical) > 0.002) return vertical;
      const horizontal = (a.boundingBox?.x ?? 0) - (b.boundingBox?.x ?? 0);
      return Math.abs(horizontal) > 0.002 ? horizontal : a.sourceIndex - b.sourceIndex;
    });
  const rows: Array<{ centerY: number; height: number; lines: PositionedLine[] }> = [];

  for (const line of positioned) {
    const box = line.boundingBox;
    if (!box) continue;
    const centerY = box.y + box.height / 2;
    const previous = rows[rows.length - 1];
    const sameRow =
      previous && Math.abs(centerY - previous.centerY) <= Math.max(box.height, previous.height) * 0.62;
    if (sameRow) {
      previous.lines.push(line);
      previous.centerY =
        previous.lines.reduce(
          (sum, item) => sum + (item.boundingBox?.y ?? 0) + (item.boundingBox?.height ?? 0) / 2,
          0,
        ) / previous.lines.length;
      previous.height = Math.max(previous.height, box.height);
    } else {
      rows.push({ centerY, height: box.height, lines: [line] });
    }
  }

  const ordered = rows.flatMap((row) =>
    row.lines.sort((a, b) => {
      const horizontal = (a.boundingBox?.x ?? 0) - (b.boundingBox?.x ?? 0);
      return Math.abs(horizontal) > 0.002 ? horizontal : a.sourceIndex - b.sourceIndex;
    }),
  );
  const unpositioned = lines
    .filter((line) => !line.boundingBox)
    .sort((a, b) => a.sourceIndex - b.sourceIndex);
  return [...ordered, ...unpositioned].map(({ sourceIndex: _sourceIndex, ...line }) => line);
}

export function structureVisionText(text: VisionAnalysis["text"]): StructuredOcr | null {
  if (!text) return null;
  const lines = orderByVisualRows(
    text.observations
      .map<PositionedLine>((observation: VisionTextObservation, sourceIndex) => ({
        sourceIndex,
        text: observation.text.trim(),
        confidence: observation.confidence,
        boundingBox: observation.boundingBox,
      }))
      .filter((line) => line.text.length > 0),
  );

  if (lines.length === 0) {
    const fallback = text.content.trim();
    if (!fallback) return null;
    return {
      plainText: fallback,
      markdown: fallback,
      lines: fallback.split(/\n+/).map((line) => ({ text: line, confidence: 0 })),
      blocks: [
        {
          id: "ocr-block-1",
          kind: "paragraph",
          text: fallback,
          confidence: 0,
          lines: fallback.split(/\n+/).map((line) => ({ text: line, confidence: 0 })),
        },
      ],
      averageConfidence: 0,
      truncated: text.truncated,
    };
  }

  const medianHeight = median(lines.map((line) => line.boundingBox?.height ?? 0.025));
  const groups: Array<{ kind: OcrBlockKind; lines: StructuredOcrLine[] }> = [];
  for (const line of lines) {
    const kind = lineKind(line, medianHeight);
    const previousGroup = groups[groups.length - 1];
    const previousLine = previousGroup?.lines[previousGroup.lines.length - 1];
    const verticalGap =
      previousLine?.boundingBox && line.boundingBox
        ? line.boundingBox.y - (previousLine.boundingBox.y + previousLine.boundingBox.height)
        : 0;
    const horizontalShift =
      previousLine?.boundingBox && line.boundingBox
        ? Math.abs(line.boundingBox.x - previousLine.boundingBox.x)
        : 0;
    const startsNewBlock =
      !previousGroup ||
      kind === "heading" ||
      previousGroup.kind === "heading" ||
      kind !== previousGroup.kind ||
      verticalGap > medianHeight * 1.2 ||
      (horizontalShift > 0.1 && kind === "paragraph");
    if (startsNewBlock) groups.push({ kind, lines: [line] });
    else previousGroup.lines.push(line);
  }

  const blocks = groups.map<StructuredOcrBlock>((group, index) => ({
    id: `ocr-block-${index + 1}`,
    kind: group.kind,
    text: group.lines.map((line) => line.text).join("\n"),
    confidence: group.lines.reduce((sum, line) => sum + line.confidence, 0) / group.lines.length,
    lines: group.lines,
  }));
  const plainText = blocks.map((block) => block.text).join("\n\n");
  const markdown = blocks.map(blockMarkdown).join("\n\n");

  return {
    plainText,
    markdown,
    lines,
    blocks,
    averageConfidence: lines.reduce((sum, line) => sum + line.confidence, 0) / lines.length,
    truncated: text.truncated,
  };
}
