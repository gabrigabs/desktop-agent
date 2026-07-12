import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createFileWriteTool } from "./file";

const dirs: string[] = [];

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("desktop.file.write", () => {
  test("writes only after the target is authorized", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "helix-file-tool-"));
    dirs.push(root);
    const target = path.join(root, "result.md");
    const tool = createFileWriteTool({ isPathAuthorized: async (value) => value.startsWith(root) });
    const result = await tool.handler({ path: target, content: "# Result" });
    expect(result).toEqual({ written: true, path: target, bytes: 8 });
    expect(await readFile(target, "utf-8")).toBe("# Result");
  });

  test("rejects paths outside the authorized root", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "helix-file-tool-"));
    dirs.push(root);
    const tool = createFileWriteTool({ isPathAuthorized: async (value) => value.startsWith(root) });
    expect(tool.handler({ path: "/tmp/not-authorized.txt", content: "no" })).rejects.toThrow(
      "outside the directories authorized",
    );
  });
});
