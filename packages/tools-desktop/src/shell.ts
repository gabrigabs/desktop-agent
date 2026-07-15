import { spawn } from "node:child_process";
import { realpath } from "node:fs/promises";
import path from "node:path";
import type { RegisteredTool } from "@desktop-agent/tool-registry";
import { z } from "zod";

export type ShellToolContext = {
  isPathAuthorized(dirPath: string): Promise<boolean>;
};

const BLOCKED_COMMANDS = new Set([
  "vim",
  "vi",
  "nano",
  "emacs",
  "less",
  "more",
  "top",
  "htop",
  "ssh",
  "scp",
  "sftp",
  "telnet",
  "ftp",
  "passwd",
  "sudo",
  "su",
  "bash",
  "zsh",
  "fish",
  "sh",
  "python",
  "python3",
  "node",
  "ruby",
  "irb",
  "mysql",
  "psql",
  "redis-cli",
  "mongo",
]);

const shellExecSchema = z.object({
  command: z.string().min(1).max(500),
  args: z.array(z.string()).default([]),
  cwd: z.string().min(1),
  timeoutMs: z.number().int().min(1000).max(120_000).default(30_000),
});

const MAX_OUTPUT = 100 * 1024;

function hasInteractiveCommand(command: string, args: string[]): boolean {
  const parts = [command, ...args].join(" ");
  if (/\bcd\s+\S+\s*&&/.test(parts)) return true;
  const baseCmd = path.basename(command);
  if (BLOCKED_COMMANDS.has(baseCmd)) return true;
  for (const arg of args) {
    const flag = arg.trim();
    if (BLOCKED_COMMANDS.has(flag)) return true;
  }
  return false;
}

async function validateCwd(cwd: string, ctx: ShellToolContext): Promise<string> {
  const resolved = path.resolve(cwd);
  const canonical = await realpath(resolved);
  if (!(await ctx.isPathAuthorized(canonical))) {
    throw new Error("Shell cwd is outside the directories authorized by the user");
  }
  return canonical;
}

export function createShellExecTool(ctx: ShellToolContext): RegisteredTool {
  return {
    name: "shell.exec",
    description:
      "Executa um comando no diretório autorizado com timeout, limite de saída e bloqueio de comandos interativos",
    category: "desktop",
    permissionLevel: "local.write",
    executionPolicy: "explicit_approval",
    inputSchema: shellExecSchema,
    async handler(input) {
      const parsed = shellExecSchema.parse(input);
      const cwd = await validateCwd(parsed.cwd, ctx);

      if (hasInteractiveCommand(parsed.command, parsed.args)) {
        throw new Error(
          "Blocked: interactive or shell commands are not allowed. Use specific non-interactive commands instead.",
        );
      }

      return new Promise((resolve, reject) => {
        const startTime = Date.now();
        const child = spawn(parsed.command, parsed.args, {
          cwd,
          stdio: ["pipe", "pipe", "pipe"],
          timeout: 0,
        });

        let stdout = "";
        let stderr = "";
        let killed = false;

        child.stdout?.on("data", (chunk: Buffer) => {
          if (stdout.length < MAX_OUTPUT) {
            stdout += chunk.toString("utf-8", 0, Math.min(chunk.length, MAX_OUTPUT - stdout.length));
          }
        });

        child.stderr?.on("data", (chunk: Buffer) => {
          if (stderr.length < MAX_OUTPUT) {
            stderr += chunk.toString("utf-8", 0, Math.min(chunk.length, MAX_OUTPUT - stderr.length));
          }
        });

        const timer = setTimeout(() => {
          killed = true;
          child.kill("SIGTERM");
          setTimeout(() => {
            try {
              child.kill("SIGKILL");
            } catch {
              // already dead
            }
          }, 2000);
        }, parsed.timeoutMs);

        child.on("error", (err) => {
          clearTimeout(timer);
          reject(err);
        });

        child.on("close", (code) => {
          clearTimeout(timer);
          const durationMs = Date.now() - startTime;

          if (stdout.length >= MAX_OUTPUT) {
            stdout = `${stdout.slice(0, MAX_OUTPUT)}\n... (truncated at 100KB)`;
          }
          if (stderr.length >= MAX_OUTPUT) {
            stderr = `${stderr.slice(0, MAX_OUTPUT)}\n... (truncated at 100KB)`;
          }

          resolve({
            command: parsed.command,
            args: parsed.args,
            cwd,
            exitCode: code ?? -1,
            durationMs,
            timedOut: killed,
            stdout,
            stderr,
          });
        });
      });
    },
  };
}
