import type { Database } from "../db";

export function runMigration(db: Database): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      title TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS turns (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
      blocks_json TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'complete' CHECK (status IN ('streaming','complete','error','cancelled')),
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      source_mode TEXT NOT NULL DEFAULT 'free',
      execution_mode TEXT NOT NULL DEFAULT 'simple'
    )
  `);

  db.run("CREATE INDEX IF NOT EXISTS idx_turns_conv ON turns(conversation_id, timestamp)");
}
