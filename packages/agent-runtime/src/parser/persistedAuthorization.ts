import { promises as fs } from "node:fs";
import path from "node:path";

export async function getPersistedDocumentRoot(filePath: string): Promise<string | null> {
  if (!path.isAbsolute(filePath)) return null;
  try {
    const stat = await fs.lstat(filePath);
    if (!stat.isFile() || stat.isSymbolicLink()) return null;
    return await fs.realpath(path.dirname(filePath));
  } catch {
    return null;
  }
}
