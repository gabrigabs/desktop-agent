import type { Database } from "../db";

function tableExists(db: Database, name: string): boolean {
  return Boolean(db.query("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(name));
}

function columnExists(db: Database, table: string, column: string): boolean {
  if (!tableExists(db, table)) return false;
  return (db.query(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).some(
    (entry) => entry.name === column,
  );
}

function renameTable(db: Database, from: string, to: string): void {
  if (tableExists(db, from) && !tableExists(db, to)) db.run(`ALTER TABLE ${from} RENAME TO ${to}`);
}

function renameColumn(db: Database, table: string, from: string, to: string): void {
  if (columnExists(db, table, from) && !columnExists(db, table, to)) {
    db.run(`ALTER TABLE ${table} RENAME COLUMN ${from} TO ${to}`);
  }
}

export function runMigration(db: Database): void {
  renameTable(db, "workspaces", "spaces");
  renameTable(db, "workspace_memory", "space_memory");
  renameTable(db, "workspace_conversations", "space_conversations");
  renameTable(db, "workspace_documents", "space_documents");

  renameColumn(db, "space_memory", "workspace_id", "space_id");
  renameColumn(db, "space_conversations", "workspace_id", "space_id");
  renameColumn(db, "space_documents", "workspace_id", "space_id");

  for (const table of [
    "workspace_budget_items",
    "workspace_debts",
    "workspace_goals",
    "workspace_purchase_decisions",
    "workspace_scenarios",
  ]) {
    db.run(`DROP TABLE IF EXISTS ${table}`);
  }

  db.run("UPDATE spaces SET preferred_layout = 'collections' WHERE preferred_layout = 'dashboard'");
  db.run(
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_space_memory_source_turn ON space_memory(space_id, source_turn_id) WHERE source_turn_id IS NOT NULL",
  );

  db.run(`
    CREATE TABLE IF NOT EXISTS execution_context_snapshots (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      space_id TEXT REFERENCES spaces(id) ON DELETE SET NULL,
      facts_json TEXT NOT NULL DEFAULT '[]',
      instructions TEXT NOT NULL DEFAULT '',
      sources_json TEXT NOT NULL DEFAULT '[]',
      file_context_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  renameColumn(db, "execution_context_snapshots", "workspace_id", "space_id");
  db.run("CREATE INDEX IF NOT EXISTS idx_execution_context_run ON execution_context_snapshots(run_id)");

  db.run(`
    CREATE TABLE IF NOT EXISTS space_collections (
      id TEXT PRIMARY KEY,
      space_id TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      icon TEXT NOT NULL DEFAULT 'table',
      fields_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  db.run("CREATE INDEX IF NOT EXISTS idx_space_collections_space ON space_collections(space_id)");

  db.run(`
    CREATE TABLE IF NOT EXISTS space_records (
      id TEXT PRIMARY KEY,
      space_id TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
      collection_id TEXT NOT NULL REFERENCES space_collections(id) ON DELETE CASCADE,
      values_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  db.run("CREATE INDEX IF NOT EXISTS idx_space_records_collection ON space_records(space_id, collection_id)");

  db.run(`
    CREATE TABLE IF NOT EXISTS space_views (
      id TEXT PRIMARY KEY,
      space_id TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
      collection_id TEXT NOT NULL REFERENCES space_collections(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      config_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  db.run("CREATE INDEX IF NOT EXISTS idx_space_views_space ON space_views(space_id, collection_id)");
}
