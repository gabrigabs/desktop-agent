import { randomUUID } from "node:crypto";
import type { LlmProvider } from "@desktop-agent/provider-gateway";
import type {
  AgentEvent,
  ApprovalRequest,
  ExecutionMode,
  PermissionLevel,
  RunStatus,
  Skill,
  WorkflowRun,
  WorkflowStep,
  WorkflowStepKind,
  WorkflowStepStatus,
  WorkflowTemplate,
} from "@desktop-agent/shared";
import {
  createWorkflowStep,
  getDb,
  getSkill,
  getWorkflowRun,
  getWorkflowTemplate,
  listWorkflowSteps,
  updateWorkflowRun,
  updateWorkflowStep,
} from "@desktop-agent/storage";
import { registry } from "@desktop-agent/tool-registry";
import { requiresApproval } from "./ApprovalEngine";
import { McpSessionManager } from "./McpSessionManager";
import { runResponseEngine } from "./ResponseEngine";
import { ToolExecutor } from "./ToolExecutor";
import { resolveVariables, type WorkflowContext } from "./VariableResolver";
import { WorkflowEventEmitter } from "./WorkflowEventEmitter";
import { WorkflowPlanner } from "./WorkflowPlanner";

export type WorkflowRunnerConfig = {
  getLlmProvider: () => LlmProvider;
  getActiveModel: () => string;
  emit: (event: AgentEvent) => void;
};

export type RunInput = {
  requestId: string;
  runId: string;
  prompt: string;
  clipboardText: string;
  history?: { role: "user" | "assistant" | "system"; content: string }[];
  skillId?: string;
  signal?: AbortSignal;
};

export type ResumeInput = RunInput & {
  approved: boolean;
};

type StepExecutionContext = {
  requestId: string;
  run: WorkflowRun;
  prompt: string;
  clipboard: string;
  history: { role: "user" | "assistant" | "system"; content: string }[];
  signal?: AbortSignal;
  provider: LlmProvider;
  model: string;
  approvalThreshold: string | undefined;
  toolExecutor: ToolExecutor;
  mcpSessionManager: McpSessionManager;
  emit: (event: AgentEvent) => void;
  emitter: WorkflowEventEmitter;
  context: WorkflowContext;
};

function isTerminalStatus(status: RunStatus): boolean {
  return status === "completed" || status === "failed" || status === "cancelled";
}

function nowIso(): string {
  return new Date().toISOString();
}

function stringifyOutput(output: unknown): string {
  if (typeof output === "string") return output;
  try {
    return JSON.stringify(output, null, 2);
  } catch {
    return String(output);
  }
}

export class WorkflowRunner {
  private getLlmProvider: () => LlmProvider;
  private getActiveModel: () => string;
  private emit: (event: AgentEvent) => void;
  private planner: WorkflowPlanner;
  private toolExecutor: ToolExecutor;

  constructor(config: WorkflowRunnerConfig) {
    this.getLlmProvider = config.getLlmProvider;
    this.getActiveModel = config.getActiveModel;
    this.emit = config.emit;
    this.planner = new WorkflowPlanner({
      getLlmProvider: config.getLlmProvider,
      getActiveModel: config.getActiveModel,
    });
    this.toolExecutor = new ToolExecutor(config.emit, () => config.getLlmProvider().name);
  }

  async start(input: RunInput): Promise<WorkflowRun> {
    const run = this.loadRun(input.runId);
    if (isTerminalStatus(run.status)) {
      return run;
    }

    const emitter = new WorkflowEventEmitter(this.emit, input.requestId);
    return this.executeRun(input, run, emitter);
  }

  async resume(input: ResumeInput): Promise<WorkflowRun> {
    const run = this.loadRun(input.runId);
    if (!run || isTerminalStatus(run.status)) {
      return run;
    }

    if (run.status !== "waiting_approval") {
      return run;
    }

    const emitter = new WorkflowEventEmitter(this.emit, input.requestId);
    return this.executeRun(input, run, emitter, input.approved);
  }

  private loadRun(runId: string): WorkflowRun {
    const run = getWorkflowRun(getDb(), runId);
    if (!run) {
      throw new Error(`Workflow run not found: ${runId}`);
    }
    return run;
  }

  private async executeRun(
    input: RunInput,
    run: WorkflowRun,
    emitter: WorkflowEventEmitter,
    resumeApproved?: boolean,
  ): Promise<WorkflowRun> {
    const db = getDb();
    const provider = this.getLlmProvider();
    const model = this.getActiveModel() || "gpt-4o";

    let template: WorkflowTemplate | null = null;
    if (run.workflowTemplateId) {
      template = getWorkflowTemplate(db, run.workflowTemplateId);
    }

    if (!template) {
      const skill = input.skillId ? getSkill(db, input.skillId) : null;
      template = await this.planner.plan({
        prompt: input.prompt,
        clipboard: input.clipboardText,
        history: input.history,
        mode: run.mode as ExecutionMode,
        maxSteps: run.maxSteps,
        skill: skill ?? undefined,
      });
    }

    const settings = template.settings ?? {};
    const maxSteps = Math.min(template.maxSteps ?? run.maxSteps ?? 8, settings.maxSteps ?? 8);
    const approvalThreshold = settings.approvalThreshold;
    const toolExecutor = this.toolExecutor;
    const mcpSessionManager = new McpSessionManager(() => db);

    const workflowContext: WorkflowContext = {
      prompt: input.prompt,
      clipboard: input.clipboardText,
      history: input.history ?? [],
      steps: [],
      run: {
        mode: run.mode,
        providerId: run.providerId,
        model: run.model,
        maxSteps: run.maxSteps,
      },
      metadata: run.metadata,
    };

    updateWorkflowRun(db, run.id, { status: "running" });
    emitter.runStarted(run);
    emitter.agentStarted();
    emitter.runStatusChanged({ ...run, status: "running" });

    try {
      this.ensureStepsFromTemplate(run, template, workflowContext, emitter);
      workflowContext.steps = listWorkflowSteps(db, run.id);

      const steps = workflowContext.steps.sort((a, b) => a.stepIndex - b.stepIndex);
      let startIndex = 0;
      if (run.currentStep && run.currentStep > 0) {
        const idx = steps.findIndex((s) => s.stepIndex === run.currentStep);
        startIndex = idx >= 0 ? idx : 0;
      }

      for (let i = startIndex; i < steps.length; i++) {
        const step = steps[i];
        if (!step) continue;

        throwIfAborted(input.signal);

        if (step.status === "completed" || step.status === "skipped") {
          continue;
        }

        if (step.status === "waiting_approval" && resumeApproved !== undefined) {
          if (!resumeApproved) {
            await this.failStepAndRun(db, run, step, "Aprovação negada pelo usuário.", emitter);
            return getWorkflowRun(db, run.id) as WorkflowRun;
          }
          step.status = "pending";
          step.requiresApproval = false;
          step.permissionLevel = undefined;
        }

        if (
          step.status !== "waiting_approval" &&
          step.permissionLevel &&
          requiresApproval(step.permissionLevel, approvalThreshold)
        ) {
          step.status = "waiting_approval";
          step.requiresApproval = true;
          updateWorkflowStep(db, step.id, {
            status: "waiting_approval",
            requiresApproval: true,
          });
          emitter.stepUpdated(listWorkflowSteps(db, run.id).find((s) => s.id === step.id) as WorkflowStep);

          const approval: ApprovalRequest = {
            id: randomUUID(),
            runId: run.id,
            stepId: step.id,
            toolName: step.toolName ?? step.title,
            permissionLevel: step.permissionLevel as PermissionLevel,
            reason: `Permissão necessária para executar ${step.toolName ?? step.title}`,
            inputPreview: JSON.stringify(step.input).slice(0, 500),
            createdAt: nowIso(),
          };
          updateWorkflowRun(db, run.id, {
            status: "waiting_approval",
            currentStep: step.stepIndex,
            approval,
          });
          emitter.runStatusChanged({ ...run, status: "waiting_approval" });
          emitter.approvalRequired(step, run.id, approval);
          return getWorkflowRun(db, run.id) as WorkflowRun;
        }

        const stepContext: StepExecutionContext = {
          requestId: input.requestId,
          run,
          prompt: input.prompt,
          clipboard: input.clipboardText,
          history: input.history ?? [],
          signal: input.signal,
          provider,
          model: settings.model ?? run.model ?? model,
          approvalThreshold,
          toolExecutor,
          mcpSessionManager,
          emit: this.emit,
          emitter,
          context: workflowContext,
        };

        const updatedStep = await this.executeStep(step, stepContext);
        workflowContext.steps = listWorkflowSteps(db, run.id);

        if (updatedStep.status === "failed") {
          await this.failRun(db, run, updatedStep.errorMessage ?? "Step failed", emitter);
          return getWorkflowRun(db, run.id) as WorkflowRun;
        }

        if (i >= maxSteps - 1) {
          break;
        }
      }

      const completedAt = nowIso();
      const finalSteps = listWorkflowSteps(db, run.id).sort((a, b) => a.stepIndex - b.stepIndex);
      const lastStep = finalSteps[finalSteps.length - 1];
      const result = lastStep ? stringifyOutput(lastStep.output) : "";

      updateWorkflowRun(db, run.id, {
        status: "completed",
        completedAt,
        currentStep: lastStep?.stepIndex ?? run.currentStep,
        result,
        approval: null,
      });

      const completedRun = getWorkflowRun(db, run.id) as WorkflowRun;
      emitter.runStatusChanged(completedRun);
      emitter.runCompleted(completedRun);
      emitter.agentCompleted();

      mcpSessionManager.stopAll();
      return completedRun;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      await this.failRun(db, run, errorMessage, emitter);
      mcpSessionManager.stopAll();
      return getWorkflowRun(db, run.id) as WorkflowRun;
    }
  }

  private ensureStepsFromTemplate(
    run: WorkflowRun,
    template: WorkflowTemplate,
    context: WorkflowContext,
    emitter: WorkflowEventEmitter,
  ): void {
    const db = getDb();
    const existingSteps = listWorkflowSteps(db, run.id);
    const sortedTemplateSteps = [...template.steps].sort((a, b) => a.stepIndex - b.stepIndex);

    for (const templateStep of sortedTemplateSteps) {
      const existing = existingSteps.find((s) => s.stepIndex === templateStep.stepIndex);
      if (existing) continue;

      const config = templateStep.config ?? {};
      const stepId = createWorkflowStep(db, {
        runId: run.id,
        stepIndex: templateStep.stepIndex,
        kind: templateStep.kind as WorkflowStepKind,
        title: templateStep.name,
        detail: config.reason as string | undefined,
        toolName: (config.toolName as string) ?? undefined,
        mcpServerId: (config.serverId as string) ?? undefined,
        skillId: (config.skillId as string) ?? undefined,
        permissionLevel: this.inferPermissionLevel(templateStep.kind as WorkflowStepKind, config),
        config,
        input: resolveVariables(config, context),
        output: {},
        requiresApproval: false,
      });

      const step = listWorkflowSteps(db, run.id).find((s) => s.id === stepId) as WorkflowStep;
      emitter.stepCreated(step);
    }
  }

  private inferPermissionLevel(
    kind: WorkflowStepKind,
    config: Record<string, unknown>,
  ): PermissionLevel | undefined {
    if (kind === "tool") {
      const toolName = (config.toolName as string) ?? "";
      const tool = registry.get(toolName);
      return tool?.permissionLevel;
    }
    if (kind === "mcp") return "external";
    if (kind === "skill") return "external";
    return undefined;
  }

  private async executeStep(step: WorkflowStep, ctx: StepExecutionContext): Promise<WorkflowStep> {
    const db = getDb();
    updateWorkflowStep(db, step.id, {
      status: "running",
      startedAt: nowIso(),
      input: resolveVariables(step.config ?? {}, ctx.context),
    });
    const runningStep = listWorkflowSteps(db, step.runId).find((s) => s.id === step.id) as WorkflowStep;
    ctx.emitter.stepUpdated(runningStep);

    let output: unknown = {};
    let errorMessage: string | undefined;

    try {
      throwIfAborted(ctx.signal);
      const resolvedConfig = resolveVariables(step.config ?? {}, ctx.context);

      switch (step.kind) {
        case "llm":
          output = await this.executeLlmStep(resolvedConfig, ctx);
          break;
        case "tool":
          output = await this.executeToolStep(resolvedConfig, ctx);
          break;
        case "mcp":
          output = await this.executeMcpStep(resolvedConfig, ctx);
          break;
        case "skill":
          output = await this.executeSkillStep(resolvedConfig, step, ctx);
          break;
        default:
          throw new Error(`Unsupported step kind: ${step.kind}`);
      }
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : String(err);
    }

    const status: WorkflowStepStatus = errorMessage ? "failed" : "completed";
    updateWorkflowStep(db, step.id, {
      status,
      output: errorMessage ? undefined : output,
      errorMessage,
      completedAt: nowIso(),
    });

    const finalStep = listWorkflowSteps(db, step.runId).find((s) => s.id === step.id) as WorkflowStep;
    ctx.emitter.stepUpdated(finalStep);
    return finalStep;
  }

  private async executeLlmStep(config: Record<string, unknown>, ctx: StepExecutionContext): Promise<string> {
    const provider = ctx.provider;
    const model = (config.model as string) || ctx.model;
    const temperature = typeof config.temperature === "number" ? config.temperature : 0.3;
    const system = (config.system as string) || "";
    const prompt = (config.prompt as string) || "";

    let result = "";
    let emittedChunk = false;

    const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: system },
      ...ctx.history,
      { role: "user", content: prompt },
    ];

    for await (const chunk of provider.stream({ model, temperature, signal: ctx.signal, messages })) {
      throwIfAborted(ctx.signal);
      if (chunk.content) {
        result += chunk.content;
        emittedChunk = true;
        ctx.emitter.chunk(chunk.content);
      }
    }

    const finalResult = result || "Não foi possível obter uma resposta.";
    if (!emittedChunk) {
      ctx.emitter.chunk(finalResult);
    }
    return finalResult;
  }

  private async executeToolStep(
    config: Record<string, unknown>,
    ctx: StepExecutionContext,
  ): Promise<unknown> {
    const toolName = (config.toolName as string) ?? "";
    if (!toolName) throw new Error("toolName is required for tool step");
    const result = await ctx.toolExecutor.execute(ctx.requestId, toolName, config.args ?? {});
    return result.output;
  }

  private async executeMcpStep(config: Record<string, unknown>, ctx: StepExecutionContext): Promise<unknown> {
    const serverId = (config.serverId as string) ?? "";
    const toolName = (config.toolName as string) ?? "";
    if (!serverId || !toolName) throw new Error("serverId and toolName are required for mcp step");

    ctx.emitter.toolStarted(toolName, config.args ?? {});
    try {
      const result = await ctx.mcpSessionManager.callTool(serverId, toolName, config.args ?? {});
      ctx.emitter.toolFinished(toolName, result);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      ctx.emitter.error(errorMessage);
      throw err;
    }
  }

  private async executeSkillStep(
    config: Record<string, unknown>,
    step: WorkflowStep,
    ctx: StepExecutionContext,
  ): Promise<string> {
    const skillId = (config.skillId as string) ?? step.skillId ?? "";
    if (!skillId) throw new Error("skillId is required for skill step");

    const skill = getSkill(getDb(), skillId);
    if (!skill) throw new Error(`Skill not found: ${skillId}`);

    const prompt = (config.prompt as string) ?? ctx.prompt;
    const clipboard = (config.clipboard as string) ?? ctx.clipboard;
    const systemPrompt = skill.systemPrompt ?? (config.system as string) ?? "";
    const toolAllowlist = skill.toolAllowlist ?? (config.toolAllowlist as string[] | undefined);
    const maxSteps = skill.maxSteps ?? (config.maxSteps as number) ?? 5;
    const temperature = skill.temperature ?? (config.temperature as number) ?? 0.3;

    return runResponseEngine(ctx.requestId, prompt, clipboard, ctx.history, {
      provider: ctx.provider,
      model: (config.model as string) || skill.model || ctx.model,
      systemPrompt,
      temperature,
      toolAllowlist,
      maxSteps,
      emit: ctx.emit,
      toolExecutor: ctx.toolExecutor,
      signal: ctx.signal,
    });
  }

  private async failRun(
    db: Database,
    run: WorkflowRun,
    errorMessage: string,
    emitter: WorkflowEventEmitter,
  ): Promise<void> {
    updateWorkflowRun(db, run.id, {
      status: "failed",
      completedAt: nowIso(),
      errorMessage,
    });
    const failedRun = getWorkflowRun(db, run.id) as WorkflowRun;
    emitter.runStatusChanged(failedRun);
    emitter.runCompleted(failedRun);
    emitter.agentCompleted();
    emitter.error(errorMessage);
  }

  private async failStepAndRun(
    db: Database,
    run: WorkflowRun,
    step: WorkflowStep,
    errorMessage: string,
    emitter: WorkflowEventEmitter,
  ): Promise<void> {
    updateWorkflowStep(db, step.id, { status: "failed", errorMessage, completedAt: nowIso() });
    await this.failRun(db, run, errorMessage, emitter);
  }
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw new Error("Workflow abortado pelo usuário.");
  }
}

type Database = ReturnType<typeof getDb>;
