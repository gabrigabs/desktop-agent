import { promises as fs } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import type { LiteParse } from "@llamaindex/liteparse";
import {
  MAX_CONTENT_CHARS,
  MAX_PREVIEW_CHARS,
  PARSEABLE_EXTENSIONS,
  type ParseableExt,
  type ParsedDocument,
  type ParseResult,
} from "./types";

export type { ParseableExt, ParsedDocument, ParseResult };
export { PARSEABLE_EXTENSIONS };

const LITEPARSE_EXTS: Set<ParseableExt> = new Set([
  ".pdf",
  ".docx",
  ".pptx",
  ".xlsx",
  ".png",
  ".jpg",
  ".jpeg",
  ".tiff",
  ".tif",
  ".bmp",
]);

let parserInstance: LiteParse | null = null;

type NativeLiteParseModule = {
  LiteParse: new (config: Record<string, unknown>) => LiteParse;
};

function loadBundledNativeParser(): LiteParse {
  const require = createRequire(import.meta.url);
  const platformArch = `${process.platform}-${process.arch}`;
  const fileName = `liteparse.${platformArch}.node`;
  const executableDir = path.dirname(process.execPath);
  const candidates = [
    path.join(executableDir, fileName),
    path.join(executableDir, "..", "Resources", "liteparse", fileName),
  ];
  for (const candidate of candidates) {
    try {
      const native = require(candidate) as NativeLiteParseModule;
      return new native.LiteParse({
        outputFormat: "markdown",
        ocrEnabled: true,
        imageMode: "placeholder",
        extractLinks: true,
        quiet: true,
      });
    } catch {
      // Try the next bundle layout.
    }
  }
  throw new Error(`LiteParse native module not found for ${platformArch}`);
}

async function getParser(): Promise<LiteParse> {
  if (!parserInstance) {
    try {
      const { LiteParse: LiteParseRuntime } = await import("@llamaindex/liteparse");
      parserInstance = new LiteParseRuntime({
        outputFormat: "markdown",
        ocrEnabled: true,
        imageMode: "placeholder",
        extractLinks: true,
        quiet: true,
      });
    } catch {
      parserInstance = loadBundledNativeParser();
    }
  }
  return parserInstance;
}

export function isParseable(filePath: string): boolean {
  const ext = filePath.toLowerCase();
  for (const parseableExt of PARSEABLE_EXTENSIONS) {
    if (ext.endsWith(parseableExt)) return true;
  }
  return false;
}

export function getParseableExt(filePath: string): ParseableExt | null {
  const ext = filePath.toLowerCase();
  for (const parseableExt of PARSEABLE_EXTENSIONS) {
    if (ext.endsWith(parseableExt)) return parseableExt;
  }
  return null;
}

function truncate(text: string): { content: string; preview: string; truncated: boolean } {
  const truncated = text.length > MAX_CONTENT_CHARS;
  const content = truncated ? text.slice(0, MAX_CONTENT_CHARS) : text;
  const preview = text.slice(0, MAX_PREVIEW_CHARS);
  return { content, preview, truncated };
}

function inferFormat(ext: ParseableExt): ParsedDocument["format"] {
  switch (ext) {
    case ".pdf":
      return "pdf";
    case ".csv":
      return "csv";
    case ".xlsx":
    case ".xls":
      return "excel";
    case ".md":
    case ".markdown":
      return "markdown";
    case ".docx":
      return "docx";
    case ".pptx":
      return "pptx";
    default:
      return "image";
  }
}

async function parseWithLiteParse(filePath: string, ext: ParseableExt): Promise<ParseResult> {
  try {
    const parser = await getParser();
    const complexity = ext === ".pdf" ? await parser.isComplex(filePath) : [];
    const result = await parser.parse(filePath);
    const text = result.text ?? "";
    const { content, preview, truncated } = truncate(text);
    const pages = result.pages?.length ?? undefined;

    return {
      ok: true,
      document: {
        format: inferFormat(ext),
        content,
        preview,
        metadata: {
          pages,
          truncated,
          hasTextLayer:
            ext === ".pdf" ? complexity.some((page) => page.textLength > 0 && !page.isGarbled) : undefined,
          pagesWithoutTextLayer:
            ext === ".pdf"
              ? complexity
                  .filter((page) => page.textLength === 0 || page.isGarbled)
                  .map((page) => page.pageNumber)
              : undefined,
          ocrApplied: ext === ".pdf" ? complexity.some((page) => page.needsOcr) : undefined,
        },
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: `LiteParse failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

async function parseCsv(filePath: string): Promise<ParseResult> {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    const records: string[][] = [];
    let record: string[] = [];
    let field = "";
    let quoted = false;
    for (let index = 0; index < raw.length; index++) {
      const char = raw[index];
      const next = raw[index + 1];
      if (char === '"') {
        if (quoted && next === '"') {
          field += '"';
          index++;
        } else {
          quoted = !quoted;
        }
      } else if (char === "," && !quoted) {
        record.push(field);
        field = "";
      } else if ((char === "\n" || char === "\r") && !quoted) {
        if (char === "\r" && next === "\n") index++;
        record.push(field);
        if (record.some((value) => value.length > 0)) records.push(record);
        record = [];
        field = "";
      } else {
        field += char;
      }
    }
    record.push(field);
    if (record.some((value) => value.length > 0)) records.push(record);
    if (quoted) return { ok: false, error: "CSV parse failed: unclosed quoted field" };
    const headers = records[0] ?? [];
    const dataRows = records.slice(1);
    const { content, preview, truncated } = truncate(raw);

    return {
      ok: true,
      document: {
        format: "csv",
        content,
        preview,
        metadata: {
          rows: dataRows.length,
          columns: Math.max(headers.length, ...dataRows.map((row) => row.length), 0),
          truncated,
        },
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: `CSV parse failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

async function parseMarkdown(filePath: string): Promise<ParseResult> {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    const { content, preview, truncated } = truncate(raw);

    const headingRegex = /^(#{1,6})\s+(.+)$/gm;
    const headings: string[] = [];
    let match: RegExpExecArray | null = headingRegex.exec(raw);
    while (match !== null) {
      headings.push(match[2] ?? "");
      match = headingRegex.exec(raw);
    }

    const linkCount = (raw.match(/\[([^\]]+)\]\([^)]+\)/g) ?? []).length;
    const codeBlockCount = (raw.match(/```/g) ?? []).length / 2;

    let frontmatter: Record<string, unknown> | undefined;
    const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n/);
    if (fmMatch) {
      const fm: Record<string, unknown> = {};
      for (const line of (fmMatch[1] ?? "").split("\n")) {
        const idx = line.indexOf(":");
        if (idx > 0) {
          const key = line.slice(0, idx).trim();
          const value = line.slice(idx + 1).trim();
          fm[key] = value;
        }
      }
      frontmatter = fm;
    }

    return {
      ok: true,
      document: {
        format: "markdown",
        content,
        preview,
        metadata: {
          headings,
          links: linkCount,
          codeBlocks: Math.floor(codeBlockCount),
          truncated,
          frontmatter,
        },
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: `Markdown parse failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

export async function parseDocument(filePath: string): Promise<ParseResult> {
  const ext = getParseableExt(filePath);
  if (!ext) {
    return { ok: false, error: `Unsupported file extension: ${path.extname(filePath)}` };
  }

  if (ext === ".csv") return parseCsv(filePath);
  if (ext === ".md" || ext === ".markdown") return parseMarkdown(filePath);

  if (ext === ".xls") {
    return {
      ok: false,
      error: "Legacy .xls format is not supported. Please convert to .xlsx.",
    };
  }

  if (LITEPARSE_EXTS.has(ext)) {
    return parseWithLiteParse(filePath, ext);
  }

  return { ok: false, error: `No parser available for extension: ${ext}` };
}
