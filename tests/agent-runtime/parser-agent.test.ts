import { describe, expect, mock, test } from "bun:test";
import type { ParseResult } from "../../packages/lite-parse/src/types";
import { ParserAgent } from "../../packages/agent-runtime/src/parser/ParserAgent";
import { createFileParseTool } from "../../packages/agent-runtime/src/parser/createFileParseTool";

function createMockParseDocument() {
  return mock(async (path: string): Promise<ParseResult> => {
    if (path.endsWith(".pdf")) {
      return {
        ok: true,
        document: {
          format: "pdf",
          content: "PDF content extracted",
          preview: "PDF preview",
          metadata: { pages: 2 },
        },
      };
    }
    if (path.endsWith(".docx")) {
      return {
        ok: true,
        document: {
          format: "docx",
          content: "DOCX content extracted",
          preview: "DOCX preview",
          metadata: {},
        },
      };
    }
    return { ok: false, error: "Unsupported or failed" };
  });
}

function createParser() {
  return new ParserAgent({ parseDocument: createMockParseDocument() });
}

describe("ParserAgent", () => {
  test("auto-parses binary files", async () => {
    const parser = createParser();
    const files = [
      {
        path: "/tmp/doc.pdf",
        displayName: "doc.pdf",
        size: 1024,
        mimeType: "application/pdf",
        encoding: "binary" as const,
        preview: "[Binary file]",
      },
      {
        path: "/tmp/plain.txt",
        displayName: "plain.txt",
        size: 100,
        mimeType: "text/plain",
        encoding: "text" as const,
        preview: "text preview",
      },
    ];

    const results = await parser.parseFileContext(files);

    expect(results).toHaveLength(1);
    expect(results[0].path).toBe("/tmp/doc.pdf");
    expect(results[0].content).toBe("PDF content extracted");
    expect(results[0].parsedFormat).toBe("pdf");
  });

  test("caches parsed files", async () => {
    const mockParse = createMockParseDocument();
    const parser = new ParserAgent({ parseDocument: mockParse });
    const files = [
      {
        path: "/tmp/doc.pdf",
        displayName: "doc.pdf",
        size: 1024,
        mimeType: "application/pdf",
        encoding: "parsed" as const,
        preview: "preview",
      },
    ];

    const first = await parser.parseFileContext(files);
    const second = await parser.parseFileContext(files);

    expect(first[0].content).toBe("PDF content extracted");
    expect(second[0].content).toBe(first[0].content);
    expect(mockParse.mock.calls.length).toBe(1);
  });

  test("does not reparse content already extracted by file context", async () => {
    const mockParse = createMockParseDocument();
    const parser = new ParserAgent({ parseDocument: mockParse });

    const results = await parser.parseFileContext([
      {
        path: "/tmp/doc.pdf",
        displayName: "doc.pdf",
        size: 1024,
        mimeType: "application/pdf",
        encoding: "parsed",
        content: "Content extracted during attachment",
        preview: "Content extracted",
        parsedFormat: "pdf",
      },
    ]);

    expect(results).toEqual([]);
    expect(mockParse.mock.calls.length).toBe(0);
  });

  test("createFileParseTool extracts files via tool handler", async () => {
    const parser = createParser();
    const tool = createFileParseTool(parser);
    const output = await tool.handler({ paths: ["/tmp/doc.pdf"] });

    expect(output).toEqual({
      results: [
        {
          path: "/tmp/doc.pdf",
          displayName: "doc.pdf",
          content: "PDF content extracted",
          preview: "PDF preview",
          parsedFormat: "pdf",
          parsedMetadata: { pages: 2 },
        },
      ],
    });
  });

  test("respects authorized roots", async () => {
    const parser = new ParserAgent({
      getAuthorizedRoots: () => ["/allowed"],
    });

    const result = await parser.parseFiles(["/outside/doc.pdf"]);

    expect(result[0].error).toContain("fora dos diretórios autorizados");
  });
});
