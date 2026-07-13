import { randomUUID } from "node:crypto";
import type { MemoryFact, Workspace, WorkspaceLayout } from "@desktop-agent/shared";
import type { Database } from "../db";

type SqlValue = string | number | null;

function mapWorkspace(row: Record<string, unknown>): Workspace {
  return {
    id: row.id as string,
    name: row.name as string,
    icon: row.icon as string,
    color: row.color as string,
    folderPath: row.folder_path as string,
    purpose: row.purpose as string,
    instructions: (row.instructions as string) ?? "",
    profileId: (row.profile_id as string) ?? undefined,
    preferredLayout: row.preferred_layout as WorkspaceLayout,
    memoryEnabled: Boolean(row.memory_enabled),
    status: row.status as "active" | "archived",
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function mapMemoryFact(row: Record<string, unknown>): MemoryFact {
  return {
    id: row.id as string,
    content: row.content as string,
    origin: row.origin as "manual" | "assistant",
    status: row.status as "active" | "archived",
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    sourceTurnId: (row.source_turn_id as string) ?? undefined,
  };
}

export function createWorkspace(
  db: Database,
  params: {
    name: string;
    folderPath: string;
    icon?: string;
    color?: string;
    purpose?: string;
    instructions?: string;
    profileId?: string | null;
    preferredLayout?: WorkspaceLayout;
  },
): string {
  const id = randomUUID();
  db.run(
    `INSERT INTO workspaces (id, name, icon, color, folder_path, purpose, instructions, profile_id, preferred_layout)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      params.name,
      params.icon ?? "folder",
      params.color ?? "#c499f4",
      params.folderPath,
      params.purpose ?? "",
      params.instructions ?? "",
      params.profileId ?? null,
      params.preferredLayout ?? "chat",
    ],
  );
  return id;
}

export function getWorkspace(db: Database, id: string): Workspace | null {
  const row = db.query("SELECT * FROM workspaces WHERE id = ?").get(id);
  if (!row) return null;
  return mapWorkspace(row as Record<string, unknown>);
}

export function listWorkspaces(db: Database, limit = 50): Workspace[] {
  return db
    .query("SELECT * FROM workspaces WHERE status = 'active' ORDER BY updated_at DESC LIMIT ?")
    .all(limit)
    .map((row) => mapWorkspace(row as Record<string, unknown>));
}

export function updateWorkspace(
  db: Database,
  id: string,
  fields: {
    name?: string;
    purpose?: string;
    instructions?: string;
    folderPath?: string;
    icon?: string;
    profileId?: string | null;
    preferredLayout?: WorkspaceLayout;
    memoryEnabled?: boolean;
    color?: string;
  },
): void {
  const assignments: string[] = ["updated_at = datetime('now')"];
  const values: SqlValue[] = [];

  if (fields.name !== undefined) {
    assignments.push("name = ?");
    values.push(fields.name);
  }
  if (fields.purpose !== undefined) {
    assignments.push("purpose = ?");
    values.push(fields.purpose);
  }
  if (fields.instructions !== undefined) {
    assignments.push("instructions = ?");
    values.push(fields.instructions);
  }
  if (fields.folderPath !== undefined) {
    assignments.push("folder_path = ?");
    values.push(fields.folderPath);
  }
  if (fields.icon !== undefined) {
    assignments.push("icon = ?");
    values.push(fields.icon);
  }
  if (fields.profileId !== undefined) {
    assignments.push("profile_id = ?");
    values.push(fields.profileId ?? null);
  }
  if (fields.preferredLayout !== undefined) {
    assignments.push("preferred_layout = ?");
    values.push(fields.preferredLayout);
  }
  if (fields.memoryEnabled !== undefined) {
    assignments.push("memory_enabled = ?");
    values.push(fields.memoryEnabled ? 1 : 0);
  }
  if (fields.color !== undefined) {
    assignments.push("color = ?");
    values.push(fields.color);
  }

  if (assignments.length === 1) return;
  values.push(id);
  db.run(`UPDATE workspaces SET ${assignments.join(", ")} WHERE id = ?`, values);
}

export function archiveWorkspace(db: Database, id: string): void {
  db.run(`UPDATE workspaces SET status = 'archived', updated_at = datetime('now') WHERE id = ?`, [id]);
}

export function deleteWorkspace(db: Database, id: string): void {
  db.run("DELETE FROM workspaces WHERE id = ?", [id]);
}

export function attachDocument(db: Database, workspaceId: string, documentId: string): void {
  db.run("INSERT OR IGNORE INTO workspace_documents (workspace_id, document_id) VALUES (?, ?)", [
    workspaceId,
    documentId,
  ]);
}

export function detachDocument(db: Database, workspaceId: string, documentId: string): void {
  db.run("DELETE FROM workspace_documents WHERE workspace_id = ? AND document_id = ?", [
    workspaceId,
    documentId,
  ]);
}

export function listWorkspaceDocumentIds(db: Database, workspaceId: string): string[] {
  return db
    .query("SELECT document_id FROM workspace_documents WHERE workspace_id = ? ORDER BY added_at DESC")
    .all(workspaceId)
    .map((row) => (row as Record<string, unknown>).document_id as string);
}

export function listMemoryFacts(db: Database, workspaceId: string): MemoryFact[] {
  return db
    .query("SELECT * FROM workspace_memory WHERE workspace_id = ? ORDER BY created_at DESC")
    .all(workspaceId)
    .map((row) => mapMemoryFact(row as Record<string, unknown>));
}

export function listActiveMemoryFacts(db: Database, workspaceId: string): MemoryFact[] {
  return db
    .query(
      "SELECT * FROM workspace_memory WHERE workspace_id = ? AND status = 'active' ORDER BY created_at DESC",
    )
    .all(workspaceId)
    .map((row) => mapMemoryFact(row as Record<string, unknown>));
}

export function addMemoryFact(
  db: Database,
  workspaceId: string,
  params: {
    content: string;
    origin?: "manual" | "assistant";
    sourceTurnId?: string;
  },
): string {
  const id = randomUUID();
  db.run(
    `INSERT INTO workspace_memory (id, workspace_id, content, origin, source_turn_id)
     VALUES (?, ?, ?, ?, ?)`,
    [id, workspaceId, params.content, params.origin ?? "manual", params.sourceTurnId ?? null],
  );
  return id;
}

export function updateMemoryFact(
  db: Database,
  id: string,
  fields: {
    content?: string;
    status?: "active" | "archived";
  },
): void {
  const assignments: string[] = ["updated_at = datetime('now')"];
  const values: SqlValue[] = [];

  if (fields.content !== undefined) {
    assignments.push("content = ?");
    values.push(fields.content);
  }
  if (fields.status !== undefined) {
    assignments.push("status = ?");
    values.push(fields.status);
  }

  if (assignments.length === 1) return;
  values.push(id);
  db.run(`UPDATE workspace_memory SET ${assignments.join(", ")} WHERE id = ?`, values);
}

export function archiveMemoryFact(db: Database, id: string): void {
  db.run(`UPDATE workspace_memory SET status = 'archived', updated_at = datetime('now') WHERE id = ?`, [id]);
}

export function deleteMemoryFact(db: Database, id: string): void {
  db.run("DELETE FROM workspace_memory WHERE id = ?", [id]);
}

export function linkConversation(db: Database, workspaceId: string, conversationId: string): void {
  db.run("INSERT OR IGNORE INTO workspace_conversations (workspace_id, conversation_id) VALUES (?, ?)", [
    workspaceId,
    conversationId,
  ]);
}

export function listConversationsByWorkspace(db: Database, workspaceId: string): string[] {
  return db
    .query("SELECT conversation_id FROM workspace_conversations WHERE workspace_id = ?")
    .all(workspaceId)
    .map((row) => (row as Record<string, unknown>).conversation_id as string);
}
