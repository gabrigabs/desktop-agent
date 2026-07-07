import { randomUUID } from "node:crypto";
import type { Database } from "../db";

type SqlValue = string | number | null;

export type PromptTemplate = {
  id: string;
  title: string;
  prompt: string;
  category: string;
  icon: string;
  executionMode: "simple" | "workflow";
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type AgentProfile = {
  id: string;
  name: string;
  systemPrompt: string;
  description: string;
  icon: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string" || value.length === 0) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function mapPromptTemplate(row: unknown): PromptTemplate {
  const r = row as Record<string, unknown>;
  return {
    id: r.id as string,
    title: r.title as string,
    prompt: r.prompt as string,
    category: r.category as string,
    icon: r.icon as string,
    executionMode: r.execution_mode as "simple" | "workflow",
    sortOrder: r.sort_order as number,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

function mapAgentProfile(row: unknown): AgentProfile {
  const r = row as Record<string, unknown>;
  return {
    id: r.id as string,
    name: r.name as string,
    systemPrompt: r.system_prompt as string,
    description: r.description as string,
    icon: r.icon as string,
    sortOrder: r.sort_order as number,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

export function listPromptTemplates(db: Database): PromptTemplate[] {
  return db
    .query("SELECT * FROM prompt_library ORDER BY sort_order ASC, title ASC")
    .all()
    .map(mapPromptTemplate);
}

export function createPromptTemplate(
  db: Database,
  params: {
    title: string;
    prompt: string;
    category?: string;
    icon?: string;
    executionMode?: "simple" | "workflow";
  },
): string {
  const id = randomUUID();
  const sortOrder = Date.now();
  db.run(
    `INSERT INTO prompt_library (id, title, prompt, category, icon, execution_mode, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      params.title,
      params.prompt,
      params.category ?? "general",
      params.icon ?? "Sparkles",
      params.executionMode ?? "simple",
      sortOrder,
    ],
  );
  return id;
}

export function updatePromptTemplate(
  db: Database,
  id: string,
  params: {
    title?: string;
    prompt?: string;
    category?: string;
    icon?: string;
    executionMode?: "simple" | "workflow";
  },
): void {
  const assignments: string[] = ["updated_at = datetime('now')"];
  const values: SqlValue[] = [];

  if (params.title !== undefined) {
    assignments.push("title = ?");
    values.push(params.title);
  }
  if (params.prompt !== undefined) {
    assignments.push("prompt = ?");
    values.push(params.prompt);
  }
  if (params.category !== undefined) {
    assignments.push("category = ?");
    values.push(params.category);
  }
  if (params.icon !== undefined) {
    assignments.push("icon = ?");
    values.push(params.icon);
  }
  if (params.executionMode !== undefined) {
    assignments.push("execution_mode = ?");
    values.push(params.executionMode);
  }

  if (assignments.length === 1) return;
  values.push(id);
  db.run(`UPDATE prompt_library SET ${assignments.join(", ")} WHERE id = ?`, values);
}

export function deletePromptTemplate(db: Database, id: string): void {
  db.run("DELETE FROM prompt_library WHERE id = ?", [id]);
}

export function listAgentProfiles(db: Database): AgentProfile[] {
  return db
    .query("SELECT * FROM agent_profiles ORDER BY sort_order ASC, name ASC")
    .all()
    .map(mapAgentProfile);
}

export function createAgentProfile(
  db: Database,
  params: {
    name: string;
    systemPrompt?: string;
    description?: string;
    icon?: string;
  },
): string {
  const id = randomUUID();
  const sortOrder = Date.now();
  db.run(
    `INSERT INTO agent_profiles (id, name, system_prompt, description, icon, sort_order)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      id,
      params.name,
      params.systemPrompt ?? "",
      params.description ?? "",
      params.icon ?? "Bot",
      sortOrder,
    ],
  );
  return id;
}

export function updateAgentProfile(
  db: Database,
  id: string,
  params: {
    name?: string;
    systemPrompt?: string;
    description?: string;
    icon?: string;
  },
): void {
  const assignments: string[] = ["updated_at = datetime('now')"];
  const values: SqlValue[] = [];

  if (params.name !== undefined) {
    assignments.push("name = ?");
    values.push(params.name);
  }
  if (params.systemPrompt !== undefined) {
    assignments.push("system_prompt = ?");
    values.push(params.systemPrompt);
  }
  if (params.description !== undefined) {
    assignments.push("description = ?");
    values.push(params.description);
  }
  if (params.icon !== undefined) {
    assignments.push("icon = ?");
    values.push(params.icon);
  }

  if (assignments.length === 1) return;
  values.push(id);
  db.run(`UPDATE agent_profiles SET ${assignments.join(", ")} WHERE id = ?`, values);
}

export function deleteAgentProfile(db: Database, id: string): void {
  db.run("DELETE FROM agent_profiles WHERE id = ?", [id]);
}

export function getAgentProfile(db: Database, id: string): AgentProfile | null {
  const row = db.query("SELECT * FROM agent_profiles WHERE id = ?").get(id);
  return row ? mapAgentProfile(row) : null;
}
