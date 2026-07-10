import { randomUUID } from "node:crypto";
import type { Skill } from "@desktop-agent/shared";
import type { Database } from "../db";

type SqlValue = string | number | null;

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

export function createSkill(
  db: Database,
  params: {
    id?: string;
    name: string;
    description?: string;
    prompt: string;
    systemPrompt?: string;
    provider?: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
    toolAllowlist?: string[];
    mcpAllowlist?: string[];
    maxSteps?: number;
    metadata?: Record<string, string>;
    compatibility?: string;
    enabled?: boolean;
  },
): string {
  const id = params.id ?? randomUUID();
  db.run(
    `INSERT INTO skills (id, name, description, prompt, system_prompt, provider, model, temperature, max_tokens, tool_allowlist_json, mcp_allowlist_json, max_steps, metadata_json, compatibility, enabled)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      params.name,
      params.description ?? "",
      params.prompt,
      params.systemPrompt ?? "",
      params.provider ?? null,
      params.model ?? null,
      params.temperature ?? null,
      params.maxTokens ?? null,
      stringifyJson(params.toolAllowlist),
      stringifyJson(params.mcpAllowlist),
      params.maxSteps ?? 1,
      stringifyJson(params.metadata),
      params.compatibility ?? "",
      params.enabled === false ? 0 : 1,
    ],
  );
  return id;
}

export function updateSkill(
  db: Database,
  id: string,
  params: {
    name?: string;
    description?: string;
    prompt?: string;
    systemPrompt?: string;
    provider?: string | null;
    model?: string | null;
    temperature?: number | null;
    maxTokens?: number | null;
    toolAllowlist?: string[];
    mcpAllowlist?: string[];
    maxSteps?: number;
    metadata?: Record<string, string>;
    compatibility?: string;
    enabled?: boolean;
  },
): void {
  const assignments: string[] = [];
  const values: SqlValue[] = [];

  if (params.name !== undefined) {
    assignments.push("name = ?");
    values.push(params.name);
  }
  if (params.description !== undefined) {
    assignments.push("description = ?");
    values.push(params.description);
  }
  if (params.prompt !== undefined) {
    assignments.push("prompt = ?");
    values.push(params.prompt);
  }
  if (params.systemPrompt !== undefined) {
    assignments.push("system_prompt = ?");
    values.push(params.systemPrompt);
  }
  if (params.provider !== undefined) {
    assignments.push("provider = ?");
    values.push(params.provider);
  }
  if (params.model !== undefined) {
    assignments.push("model = ?");
    values.push(params.model);
  }
  if (params.temperature !== undefined) {
    assignments.push("temperature = ?");
    values.push(params.temperature ?? null);
  }
  if (params.maxTokens !== undefined) {
    assignments.push("max_tokens = ?");
    values.push(params.maxTokens ?? null);
  }
  if (params.toolAllowlist !== undefined) {
    assignments.push("tool_allowlist_json = ?");
    values.push(stringifyJson(params.toolAllowlist));
  }
  if (params.mcpAllowlist !== undefined) {
    assignments.push("mcp_allowlist_json = ?");
    values.push(stringifyJson(params.mcpAllowlist));
  }
  if (params.maxSteps !== undefined) {
    assignments.push("max_steps = ?");
    values.push(params.maxSteps);
  }
  if (params.metadata !== undefined) {
    assignments.push("metadata_json = ?");
    values.push(stringifyJson(params.metadata));
  }
  if (params.compatibility !== undefined) {
    assignments.push("compatibility = ?");
    values.push(params.compatibility);
  }
  if (params.enabled !== undefined) {
    assignments.push("enabled = ?");
    values.push(params.enabled ? 1 : 0);
  }

  if (assignments.length === 0) return;

  assignments.push("updated_at = datetime('now')");
  values.push(id);
  db.run(`UPDATE skills SET ${assignments.join(", ")} WHERE id = ?`, values);
}

export function getSkill(db: Database, id: string): Skill | null {
  const row = db.query("SELECT * FROM skills WHERE id = ?").get(id);
  if (!row) return null;
  return mapSkill(row);
}

export function listSkills(db: Database, includeDisabled = false): Skill[] {
  const sql = includeDisabled
    ? "SELECT * FROM skills ORDER BY name ASC"
    : "SELECT * FROM skills WHERE enabled = 1 ORDER BY name ASC";
  return db.query(sql).all().map(mapSkill);
}

export function deleteSkill(db: Database, id: string): void {
  db.run("DELETE FROM skills WHERE id = ?", [id]);
}

function mapSkill(row: unknown): Skill {
  const r = row as Record<string, unknown>;
  return {
    id: r.id as string,
    name: r.name as string,
    description: r.description as string,
    prompt: r.prompt as string,
    systemPrompt: r.system_prompt as string,
    provider: (r.provider as string) ?? undefined,
    model: (r.model as string) ?? undefined,
    temperature: r.temperature as number | undefined,
    maxTokens: r.max_tokens as number | undefined,
    toolAllowlist: parseJson<string[]>(r.tool_allowlist_json, []),
    mcpAllowlist: parseJson<string[]>(r.mcp_allowlist_json, []),
    maxSteps: r.max_steps as number,
    metadata: parseJson<Record<string, string>>(r.metadata_json, {}),
    compatibility: (r.compatibility as string) || undefined,
    enabled: Boolean(r.enabled),
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}
