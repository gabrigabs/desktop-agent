import type { FileContextInput } from "@desktop-agent/shared";
import { describe, expect, test } from "bun:test";
import { mergeWorkspaceFileContext } from "../../packages/agent-runtime/src/workflow/WorkflowRunner";

const workspaceFile: FileContextInput = {
  path: "/workspace/reference.md",
  displayName: "reference.md",
  size: 20,
  mimeType: "text/markdown",
  encoding: "parsed",
  content: "persistent context",
  preview: "persistent context",
  parsedFormat: "markdown",
};

describe("workspace file context", () => {
  test("keeps pinned workspace files available to a chat run", () => {
    expect(mergeWorkspaceFileContext([workspaceFile], [])).toEqual([workspaceFile]);
  });

  test("lets an explicit session attachment refresh the same path", () => {
    const sessionFile = { ...workspaceFile, content: "new session content", preview: "new session content" };
    expect(mergeWorkspaceFileContext([workspaceFile], [sessionFile])).toEqual([sessionFile]);
  });
});
