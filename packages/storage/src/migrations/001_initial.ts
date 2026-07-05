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

  db.run(`
    CREATE TABLE IF NOT EXISTS workflow_runs (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      completed_at TEXT,
      mode TEXT NOT NULL,
      status TEXT NOT NULL,
      prompt TEXT NOT NULL,
      source_mode TEXT NOT NULL DEFAULT 'free',
      clipboard_preview TEXT NOT NULL DEFAULT '',
      provider_id TEXT NOT NULL,
      model TEXT NOT NULL DEFAULT '',
      max_steps INTEGER NOT NULL DEFAULT 8,
      current_step INTEGER NOT NULL DEFAULT 0,
      result TEXT NOT NULL DEFAULT '',
      error_message TEXT,
      approval_json TEXT,
      metadata_json TEXT NOT NULL DEFAULT '{}'
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS workflow_steps (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
      step_index INTEGER NOT NULL,
      kind TEXT NOT NULL,
      status TEXT NOT NULL,
      title TEXT NOT NULL,
      detail TEXT NOT NULL DEFAULT '',
      tool_name TEXT,
      permission_level TEXT,
      input_json TEXT NOT NULL DEFAULT '{}',
      output_json TEXT NOT NULL DEFAULT '{}',
      error_message TEXT,
      requires_approval INTEGER NOT NULL DEFAULT 0,
      started_at TEXT,
      completed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(run_id, step_index)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS workflow_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      prompt TEXT NOT NULL,
      mode TEXT NOT NULL,
      max_steps INTEGER NOT NULL DEFAULT 8,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS mcp_servers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      command TEXT NOT NULL,
      args_json TEXT NOT NULL DEFAULT '[]',
      env_json TEXT NOT NULL DEFAULT '{}',
      enabled INTEGER NOT NULL DEFAULT 0,
      preset INTEGER NOT NULL DEFAULT 0,
      permission_policy_json TEXT NOT NULL DEFAULT '[]',
      last_checked_at TEXT,
      last_error TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}
