import type { Database } from "../db";
import { runMigrations as runInitialMigration } from "./001_initial";
import { runMigration as runTurnsMigration } from "./002_turns";
import { runMigration as runSettingsV2Migration } from "./003_settings_v2";
import { runMigration as runMcpEnvMigration } from "./004_mcp_env";
import { runMigration as runUiPreferencesMigration } from "./005_ui_preferences";
import { runMigration as runPromptLibraryMigration } from "./006_prompt_library";
import { runMigration as runAgentProfilesFieldsMigration } from "./007_agent_profiles_fields";
import { runMigration as runWorkflowsAndSkillsMigration } from "./008_workflows_and_skills";
import { runMigration as runSkillMetadataMigration } from "./009_skill_metadata";
import { runMigration as runConversationProfileIdMigration } from "./010_conversation_profile_id";
import { runMigration as runTurnProfileIdMigration } from "./011_turn_profile_id";
import { runMigration as runParsedDocumentsMigration } from "./012_parsed_documents";
import { runMigration as runParsedDocumentsIdentityMigration } from "./013_parsed_documents_identity";
import { runMigration as runMarkdownSourcesMigration } from "./014_markdown_sources";
import { runMigration as runSpacesMigration } from "./015_workspaces";
import { runMigration as runSpaceCustomizationMigration } from "./016_workspace_customization";
import { runMigration as runSpaceConsolidationMigration } from "./017_space_consolidation";
import { runMigration as runSettingsCleanupMigration } from "./018_settings_cleanup";
import { runMigration as runFollowUpSessionsMigration } from "./019_follow_up_sessions";

const MIGRATION_TABLE = `
  CREATE TABLE IF NOT EXISTS _migrations (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`;

function applyMigration(db: Database, version: number, fn: (db: Database) => void): void {
  const existing = db.query("SELECT version FROM _migrations WHERE version = ?").get(version);
  if (existing) return;

  fn(db);
  db.run("INSERT INTO _migrations (version) VALUES (?)", [version]);
}

export function runMigrationsThrough(db: Database, targetVersion = 19): void {
  db.run(MIGRATION_TABLE);
  const migrations: Array<[number, (database: Database) => void]> = [
    [1, runInitialMigration], [2, runTurnsMigration], [3, runSettingsV2Migration],
    [4, runMcpEnvMigration], [5, runUiPreferencesMigration], [6, runPromptLibraryMigration],
    [7, runAgentProfilesFieldsMigration], [8, runWorkflowsAndSkillsMigration], [9, runSkillMetadataMigration],
    [10, runConversationProfileIdMigration], [11, runTurnProfileIdMigration], [12, runParsedDocumentsMigration],
    [13, runParsedDocumentsIdentityMigration], [14, runMarkdownSourcesMigration], [15, runSpacesMigration],
    [16, runSpaceCustomizationMigration], [17, runSpaceConsolidationMigration], [18, runSettingsCleanupMigration],
    [19, runFollowUpSessionsMigration],
  ];
  for (const [version, migration] of migrations) {
    if (version <= targetVersion) applyMigration(db, version, migration);
  }
}

export function runMigrations(db: Database): void {
  runMigrationsThrough(db);
}
