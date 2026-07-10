import type { Database } from "../db";

export function runMigration(db: Database): void {
  db.run(`
    ALTER TABLE skills ADD COLUMN metadata_json TEXT NOT NULL DEFAULT '{}'
  `);

  db.run(`
    ALTER TABLE skills ADD COLUMN compatibility TEXT NOT NULL DEFAULT ''
  `);
}
