import type { Database } from "../db";

export function runMigration(db: Database): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS parsed_documents (
      id TEXT PRIMARY KEY,
      path TEXT NOT NULL DEFAULT '',
      display_name TEXT NOT NULL,
      size INTEGER NOT NULL DEFAULT 0,
      mime_type TEXT NOT NULL DEFAULT '',
      encoding TEXT NOT NULL DEFAULT 'parsed',
      content TEXT,
      preview TEXT NOT NULL DEFAULT '',
      parsed_format TEXT,
      parsed_metadata_json TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'done',
      error TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}
