import type { Database } from "../db";

function hasColumn(db: Database, table: string, column: string): boolean {
  const rows = db.query(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return rows.some((row) => row.name === column);
}

export function runMigration(db: Database): void {
  if (!hasColumn(db, "agent_profiles", "tone")) {
    db.run("ALTER TABLE agent_profiles ADD COLUMN tone TEXT NOT NULL DEFAULT ''");
  }
  if (!hasColumn(db, "agent_profiles", "response_style")) {
    db.run("ALTER TABLE agent_profiles ADD COLUMN response_style TEXT NOT NULL DEFAULT ''");
  }
  if (!hasColumn(db, "agent_profiles", "constraints")) {
    db.run("ALTER TABLE agent_profiles ADD COLUMN constraints TEXT NOT NULL DEFAULT ''");
  }

  db.run(`
    UPDATE agent_profiles
    SET tone = CASE
      WHEN id = 'profile-developer' THEN 'técnico'
      WHEN id = 'profile-writer' THEN 'claro'
      WHEN id = 'profile-analyst' THEN 'objetivo'
      ELSE 'neutro'
    END,
    response_style = CASE
      WHEN id = 'profile-developer' THEN 'direto'
      WHEN id = 'profile-writer' THEN 'estruturado'
      WHEN id = 'profile-analyst' THEN 'objetivo'
      ELSE 'equilibrado'
    END,
    constraints = ''
    WHERE tone = '' AND response_style = ''
  `);
}
