import type { Database } from "../db";

function setDefaultSetting(db: Database, key: string, value: string): void {
  db.run("INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)", [key, value]);
}

export function runMigration(db: Database): void {
  setDefaultSetting(db, "windowOpacity", "0.72");
  setDefaultSetting(db, "petSize", "58");
}
