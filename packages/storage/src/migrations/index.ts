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
import { runMigration as runWorkspacesMigration } from "./015_workspaces";
import { runMigration as runWorkspaceCustomizationMigration } from "./016_workspace_customization";

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

export function runMigrations(db: Database): void {
  db.run(MIGRATION_TABLE);
  applyMigration(db, 1, runInitialMigration);
  applyMigration(db, 2, runTurnsMigration);
  applyMigration(db, 3, runSettingsV2Migration);
  applyMigration(db, 4, runMcpEnvMigration);
  applyMigration(db, 5, runUiPreferencesMigration);
  applyMigration(db, 6, runPromptLibraryMigration);
  applyMigration(db, 7, runAgentProfilesFieldsMigration);
  applyMigration(db, 8, runWorkflowsAndSkillsMigration);
  applyMigration(db, 9, runSkillMetadataMigration);
  applyMigration(db, 10, runConversationProfileIdMigration);
  applyMigration(db, 11, runTurnProfileIdMigration);
  applyMigration(db, 12, runParsedDocumentsMigration);
  applyMigration(db, 13, runParsedDocumentsIdentityMigration);
  applyMigration(db, 14, runMarkdownSourcesMigration);
  applyMigration(db, 15, runWorkspacesMigration);
  applyMigration(db, 16, runWorkspaceCustomizationMigration);
}
