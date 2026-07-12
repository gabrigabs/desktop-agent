import { randomUUID } from "node:crypto";
import type { Database } from "../db";

export type MarkdownSource = {
  id: string;
  path: string;
  displayName: string;
  fileCount: number;
  lastIndexedAt: string;
  createdAt: string;
  updatedAt: string;
};

function mapRow(row: unknown): MarkdownSource {
  const value = row as Record<string, unknown>;
  return {
    id: value.id as string,
    path: value.path as string,
    displayName: value.display_name as string,
    fileCount: value.file_count as number,
    lastIndexedAt: value.last_indexed_at as string,
    createdAt: value.created_at as string,
    updatedAt: value.updated_at as string,
  };
}

export function upsertMarkdownSource(
  db: Database,
  input: { path: string; displayName: string; fileCount: number },
): MarkdownSource {
  const existing = db.query("SELECT id, created_at FROM markdown_sources WHERE path = ?").get(input.path) as
    | { id: string; created_at: string }
    | undefined;
  const id = existing?.id ?? randomUUID();
  const now = new Date().toISOString();
  db.run(
    `INSERT INTO markdown_sources (
      id, path, display_name, file_count, last_indexed_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(path) DO UPDATE SET
      display_name = excluded.display_name,
      file_count = excluded.file_count,
      last_indexed_at = excluded.last_indexed_at,
      updated_at = excluded.updated_at`,
    [id, input.path, input.displayName, input.fileCount, now, existing?.created_at ?? now, now],
  );
  const saved = db.query("SELECT * FROM markdown_sources WHERE id = ?").get(id);
  if (!saved) throw new Error("Failed to persist Markdown source");
  return mapRow(saved);
}

export function listMarkdownSources(db: Database): MarkdownSource[] {
  return db.query("SELECT * FROM markdown_sources ORDER BY updated_at DESC").all().map(mapRow);
}

export function deleteAllMarkdownSources(db: Database): void {
  db.run("DELETE FROM markdown_sources");
}
