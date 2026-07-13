import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { rmSync } from "node:fs";
import path from "node:path";
import {
  addMemoryFact,
  attachDocument,
  archiveMemoryFact,
  archiveWorkspace,
  closeDb,
  createConversation,
  createParsedDocument,
  createWorkspace,
  deleteMemoryFact,
  deleteWorkspace,
  detachDocument,
  getDb,
  getConversation,
  getWorkspace,
  linkConversation,
  listActiveMemoryFacts,
  listConversationsByWorkspace,
  listMemoryFacts,
  listWorkspaceDocumentIds,
  listWorkspaces,
  runMigrations,
  updateMemoryFact,
  updateWorkspace,
} from "../../packages/storage/src/index";

const tmpDb = path.join(import.meta.dir, "tmp-workspace-test.db");

beforeAll(() => {
  runMigrations(getDb(tmpDb));
});

afterAll(() => {
  closeDb();
  try {
    rmSync(tmpDb, { force: true });
  } catch {
    // ignore
  }
});

describe("workspace repository", () => {
  test("create, get, list, update, archive", () => {
    const db = getDb(tmpDb);
    const id = createWorkspace(db, {
      name: "Test Workspace",
      folderPath: "/tmp/test",
      icon: "folder",
      color: "#ff0000",
      purpose: "Testing",
      instructions: "Always answer with evidence.",
    });

    const ws = getWorkspace(db, id);
    expect(ws).not.toBeNull();
    expect(ws?.name).toBe("Test Workspace");
    expect(ws?.folderPath).toBe("/tmp/test");
    expect(ws?.status).toBe("active");
    expect(ws?.memoryEnabled).toBe(true);
    expect(ws?.instructions).toBe("Always answer with evidence.");

    const listed = listWorkspaces(db);
    expect(listed.length).toBeGreaterThanOrEqual(1);
    expect(listed.some((w) => w.id === id)).toBe(true);

    updateWorkspace(db, id, {
      name: "Updated",
      memoryEnabled: false,
      icon: "code",
      folderPath: "/tmp/updated",
      instructions: "Be concise.",
    });
    const updated = getWorkspace(db, id);
    expect(updated?.name).toBe("Updated");
    expect(updated?.memoryEnabled).toBe(false);
    expect(updated).toMatchObject({ icon: "code", folderPath: "/tmp/updated", instructions: "Be concise." });

    archiveWorkspace(db, id);
    const archived = getWorkspace(db, id);
    expect(archived?.status).toBe("archived");
    const activeList = listWorkspaces(db);
    expect(activeList.some((w) => w.id === id)).toBe(false);
  });

  test("memory facts: add, list, update, archive, delete", () => {
    const db = getDb(tmpDb);
    const wsId = createWorkspace(db, { name: "Memory Test", folderPath: "/tmp/mem" });

    const factId = addMemoryFact(db, wsId, { content: "Remember this", origin: "manual" });
    const facts = listMemoryFacts(db, wsId);
    expect(facts.length).toBe(1);
    expect(facts[0]?.content).toBe("Remember this");
    expect(facts[0]?.origin).toBe("manual");
    expect(facts[0]?.status).toBe("active");

    const activeFacts = listActiveMemoryFacts(db, wsId);
    expect(activeFacts.length).toBe(1);

    updateMemoryFact(db, factId, { content: "Updated fact" });
    const updated = listMemoryFacts(db, wsId).find((f) => f.id === factId);
    expect(updated?.content).toBe("Updated fact");

    archiveMemoryFact(db, factId);
    const afterArchive = listActiveMemoryFacts(db, wsId);
    expect(afterArchive.length).toBe(0);

    deleteMemoryFact(db, factId);
    const afterDelete = listMemoryFacts(db, wsId);
    expect(afterDelete.length).toBe(0);
  });

  test("link conversation to workspace", () => {
    const db = getDb(tmpDb);
    const wsId = createWorkspace(db, { name: "Conv Test", folderPath: "/tmp/conv" });
    const convId = createConversation(db, { title: "Test conversation" });

    linkConversation(db, wsId, convId);
    const convs = listConversationsByWorkspace(db, wsId);
    expect(convs).toContain(convId);

    linkConversation(db, wsId, convId);
    const convs2 = listConversationsByWorkspace(db, wsId);
    expect(convs2.length).toBe(1);
  });

  test("attach parser documents and permanently delete only workspace-owned data", () => {
    const db = getDb(tmpDb);
    const wsId = createWorkspace(db, { name: "Sources", folderPath: "/tmp/sources" });
    const docId = createParsedDocument(db, {
      path: "/tmp/reference.png",
      displayName: "reference.png",
      size: 120,
      mimeType: "image/png",
      encoding: "parsed",
      content: "Image OCR",
      preview: "Image OCR",
      parsedFormat: "image",
      parsedMetadata: {},
      status: "done",
    });
    const convId = createConversation(db, { title: "Persistent conversation" });
    const factId = addMemoryFact(db, wsId, { content: "Workspace-only memory" });

    attachDocument(db, wsId, docId);
    attachDocument(db, wsId, docId);
    linkConversation(db, wsId, convId);
    expect(listWorkspaceDocumentIds(db, wsId)).toEqual([docId]);

    detachDocument(db, wsId, docId);
    expect(listWorkspaceDocumentIds(db, wsId)).toEqual([]);
    attachDocument(db, wsId, docId);

    deleteWorkspace(db, wsId);
    expect(getWorkspace(db, wsId)).toBeNull();
    expect(listMemoryFacts(db, wsId)).toEqual([]);
    expect(listWorkspaceDocumentIds(db, wsId)).toEqual([]);
    expect(getConversation(db, convId)).not.toBeNull();
    expect(db.query("SELECT id FROM parsed_documents WHERE id = ?").get(docId)).not.toBeNull();
    expect(db.query("SELECT id FROM workspace_memory WHERE id = ?").get(factId)).toBeNull();
  });
});
