import { describe, expect, test } from "bun:test";
import type { WorkflowRun } from "@desktop-agent/shared";
import { buildExecutionContextSummary } from "../../apps/desktop/src/lib/execution-context";

const run: WorkflowRun = {
  id: "run-1",
  createdAt: "2026-07-14T10:00:00.000Z",
  updatedAt: "2026-07-14T10:00:01.000Z",
  mode: "workflow",
  status: "completed",
  prompt: "write",
  sourceMode: "free",
  clipboardPreview: "",
  providerId: "mock",
  model: "mock",
  maxSteps: 2,
  currentStep: 1,
  result: "done",
  metadata: {},
  steps: [
    {
      id: "step-1",
      runId: "run-1",
      stepIndex: 0,
      kind: "tool",
      status: "completed",
      title: "Write file",
      detail: "",
      toolName: "desktop.file.write",
      input: { path: "/tmp/result.md", apiKey: "secret" },
      output: { path: "/tmp/result.md", written: true },
      requiresApproval: true,
      startedAt: "2026-07-14T10:00:00.000Z",
      completedAt: "2026-07-14T10:00:00.250Z",
      createdAt: "2026-07-14T10:00:00.000Z",
    },
  ],
};

describe("buildExecutionContextSummary", () => {
  test("summarizes tools, files and redacts sensitive inputs", () => {
    const summary = buildExecutionContextSummary({
      snapshot: null,
      run,
      files: [],
      contexts: [],
    });

    expect(summary.toolsUsed[0]?.durationMs).toBe(250);
    expect(summary.toolsUsed[0]?.inputPreview).toContain("[redacted]");
    expect(summary.filesWritten[0]?.displayName).toBe("result.md");
  });
});
