import { randomUUID } from "node:crypto";
import type { FileContextInput } from "@desktop-agent/shared";
import type { Database } from "../db";

type ParsedDocumentStatus = "pending" | "parsing" | "done" | "error";

export interface StoredParsedDocument {
  id: string;
  path: string;
  displayName: string;
  size: number;
  mimeType: string;
  encoding: string;
  content?: string;
  preview: string;
  parsedFormat?: string;
  parsedMetadata: Record<string, unknown>;
  status: ParsedDocumentStatus;
  error?: string;
  createdAt: string;
  updatedAt: string;
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

function mapRow(row: unknown): StoredParsedDocument {
  const r = row as Record<string, unknown>;
  return {
    id: r.id as string,
    path: (r.path as string) ?? "",
    displayName: r.display_name as string,
    size: (r.size as number) ?? 0,
    mimeType: (r.mime_type as string) ?? "",
    encoding: (r.encoding as string) ?? "parsed",
    content: (r.content as string) ?? undefined,
    preview: (r.preview as string) ?? "",
    parsedFormat: (r.parsed_format as string) ?? undefined,
    parsedMetadata: parseJson<Record<string, unknown>>(r.parsed_metadata_json, {}),
    status: r.status as ParsedDocumentStatus,
    error: (r.error as string) ?? undefined,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

export function createParsedDocument(
  db: Database,
  params: Omit<StoredParsedDocument, "id" | "createdAt" | "updatedAt"> & { id?: string },
): string {
  const id = params.id ?? randomUUID();
  const now = new Date().toISOString();
  db.run(
    `INSERT INTO parsed_documents (
      id, path, display_name, size, mime_type, encoding, content, preview, parsed_format,
      parsed_metadata_json, status, error, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      params.path ?? "",
      params.displayName,
      params.size ?? 0,
      params.mimeType ?? "",
      params.encoding ?? "parsed",
      params.content ?? null,
      params.preview ?? "",
      params.parsedFormat ?? null,
      JSON.stringify(params.parsedMetadata ?? {}),
      params.status ?? "done",
      params.error ?? null,
      now,
      now,
    ],
  );
  return id;
}

export function upsertParsedDocument(
  db: Database,
  params: Omit<StoredParsedDocument, "id" | "createdAt" | "updatedAt"> & { id?: string },
): string {
  if (params.id && getParsedDocument(db, params.id)) {
    updateParsedDocument(db, params.id, params);
    return params.id;
  }
  const existing = params.path ? getParsedDocumentByPath(db, params.path) : null;
  if (existing) {
    updateParsedDocument(db, existing.id, params);
    return existing.id;
  }
  return createParsedDocument(db, params);
}

export function updateParsedDocument(
  db: Database,
  id: string,
  params: Partial<Omit<StoredParsedDocument, "id" | "createdAt" | "updatedAt">>,
): void {
  const assignments: string[] = [];
  const values: (string | number | null)[] = [];

  if (params.path !== undefined) {
    assignments.push("path = ?");
    values.push(params.path);
  }
  if (params.displayName !== undefined) {
    assignments.push("display_name = ?");
    values.push(params.displayName);
  }
  if (params.size !== undefined) {
    assignments.push("size = ?");
    values.push(params.size);
  }
  if (params.mimeType !== undefined) {
    assignments.push("mime_type = ?");
    values.push(params.mimeType);
  }
  if (params.encoding !== undefined) {
    assignments.push("encoding = ?");
    values.push(params.encoding);
  }
  if (params.content !== undefined) {
    assignments.push("content = ?");
    values.push(params.content ?? null);
  }
  if (params.preview !== undefined) {
    assignments.push("preview = ?");
    values.push(params.preview);
  }
  if (params.parsedFormat !== undefined) {
    assignments.push("parsed_format = ?");
    values.push(params.parsedFormat ?? null);
  }
  if (params.parsedMetadata !== undefined) {
    assignments.push("parsed_metadata_json = ?");
    values.push(JSON.stringify(params.parsedMetadata ?? {}));
  }
  if (params.status !== undefined) {
    assignments.push("status = ?");
    values.push(params.status);
  }
  if (params.error !== undefined) {
    assignments.push("error = ?");
    values.push(params.error ?? null);
  }

  if (assignments.length === 0) return;

  assignments.push("updated_at = datetime('now')");
  values.push(id);
  db.run(`UPDATE parsed_documents SET ${assignments.join(", ")} WHERE id = ?`, values);
}

export function getParsedDocument(db: Database, id: string): StoredParsedDocument | null {
  const row = db.query("SELECT * FROM parsed_documents WHERE id = ?").get(id);
  if (!row) return null;
  return mapRow(row);
}

export function getParsedDocumentByPath(db: Database, path: string): StoredParsedDocument | null {
  const row = db
    .query("SELECT * FROM parsed_documents WHERE path = ? ORDER BY updated_at DESC LIMIT 1")
    .get(path);
  if (!row) return null;
  return mapRow(row);
}

export function listParsedDocuments(db: Database, limit = 100): StoredParsedDocument[] {
  return db.query("SELECT * FROM parsed_documents ORDER BY updated_at DESC LIMIT ?").all(limit).map(mapRow);
}

export function deleteParsedDocument(db: Database, id: string): void {
  db.run("DELETE FROM parsed_documents WHERE id = ?", [id]);
}

export function deleteAllParsedDocuments(db: Database): void {
  db.run("DELETE FROM parsed_documents");
}

export function toFileContextInput(doc: StoredParsedDocument): FileContextInput {
  const format = doc.parsedFormat;
  const parsedFormat = ["pdf", "csv", "excel", "markdown", "docx", "pptx", "image"].includes(format ?? "")
    ? (format as FileContextInput["parsedFormat"])
    : undefined;
  return {
    path: doc.path,
    displayName: doc.displayName,
    size: doc.size,
    mimeType: doc.mimeType,
    encoding: doc.encoding as FileContextInput["encoding"],
    content: doc.content,
    preview: doc.preview,
    parsedFormat,
    parsedMetadata: doc.parsedMetadata,
  };
}
