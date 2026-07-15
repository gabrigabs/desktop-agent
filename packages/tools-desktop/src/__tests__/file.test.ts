import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createDirectoryListTool, createFileReadTool, createFileWriteTool } from "../file";

const dirs: string[] = [];
let canonicalRoot: string;

beforeEach(async () => {
  const root = await mkdtemp(path.join(tmpdir(), "helix-file-tool-"));
  canonicalRoot = await realpath(root);
  dirs.push(root);
});

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function isPathAuthorized(value: string) {
  const resolved = path.resolve(value);
  return resolved.startsWith(canonicalRoot) || resolved.startsWith(`${canonicalRoot}${path.sep}`);
}

describe("desktop.file.write", () => {
  test("always requires an explicit one-shot approval", () => {
    const tool = createFileWriteTool({ isPathAuthorized });
    expect(tool.executionPolicy).toBe("explicit_approval");
  });

  test("writes only after the target is authorized", async () => {
    const target = path.join(canonicalRoot, "result.md");
    const tool = createFileWriteTool({ isPathAuthorized });
    const result = await tool.handler({ path: target, content: "# Result" });
    expect(result).toEqual({ written: true, path: target, bytes: 8 });
    expect(await readFile(target, "utf-8")).toBe("# Result");
  });

  test("rejects paths outside the authorized root", async () => {
    const tool = createFileWriteTool({ isPathAuthorized });
    expect(tool.handler({ path: "/tmp/not-authorized.txt", content: "no" })).rejects.toThrow(
      "outside the directories authorized",
    );
  });
});

describe("desktop.file.read", () => {
  test("reads content within authorized root", async () => {
    const target = path.join(canonicalRoot, "notes.txt");
    await writeFile(target, "hello world");
    const tool = createFileReadTool({ isPathAuthorized });
    const result = await tool.handler({ path: target });
    expect(result).toMatchObject({ path: target, content: "hello world", truncated: false, size: 11 });
  });

  test("rejects reading outside authorized root", async () => {
    const tool = createFileReadTool({ isPathAuthorized });
    expect(tool.handler({ path: "/etc/passwd" })).rejects.toThrow("outside the directories authorized");
  });
});

describe("desktop.directory.list", () => {
  test("lists entries within authorized root", async () => {
    await mkdir(path.join(canonicalRoot, "sub"));
    await writeFile(path.join(canonicalRoot, "a.txt"), "x");
    const tool = createDirectoryListTool({ isPathAuthorized });
    const result = (await tool.handler({ path: canonicalRoot })) as { path: string; entries: unknown[] };
    expect(result.path).toBe(canonicalRoot);
    expect(result.entries.length).toBe(2);
    expect(result.entries.some((e) => (e as { name: string }).name === "a.txt")).toBe(true);
    expect(result.entries.some((e) => (e as { name: string }).name === "sub")).toBe(true);
  });
});
