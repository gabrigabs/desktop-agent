import { randomUUID } from "node:crypto";
import type { Conversation, ExecutionMode, MessageBlock, Turn } from "@desktop-agent/shared";
import type { Database } from "../db";

function stringifyJson(value: unknown): string {
  return JSON.stringify(value ?? {});
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string" || value.length === 0) {
    return fallback;
  }
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function createConversation(
  db: Database,
  params: { id?: string; title?: string; profileId?: string },
): string {
  const id = params.id ?? randomUUID();
  const title = params.title ?? "Nova conversa";
  db.run(`INSERT INTO conversations (id, title, profile_id) VALUES (?, ?, ?)`, [
    id,
    title,
    params.profileId ?? null,
  ]);
  return id;
}

export function createTurn(
  db: Database,
  params: {
    id?: string;
    conversationId: string;
    role: "user" | "assistant" | "system";
    blocks: MessageBlock[];
    status: "streaming" | "complete" | "error" | "cancelled";
    timestamp: string;
    sourceMode: "free" | "clipboard";
    executionMode: ExecutionMode;
    profileId?: string;
  },
): string {
  const id = params.id ?? randomUUID();
  db.run(
    `INSERT INTO turns (id, conversation_id, role, blocks_json, status, timestamp, source_mode, execution_mode, profile_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      params.conversationId,
      params.role,
      stringifyJson(params.blocks),
      params.status,
      params.timestamp,
      params.sourceMode,
      params.executionMode,
      params.profileId ?? null,
    ],
  );
  return id;
}

export function upsertTurn(
  db: Database,
  params: {
    id: string;
    conversationId: string;
    role: "user" | "assistant" | "system";
    blocks: MessageBlock[];
    status: "streaming" | "complete" | "error" | "cancelled";
    timestamp: string;
    sourceMode: "free" | "clipboard";
    executionMode: ExecutionMode;
    profileId?: string;
  },
): void {
  db.run(
    `INSERT INTO turns (id, conversation_id, role, blocks_json, status, timestamp, source_mode, execution_mode, profile_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       conversation_id = excluded.conversation_id,
       role = excluded.role,
       blocks_json = excluded.blocks_json,
       status = excluded.status,
       timestamp = excluded.timestamp,
       source_mode = excluded.source_mode,
       execution_mode = excluded.execution_mode,
       profile_id = excluded.profile_id`,
    [
      params.id,
      params.conversationId,
      params.role,
      stringifyJson(params.blocks),
      params.status,
      params.timestamp,
      params.sourceMode,
      params.executionMode,
      params.profileId ?? null,
    ],
  );

  db.run(`UPDATE conversations SET updated_at = datetime('now') WHERE id = ?`, [params.conversationId]);
}

export function listConversations(db: Database, limit = 20): Conversation[] {
  const rows = db
    .query(
      "SELECT id, title, profile_id, created_at, updated_at FROM conversations ORDER BY updated_at DESC LIMIT ?",
    )
    .all(limit) as Array<{
    id: string;
    title: string;
    profile_id: string | null;
    created_at: string;
    updated_at: string;
  }>;

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    profileId: row.profile_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export function getConversation(db: Database, id: string): Conversation | null {
  const row = db
    .query("SELECT id, title, profile_id, created_at, updated_at FROM conversations WHERE id = ?")
    .get(id) as {
    id: string;
    title: string;
    profile_id: string | null;
    created_at: string;
    updated_at: string;
  } | null;

  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    profileId: row.profile_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listTurns(db: Database, conversationId: string): Turn[] {
  const rows = db
    .query(
      "SELECT id, conversation_id, role, blocks_json, status, timestamp, source_mode, execution_mode, profile_id FROM turns WHERE conversation_id = ? ORDER BY timestamp ASC",
    )
    .all(conversationId) as Array<{
    id: string;
    conversation_id: string;
    role: string;
    blocks_json: string;
    status: string;
    timestamp: string;
    source_mode: string;
    execution_mode: string;
    profile_id: string | null;
  }>;

  return rows.map((row) => ({
    id: row.id,
    role: row.role as Turn["role"],
    blocks: parseJson<MessageBlock[]>(row.blocks_json, []),
    status: row.status as Turn["status"],
    timestamp: new Date(row.timestamp).getTime(),
    sourceMode: row.source_mode as Turn["sourceMode"],
    executionMode: row.execution_mode as Turn["executionMode"],
    profileId: row.profile_id ?? undefined,
  }));
}

export function updateConversationTitle(db: Database, id: string, title: string): void {
  db.run(`UPDATE conversations SET title = ?, updated_at = datetime('now') WHERE id = ?`, [title, id]);
}
