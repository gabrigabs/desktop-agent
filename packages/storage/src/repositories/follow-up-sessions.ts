import { randomUUID } from "node:crypto";
import type {
  FollowUpContextPolicy,
  FollowUpEvent,
  FollowUpEventType,
  FollowUpHypothesis,
  FollowUpHypothesisStatus,
  FollowUpMemoryScope,
  FollowUpMode,
  FollowUpObservation,
  FollowUpObservationSource,
  FollowUpObservationStatus,
  FollowUpSession,
  FollowUpStatus,
} from "@desktop-agent/shared";
import type { Database } from "../db";

type SqlValue = string | number | null;

const DEFAULT_CONTEXT_POLICY: FollowUpContextPolicy = {
  screenCapture: false,
  clipboard: false,
  fileAccess: false,
};

function rowToObservation(row: Record<string, unknown>): FollowUpObservation {
  return {
    id: row.id as string,
    sessionId: row.session_id as string,
    content: row.content as string,
    source: row.source as FollowUpObservationSource,
    status: (row.status as FollowUpObservationStatus) ?? "pending",
    target: (row.target as string) ?? null,
    metadata: row.metadata_json ? (JSON.parse(row.metadata_json as string) as Record<string, unknown>) : {},
    timestamp: row.created_at as string,
  };
}

function rowToHypothesis(row: Record<string, unknown>): FollowUpHypothesis {
  return {
    id: row.id as string,
    sessionId: row.session_id as string,
    text: row.text as string,
    status: (row.status as FollowUpHypothesisStatus) ?? "open",
    evidenceIds: row.evidence ? (JSON.parse(row.evidence as string) as string[]) : [],
    timestamp: row.created_at as string,
  };
}

function rowToEvent(row: Record<string, unknown>): FollowUpEvent {
  return {
    id: row.id as string,
    sessionId: row.session_id as string,
    type: row.type as FollowUpEventType,
    payload: row.payload ? JSON.parse(row.payload as string) : null,
    timestamp: row.created_at as string,
  };
}

function rowToSession(
  row: Record<string, unknown>,
  observations: FollowUpObservation[],
  hypotheses: FollowUpHypothesis[],
  events: FollowUpEvent[],
): FollowUpSession {
  return {
    id: row.id as string,
    mode: row.mode as FollowUpMode,
    status: row.status as FollowUpStatus,
    objective: row.objective as string,
    spaceId: (row.space_id as string) ?? null,
    memoryScope: (row.memory_scope as FollowUpMemoryScope) ?? "session",
    contextPolicy: row.context_policy
      ? (JSON.parse(row.context_policy as string) as FollowUpContextPolicy)
      : DEFAULT_CONTEXT_POLICY,
    observations,
    hypotheses,
    events,
    nextActions: row.next_actions ? (JSON.parse(row.next_actions as string) as string[]) : [],
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    pausedAt: (row.paused_at as string) ?? null,
    completedAt: (row.completed_at as string) ?? null,
    closeReason: (row.close_reason as string) ?? null,
  };
}

export function createSession(
  db: Database,
  input: {
    mode: FollowUpMode;
    objective: string;
    spaceId?: string | null;
    memoryScope?: FollowUpMemoryScope;
    contextPolicy?: FollowUpContextPolicy;
  },
): FollowUpSession {
  const id = randomUUID();
  const policy = input.contextPolicy ?? DEFAULT_CONTEXT_POLICY;
  db.run(
    `INSERT INTO follow_up_sessions (id, mode, status, objective, space_id, memory_scope, context_policy, next_actions)
     VALUES (?, ?, 'active', ?, ?, ?, ?, '[]')`,
    [
      id,
      input.mode,
      input.objective,
      input.spaceId ?? null,
      input.memoryScope ?? "session",
      JSON.stringify(policy),
    ],
  );
  appendEvent(db, id, "started", { mode: input.mode, objective: input.objective });
  return getSession(db, id) as FollowUpSession;
}

export function getSession(db: Database, id: string): FollowUpSession | null {
  const row = db.query("SELECT * FROM follow_up_sessions WHERE id = ?").get(id) as Record<
    string,
    unknown
  > | null;
  if (!row) return null;
  const observations = (
    db
      .query("SELECT * FROM follow_up_observations WHERE session_id = ? ORDER BY created_at ASC")
      .all(id) as Record<string, unknown>[]
  ).map(rowToObservation);
  const hypotheses = (
    db
      .query("SELECT * FROM follow_up_hypotheses WHERE session_id = ? ORDER BY created_at ASC")
      .all(id) as Record<string, unknown>[]
  ).map(rowToHypothesis);
  const events = (
    db.query("SELECT * FROM follow_up_events WHERE session_id = ? ORDER BY created_at ASC").all(id) as Record<
      string,
      unknown
    >[]
  ).map(rowToEvent);
  return rowToSession(row, observations, hypotheses, events);
}

export function listSessions(db: Database): FollowUpSession[] {
  const rows = db.query("SELECT * FROM follow_up_sessions ORDER BY created_at DESC").all() as Record<
    string,
    unknown
  >[];
  return rows.map((row) => {
    const id = row.id as string;
    const observations = (
      db
        .query("SELECT * FROM follow_up_observations WHERE session_id = ? ORDER BY created_at ASC")
        .all(id) as Record<string, unknown>[]
    ).map(rowToObservation);
    const hypotheses = (
      db
        .query("SELECT * FROM follow_up_hypotheses WHERE session_id = ? ORDER BY created_at ASC")
        .all(id) as Record<string, unknown>[]
    ).map(rowToHypothesis);
    const events = (
      db
        .query("SELECT * FROM follow_up_events WHERE session_id = ? ORDER BY created_at ASC")
        .all(id) as Record<string, unknown>[]
    ).map(rowToEvent);
    return rowToSession(row, observations, hypotheses, events);
  });
}

export function listActiveSessions(db: Database): FollowUpSession[] {
  const rows = db
    .query(
      "SELECT * FROM follow_up_sessions WHERE status IN ('active', 'paused', 'waiting_approval') ORDER BY created_at DESC",
    )
    .all() as Record<string, unknown>[];
  return rows.map((row) => {
    const id = row.id as string;
    const observations = (
      db
        .query("SELECT * FROM follow_up_observations WHERE session_id = ? ORDER BY created_at ASC")
        .all(id) as Record<string, unknown>[]
    ).map(rowToObservation);
    const hypotheses = (
      db
        .query("SELECT * FROM follow_up_hypotheses WHERE session_id = ? ORDER BY created_at ASC")
        .all(id) as Record<string, unknown>[]
    ).map(rowToHypothesis);
    const events = (
      db
        .query("SELECT * FROM follow_up_events WHERE session_id = ? ORDER BY created_at ASC")
        .all(id) as Record<string, unknown>[]
    ).map(rowToEvent);
    return rowToSession(row, observations, hypotheses, events);
  });
}

function updateStatus(
  db: Database,
  id: string,
  status: FollowUpStatus,
  extra?: { pausedAt?: string | null; completedAt?: string | null; closeReason?: string | null },
): void {
  const sets: string[] = ["status = ?", "updated_at = datetime('now')"];
  const values: SqlValue[] = [status];
  if (extra?.pausedAt !== undefined) {
    sets.push("paused_at = ?");
    values.push(extra.pausedAt);
  }
  if (extra?.completedAt !== undefined) {
    sets.push("completed_at = ?");
    values.push(extra.completedAt);
  }
  if (extra?.closeReason !== undefined) {
    sets.push("close_reason = ?");
    values.push(extra.closeReason);
  }
  values.push(id);
  db.run(`UPDATE follow_up_sessions SET ${sets.join(", ")} WHERE id = ?`, values);
}

export function pauseSession(db: Database, id: string): void {
  updateStatus(db, id, "paused", { pausedAt: new Date().toISOString() });
  appendEvent(db, id, "paused", {});
}

export function resumeSession(db: Database, id: string): void {
  updateStatus(db, id, "active", { pausedAt: null });
  appendEvent(db, id, "resumed", {});
}

export function stopSession(db: Database, id: string, reason: string): void {
  updateStatus(db, id, "failed", { completedAt: new Date().toISOString(), closeReason: reason });
  appendEvent(db, id, "stopped", { reason });
}

export function completeSession(db: Database, id: string, summary: string): void {
  updateStatus(db, id, "completed", { completedAt: new Date().toISOString(), closeReason: summary });
  appendEvent(db, id, "completed", { summary });
}

export function addObservation(
  db: Database,
  sessionId: string,
  content: string,
  source: FollowUpObservationSource,
  options?: {
    status?: FollowUpObservationStatus;
    target?: string | null;
    metadata?: Record<string, unknown>;
  },
): FollowUpObservation {
  const id = randomUUID();
  db.run(
    "INSERT INTO follow_up_observations (id, session_id, content, source, status, target, metadata_json) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [
      id,
      sessionId,
      content,
      source,
      options?.status ?? "pending",
      options?.target ?? null,
      JSON.stringify(options?.metadata ?? {}),
    ],
  );
  appendEvent(db, sessionId, "observation", {
    observationId: id,
    content,
    source,
    status: options?.status ?? "pending",
    target: options?.target ?? null,
  });
  const row = db.query("SELECT * FROM follow_up_observations WHERE id = ?").get(id) as Record<
    string,
    unknown
  >;
  return rowToObservation(row);
}

export function updateObservation(
  db: Database,
  id: string,
  data: {
    status?: FollowUpObservationStatus;
    content?: string;
    target?: string | null;
    metadata?: Record<string, unknown>;
  },
): void {
  const row = db.query("SELECT session_id FROM follow_up_observations WHERE id = ?").get(id) as {
    session_id: string;
  } | null;
  if (!row) return;

  const sets: string[] = [];
  const values: SqlValue[] = [];
  if (data.status !== undefined) {
    sets.push("status = ?");
    values.push(data.status);
  }
  if (data.content !== undefined) {
    sets.push("content = ?");
    values.push(data.content);
  }
  if (data.target !== undefined) {
    sets.push("target = ?");
    values.push(data.target);
  }
  if (data.metadata !== undefined) {
    sets.push("metadata_json = ?");
    values.push(JSON.stringify(data.metadata));
  }
  if (sets.length === 0) return;
  values.push(id);
  db.run(`UPDATE follow_up_observations SET ${sets.join(", ")} WHERE id = ?`, values);
  appendEvent(db, row.session_id, "observation", { observationId: id, update: data });
}

export function addHypothesis(db: Database, sessionId: string, text: string): FollowUpHypothesis {
  const id = randomUUID();
  db.run(
    "INSERT INTO follow_up_hypotheses (id, session_id, text, status, evidence) VALUES (?, ?, ?, 'open', '[]')",
    [id, sessionId, text],
  );
  appendEvent(db, sessionId, "hypothesis", { text });
  const row = db.query("SELECT * FROM follow_up_hypotheses WHERE id = ?").get(id) as Record<string, unknown>;
  return rowToHypothesis(row);
}

export function updateHypothesis(
  db: Database,
  id: string,
  data: { status?: FollowUpHypothesisStatus; evidenceIds?: string[] },
): void {
  const sets: string[] = [];
  const values: SqlValue[] = [];
  if (data.status !== undefined) {
    sets.push("status = ?");
    values.push(data.status);
  }
  if (data.evidenceIds !== undefined) {
    sets.push("evidence = ?");
    values.push(JSON.stringify(data.evidenceIds));
  }
  if (sets.length === 0) return;
  values.push(id);
  db.run(`UPDATE follow_up_hypotheses SET ${sets.join(", ")} WHERE id = ?`, values);
}

export function appendEvent(
  db: Database,
  sessionId: string,
  type: FollowUpEventType,
  payload: unknown,
): void {
  const id = randomUUID();
  db.run("INSERT INTO follow_up_events (id, session_id, type, payload) VALUES (?, ?, ?, ?)", [
    id,
    sessionId,
    type,
    JSON.stringify(payload),
  ]);
}

export function restoreActiveSessions(db: Database): void {
  const sessions = db.query("SELECT id FROM follow_up_sessions WHERE status = 'active'").all() as Record<
    string,
    unknown
  >[];
  for (const session of sessions) {
    const id = session.id as string;
    updateStatus(db, id, "paused", { pausedAt: new Date().toISOString() });
    appendEvent(db, id, "paused", { reason: "restored_on_boot" });
  }
}
