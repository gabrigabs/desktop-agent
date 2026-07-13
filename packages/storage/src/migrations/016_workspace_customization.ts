import type { Database } from "../db";

export function runMigration(db: Database): void {
  const columns = db.query("PRAGMA table_info(workspaces)").all() as Array<{ name: string }>;
  if (!columns.some((column) => column.name === "instructions")) {
    db.run("ALTER TABLE workspaces ADD COLUMN instructions TEXT NOT NULL DEFAULT ''");
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS workspace_documents (
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      document_id TEXT NOT NULL REFERENCES parsed_documents(id) ON DELETE CASCADE,
      added_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (workspace_id, document_id)
    )
  `);
}
