import type { Database } from "../db";
import { getSetting, setSetting } from "../repositories/settings";

export function runMigration(db: Database): void {
  if (!getSetting(db, "defaultWindowMode")) setSetting(db, "defaultWindowMode", "normal");
  for (const key of [
    "lastWindowMode",
    "petClickBehavior",
    "contextRetention",
    "confirmContextSend",
    "hideSensitiveContent",
    "inspectorInExpanded",
    "experimentalArtifacts",
  ]) {
    db.run("DELETE FROM app_settings WHERE key = ?", [key]);
  }
}
