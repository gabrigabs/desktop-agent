import type { CompletionChunk, CompletionInput, CompletionOutput } from "@desktop-agent/shared";
import type { LlmProvider } from "@desktop-agent/provider-gateway";
import { registry } from "@desktop-agent/tool-registry";
import {
  closeDb,
  createWorkflowRun,
  getDb,
  runMigrations,
  saveWorkflowTemplate,
} from "@desktop-agent/storage";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { z } from "zod";
import { ParserAgent } from "../../parser";
import { WorkflowRunner } from "../WorkflowRunner";

class ApprovalProvider implements LlmProvider {
  name = "approval-provider";
  kind = "mock" as const;
  streamCount = 0;

  async complete(_input: CompletionInput): Promise<CompletionOutput> {
    throw new Error("complete must not be called");
  }

  async *stream(_input: CompletionInput): AsyncIterable<CompletionChunk> {
    this.streamCount += 1;
    if (this.streamCount === 1) {
      yield {
        content: "",
        done: true,
        toolCalls: [{
          id: "native-call",
          type: "function",
          function: { name: "test.restart-safe", arguments: JSON.stringify({ value: "approved" }) },
        }],
      };
      return;
    }
    yield { content: "retomado", done: true };
  }
}

describe("WorkflowRunner native tool approval checkpoint", () => {
  let executions = 0;

  beforeEach(() => {
    runMigrations(getDb(":memory:"));
    registry.register({
      name: "test.restart-safe",
      description: "Sensitive test tool",
      category: "system",
      permissionLevel: "local.write",
      executionPolicy: "explicit_approval",
      inputSchema: z.object({ value: z.string() }),
      handler: async () => { executions += 1; return { ok: true }; },
    });
  });

  afterEach(() => {
    registry.unregister("test.restart-safe");
    closeDb();
    executions = 0;
  });

  test("persists waiting approval and resumes through a new runner instance", async () => {
    const db = getDb();
    const template = saveWorkflowTemplate(db, {
      name: "Approval",
      prompt: "Use tool",
      settings: { mode: "workflow", maxSteps: 2, toolAllowlist: ["test.restart-safe"] },
      steps: [{
        name: "Responder",
        kind: "llm",
        config: { prompt: "Use the sensitive tool", toolAllowlist: ["test.restart-safe"] },
      }],
    });
    const runId = createWorkflowRun(db, {
      mode: "workflow",
      prompt: "Use tool",
      providerId: "approval-provider",
      model: "model",
      workflowTemplateId: template.id,
      maxSteps: 2,
    });
    const provider = new ApprovalProvider();
    const createRunner = () => new WorkflowRunner({
      getLlmProvider: () => provider,
      getActiveModel: () => "model",
      getLanguage: () => "pt-BR",
      emit: () => {},
      parserAgent: new ParserAgent(),
    });

    const waiting = await createRunner().start({
      requestId: "request-start",
      runId,
      prompt: "Use tool",
      clipboardText: "",
    });
    expect(waiting.status).toBe("waiting_approval");
    expect(waiting.approval?.toolName).toBe("test.restart-safe");
    expect(executions).toBe(0);

    const completed = await createRunner().resume({
      requestId: "request-resume",
      runId,
      prompt: "Use tool",
      clipboardText: "",
      approved: true,
    });
    expect(completed.status).toBe("completed");
    expect(completed.result).toBe("retomado");
    expect(executions).toBe(1);
  });

  test("denial fails the pending call without executing it", async () => {
    const db = getDb();
    const template = saveWorkflowTemplate(db, {
      name: "Denied approval",
      prompt: "Use tool",
      steps: [{ name: "Responder", kind: "llm", config: { prompt: "Use tool", toolAllowlist: ["test.restart-safe"] } }],
    });
    const runId = createWorkflowRun(db, {
      mode: "workflow",
      prompt: "Use tool",
      providerId: "approval-provider",
      model: "model",
      workflowTemplateId: template.id,
    });
    const provider = new ApprovalProvider();
    const runner = new WorkflowRunner({
      getLlmProvider: () => provider,
      getActiveModel: () => "model",
      getLanguage: () => "pt-BR",
      emit: () => {},
      parserAgent: new ParserAgent(),
    });
    const waiting = await runner.start({ requestId: "start-denied", runId, prompt: "Use tool", clipboardText: "" });
    expect(waiting.status).toBe("waiting_approval");
    const denied = await runner.resume({
      requestId: "deny",
      runId,
      prompt: "Use tool",
      clipboardText: "",
      approved: false,
    });
    expect(denied.status).toBe("failed");
    expect(executions).toBe(0);
  });
});
