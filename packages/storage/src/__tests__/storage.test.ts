import type { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { closeDb, getDb } from "../db";
import { runMigrations } from "../migrations";
import { createConversation, getConversation, listTurns, upsertTurn } from "../repositories/conversations";
import { createInteraction, getRecentInteractions, searchInteractions } from "../repositories/interactions";
import {
  ensureDefaultMcpPresets,
  listMcpServers,
  updateMcpServerStatus,
  upsertMcpServer,
} from "../repositories/mcp-servers";
import {
  createParsedDocument,
  deleteAllParsedDocuments,
  deleteParsedDocument,
  getParsedDocument,
  listParsedDocuments,
  upsertParsedDocument,
} from "../repositories/parsed-documents";
import {
  createWorkflowRun,
  createWorkflowStep,
  getWorkflowRun,
  listWorkflowRuns,
  updateWorkflowRun,
  updateWorkflowStep,
} from "../repositories/workflows";

describe("Storage Package Tests", () => {
  let db: Database;

  beforeEach(() => {
    // Use in-memory database for isolated unit tests
    db = getDb(":memory:");
    runMigrations(db);
  });

  afterEach(() => {
    closeDb();
  });

  test("Migrations should create correct tables", () => {
    const tables = db.query("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[];
    const tableNames = tables.map((t) => t.name);

    expect(tableNames).toContain("interactions");
    expect(tableNames).toContain("tool_runs");
    expect(tableNames).toContain("permissions");
    expect(tableNames).toContain("provider_configs");
    expect(tableNames).toContain("_migrations");
    expect(tableNames).toContain("conversations");
    expect(tableNames).toContain("turns");
    expect(tableNames).toContain("workflow_runs");
    expect(tableNames).toContain("workflow_steps");
    expect(tableNames).toContain("workflow_templates");
    expect(tableNames).toContain("mcp_servers");
    expect(tableNames).toContain("prompt_library");
    expect(tableNames).toContain("agent_profiles");
    expect(tableNames).toContain("parsed_documents");

    const migrations = db.query("SELECT version FROM _migrations ORDER BY version").all() as {
      version: number;
    }[];
    expect(migrations.map((migration) => migration.version)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13,
    ]);

    const settings = db.query("SELECT key, value FROM app_settings ORDER BY key").all() as {
      key: string;
      value: string;
    }[];
    expect(settings).toContainEqual({ key: "alwaysOnTop", value: "false" });
    expect(settings).toContainEqual({ key: "lastWindowMode", value: "normal" });
  });

  test("Should log and retrieve interactions", () => {
    const id = createInteraction(db, {
      toolName: "text.rewrite",
      providerId: "mock",
      permissionLevel: "external",
      inputPreview: "input text",
      outputPreview: "output text",
      durationMs: 120,
      success: true,
    });

    expect(id).toBeDefined();

    const recent = getRecentInteractions(db, 10);
    expect(recent.length).toBe(1);
    expect(recent[0]?.id).toBe(id);
    expect(recent[0]?.toolName).toBe("text.rewrite");
    expect(recent[0]?.permissionLevel).toBe("external");
    expect(recent[0]?.success).toBe(true);
    expect(recent[0]?.durationMs).toBe(120);
  });

  test("Should search interactions using FTS5", () => {
    createInteraction(db, {
      toolName: "text.summarize",
      providerId: "mock",
      permissionLevel: "local.read",
      inputPreview: "apple banana cherry",
      outputPreview: "fruit summary",
      durationMs: 80,
      success: true,
    });

    createInteraction(db, {
      toolName: "text.rewrite",
      providerId: "mock",
      permissionLevel: "external",
      inputPreview: "dog cat elephant",
      outputPreview: "animal rewrite",
      durationMs: 90,
      success: true,
    });

    const results = searchInteractions(db, "banana");
    expect(results.length).toBe(1);
    expect(results[0]?.toolName).toBe("text.summarize");
    expect(results[0]?.permissionLevel).toBe("local.read");

    const animalResults = searchInteractions(db, "elephant");
    expect(animalResults.length).toBe(1);
    expect(animalResults[0]?.toolName).toBe("text.rewrite");
  });

  test("Should persist workflow runs with ordered steps", () => {
    const runId = createWorkflowRun(db, {
      mode: "workflow",
      prompt: "Pesquise concorrentes",
      sourceMode: "free",
      providerId: "mock",
      model: "mock-model",
      maxSteps: 8,
    });

    const planStepId = createWorkflowStep(db, {
      runId,
      stepIndex: 1,
      kind: "plan",
      status: "completed",
      title: "Plano inicial",
      detail: "Buscar, comparar e resumir.",
      output: { plan: ["buscar", "comparar"] },
    });

    const toolStepId = createWorkflowStep(db, {
      runId,
      stepIndex: 2,
      kind: "tool",
      status: "running",
      title: "Buscar web",
      toolName: "web.search",
      permissionLevel: "network",
      input: { query: "concorrentes" },
      requiresApproval: true,
    });

    updateWorkflowStep(db, toolStepId, {
      status: "completed",
      output: { results: 3 },
      completedAt: "2026-07-05T12:00:00.000Z",
    });
    updateWorkflowRun(db, runId, {
      status: "completed",
      currentStep: 2,
      result: "Resumo pronto",
      completedAt: "2026-07-05T12:00:00.000Z",
    });

    const run = getWorkflowRun(db, runId);
    expect(run?.id).toBe(runId);
    expect(run?.status).toBe("completed");
    expect(run?.result).toBe("Resumo pronto");
    expect(run?.steps?.map((step) => step.id)).toEqual([planStepId, toolStepId]);
    expect(run?.steps?.[1]?.permissionLevel).toBe("network");
    expect(run?.steps?.[1]?.requiresApproval).toBe(true);

    const recent = listWorkflowRuns(db, 5);
    expect(recent[0]?.id).toBe(runId);
  });

  test("Should install MCP presets disabled and mask env values", () => {
    ensureDefaultMcpPresets(db);
    upsertMcpServer(db, {
      id: "custom-search",
      name: "Custom Search",
      command: "node",
      args: ["server.js"],
      env: { API_KEY: "secret" },
      enabled: true,
      preset: false,
      permissionPolicy: ["network"],
    });
    updateMcpServerStatus(db, "custom-search", {
      lastCheckedAt: "2026-07-05T12:00:00.000Z",
      lastError: null,
    });

    const servers = listMcpServers(db);
    const custom = servers.find((server) => server.id === "custom-search");
    const playwright = servers.find((server) => server.id === "playwright");

    expect(playwright?.enabled).toBe(false);
    expect(playwright?.preset).toBe(true);
    expect(custom?.enabled).toBe(true);
    expect(custom?.env?.API_KEY).toBe("********");
    expect(custom?.permissionPolicy).toEqual(["network"]);
    expect(custom?.lastCheckedAt).toBe("2026-07-05T12:00:00.000Z");
  });

  test("Should upsert conversation turns", () => {
    const conversationId = createConversation(db, { title: "Test", profileId: "profile-editor" });
    const turnId = "turn-1";
    upsertTurn(db, {
      id: turnId,
      conversationId,
      role: "user",
      blocks: [
        { type: "text", content: "hello" },
        {
          type: "context",
          source: "clipboard",
          preview: "context preview",
          content: "full clipboard context",
          policy: "include",
        },
      ],
      status: "complete",
      timestamp: "2026-07-05T12:00:00.000Z",
      sourceMode: "free",
      executionMode: "simple",
      profileId: "profile-editor",
    });

    upsertTurn(db, {
      id: turnId,
      conversationId,
      role: "user",
      blocks: [
        { type: "text", content: "hello world" },
        {
          type: "context",
          source: "clipboard",
          preview: "context preview",
          content: "full clipboard context",
          policy: "include",
        },
      ],
      status: "complete",
      timestamp: "2026-07-05T12:00:00.000Z",
      sourceMode: "free",
      executionMode: "simple",
      profileId: "profile-editor",
    });

    const turns = listTurns(db, conversationId);
    expect(turns.length).toBe(1);
    const block = turns[0]?.blocks[0];
    expect(block?.type === "text" ? block.content : "").toBe("hello world");
    expect(turns[0]?.blocks[1]).toMatchObject({
      type: "context",
      source: "clipboard",
      content: "full clipboard context",
    });
    expect(turns[0]?.profileId).toBe("profile-editor");
    expect(getConversation(db, conversationId)?.profileId).toBe("profile-editor");
  });

  test("Should find a conversation by id outside the recent list", () => {
    const olderId = createConversation(db, { title: "Older" });
    createConversation(db, { title: "Recent" });

    expect(getConversation(db, olderId)).toMatchObject({ id: olderId, title: "Older" });
    expect(getConversation(db, "missing")).toBeNull();
  });

  test("Should persist parsed documents", () => {
    const id = createParsedDocument(db, {
      path: "/tmp/test.md",
      displayName: "test.md",
      size: 42,
      mimeType: "text/markdown",
      encoding: "parsed",
      content: "# Hello",
      preview: "# Hello",
      parsedFormat: "markdown",
      parsedMetadata: { pages: 1 },
      status: "done",
    });

    const doc = getParsedDocument(db, id);
    expect(doc).toMatchObject({
      path: "/tmp/test.md",
      displayName: "test.md",
      content: "# Hello",
      parsedFormat: "markdown",
      parsedMetadata: { pages: 1 },
    });

    const docs = listParsedDocuments(db, 10);
    expect(docs.length).toBe(1);

    const sameId = upsertParsedDocument(db, {
      path: "/tmp/test.md",
      displayName: "renamed.md",
      size: 43,
      mimeType: "text/markdown",
      encoding: "parsed",
      content: "# Updated",
      preview: "# Updated",
      parsedFormat: "markdown",
      parsedMetadata: { headings: ["Updated"] },
      status: "done",
    });
    expect(sameId).toBe(id);
    expect(listParsedDocuments(db, 10)).toHaveLength(1);
    expect(getParsedDocument(db, id)).toMatchObject({ displayName: "renamed.md", content: "# Updated" });

    deleteParsedDocument(db, id);
    expect(getParsedDocument(db, id)).toBeNull();

    createParsedDocument(db, {
      path: "/tmp/other.pdf",
      displayName: "other.pdf",
      size: 100,
      mimeType: "application/pdf",
      encoding: "parsed",
      content: "PDF text",
      preview: "PDF text",
      parsedFormat: "pdf",
      parsedMetadata: { pages: 2 },
      status: "done",
    });
    deleteAllParsedDocuments(db);
    expect(listParsedDocuments(db, 10).length).toBe(0);
  });
});
