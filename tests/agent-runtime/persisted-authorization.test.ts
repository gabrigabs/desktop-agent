import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { getPersistedDocumentRoot } from "../../packages/agent-runtime/src/parser/persistedAuthorization";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("persisted document authorization", () => {
  test("restores only the canonical parent of an existing regular file", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "helix-persisted-document-"));
    directories.push(directory);
    const filePath = path.join(directory, "notes.md");
    await writeFile(filePath, "# Notes");

    expect(await getPersistedDocumentRoot(filePath)).toBe(await realpath(directory));
    expect(await getPersistedDocumentRoot("notes.md")).toBeNull();
    expect(await getPersistedDocumentRoot(path.join(directory, "missing.md"))).toBeNull();
  });

  test("does not restore authorization from a symlink", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "helix-persisted-document-"));
    directories.push(directory);
    const target = path.join(directory, "target.md");
    const link = path.join(directory, "link.md");
    await writeFile(target, "# Target");
    await symlink(target, link);
    expect(await getPersistedDocumentRoot(link)).toBeNull();
  });
});
