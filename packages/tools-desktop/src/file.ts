import { mkdir, readdir, readFile, realpath, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { RegisteredTool } from "@desktop-agent/tool-registry";
import { z } from "zod";

export type FileToolContext = {
  isPathAuthorized(path: string): Promise<boolean>;
};

const fileWriteSchema = z.object({
  path: z.string().min(1),
  content: z.string(),
  createDirectories: z.boolean().default(false),
});

export function createFileWriteTool(ctx: FileToolContext): RegisteredTool {
  return {
    name: "desktop.file.write",
    description: "Cria ou sobrescreve um arquivo dentro de uma pasta autorizada pelo usuário",
    category: "desktop",
    permissionLevel: "local.write",
    inputSchema: fileWriteSchema,
    async handler(input) {
      const parsed = fileWriteSchema.parse(input);
      const targetPath = path.resolve(parsed.path);
      if (!(await ctx.isPathAuthorized(targetPath))) {
        throw new Error("Path is outside the directories authorized by the user");
      }
      if (parsed.createDirectories) await mkdir(path.dirname(targetPath), { recursive: true });
      // Revalidate the canonical parent after optional directory creation to prevent traversal via symlink.
      await realpath(path.dirname(targetPath));
      if (!(await ctx.isPathAuthorized(targetPath))) {
        throw new Error("Canonical target is outside the directories authorized by the user");
      }
      await writeFile(targetPath, parsed.content, "utf-8");
      return { written: true, path: targetPath, bytes: Buffer.byteLength(parsed.content) };
    },
  };
}

const fileReadSchema = z.object({
  path: z.string().min(1),
  limit: z
    .number()
    .int()
    .min(1)
    .max(1024 * 1024)
    .default(50 * 1024),
  offset: z.number().int().min(0).default(0),
});

export function createFileReadTool(ctx: FileToolContext): RegisteredTool {
  return {
    name: "desktop.file.read",
    description: "Lê o conteúdo de um arquivo dentro de uma pasta autorizada pelo usuário",
    category: "desktop",
    permissionLevel: "local.read",
    inputSchema: fileReadSchema,
    async handler(input) {
      const parsed = fileReadSchema.parse(input);
      const targetPath = path.resolve(parsed.path);
      if (!(await ctx.isPathAuthorized(targetPath))) {
        throw new Error("Path is outside the directories authorized by the user");
      }
      const canonicalTarget = await realpath(targetPath);
      if (!(await ctx.isPathAuthorized(canonicalTarget))) {
        throw new Error("Canonical target is outside the directories authorized by the user");
      }

      const info = await stat(canonicalTarget);
      if (!info.isFile()) {
        throw new Error("Path is not a file");
      }

      const buffer = await readFile(canonicalTarget);
      const start = Math.min(parsed.offset, buffer.length);
      const end = Math.min(start + parsed.limit, buffer.length);
      const slice = buffer.subarray(start, end);
      const content = slice.toString("utf-8");
      const truncated = end < buffer.length;

      return {
        path: canonicalTarget,
        content,
        truncated,
        size: buffer.length,
        offset: start,
        end,
      };
    },
  };
}

const directoryListSchema = z.object({
  path: z.string().min(1),
  recursive: z.boolean().default(false),
  maxDepth: z.number().int().min(1).max(10).default(3),
});

export function createDirectoryListTool(ctx: FileToolContext): RegisteredTool {
  return {
    name: "desktop.directory.list",
    description: "Lista os arquivos e diretórios dentro de uma pasta autorizada pelo usuário",
    category: "desktop",
    permissionLevel: "local.read",
    inputSchema: directoryListSchema,
    async handler(input) {
      const parsed = directoryListSchema.parse(input);
      const targetPath = path.resolve(parsed.path);
      if (!(await ctx.isPathAuthorized(targetPath))) {
        throw new Error("Path is outside the directories authorized by the user");
      }
      const canonicalTarget = await realpath(targetPath);
      if (!(await ctx.isPathAuthorized(canonicalTarget))) {
        throw new Error("Canonical target is outside the directories authorized by the user");
      }

      const info = await stat(canonicalTarget);
      if (!info.isDirectory()) {
        throw new Error("Path is not a directory");
      }

      async function collectEntries(dir: string, depth: number): Promise<unknown[]> {
        const entries = await readdir(dir, { withFileTypes: true });
        const result: unknown[] = [];
        for (const entry of entries) {
          const entryPath = path.join(dir, entry.name);
          if (!(await ctx.isPathAuthorized(entryPath))) continue;
          const entryStat = await stat(entryPath);
          result.push({
            name: entry.name,
            path: entryPath,
            type: entry.isDirectory() ? "directory" : entry.isFile() ? "file" : "other",
            size: entryStat.size,
            mtime: entryStat.mtime.toISOString(),
          });
          if (parsed.recursive && entry.isDirectory() && depth < parsed.maxDepth) {
            result.push(...(await collectEntries(entryPath, depth + 1)));
          }
        }
        return result;
      }

      const entries = await collectEntries(canonicalTarget, 1);
      return { path: canonicalTarget, entries };
    },
  };
}
