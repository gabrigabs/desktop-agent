import { randomUUID } from "node:crypto";
import type { AuditEntry, PermissionLevel } from "@desktop-agent/shared";
import type { Database } from "../db";

export function createInteraction(
  db: Database,
  params: {
    toolName: string;
    providerId: string;
    permissionLevel: PermissionLevel;
    inputPreview: string;
    outputPreview: string;
    durationMs: number;
    success: boolean;
    errorMessage?: string;
  },
): string {
  const id = randomUUID();
  db.run(
    `INSERT INTO interactions (id, tool_name, provider_id, permission_level, input_preview, output_preview, duration_ms, success, error_message)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      params.toolName,
      params.providerId,
      params.permissionLevel,
      params.inputPreview,
      params.outputPreview,
      params.durationMs,
      params.success ? 1 : 0,
      params.errorMessage ?? null,
    ],
  );
  return id;
}

export function getRecentInteractions(db: Database, limit = 20): AuditEntry[] {
  return db
    .query(
      `SELECT id, timestamp, tool_name, provider_id, permission_level, input_preview, output_preview, duration_ms, success, error_message
       FROM interactions
       ORDER BY timestamp DESC
       LIMIT ?`,
    )
    .all(limit)
    .map(mapRow);
}

export function searchInteractions(db: Database, query: string, limit = 20): AuditEntry[] {
  return db
    .query(
      `SELECT i.id, i.timestamp, i.tool_name, i.provider_id, i.permission_level, i.input_preview, i.output_preview, i.duration_ms, i.success, i.error_message
       FROM interactions i
       JOIN interactions_fts fts ON i.rowid = fts.rowid
       WHERE interactions_fts MATCH ?
       ORDER BY rank
       LIMIT ?`,
    )
    .all(query, limit)
    .map(mapRow);
}

function mapRow(row: unknown): AuditEntry {
  const r = row as Record<string, unknown>;
  return {
    id: r.id as string,
    timestamp: r.timestamp as string,
    toolName: r.tool_name as string,
    providerId: r.provider_id as string,
    permissionLevel: r.permission_level as PermissionLevel,
    inputPreview: r.input_preview as string,
    outputPreview: r.output_preview as string,
    durationMs: r.duration_ms as number,
    success: Boolean(r.success),
    errorMessage: (r.error_message as string) ?? undefined,
  };
}
