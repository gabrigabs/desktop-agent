import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import ExcelJS from "exceljs";
import { parseDocument } from "./index";

const dirs: string[] = [];

async function fixture(name: string, content: string): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "helix-lite-parse-"));
  dirs.push(dir);
  const filePath = path.join(dir, name);
  await writeFile(filePath, content);
  return filePath;
}

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("parseDocument", () => {
  test("counts quoted and multiline CSV fields correctly", async () => {
    const filePath = await fixture(
      "sample.csv",
      'name,notes\n"Ada, Lovelace","line 1\nline 2"\nGrace,compiler\n',
    );
    const result = await parseDocument(filePath);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.document.metadata.rows).toBe(2);
    expect(result.document.metadata.columns).toBe(2);
  });

  test("rejects an unclosed quoted CSV field", async () => {
    const filePath = await fixture("broken.csv", 'name,notes\nAda,"unfinished\n');
    const result = await parseDocument(filePath);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("unclosed quoted field");
  });

  test("extracts Markdown structure", async () => {
    const filePath = await fixture(
      "sample.md",
      "---\ntitle: Example\n---\n# Heading\n\n[Link](https://example.com)\n\n```ts\nconst x = 1;\n```\n",
    );
    const result = await parseDocument(filePath);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.document.metadata.frontmatter).toEqual({ title: "Example" });
    expect(result.document.metadata.headings).toEqual(["Heading"]);
    expect(result.document.metadata.links).toBe(1);
    expect(result.document.metadata.codeBlocks).toBe(1);
  });

  test("normalizes XLSX sheets with headers and inferred column types", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "helix-lite-parse-"));
    dirs.push(dir);
    const filePath = path.join(dir, "sample.xlsx");
    const workbook = new ExcelJS.Workbook();
    const people = workbook.addWorksheet("People");
    people.addRow(["name", "age", "active", "created_at"]);
    people.addRow(["Ada", 36, true, new Date("2026-01-02T00:00:00.000Z")]);
    people.addRow(["Grace", 85, false, new Date("2026-02-03T00:00:00.000Z")]);
    workbook.addWorksheet("Empty").addRow(["note"]);
    await workbook.xlsx.writeFile(filePath);

    const result = await parseDocument(filePath);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.document.metadata.sheets).toEqual(["People", "Empty"]);
    expect(result.document.metadata.sheetDetails?.[0]).toMatchObject({
      name: "People",
      rows: 2,
      columns: 4,
      headers: ["name", "age", "active", "created_at"],
      columnTypes: ["string", "number", "boolean", "date"],
    });
    expect(result.document.content).toContain("## People");
    expect(result.document.content).toContain("| Ada | 36 | true |");
  });
});
