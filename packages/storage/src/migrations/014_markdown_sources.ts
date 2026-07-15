import type { Database } from "../db";

export function runMigration(db: Database): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS markdown_sources (
      id TEXT PRIMARY KEY,
      path TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      file_count INTEGER NOT NULL DEFAULT 0,
      last_indexed_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
}
