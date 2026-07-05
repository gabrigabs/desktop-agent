import type { Database } from "../db";

export function getSetting(db: Database, key: string): string | null {
  const row = db.query("SELECT value FROM app_settings WHERE key = ?").get(key) as { value: string } | null;
  return row ? row.value : null;
}

export function setSetting(db: Database, key: string, value: string): void {
  db.run(
    `INSERT INTO app_settings (key, value)
     VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value],
  );
}

export function getAllSettings(db: Database): Record<string, string> {
  const rows = db.query("SELECT key, value FROM app_settings").all() as Array<{
    key: string;
    value: string;
  }>;

  const settings: Record<string, string> = {};
  for (const row of rows) {
    settings[row.key] = row.value;
  }
  return settings;
}
