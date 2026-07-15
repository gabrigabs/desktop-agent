import { execSync } from "node:child_process";
import { realpath } from "node:fs/promises";
import path from "node:path";
import type { RegisteredTool } from "@desktop-agent/tool-registry";
import { z } from "zod";

export type GitToolContext = {
  isPathAuthorized(dirPath: string): Promise<boolean>;
};

const gitStatusSchema = z.object({
  cwd: z.string().min(1),
});

const gitDiffSchema = z.object({
  cwd: z.string().min(1),
  staged: z.boolean().default(false),
  pathspec: z.string().optional(),
});

const gitLogSchema = z.object({
  cwd: z.string().min(1),
  n: z.number().int().min(1).max(100).default(20),
  oneline: z.boolean().default(true),
});

async function validateCwd(cwd: string, ctx: GitToolContext): Promise<string> {
  const resolved = path.resolve(cwd);
  const canonical = await realpath(resolved);
  if (!(await ctx.isPathAuthorized(canonical))) {
    throw new Error("Git cwd is outside the directories authorized by the user");
  }
  return canonical;
}

function runGit(args: string[], cwd: string, maxOutput = 100_000): string {
  const result = execSync(`git ${args.join(" ")}`, {
    cwd,
    encoding: "utf-8",
    timeout: 15_000,
    maxBuffer: 1024 * 1024,
  });
  if (result.length > maxOutput) {
    return `${result.slice(0, maxOutput)}\n... (truncated)`;
  }
  return result;
}

export function createGitStatusTool(ctx: GitToolContext): RegisteredTool {
  return {
    name: "git.status",
    description: "Executa git status --porcelain=v1 no diretório autorizado",
    category: "desktop",
    permissionLevel: "local.read",
    inputSchema: gitStatusSchema,
    async handler(input) {
      const parsed = gitStatusSchema.parse(input);
      const cwd = await validateCwd(parsed.cwd, ctx);
      const output = runGit(["status", "--porcelain=v1"], cwd);
      const lines = output.trim().split("\n").filter(Boolean);
      return { cwd, output, fileCount: lines.length };
    },
  };
}

export function createGitDiffTool(ctx: GitToolContext): RegisteredTool {
  return {
    name: "git.diff",
    description: "Executa git diff (ou git diff --staged) no diretório autorizado",
    category: "desktop",
    permissionLevel: "local.read",
    inputSchema: gitDiffSchema,
    async handler(input) {
      const parsed = gitDiffSchema.parse(input);
      const cwd = await validateCwd(parsed.cwd, ctx);
      const args = ["diff"];
      if (parsed.staged) args.push("--staged");
      if (parsed.pathspec) args.push("--", parsed.pathspec);
      const output = runGit(args, cwd);
      return { cwd, staged: parsed.staged, output };
    },
  };
}

export function createGitLogTool(ctx: GitToolContext): RegisteredTool {
  return {
    name: "git.log",
    description: "Executa git log --oneline -n <n> no diretório autorizado",
    category: "desktop",
    permissionLevel: "local.read",
    inputSchema: gitLogSchema,
    async handler(input) {
      const parsed = gitLogSchema.parse(input);
      const cwd = await validateCwd(parsed.cwd, ctx);
      const args = ["log"];
      if (parsed.oneline) args.push("--oneline");
      args.push(`-n`, String(parsed.n));
      const output = runGit(args, cwd);
      const commits = output
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          const match = line.match(/^([a-f0-9]+)\s+(.*)$/);
          return match ? { hash: match[1], message: match[2] } : { hash: "", message: line };
        });
      return { cwd, count: commits.length, commits };
    },
  };
}
