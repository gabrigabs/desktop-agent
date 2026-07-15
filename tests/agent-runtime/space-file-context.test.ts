import type { FileContextInput } from "@desktop-agent/shared";
import { describe, expect, test } from "bun:test";
import { mergeSpaceFileContext } from "../../packages/agent-runtime/src/workflow/WorkflowRunner";

const spaceFile: FileContextInput = {
  path: "/space/reference.md",
  displayName: "reference.md",
  size: 20,
  mimeType: "text/markdown",
  encoding: "parsed",
  content: "persistent context",
  preview: "persistent context",
  parsedFormat: "markdown",
};

describe("space file context", () => {
  test("keeps pinned space files available to a chat run", () => {
    expect(mergeSpaceFileContext([spaceFile], [])).toEqual([spaceFile]);
  });

  test("lets an explicit session attachment refresh the same path", () => {
    const sessionFile = { ...spaceFile, content: "new session content", preview: "new session content" };
    expect(mergeSpaceFileContext([spaceFile], [sessionFile])).toEqual([sessionFile]);
  });
});
