export type ParsedDocument = {
  format: "pdf" | "csv" | "excel" | "markdown" | "docx" | "pptx" | "image";
  content: string;
  preview: string;
  metadata: {
    pages?: number;
    sheets?: string[];
    sheetDetails?: Array<{
      name: string;
      rows: number;
      columns: number;
      headers: string[];
      columnTypes: string[];
      truncated: boolean;
    }>;
    rows?: number;
    columns?: number;
    truncated?: boolean;
    hasTextLayer?: boolean;
    pagesWithoutTextLayer?: number[];
    ocrApplied?: boolean;
    frontmatter?: Record<string, unknown>;
    headings?: string[];
    links?: number;
    codeBlocks?: number;
  };
};

export type ParseResult = { ok: true; document: ParsedDocument } | { ok: false; error: string };

export type ParseableExt =
  | ".pdf"
  | ".csv"
  | ".xlsx"
  | ".xls"
  | ".md"
  | ".markdown"
  | ".docx"
  | ".pptx"
  | ".png"
  | ".jpg"
  | ".jpeg"
  | ".tiff"
  | ".tif"
  | ".bmp";

export const PARSEABLE_EXTENSIONS: Set<ParseableExt> = new Set([
  ".pdf",
  ".csv",
  ".xlsx",
  ".xls",
  ".md",
  ".markdown",
  ".docx",
  ".pptx",
  ".png",
  ".jpg",
  ".jpeg",
  ".tiff",
  ".tif",
  ".bmp",
]);

export const MAX_CONTENT_CHARS = 500_000;
export const MAX_PREVIEW_CHARS = 500;
