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

export function createConversation(db: Database, params: { id?: string; title?: string }): string {
  const id = params.id ?? randomUUID();
  const title = params.title ?? "Nova conversa";
  db.run(`INSERT INTO conversations (id, title) VALUES (?, ?)`, [id, title]);
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
  },
): string {
  const id = params.id ?? randomUUID();
  db.run(
    `INSERT INTO turns (id, conversation_id, role, blocks_json, status, timestamp, source_mode, execution_mode)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      params.conversationId,
      params.role,
      stringifyJson(params.blocks),
      params.status,
      params.timestamp,
      params.sourceMode,
      params.executionMode,
    ],
  );
  return id;
}

export function listConversations(db: Database, limit = 20): Conversation[] {
  const rows = db
    .query("SELECT id, title, created_at, updated_at FROM conversations ORDER BY updated_at DESC LIMIT ?")
    .all(limit) as Array<{
    id: string;
    title: string;
    created_at: string;
    updated_at: string;
  }>;

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export function listTurns(db: Database, conversationId: string): Turn[] {
  const rows = db
    .query(
      "SELECT id, conversation_id, role, blocks_json, status, timestamp, source_mode, execution_mode FROM turns WHERE conversation_id = ? ORDER BY timestamp ASC",
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
  }>;

  return rows.map((row) => ({
    id: row.id,
    role: row.role as Turn["role"],
    blocks: parseJson<MessageBlock[]>(row.blocks_json, []),
    status: row.status as Turn["status"],
    timestamp: new Date(row.timestamp).getTime(),
    sourceMode: row.source_mode as Turn["sourceMode"],
    executionMode: row.execution_mode as Turn["executionMode"],
  }));
}

export function updateConversationTitle(db: Database, id: string, title: string): void {
  db.run(`UPDATE conversations SET title = ?, updated_at = datetime('now') WHERE id = ?`, [title, id]);
}
