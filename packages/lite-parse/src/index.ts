import { promises as fs } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import type { LiteParse } from "@llamaindex/liteparse";
import ExcelJS from "exceljs";
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

const LITEPARSE_EXTS: Set<ParseableExt> = new Set([".pdf", ".docx", ".pptx", ".xlsx"]);

const parserInstances = new Map<boolean, LiteParse>();
const MAX_SHEET_ROWS = 1_000;
const MAX_SHEET_COLUMNS = 50;

type NativeLiteParseModule = {
  LiteParse: new (config: Record<string, unknown>) => LiteParse;
};

function parserConfig(ocrEnabled: boolean): Record<string, unknown> {
  return {
    outputFormat: "markdown",
    ocrEnabled,
    imageMode: "placeholder",
    extractLinks: true,
    quiet: true,
  };
}

function loadBundledNativeParser(ocrEnabled: boolean): LiteParse {
  const require = createRequire(import.meta.url);
  const platformArch = `${process.platform}-${process.arch}`;
  const fileName = `liteparse.${platformArch}.node`;
  const executableDir = path.dirname(process.execPath);
  const candidates = [
    path.join(executableDir, fileName),
    // Tauri dev copies bundled resources into target/<profile>/liteparse.
    path.join(executableDir, "liteparse", fileName),
    path.join(executableDir, "..", "Resources", "liteparse", fileName),
  ];
  for (const candidate of candidates) {
    try {
      const native = require(candidate) as NativeLiteParseModule;
      return new native.LiteParse(parserConfig(ocrEnabled));
    } catch {
      // Try the next bundle layout.
    }
  }
  throw new Error(`LiteParse native module not found for ${platformArch}`);
}

async function getParser(ocrEnabled: boolean): Promise<LiteParse> {
  let parser = parserInstances.get(ocrEnabled);
  if (!parser) {
    try {
      const { LiteParse: LiteParseRuntime } = await import("@llamaindex/liteparse");
      parser = new LiteParseRuntime(parserConfig(ocrEnabled));
    } catch {
      parser = loadBundledNativeParser(ocrEnabled);
    }
    parserInstances.set(ocrEnabled, parser);
  }
  return parser;
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
    const ocrEnabled = inferFormat(ext) === "image";
    const parser = await getParser(ocrEnabled);
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
          ocrApplied: ext === ".pdf" ? false : undefined,
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

function cellValue(value: ExcelJS.CellValue): string | number | boolean | Date | null {
  if (value === null || value === undefined) return null;
  if (
    value instanceof Date ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (typeof value === "object") {
    const record = value as unknown as Record<string, unknown>;
    if ("result" in value) return cellValue(value.result as ExcelJS.CellValue);
    if ("text" in value) return String(value.text);
    if ("richText" in value) return value.richText.map((part) => part.text).join("");
    if ("hyperlink" in record) return String(record.text ?? record.hyperlink);
  }
  return String(value);
}

function inferColumnType(values: Array<string | number | boolean | Date | null>): string {
  const types = new Set(
    values
      .filter((value) => value !== null && value !== "")
      .map((value) => {
        if (value instanceof Date) return "date";
        return typeof value;
      }),
  );
  if (types.size === 0) return "empty";
  if (types.size === 1) return Array.from(types)[0] ?? "empty";
  return "mixed";
}

function markdownCell(value: string | number | boolean | Date | null): string {
  if (value === null) return "";
  const text = value instanceof Date ? value.toISOString() : String(value);
  return text.replace(/\|/g, "\\|").replace(/\r?\n/g, "<br>");
}

async function parseXlsx(filePath: string): Promise<ParseResult> {
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const sections: string[] = [];
    const sheetDetails: NonNullable<ParsedDocument["metadata"]["sheetDetails"]> = [];
    let totalRows = 0;
    let maxColumns = 0;
    let anyTruncated = false;

    for (const worksheet of workbook.worksheets) {
      const rowCount = Math.min(worksheet.actualRowCount, MAX_SHEET_ROWS + 1);
      const columnCount = Math.min(worksheet.actualColumnCount, MAX_SHEET_COLUMNS);
      const rows: Array<Array<string | number | boolean | Date | null>> = [];
      for (let rowIndex = 1; rowIndex <= rowCount; rowIndex++) {
        const row: Array<string | number | boolean | Date | null> = [];
        for (let columnIndex = 1; columnIndex <= columnCount; columnIndex++) {
          row.push(cellValue(worksheet.getCell(rowIndex, columnIndex).value));
        }
        rows.push(row);
      }

      const rawHeaders = rows[0] ?? [];
      const headers = Array.from({ length: columnCount }, (_, index) => {
        const header = markdownCell(rawHeaders[index] ?? null).trim();
        return header || `Column ${index + 1}`;
      });
      const dataRows = rows.slice(1);
      const columnTypes = headers.map((_, index) =>
        inferColumnType(dataRows.map((row) => row[index] ?? null)),
      );
      const truncated =
        worksheet.actualRowCount > MAX_SHEET_ROWS + 1 || worksheet.actualColumnCount > MAX_SHEET_COLUMNS;
      anyTruncated ||= truncated;
      totalRows += Math.max(worksheet.actualRowCount - 1, 0);
      maxColumns = Math.max(maxColumns, worksheet.actualColumnCount);
      sheetDetails.push({
        name: worksheet.name,
        rows: Math.max(worksheet.actualRowCount - 1, 0),
        columns: worksheet.actualColumnCount,
        headers,
        columnTypes,
        truncated,
      });

      const table = [
        `## ${worksheet.name}`,
        "",
        `| ${headers.map(markdownCell).join(" | ")} |`,
        `| ${headers.map(() => "---").join(" | ")} |`,
        ...dataRows.map(
          (row) => `| ${headers.map((_, index) => markdownCell(row[index] ?? null)).join(" | ")} |`,
        ),
      ];
      if (truncated)
        table.push("", `_Preview limited to ${MAX_SHEET_ROWS} rows and ${MAX_SHEET_COLUMNS} columns._`);
      sections.push(table.join("\n"));
    }

    const normalized = sections.join("\n\n");
    const { content, preview, truncated } = truncate(normalized);
    return {
      ok: true,
      document: {
        format: "excel",
        content,
        preview,
        metadata: {
          sheets: workbook.worksheets.map((sheet) => sheet.name),
          sheetDetails,
          rows: totalRows,
          columns: maxColumns,
          truncated: truncated || anyTruncated,
        },
      },
    };
  } catch (err) {
    return { ok: false, error: `XLSX parse failed: ${err instanceof Error ? err.message : String(err)}` };
  }
}

export async function parseDocument(filePath: string): Promise<ParseResult> {
  const ext = getParseableExt(filePath);
  if (!ext) {
    return { ok: false, error: `Unsupported file extension: ${path.extname(filePath)}` };
  }

  if (ext === ".csv") return parseCsv(filePath);
  if (ext === ".md" || ext === ".markdown") return parseMarkdown(filePath);
  if (ext === ".xlsx") return parseXlsx(filePath);

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
