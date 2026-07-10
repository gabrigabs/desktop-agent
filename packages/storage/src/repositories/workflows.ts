import { randomUUID } from "node:crypto";
import type {
  ApprovalRequest,
  ExecutionMode,
  PermissionLevel,
  RunStatus,
  WorkflowRun,
  WorkflowStep,
  WorkflowStepKind,
  WorkflowStepStatus,
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

function previewText(value: string, limit = 500): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= limit) return normalized;
  return `${normalized.slice(0, limit - 3)}...`;
}

export function createWorkflowRun(
  db: Database,
  params: {
    id?: string;
    mode: ExecutionMode;
    status?: RunStatus;
    prompt: string;
    sourceMode?: "free" | "clipboard";
    clipboardText?: string;
    providerId: string;
    model?: string;
    maxSteps?: number;
    workflowTemplateId?: string;
    metadata?: Record<string, unknown>;
  },
): string {
  const id = params.id ?? randomUUID();
  db.run(
    `INSERT INTO workflow_runs (id, mode, status, prompt, source_mode, clipboard_preview, provider_id, model, max_steps, template_id, metadata_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      params.mode,
      params.status ?? "queued",
      params.prompt,
      params.sourceMode ?? "free",
      previewText(params.clipboardText ?? ""),
      params.providerId,
      params.model ?? "",
      params.maxSteps ?? 8,
      params.workflowTemplateId ?? null,
      stringifyJson(params.metadata ?? {}),
    ],
  );
  return id;
}

export function updateWorkflowRun(
  db: Database,
  id: string,
  params: {
    status?: RunStatus;
    completedAt?: string | null;
    currentStep?: number;
    result?: string;
    errorMessage?: string | null;
    approval?: ApprovalRequest | null;
    workflowTemplateId?: string | null;
    metadata?: Record<string, unknown>;
  },
): void {
  const assignments = ["updated_at = datetime('now')"];
  const values: SqlValue[] = [];

  if (params.status !== undefined) {
    assignments.push("status = ?");
    values.push(params.status);
  }
  if (params.completedAt !== undefined) {
    assignments.push("completed_at = ?");
    values.push(params.completedAt);
  }
  if (params.currentStep !== undefined) {
    assignments.push("current_step = ?");
    values.push(params.currentStep);
  }
  if (params.result !== undefined) {
    assignments.push("result = ?");
    values.push(params.result);
  }
  if (params.errorMessage !== undefined) {
    assignments.push("error_message = ?");
    values.push(params.errorMessage);
  }
  if (params.approval !== undefined) {
    assignments.push("approval_json = ?");
    values.push(params.approval ? stringifyJson(params.approval) : null);
  }
  if (params.workflowTemplateId !== undefined) {
    assignments.push("template_id = ?");
    values.push(params.workflowTemplateId);
  }
  if (params.metadata !== undefined) {
    assignments.push("metadata_json = ?");
    values.push(stringifyJson(params.metadata));
  }

  values.push(id);
  db.run(`UPDATE workflow_runs SET ${assignments.join(", ")} WHERE id = ?`, values);
}

export function getWorkflowRun(db: Database, id: string, includeSteps = true): WorkflowRun | null {
  const row = db.query("SELECT * FROM workflow_runs WHERE id = ?").get(id);
  if (!row) return null;

  const run = mapWorkflowRun(row);
  if (includeSteps) {
    run.steps = listWorkflowSteps(db, id);
  }
  return run;
}

export function listWorkflowRuns(db: Database, limit = 20): WorkflowRun[] {
  return db
    .query("SELECT * FROM workflow_runs ORDER BY created_at DESC LIMIT ?")
    .all(limit)
    .map((row) => mapWorkflowRun(row));
}

export function createWorkflowStep(
  db: Database,
  params: {
    id?: string;
    runId: string;
    stepIndex: number;
    kind: WorkflowStepKind;
    status?: WorkflowStepStatus;
    title: string;
    detail?: string;
    toolName?: string;
    mcpServerId?: string;
    skillId?: string;
    permissionLevel?: PermissionLevel;
    config?: Record<string, unknown>;
    input?: unknown;
    output?: unknown;
    errorMessage?: string;
    requiresApproval?: boolean;
    startedAt?: string;
    completedAt?: string;
  },
): string {
  const id = params.id ?? randomUUID();
  db.run(
    `INSERT INTO workflow_steps (id, run_id, step_index, kind, status, title, detail, tool_name, mcp_server_id, skill_id, permission_level, config_json, input_json, output_json, error_message, requires_approval, started_at, completed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      params.runId,
      params.stepIndex,
      params.kind,
      params.status ?? "pending",
      params.title,
      params.detail ?? "",
      params.toolName ?? null,
      params.mcpServerId ?? null,
      params.skillId ?? null,
      params.permissionLevel ?? null,
      stringifyJson(params.config),
      stringifyJson(params.input ?? {}),
      stringifyJson(params.output ?? {}),
      params.errorMessage ?? null,
      params.requiresApproval ? 1 : 0,
      params.startedAt ?? null,
      params.completedAt ?? null,
    ],
  );
  return id;
}

export function updateWorkflowStep(
  db: Database,
  id: string,
  params: {
    status?: WorkflowStepStatus;
    detail?: string;
    input?: unknown;
    output?: unknown;
    errorMessage?: string | null;
    requiresApproval?: boolean;
    startedAt?: string | null;
    completedAt?: string | null;
  },
): void {
  const assignments: string[] = [];
  const values: SqlValue[] = [];

  if (params.status !== undefined) {
    assignments.push("status = ?");
    values.push(params.status);
  }
  if (params.detail !== undefined) {
    assignments.push("detail = ?");
    values.push(params.detail);
  }
  if (params.input !== undefined) {
    assignments.push("input_json = ?");
    values.push(stringifyJson(params.input));
  }
  if (params.output !== undefined) {
    assignments.push("output_json = ?");
    values.push(stringifyJson(params.output));
  }
  if (params.errorMessage !== undefined) {
    assignments.push("error_message = ?");
    values.push(params.errorMessage);
  }
  if (params.requiresApproval !== undefined) {
    assignments.push("requires_approval = ?");
    values.push(params.requiresApproval ? 1 : 0);
  }
  if (params.startedAt !== undefined) {
    assignments.push("started_at = ?");
    values.push(params.startedAt);
  }
  if (params.completedAt !== undefined) {
    assignments.push("completed_at = ?");
    values.push(params.completedAt);
  }

  if (assignments.length === 0) return;

  values.push(id);
  db.run(`UPDATE workflow_steps SET ${assignments.join(", ")} WHERE id = ?`, values);
}

export function listWorkflowSteps(db: Database, runId: string): WorkflowStep[] {
  return db
    .query("SELECT * FROM workflow_steps WHERE run_id = ? ORDER BY step_index ASC")
    .all(runId)
    .map(mapWorkflowStep);
}

function mapWorkflowRun(row: unknown): WorkflowRun {
  const r = row as Record<string, unknown>;
  return {
    id: r.id as string,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
    completedAt: (r.completed_at as string) ?? undefined,
    workflowTemplateId: (r.template_id as string) ?? undefined,
    mode: r.mode as ExecutionMode,
    status: r.status as RunStatus,
    prompt: r.prompt as string,
    sourceMode: r.source_mode as "free" | "clipboard",
    clipboardPreview: r.clipboard_preview as string,
    providerId: r.provider_id as string,
    model: r.model as string,
    maxSteps: r.max_steps as number,
    currentStep: r.current_step as number,
    result: r.result as string,
    errorMessage: (r.error_message as string) ?? undefined,
    approval: parseJson<ApprovalRequest | undefined>(r.approval_json, undefined),
    metadata: parseJson<Record<string, unknown>>(r.metadata_json, {}),
  };
}

function mapWorkflowStep(row: unknown): WorkflowStep {
  const r = row as Record<string, unknown>;
  return {
    id: r.id as string,
    runId: r.run_id as string,
    stepIndex: r.step_index as number,
    kind: r.kind as WorkflowStepKind,
    status: r.status as WorkflowStepStatus,
    title: r.title as string,
    detail: r.detail as string,
    toolName: (r.tool_name as string) ?? undefined,
    mcpServerId: (r.mcp_server_id as string) ?? undefined,
    skillId: (r.skill_id as string) ?? undefined,
    permissionLevel: (r.permission_level as PermissionLevel) ?? undefined,
    config: parseJson<Record<string, unknown>>(r.config_json, {}),
    input: parseJson(r.input_json, {}),
    output: parseJson(r.output_json, {}),
    errorMessage: (r.error_message as string) ?? undefined,
    requiresApproval: Boolean(r.requires_approval),
    startedAt: (r.started_at as string) ?? undefined,
    completedAt: (r.completed_at as string) ?? undefined,
    createdAt: r.created_at as string,
  };
}
