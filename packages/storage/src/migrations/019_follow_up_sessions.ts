import type { Database } from "../db";

function columnExists(db: Database, table: string, column: string): boolean {
  const tableExists = Boolean(
    db.query("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(table),
  );
  if (!tableExists) return false;
  return (db.query(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).some(
    (entry) => entry.name === column,
  );
}

export function runMigration(db: Database): void {
  if (
    columnExists(db, "follow_up_sessions", "workspace_id") &&
    !columnExists(db, "follow_up_sessions", "space_id")
  ) {
    db.run("ALTER TABLE follow_up_sessions RENAME COLUMN workspace_id TO space_id");
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS follow_up_sessions (
      id TEXT PRIMARY KEY,
      mode TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      objective TEXT NOT NULL,
      space_id TEXT REFERENCES spaces(id) ON DELETE SET NULL,
      memory_scope TEXT DEFAULT 'session',
      context_policy TEXT,
      next_actions TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      paused_at TEXT,
      completed_at TEXT,
      close_reason TEXT
    )
  `);
  db.run("CREATE INDEX IF NOT EXISTS idx_follow_up_sessions_status ON follow_up_sessions(status)");

  db.run(`
    CREATE TABLE IF NOT EXISTS follow_up_observations (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      content TEXT NOT NULL,
      source TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  db.run(
    "CREATE INDEX IF NOT EXISTS idx_follow_up_observations_session ON follow_up_observations(session_id)",
  );

  db.run(`
    CREATE TABLE IF NOT EXISTS follow_up_hypotheses (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      text TEXT NOT NULL,
      status TEXT DEFAULT 'open',
      evidence TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  db.run("CREATE INDEX IF NOT EXISTS idx_follow_up_hypotheses_session ON follow_up_hypotheses(session_id)");

  db.run(`
    CREATE TABLE IF NOT EXISTS follow_up_events (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      type TEXT NOT NULL,
      payload TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  db.run("CREATE INDEX IF NOT EXISTS idx_follow_up_events_session ON follow_up_events(session_id)");
}
