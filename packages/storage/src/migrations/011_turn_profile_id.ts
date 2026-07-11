import type { Database } from "../db";

export function runMigration(db: Database): void {
  db.run(`
    ALTER TABLE turns ADD COLUMN profile_id TEXT
  `);

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_turns_profile ON turns(profile_id)
  `);
}
