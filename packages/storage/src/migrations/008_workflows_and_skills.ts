import type { Database } from "../db";

export function runMigration(db: Database): void {
  // Skills table for reusable skill blocks.
  db.run(`
    CREATE TABLE IF NOT EXISTS skills (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      prompt TEXT NOT NULL,
      system_prompt TEXT NOT NULL DEFAULT '',
      provider TEXT,
      model TEXT,
      temperature REAL,
      max_tokens INTEGER,
      tool_allowlist_json TEXT NOT NULL DEFAULT '[]',
      mcp_allowlist_json TEXT NOT NULL DEFAULT '[]',
      max_steps INTEGER NOT NULL DEFAULT 1,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Workflow template steps (explicit plan sequence).
  db.run(`
    CREATE TABLE IF NOT EXISTS workflow_template_steps (
      id TEXT PRIMARY KEY,
      template_id TEXT NOT NULL REFERENCES workflow_templates(id) ON DELETE CASCADE,
      step_index INTEGER NOT NULL,
      name TEXT NOT NULL,
      kind TEXT NOT NULL,
      config_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(template_id, step_index)
    )
  `);

  // Add settings to workflow templates and link runs to templates.
  db.run(`
    ALTER TABLE workflow_templates ADD COLUMN settings_json TEXT NOT NULL DEFAULT '{}'
  `);

  db.run(`
    ALTER TABLE workflow_runs ADD COLUMN template_id TEXT
  `);

  // Extend workflow_steps to support MCP and skill steps.
  db.run(`
    ALTER TABLE workflow_steps ADD COLUMN mcp_server_id TEXT
  `);

  db.run(`
    ALTER TABLE workflow_steps ADD COLUMN skill_id TEXT
  `);

  db.run(`
    ALTER TABLE workflow_steps ADD COLUMN config_json TEXT NOT NULL DEFAULT '{}'
  `);
}
