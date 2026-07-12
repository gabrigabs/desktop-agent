import { mkdir, realpath, writeFile } from "node:fs/promises";
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
