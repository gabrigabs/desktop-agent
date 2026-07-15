import type { Database } from "../db";

export function runMigration(db: Database): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      icon TEXT NOT NULL DEFAULT 'folder',
      color TEXT NOT NULL DEFAULT '#c499f4',
      folder_path TEXT NOT NULL,
      purpose TEXT NOT NULL DEFAULT '',
      instructions TEXT NOT NULL DEFAULT '',
      profile_id TEXT,
      preferred_layout TEXT NOT NULL DEFAULT 'chat',
      memory_enabled INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS workspace_memory (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      origin TEXT NOT NULL DEFAULT 'manual',
      status TEXT NOT NULL DEFAULT 'active',
      source_turn_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS workspace_conversations (
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      PRIMARY KEY (workspace_id, conversation_id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS workspace_documents (
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      document_id TEXT NOT NULL REFERENCES parsed_documents(id) ON DELETE CASCADE,
      added_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (workspace_id, document_id)
    )
  `);
}
