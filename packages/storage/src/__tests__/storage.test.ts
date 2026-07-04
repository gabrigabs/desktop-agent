import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { closeDb, getDb } from "../db";
import { runMigrations } from "../migrations/001_initial";
import { createInteraction, getRecentInteractions, searchInteractions } from "../repositories/interactions";

describe("Storage Package Tests", () => {
  let db: any;

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
});
