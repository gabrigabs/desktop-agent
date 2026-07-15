import type { Database } from "../db";

function columnExists(db: Database, table: string, column: string): boolean {
  return (db.query(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).some(
    (entry) => entry.name === column,
  );
}

export function runMigration(db: Database): void {
  if (!columnExists(db, "follow_up_observations", "status")) {
    db.run("ALTER TABLE follow_up_observations ADD COLUMN status TEXT NOT NULL DEFAULT 'pending'");
  }
  if (!columnExists(db, "follow_up_observations", "target")) {
    db.run("ALTER TABLE follow_up_observations ADD COLUMN target TEXT");
  }
  if (!columnExists(db, "follow_up_observations", "metadata_json")) {
    db.run("ALTER TABLE follow_up_observations ADD COLUMN metadata_json TEXT NOT NULL DEFAULT '{}'");
  }
  db.run(
    "CREATE INDEX IF NOT EXISTS idx_follow_up_observations_status ON follow_up_observations(session_id, status)",
  );
}
