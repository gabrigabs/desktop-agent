import type { Database } from "../db";

function hasColumn(db: Database, table: string, column: string): boolean {
  const rows = db.query(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return rows.some((row) => row.name === column);
}

export function runMigration(db: Database): void {
  if (!hasColumn(db, "mcp_servers", "env_json")) {
    db.run("ALTER TABLE mcp_servers ADD COLUMN env_json TEXT NOT NULL DEFAULT '{}'");
  }
}
