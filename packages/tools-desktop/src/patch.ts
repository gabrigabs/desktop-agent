import { readFile, realpath, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { RegisteredTool } from "@desktop-agent/tool-registry";
import { z } from "zod";

export type PatchToolContext = {
  isPathAuthorized(filePath: string): Promise<boolean>;
};

const filePatchSchema = z.object({
  filePath: z.string().min(1),
  patch: z.string().min(1),
  dryRun: z.boolean().default(false),
});

function applyUnifiedPatch(original: string, patchText: string): string {
  const patchLines = patchText.split("\n");
  const result: string[] = [];
  const originalLines = original.split("\n");

  let patchIdx = 0;
  let origIdx = 0;

  while (patchIdx < patchLines.length) {
    const line = patchLines[patchIdx];

    if (line === undefined) break;

    if (line.startsWith("@@")) {
      const match = line.match(/@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@/);
      if (!match) throw new Error(`Invalid hunk header: ${line}`);

      const oldStart = Number.parseInt(match[1] ?? "1", 10) - 1;
      if (oldStart < 0 || oldStart > originalLines.length) {
        throw new Error(`Hunk start ${oldStart} out of range (file has ${originalLines.length} lines)`);
      }

      while (origIdx < oldStart) {
        result.push(originalLines[origIdx] ?? "");
        origIdx++;
      }

      patchIdx++;
      while (patchIdx < patchLines.length && !patchLines[patchIdx]?.startsWith("@@")) {
        const hunkLine = patchLines[patchIdx];
        if (hunkLine === undefined) break;

        if (hunkLine.startsWith(" ")) {
          const contextLine = hunkLine.slice(1);
          const origLine = originalLines[origIdx] ?? "";
          if (contextLine !== origLine) {
            throw new Error(
              `Context mismatch at line ${origIdx + 1}: expected "${origLine}", got "${contextLine}"`,
            );
          }
          result.push(origLine);
          origIdx++;
        } else if (hunkLine.startsWith("-")) {
          const removedLine = hunkLine.slice(1);
          const origLine = originalLines[origIdx] ?? "";
          if (removedLine !== origLine) {
            throw new Error(
              `Remove mismatch at line ${origIdx + 1}: expected "${origLine}", got "${removedLine}"`,
            );
          }
          origIdx++;
        } else if (hunkLine.startsWith("+")) {
          result.push(hunkLine.slice(1));
        } else if (hunkLine === "") {
          // Empty line in patch, treat as context
          result.push(originalLines[origIdx] ?? "");
          origIdx++;
        } else if (hunkLine.startsWith("\\")) {
          // No newline marker, skip
        } else {
          throw new Error(`Invalid patch line: ${hunkLine}`);
        }
        patchIdx++;
      }
    } else if (line.startsWith("---") || line.startsWith("+++")) {
      patchIdx++;
    } else if (line.startsWith("diff ")) {
      patchIdx++;
    } else if (line === "") {
      patchIdx++;
    } else {
      patchIdx++;
    }
  }

  while (origIdx < originalLines.length) {
    result.push(originalLines[origIdx] ?? "");
    origIdx++;
  }

  return result.join("\n");
}

export function createFilePatchTool(ctx: PatchToolContext): RegisteredTool {
  return {
    name: "file.patch",
    description: "Aplica um patch unificado em um arquivo com preview e rollback automático",
    category: "desktop",
    permissionLevel: "local.write",
    executionPolicy: "explicit_approval",
    inputSchema: filePatchSchema,
    async handler(input) {
      const parsed = filePatchSchema.parse(input);
      const resolvedPath = path.resolve(parsed.filePath);
      const canonical = await realpath(resolvedPath);
      if (!(await ctx.isPathAuthorized(canonical))) {
        throw new Error("File path is outside the directories authorized by the user");
      }

      const original = await readFile(canonical, "utf-8");
      const patched = applyUnifiedPatch(original, parsed.patch);

      if (parsed.dryRun) {
        const originalLines = original.split("\n");
        const patchedLines = patched.split("\n");
        return {
          dryRun: true,
          filePath: canonical,
          originalLines: originalLines.length,
          patchedLines: patchedLines.length,
          preview: patched.slice(0, 5000),
        };
      }

      const tmpPath = `${canonical}.helix-patch-tmp-${Date.now()}`;
      try {
        await writeFile(tmpPath, patched, "utf-8");
        await rename(tmpPath, canonical);
      } catch (err) {
        try {
          await writeFile(canonical, original, "utf-8");
        } catch {
          // rollback failed, original may be corrupted
        }
        throw err;
      }

      return {
        dryRun: false,
        filePath: canonical,
        applied: true,
        originalSize: Buffer.byteLength(original),
        patchedSize: Buffer.byteLength(patched),
      };
    },
  };
}
