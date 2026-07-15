import { randomUUID } from "node:crypto";
import type {
  ExecutionMode,
  WorkflowStepTemplate,
  WorkflowTemplate,
  WorkflowTemplateSettings,
} from "@desktop-agent/shared";
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

export function createWorkflowTemplate(
  db: Database,
  params: {
    id?: string;
    name: string;
    description?: string;
    prompt: string;
    settings?: WorkflowTemplateSettings;
    mode?: ExecutionMode;
    maxSteps?: number;
    enabled?: boolean;
  },
): string {
  const id = params.id ?? randomUUID();
  const settings = params.settings ?? {};
  db.run(
    `INSERT INTO workflow_templates (id, name, description, prompt, settings_json, mode, max_steps, enabled)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      params.name,
      params.description ?? "",
      params.prompt,
      stringifyJson(settings),
      params.mode ?? settings.mode ?? "workflow",
      params.maxSteps ?? settings.maxSteps ?? 8,
      params.enabled === false ? 0 : 1,
    ],
  );
  return id;
}

export function updateWorkflowTemplate(
  db: Database,
  id: string,
  params: {
    name?: string;
    description?: string;
    prompt?: string;
    settings?: WorkflowTemplateSettings;
    mode?: ExecutionMode;
    maxSteps?: number;
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
  if (params.settings !== undefined) {
    assignments.push("settings_json = ?");
    values.push(stringifyJson(params.settings));
  }
  if (params.mode !== undefined) {
    assignments.push("mode = ?");
    values.push(params.mode);
  }
  if (params.maxSteps !== undefined) {
    assignments.push("max_steps = ?");
    values.push(params.maxSteps);
  }
  if (params.enabled !== undefined) {
    assignments.push("enabled = ?");
    values.push(params.enabled ? 1 : 0);
  }

  if (assignments.length === 0) return;

  assignments.push("updated_at = datetime('now')");
  values.push(id);
  db.run(`UPDATE workflow_templates SET ${assignments.join(", ")} WHERE id = ?`, values);
}

export function getWorkflowTemplate(db: Database, id: string): WorkflowTemplate | null {
  const row = db.query("SELECT * FROM workflow_templates WHERE id = ?").get(id);
  if (!row) return null;

  const template = mapWorkflowTemplate(row);
  template.steps = listWorkflowTemplateSteps(db, id);
  return template;
}

export function listWorkflowTemplates(db: Database): WorkflowTemplate[] {
  return db
    .query("SELECT * FROM workflow_templates ORDER BY name ASC")
    .all()
    .map((row) => {
      const template = mapWorkflowTemplate(row);
      template.steps = listWorkflowTemplateSteps(db, template.id);
      return template;
    });
}

export function deleteWorkflowTemplate(db: Database, id: string): void {
  db.run("DELETE FROM workflow_templates WHERE id = ?", [id]);
}

export function saveWorkflowTemplate(
  db: Database,
  params: {
    id?: string;
    name: string;
    description?: string;
    prompt: string;
    settings?: WorkflowTemplateSettings;
    steps?: Array<Omit<WorkflowStepTemplate, "id" | "templateId" | "stepIndex" | "createdAt" | "updatedAt">>;
    enabled?: boolean;
  },
): WorkflowTemplate {
  const id = params.id ?? randomUUID();
  const existing = db.query("SELECT id FROM workflow_templates WHERE id = ?").get(id);

  const settings = params.settings ?? {};
  const mode = settings.mode ?? "workflow";
  const maxSteps = settings.maxSteps ?? 8;

  const templateParams = {
    id,
    name: params.name,
    description: params.description,
    prompt: params.prompt,
    settings,
    mode,
    maxSteps,
    enabled: params.enabled,
  };

  if (existing) {
    updateWorkflowTemplate(db, id, templateParams);
    deleteWorkflowTemplateSteps(db, id);
  } else {
    createWorkflowTemplate(db, templateParams);
  }

  const steps = params.steps ?? [];
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    if (!step) continue;
    createWorkflowTemplateStep(db, {
      templateId: id,
      stepIndex: i + 1,
      name: step.name,
      kind: step.kind,
      config: step.config,
    });
  }

  return getWorkflowTemplate(db, id) as WorkflowTemplate;
}

export function createWorkflowTemplateStep(
  db: Database,
  params: {
    id?: string;
    templateId: string;
    stepIndex: number;
    name: string;
    kind: WorkflowStepTemplate["kind"];
    config?: Record<string, unknown>;
  },
): string {
  const id = params.id ?? randomUUID();
  db.run(
    `INSERT INTO workflow_template_steps (id, template_id, step_index, name, kind, config_json)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, params.templateId, params.stepIndex, params.name, params.kind, stringifyJson(params.config)],
  );
  return id;
}

export function listWorkflowTemplateSteps(db: Database, templateId: string): WorkflowStepTemplate[] {
  return db
    .query("SELECT * FROM workflow_template_steps WHERE template_id = ? ORDER BY step_index ASC")
    .all(templateId)
    .map(mapWorkflowTemplateStep);
}

export function updateWorkflowTemplateStep(
  db: Database,
  id: string,
  params: {
    name?: string;
    kind?: WorkflowStepTemplate["kind"];
    config?: Record<string, unknown>;
  },
): void {
  const assignments: string[] = [];
  const values: SqlValue[] = [];

  if (params.name !== undefined) {
    assignments.push("name = ?");
    values.push(params.name);
  }
  if (params.kind !== undefined) {
    assignments.push("kind = ?");
    values.push(params.kind);
  }
  if (params.config !== undefined) {
    assignments.push("config_json = ?");
    values.push(stringifyJson(params.config));
  }

  if (assignments.length === 0) return;

  assignments.push("updated_at = datetime('now')");
  values.push(id);
  db.run(`UPDATE workflow_template_steps SET ${assignments.join(", ")} WHERE id = ?`, values);
}

export function deleteWorkflowTemplateSteps(db: Database, templateId: string): void {
  db.run("DELETE FROM workflow_template_steps WHERE template_id = ?", [templateId]);
}

export function deleteWorkflowTemplateStep(db: Database, id: string): void {
  db.run("DELETE FROM workflow_template_steps WHERE id = ?", [id]);
}

function mapWorkflowTemplate(row: unknown): WorkflowTemplate {
  const r = row as Record<string, unknown>;
  const settings = parseJson<WorkflowTemplateSettings>(r.settings_json, {});
  return {
    id: r.id as string,
    name: r.name as string,
    description: r.description as string,
    prompt: r.prompt as string,
    settings,
    steps: [],
    mode: r.mode as ExecutionMode,
    maxSteps: r.max_steps as number,
    enabled: Boolean(r.enabled),
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

function mapWorkflowTemplateStep(row: unknown): WorkflowStepTemplate {
  const r = row as Record<string, unknown>;
  return {
    id: r.id as string,
    templateId: r.template_id as string,
    stepIndex: r.step_index as number,
    name: r.name as string,
    kind: r.kind as WorkflowStepTemplate["kind"],
    config: parseJson<Record<string, unknown>>(r.config_json, {}),
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}
