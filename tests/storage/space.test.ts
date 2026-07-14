import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { rmSync } from "node:fs";
import path from "node:path";
import {
  addMemoryFact,
  attachDocument,
  archiveSpace,
  closeDb,
  createConversation,
  createParsedDocument,
  createSpace,
  deleteMemoryFact,
  deleteSpace,
  detachDocument,
  getDb,
  getConversation,
  getSpace,
  linkConversation,
  listActiveMemoryFacts,
  listConversationsBySpace,
  listMemoryFacts,
  listSpaceDocumentIds,
  listSpaces,
  runMigrations,
  updateMemoryFact,
  updateSpace,
} from "../../packages/storage/src/index";

const tmpDb = path.join(import.meta.dir, "tmp-space-test.db");

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

describe("space repository", () => {
  test("create, get, list, update, archive", () => {
    const db = getDb(tmpDb);
    const space = createSpace(db, {
      name: "Test Space",
      folderPath: "/tmp/test",
      icon: "folder",
      color: "#ff0000",
      purpose: "Testing",
      instructions: "Always answer with evidence.",
    });

    const ws = getSpace(db, space.id);
    expect(ws).not.toBeNull();
    expect(ws?.name).toBe("Test Space");
    expect(ws?.folderPath).toBe("/tmp/test");
    expect(ws?.status).toBe("active");
    expect(ws?.memoryEnabled).toBe(true);
    expect(ws?.instructions).toBe("Always answer with evidence.");

    const listed = listSpaces(db);
    expect(listed.length).toBeGreaterThanOrEqual(1);
    expect(listed.some((w) => w.id === space.id)).toBe(true);

    updateSpace(db, space.id, {
      name: "Updated",
      memoryEnabled: false,
      icon: "code",
      folderPath: "/tmp/updated",
      instructions: "Be concise.",
    });
    const updated = getSpace(db, space.id);
    expect(updated?.name).toBe("Updated");
    expect(updated?.memoryEnabled).toBe(false);
    expect(updated).toMatchObject({ icon: "code", folderPath: "/tmp/updated", instructions: "Be concise." });

    archiveSpace(db, space.id);
    const archived = getSpace(db, space.id);
    expect(archived?.status).toBe("archived");
    const activeList = listSpaces(db);
    expect(activeList.some((w) => w.id === space.id)).toBe(false);
  });

  test("memory facts: add, list, update, archive, delete", () => {
    const db = getDb(tmpDb);
    const space = createSpace(db, { name: "Memory Test", folderPath: "/tmp/mem" });

    const fact = addMemoryFact(db, space.id, { content: "Remember this", origin: "manual" });
    const facts = listMemoryFacts(db, space.id);
    expect(facts.length).toBe(1);
    expect(facts[0]?.content).toBe("Remember this");
    expect(facts[0]?.origin).toBe("manual");
    expect(facts[0]?.status).toBe("active");

    const activeFacts = listActiveMemoryFacts(db, space.id);
    expect(activeFacts.length).toBe(1);

    updateMemoryFact(db, space.id, fact.id, { content: "Updated fact" });
    const updated = listMemoryFacts(db, space.id).find((item) => item.id === fact.id);
    expect(updated?.content).toBe("Updated fact");

    updateMemoryFact(db, space.id, fact.id, { status: "archived" });
    const afterArchive = listActiveMemoryFacts(db, space.id);
    expect(afterArchive.length).toBe(0);

    deleteMemoryFact(db, space.id, fact.id);
    const afterDelete = listMemoryFacts(db, space.id);
    expect(afterDelete.length).toBe(0);
  });

  test("link conversation to space", () => {
    const db = getDb(tmpDb);
    const space = createSpace(db, { name: "Conv Test", folderPath: "/tmp/conv" });
    const convId = createConversation(db, { title: "Test conversation" });

    linkConversation(db, space.id, convId);
    const convs = listConversationsBySpace(db, space.id);
    expect(convs).toContain(convId);

    linkConversation(db, space.id, convId);
    const convs2 = listConversationsBySpace(db, space.id);
    expect(convs2.length).toBe(1);
  });

  test("attach parser documents and permanently delete only space-owned data", () => {
    const db = getDb(tmpDb);
    const space = createSpace(db, { name: "Sources", folderPath: "/tmp/sources" });
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
    const fact = addMemoryFact(db, space.id, { content: "Space-only memory" });

    attachDocument(db, space.id, docId);
    attachDocument(db, space.id, docId);
    linkConversation(db, space.id, convId);
    expect(listSpaceDocumentIds(db, space.id)).toEqual([docId]);

    detachDocument(db, space.id, docId);
    expect(listSpaceDocumentIds(db, space.id)).toEqual([]);
    attachDocument(db, space.id, docId);

    deleteSpace(db, space.id);
    expect(getSpace(db, space.id)).toBeNull();
    expect(listMemoryFacts(db, space.id)).toEqual([]);
    expect(listSpaceDocumentIds(db, space.id)).toEqual([]);
    expect(getConversation(db, convId)).not.toBeNull();
    expect(db.query("SELECT id FROM parsed_documents WHERE id = ?").get(docId)).not.toBeNull();
    expect(db.query("SELECT id FROM space_memory WHERE id = ?").get(fact.id)).toBeNull();
  });
});
