import type { Database } from "../db";

export function runMigration(db: Database): void {
  db.run(`
    ALTER TABLE conversations ADD COLUMN profile_id TEXT
  `);

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_conversations_profile ON conversations(profile_id)
  `);
}
