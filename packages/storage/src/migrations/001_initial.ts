import type { Database } from "../db";

export function runMigrations(db: Database): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS interactions (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      tool_name TEXT NOT NULL,
      provider_id TEXT NOT NULL,
      permission_level TEXT NOT NULL DEFAULT 'external',
      input_preview TEXT NOT NULL,
      output_preview TEXT NOT NULL,
      duration_ms INTEGER NOT NULL,
      success INTEGER NOT NULL DEFAULT 1,
      error_message TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS tool_runs (
      id TEXT PRIMARY KEY,
      interaction_id TEXT NOT NULL REFERENCES interactions(id),
      tool_name TEXT NOT NULL,
      input_json TEXT NOT NULL,
      output_json TEXT NOT NULL,
      started_at TEXT NOT NULL,
      completed_at TEXT NOT NULL,
      duration_ms INTEGER NOT NULL,
      success INTEGER NOT NULL DEFAULT 1,
      error_message TEXT
    )
  `);

  db.run(`
    CREATE VIRTUAL TABLE IF NOT EXISTS interactions_fts USING fts5(
      id,
      input_preview,
      output_preview,
      content='interactions',
      content_rowid='rowid'
    )
  `);

  db.run(`
    CREATE TRIGGER IF NOT EXISTS interactions_ai AFTER INSERT ON interactions BEGIN
      INSERT INTO interactions_fts(rowid, id, input_preview, output_preview)
      VALUES (new.rowid, new.id, new.input_preview, new.output_preview);
    END
  `);

  db.run(`
    CREATE TRIGGER IF NOT EXISTS interactions_ad AFTER DELETE ON interactions BEGIN
      INSERT INTO interactions_fts(interactions_fts, rowid, id, input_preview, output_preview)
      VALUES ('delete', old.rowid, old.id, old.input_preview, old.output_preview);
    END
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS permissions (
      id TEXT PRIMARY KEY,
      level TEXT NOT NULL,
      description TEXT NOT NULL,
      granted INTEGER NOT NULL DEFAULT 0,
      remembered INTEGER NOT NULL DEFAULT 0
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS provider_configs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      kind TEXT NOT NULL,
      base_url TEXT NOT NULL,
      api_key_env TEXT NOT NULL,
      models TEXT NOT NULL DEFAULT '[]'
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);
}
