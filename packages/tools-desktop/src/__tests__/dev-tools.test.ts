import { afterEach, describe, expect, test } from "bun:test";
import { execSync } from "node:child_process";
import { mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createGitDiffTool, createGitLogTool, createGitStatusTool } from "../git";
import { createFilePatchTool } from "../patch";
import { createShellExecTool } from "../shell";

const dirs: string[] = [];

async function makeTempDir(prefix: string): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), prefix));
  const canonical = await realpath(dir);
  dirs.push(dir);
  return canonical;
}

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function makeTempRepo(): Promise<string> {
  const root = await makeTempDir("helix-git-tool-");
  execSync("git init", { cwd: root, encoding: "utf-8" });
  execSync("git config user.email test@test.com", { cwd: root, encoding: "utf-8" });
  execSync("git config user.name Test", { cwd: root, encoding: "utf-8" });
  return root;
}

describe("git.status", () => {
  test("returns porcelain status for a repo", async () => {
    const root = await makeTempRepo();
    await writeFile(path.join(root, "a.txt"), "hello");
    const tool = createGitStatusTool({ isPathAuthorized: async (p) => p.startsWith(root) });
    const result = (await tool.handler({ cwd: root })) as { fileCount: number; output: string };
    expect(result.fileCount).toBe(1);
    expect(result.output).toContain("a.txt");
  });

  test("rejects unauthorized cwd", async () => {
    const root = await makeTempRepo();
    const tool = createGitStatusTool({ isPathAuthorized: async (p) => p === root });
    expect(tool.handler({ cwd: "/tmp" })).rejects.toThrow("outside the directories");
  });
});

describe("git.diff", () => {
  test("returns diff output", async () => {
    const root = await makeTempRepo();
    await writeFile(path.join(root, "a.txt"), "line1\n");
    execSync("git add a.txt", { cwd: root, encoding: "utf-8" });
    execSync("git commit -m init", { cwd: root, encoding: "utf-8" });
    await writeFile(path.join(root, "a.txt"), "line1\nline2\n");
    const tool = createGitDiffTool({ isPathAuthorized: async (p) => p.startsWith(root) });
    const result = (await tool.handler({ cwd: root })) as { output: string };
    expect(result.output).toContain("+line2");
  });
});

describe("git.log", () => {
  test("returns commit log", async () => {
    const root = await makeTempRepo();
    await writeFile(path.join(root, "a.txt"), "hello");
    execSync("git add a.txt", { cwd: root, encoding: "utf-8" });
    execSync('git commit -m "initial"', { cwd: root, encoding: "utf-8" });
    const tool = createGitLogTool({ isPathAuthorized: async (p) => p.startsWith(root) });
    const result = (await tool.handler({ cwd: root, n: 5 })) as {
      commits: { hash: string; message: string }[];
    };
    expect(result.commits.length).toBe(1);
    expect(result.commits[0]?.message).toBe("initial");
  });
});

describe("shell.exec", () => {
  test("executes a simple command", async () => {
    const root = await makeTempDir("helix-shell-tool-");
    const tool = createShellExecTool({ isPathAuthorized: async (p) => p.startsWith(root) });
    const result = (await tool.handler({ command: "echo", args: ["hello"], cwd: root })) as {
      exitCode: number;
      stdout: string;
    };
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe("hello");
  });

  test("blocks interactive commands", async () => {
    const root = await makeTempDir("helix-shell-tool-");
    const tool = createShellExecTool({ isPathAuthorized: async (p) => p.startsWith(root) });
    expect(tool.handler({ command: "vim", args: [], cwd: root })).rejects.toThrow("Blocked");
  });

  test("blocks cd && cmd pattern", async () => {
    const root = await makeTempDir("helix-shell-tool-");
    const tool = createShellExecTool({ isPathAuthorized: async (p) => p.startsWith(root) });
    expect(tool.handler({ command: "cd", args: ["/tmp", "&&", "ls"], cwd: root })).rejects.toThrow("Blocked");
  });

  test("rejects unauthorized cwd", async () => {
    const root = await makeTempDir("helix-shell-tool-");
    const tool = createShellExecTool({ isPathAuthorized: async (p) => p === root });
    expect(tool.handler({ command: "echo", args: ["hi"], cwd: "/tmp" })).rejects.toThrow(
      "outside the directories",
    );
  });
});

describe("file.patch", () => {
  test("applies a valid patch", async () => {
    const root = await makeTempDir("helix-patch-tool-");
    const filePath = path.join(root, "test.txt");
    await writeFile(filePath, "line1\nline2\nline3\n");
    const patch = `--- a/test.txt\n+++ b/test.txt\n@@ -1,3 +1,3 @@\n line1\n-line2\n+line2 patched\n line3\n`;
    const tool = createFilePatchTool({ isPathAuthorized: async (p) => p.startsWith(root) });
    const result = (await tool.handler({ filePath, patch })) as { applied: boolean };
    expect(result.applied).toBe(true);
    const { readFile } = await import("node:fs/promises");
    const content = await readFile(filePath, "utf-8");
    expect(content).toContain("line2 patched");
  });

  test("dry run does not modify file", async () => {
    const root = await makeTempDir("helix-patch-tool-");
    const filePath = path.join(root, "test.txt");
    await writeFile(filePath, "line1\nline2\n");
    const patch = `--- a/test.txt\n+++ b/test.txt\n@@ -1,2 +1,2 @@\n line1\n-line2\n+line2 modified\n`;
    const tool = createFilePatchTool({ isPathAuthorized: async (p) => p.startsWith(root) });
    const result = (await tool.handler({ filePath, patch, dryRun: true })) as {
      dryRun: boolean;
    };
    expect(result.dryRun).toBe(true);
    const { readFile } = await import("node:fs/promises");
    const content = await readFile(filePath, "utf-8");
    expect(content).toBe("line1\nline2\n");
  });

  test("rejects unauthorized path", async () => {
    const root = await makeTempDir("helix-patch-tool-");
    const tool = createFilePatchTool({ isPathAuthorized: async (p) => p === root });
    expect(tool.handler({ filePath: "/etc/passwd", patch: "--- a\n+++ b\n" })).rejects.toThrow(
      "outside the directories",
    );
  });

  test("fails on context mismatch", async () => {
    const root = await makeTempDir("helix-patch-tool-");
    const filePath = path.join(root, "test.txt");
    await writeFile(filePath, "line1\nline2\n");
    const patch = `--- a/test.txt\n+++ b/test.txt\n@@ -1,2 +1,2 @@\n wrong\n-line2\n+line2 modified\n`;
    const tool = createFilePatchTool({ isPathAuthorized: async (p) => p.startsWith(root) });
    expect(tool.handler({ filePath, patch })).rejects.toThrow("Context mismatch");
  });
});
