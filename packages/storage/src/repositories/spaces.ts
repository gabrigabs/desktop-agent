import { randomUUID } from "node:crypto";
import type {
  ExecutionContextSnapshot,
  Space,
  SpaceCollection,
  SpaceField,
  SpaceLayout,
  SpaceMemoryFact,
  SpaceRecord,
  SpaceRecordValue,
  SpaceView,
  SpaceViewType,
} from "@desktop-agent/shared";
import type { Database } from "../db";

type SqlValue = string | number | null;

function mapSpace(row: Record<string, unknown>): Space {
  return {
    id: row.id as string,
    name: row.name as string,
    icon: row.icon as string,
    color: row.color as string,
    folderPath: row.folder_path as string,
    purpose: row.purpose as string,
    instructions: (row.instructions as string) ?? "",
    profileId: (row.profile_id as string) ?? undefined,
    preferredLayout: row.preferred_layout as SpaceLayout,
    memoryEnabled: Boolean(row.memory_enabled),
    status: row.status as "active" | "archived",
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function mapMemoryFact(row: Record<string, unknown>): SpaceMemoryFact {
  return {
    id: row.id as string,
    spaceId: row.space_id as string,
    content: row.content as string,
    origin: row.origin as "manual" | "assistant",
    status: row.status as "active" | "archived",
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    sourceTurnId: (row.source_turn_id as string) ?? undefined,
  };
}

export function createSpace(
  db: Database,
  params: {
    name: string;
    folderPath: string;
    icon?: string;
    color?: string;
    purpose?: string;
    instructions?: string;
    profileId?: string | null;
    preferredLayout?: SpaceLayout;
    memoryEnabled?: boolean;
  },
): Space {
  const id = randomUUID();
  db.run(
    `INSERT INTO spaces (id, name, icon, color, folder_path, purpose, instructions, profile_id, preferred_layout, memory_enabled)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      params.memoryEnabled === false ? 0 : 1,
    ],
  );
  const created = getSpace(db, id);
  if (!created) throw new Error("SPACE_CREATE_FAILED");
  return created;
}

export function getSpace(db: Database, id: string): Space | null {
  const row = db.query("SELECT * FROM spaces WHERE id = ?").get(id);
  if (!row) return null;
  return mapSpace(row as Record<string, unknown>);
}

export function listSpaces(db: Database, limit = 50): Space[] {
  return db
    .query("SELECT * FROM spaces WHERE status = 'active' ORDER BY updated_at DESC LIMIT ?")
    .all(limit)
    .map((row) => mapSpace(row as Record<string, unknown>));
}

export function updateSpace(
  db: Database,
  id: string,
  fields: {
    name?: string;
    purpose?: string;
    instructions?: string;
    folderPath?: string;
    icon?: string;
    profileId?: string | null;
    preferredLayout?: SpaceLayout;
    memoryEnabled?: boolean;
    color?: string;
  },
): Space {
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

  if (assignments.length === 1) {
    const current = getSpace(db, id);
    if (!current) throw new Error("SPACE_NOT_FOUND");
    return current;
  }
  values.push(id);
  db.run(`UPDATE spaces SET ${assignments.join(", ")} WHERE id = ?`, values);
  const updated = getSpace(db, id);
  if (!updated) throw new Error("SPACE_NOT_FOUND");
  return updated;
}

export function archiveSpace(db: Database, id: string): Space {
  db.run(`UPDATE spaces SET status = 'archived', updated_at = datetime('now') WHERE id = ?`, [id]);
  const archived = getSpace(db, id);
  if (!archived) throw new Error("SPACE_NOT_FOUND");
  return archived;
}

export function deleteSpace(db: Database, id: string): Space {
  const existing = getSpace(db, id);
  if (!existing) throw new Error("SPACE_NOT_FOUND");
  db.run("DELETE FROM spaces WHERE id = ?", [id]);
  return existing;
}

export function attachDocument(db: Database, spaceId: string, documentId: string): void {
  db.run("INSERT OR IGNORE INTO space_documents (space_id, document_id) VALUES (?, ?)", [
    spaceId,
    documentId,
  ]);
}

export function detachDocument(db: Database, spaceId: string, documentId: string): void {
  db.run("DELETE FROM space_documents WHERE space_id = ? AND document_id = ?", [spaceId, documentId]);
}

export function listSpaceDocumentIds(db: Database, spaceId: string): string[] {
  return db
    .query("SELECT document_id FROM space_documents WHERE space_id = ? ORDER BY added_at DESC")
    .all(spaceId)
    .map((row) => (row as Record<string, unknown>).document_id as string);
}

export function listMemoryFacts(db: Database, spaceId: string): SpaceMemoryFact[] {
  return db
    .query("SELECT * FROM space_memory WHERE space_id = ? ORDER BY created_at DESC")
    .all(spaceId)
    .map((row) => mapMemoryFact(row as Record<string, unknown>));
}

export function listActiveMemoryFacts(db: Database, spaceId: string): SpaceMemoryFact[] {
  return db
    .query("SELECT * FROM space_memory WHERE space_id = ? AND status = 'active' ORDER BY created_at DESC")
    .all(spaceId)
    .map((row) => mapMemoryFact(row as Record<string, unknown>));
}

export function addMemoryFact(
  db: Database,
  spaceId: string,
  params: {
    content: string;
    origin?: "manual" | "assistant";
    sourceTurnId?: string;
  },
): SpaceMemoryFact {
  if (params.sourceTurnId) {
    const existing = db
      .query("SELECT * FROM space_memory WHERE space_id = ? AND source_turn_id = ? LIMIT 1")
      .get(spaceId, params.sourceTurnId) as Record<string, unknown> | undefined;
    if (existing) return mapMemoryFact(existing);
  }
  const id = randomUUID();
  db.run(
    `INSERT INTO space_memory (id, space_id, content, origin, source_turn_id)
     VALUES (?, ?, ?, ?, ?)`,
    [id, spaceId, params.content, params.origin ?? "manual", params.sourceTurnId ?? null],
  );
  const row = db.query("SELECT * FROM space_memory WHERE id = ? AND space_id = ?").get(id, spaceId) as Record<
    string,
    unknown
  >;
  return mapMemoryFact(row);
}

export function updateMemoryFact(
  db: Database,
  spaceId: string,
  id: string,
  fields: {
    content?: string;
    status?: "active" | "archived";
  },
): SpaceMemoryFact {
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

  if (assignments.length === 1) {
    const current = db.query("SELECT * FROM space_memory WHERE id = ? AND space_id = ?").get(id, spaceId);
    if (!current) throw new Error("SPACE_MEMORY_FACT_NOT_FOUND");
    return mapMemoryFact(current as Record<string, unknown>);
  }
  values.push(id);
  values.push(spaceId);
  db.run(`UPDATE space_memory SET ${assignments.join(", ")} WHERE id = ? AND space_id = ?`, values);
  const row = db.query("SELECT * FROM space_memory WHERE id = ? AND space_id = ?").get(id, spaceId);
  if (!row) throw new Error("SPACE_MEMORY_FACT_NOT_FOUND");
  return mapMemoryFact(row as Record<string, unknown>);
}

export function deleteMemoryFact(db: Database, spaceId: string, id: string): void {
  db.run("DELETE FROM space_memory WHERE id = ? AND space_id = ?", [id, spaceId]);
}

export function linkConversation(db: Database, spaceId: string, conversationId: string): void {
  db.run("INSERT OR IGNORE INTO space_conversations (space_id, conversation_id) VALUES (?, ?)", [
    spaceId,
    conversationId,
  ]);
}

export function listConversationsBySpace(db: Database, spaceId: string): string[] {
  return db
    .query("SELECT conversation_id FROM space_conversations WHERE space_id = ?")
    .all(spaceId)
    .map((row) => (row as Record<string, unknown>).conversation_id as string);
}

export function saveExecutionContextSnapshot(
  db: Database,
  params: {
    runId: string;
    spaceId: string | null;
    facts: { id: string; content: string; origin: "manual" | "assistant" }[];
    instructions: string;
    sources: { documentId: string; displayName: string; preview: string; mimeType: string }[];
    fileContextPaths: string[];
  },
): string {
  const id = randomUUID();
  db.run(
    `INSERT INTO execution_context_snapshots (id, run_id, space_id, facts_json, instructions, sources_json, file_context_json)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      params.runId,
      params.spaceId,
      JSON.stringify(params.facts),
      params.instructions,
      JSON.stringify(params.sources),
      JSON.stringify(params.fileContextPaths),
    ],
  );
  return id;
}

export function getExecutionContextSnapshot(db: Database, runId: string): ExecutionContextSnapshot | null {
  const row = db
    .query("SELECT * FROM execution_context_snapshots WHERE run_id = ? ORDER BY created_at DESC LIMIT 1")
    .get(runId) as Record<string, unknown> | undefined;
  if (!row) return null;
  const facts = JSON.parse((row.facts_json as string) ?? "[]") as Array<{
    id: string;
    content: string;
    origin?: "manual" | "assistant";
  }>;
  const sources = JSON.parse((row.sources_json as string) ?? "[]") as Array<{
    documentId: string;
    displayName: string;
    preview?: string;
    mimeType?: string;
  }>;
  return {
    id: row.id as string,
    runId: row.run_id as string,
    spaceId: (row.space_id as string) ?? null,
    facts: facts.map((fact) => ({ ...fact, origin: fact.origin ?? "manual" })),
    instructions: (row.instructions as string) ?? "",
    sources: sources.map((source) => ({
      ...source,
      preview: source.preview ?? "",
      mimeType: source.mimeType ?? "application/octet-stream",
    })),
    fileContextPaths: JSON.parse((row.file_context_json as string) ?? "[]"),
    createdAt: row.created_at as string,
  };
}

function mapCollection(row: Record<string, unknown>): SpaceCollection {
  return {
    id: row.id as string,
    spaceId: row.space_id as string,
    name: row.name as string,
    icon: (row.icon as string) || "table",
    fields: JSON.parse((row.fields_json as string) || "[]") as SpaceField[],
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function mapRecord(row: Record<string, unknown>): SpaceRecord {
  return {
    id: row.id as string,
    spaceId: row.space_id as string,
    collectionId: row.collection_id as string,
    values: JSON.parse((row.values_json as string) || "{}") as Record<string, SpaceRecordValue>,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function mapView(row: Record<string, unknown>): SpaceView {
  return {
    id: row.id as string,
    spaceId: row.space_id as string,
    collectionId: row.collection_id as string,
    name: row.name as string,
    type: row.type as SpaceViewType,
    config: JSON.parse((row.config_json as string) || "{}") as Record<string, unknown>,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function getOwnedCollection(db: Database, spaceId: string, collectionId: string): SpaceCollection {
  const row = db
    .query("SELECT * FROM space_collections WHERE id = ? AND space_id = ?")
    .get(collectionId, spaceId) as Record<string, unknown> | undefined;
  if (!row) throw new Error("SPACE_COLLECTION_NOT_FOUND");
  return mapCollection(row);
}

function validateFields(fields: SpaceField[]): void {
  const ids = new Set<string>();
  for (const field of fields) {
    if (!field.id.trim() || !field.name.trim()) throw new Error("SPACE_FIELD_NAME_REQUIRED");
    if (ids.has(field.id)) throw new Error("SPACE_FIELD_ID_DUPLICATED");
    ids.add(field.id);
    if (field.type === "select" && (!field.options || field.options.length === 0)) {
      throw new Error("SPACE_SELECT_OPTIONS_REQUIRED");
    }
  }
}

function validateRecordValues(fields: SpaceField[], values: Record<string, SpaceRecordValue>): void {
  const definitions = new Map(fields.map((field) => [field.id, field]));
  for (const key of Object.keys(values)) {
    if (!definitions.has(key)) throw new Error(`SPACE_RECORD_UNKNOWN_FIELD:${key}`);
  }
  for (const field of fields) {
    const value = values[field.id];
    if (field.required && (value === undefined || value === null || value === "")) {
      throw new Error(`SPACE_RECORD_REQUIRED_FIELD:${field.id}`);
    }
    if (value === undefined || value === null || value === "") continue;
    if ((field.type === "number" || field.type === "currency") && typeof value !== "number") {
      throw new Error(`SPACE_RECORD_INVALID_NUMBER:${field.id}`);
    }
    if (field.type === "boolean" && typeof value !== "boolean") {
      throw new Error(`SPACE_RECORD_INVALID_BOOLEAN:${field.id}`);
    }
    if (
      (field.type === "text" || field.type === "date" || field.type === "select") &&
      typeof value !== "string"
    ) {
      throw new Error(`SPACE_RECORD_INVALID_TEXT:${field.id}`);
    }
    if (field.type === "select" && !field.options?.includes(value as string)) {
      throw new Error(`SPACE_RECORD_INVALID_OPTION:${field.id}`);
    }
  }
}

export function listSpaceCollections(db: Database, spaceId: string): SpaceCollection[] {
  return (
    db
      .query("SELECT * FROM space_collections WHERE space_id = ? ORDER BY created_at ASC")
      .all(spaceId) as Record<string, unknown>[]
  ).map(mapCollection);
}

export function createSpaceCollection(
  db: Database,
  spaceId: string,
  input: { name: string; icon?: string; fields: SpaceField[] },
): SpaceCollection {
  validateFields(input.fields);
  const id = randomUUID();
  db.run("INSERT INTO space_collections (id, space_id, name, icon, fields_json) VALUES (?, ?, ?, ?, ?)", [
    id,
    spaceId,
    input.name.trim(),
    input.icon ?? "table",
    JSON.stringify(input.fields),
  ]);
  return getOwnedCollection(db, spaceId, id);
}

export function updateSpaceCollection(
  db: Database,
  spaceId: string,
  id: string,
  input: { name?: string; icon?: string; fields?: SpaceField[] },
): SpaceCollection {
  const current = getOwnedCollection(db, spaceId, id);
  const fields = input.fields ?? current.fields;
  validateFields(fields);
  db.run(
    `UPDATE space_collections
     SET name = ?, icon = ?, fields_json = ?, updated_at = datetime('now')
     WHERE id = ? AND space_id = ?`,
    [input.name?.trim() ?? current.name, input.icon ?? current.icon, JSON.stringify(fields), id, spaceId],
  );
  return getOwnedCollection(db, spaceId, id);
}

export function deleteSpaceCollection(db: Database, spaceId: string, id: string): void {
  db.run("DELETE FROM space_collections WHERE id = ? AND space_id = ?", [id, spaceId]);
}

export function listSpaceRecords(db: Database, spaceId: string, collectionId: string): SpaceRecord[] {
  getOwnedCollection(db, spaceId, collectionId);
  return (
    db
      .query("SELECT * FROM space_records WHERE space_id = ? AND collection_id = ? ORDER BY created_at DESC")
      .all(spaceId, collectionId) as Record<string, unknown>[]
  ).map(mapRecord);
}

export function createSpaceRecord(
  db: Database,
  spaceId: string,
  collectionId: string,
  values: Record<string, SpaceRecordValue>,
): SpaceRecord {
  const collection = getOwnedCollection(db, spaceId, collectionId);
  validateRecordValues(collection.fields, values);
  const id = randomUUID();
  db.run("INSERT INTO space_records (id, space_id, collection_id, values_json) VALUES (?, ?, ?, ?)", [
    id,
    spaceId,
    collectionId,
    JSON.stringify(values),
  ]);
  const row = db.query("SELECT * FROM space_records WHERE id = ? AND space_id = ?").get(id, spaceId);
  return mapRecord(row as Record<string, unknown>);
}

export function updateSpaceRecord(
  db: Database,
  spaceId: string,
  collectionId: string,
  id: string,
  values: Record<string, SpaceRecordValue>,
): SpaceRecord {
  const collection = getOwnedCollection(db, spaceId, collectionId);
  validateRecordValues(collection.fields, values);
  db.run(
    `UPDATE space_records SET values_json = ?, updated_at = datetime('now')
     WHERE id = ? AND space_id = ? AND collection_id = ?`,
    [JSON.stringify(values), id, spaceId, collectionId],
  );
  const row = db
    .query("SELECT * FROM space_records WHERE id = ? AND space_id = ? AND collection_id = ?")
    .get(id, spaceId, collectionId);
  if (!row) throw new Error("SPACE_RECORD_NOT_FOUND");
  return mapRecord(row as Record<string, unknown>);
}

export function deleteSpaceRecord(db: Database, spaceId: string, collectionId: string, id: string): void {
  db.run("DELETE FROM space_records WHERE id = ? AND space_id = ? AND collection_id = ?", [
    id,
    spaceId,
    collectionId,
  ]);
}

export function listSpaceViews(db: Database, spaceId: string, collectionId?: string): SpaceView[] {
  const rows = collectionId
    ? db
        .query("SELECT * FROM space_views WHERE space_id = ? AND collection_id = ? ORDER BY created_at ASC")
        .all(spaceId, collectionId)
    : db.query("SELECT * FROM space_views WHERE space_id = ? ORDER BY created_at ASC").all(spaceId);
  return (rows as Record<string, unknown>[]).map(mapView);
}

export function createSpaceView(
  db: Database,
  spaceId: string,
  input: { collectionId: string; name: string; type: SpaceViewType; config?: Record<string, unknown> },
): SpaceView {
  getOwnedCollection(db, spaceId, input.collectionId);
  const id = randomUUID();
  db.run(
    "INSERT INTO space_views (id, space_id, collection_id, name, type, config_json) VALUES (?, ?, ?, ?, ?, ?)",
    [id, spaceId, input.collectionId, input.name.trim(), input.type, JSON.stringify(input.config ?? {})],
  );
  const row = db.query("SELECT * FROM space_views WHERE id = ? AND space_id = ?").get(id, spaceId);
  return mapView(row as Record<string, unknown>);
}

export function updateSpaceView(
  db: Database,
  spaceId: string,
  id: string,
  input: { name?: string; type?: SpaceViewType; config?: Record<string, unknown> },
): SpaceView {
  const currentRow = db.query("SELECT * FROM space_views WHERE id = ? AND space_id = ?").get(id, spaceId);
  if (!currentRow) throw new Error("SPACE_VIEW_NOT_FOUND");
  const current = mapView(currentRow as Record<string, unknown>);
  db.run(
    `UPDATE space_views SET name = ?, type = ?, config_json = ?, updated_at = datetime('now')
     WHERE id = ? AND space_id = ?`,
    [
      input.name?.trim() ?? current.name,
      input.type ?? current.type,
      JSON.stringify(input.config ?? current.config),
      id,
      spaceId,
    ],
  );
  const row = db.query("SELECT * FROM space_views WHERE id = ? AND space_id = ?").get(id, spaceId);
  return mapView(row as Record<string, unknown>);
}

export function deleteSpaceView(db: Database, spaceId: string, id: string): void {
  db.run("DELETE FROM space_views WHERE id = ? AND space_id = ?", [id, spaceId]);
}
