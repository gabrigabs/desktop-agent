import { randomUUID } from "node:crypto";
import type { LlmProvider } from "@desktop-agent/provider-gateway";
import type {
  AgentEvent,
  ApprovalRequest,
  ContextAttachment,
  ExecutionGrant,
  ExecutionMode,
  FileContextInput,
  PermissionLevel,
  RunStatus,
  WorkflowRun,
  WorkflowStep,
  WorkflowStepKind,
  WorkflowStepStatus,
  WorkflowTemplate,
} from "@desktop-agent/shared";
import {
  createWorkflowStep,
  getAgentProfile,
  getDb,
  getParsedDocument,
  getSkill,
  getSpace as getStoredSpace,
  getWorkflowRun,
  getWorkflowTemplate,
  listActiveMemoryFacts as listActiveStoredMemoryFacts,
  listWorkflowSteps,
  listSpaceDocumentIds,
  saveExecutionContextSnapshot,
  toFileContextInput,
  updateWorkflowRun,
  updateWorkflowStep,
} from "@desktop-agent/storage";
import { registry } from "@desktop-agent/tool-registry";
import type { SupportedLanguage } from "../i18n";
import { t } from "../i18n";
import type { ParserAgent } from "../parser";
import { runAgentLoop } from "./AgentLoop";
import { requiresApproval } from "./ApprovalEngine";
import { createExecutionGrant } from "./ExecutionGrant";
import { McpSessionManager } from "./McpSessionManager";
import { runResponseEngine } from "./ResponseEngine";
import { ToolExecutor } from "./ToolExecutor";
import { resolveVariables, type WorkflowContext } from "./VariableResolver";
import { WorkflowEventEmitter } from "./WorkflowEventEmitter";
import { WorkflowPlanner } from "./WorkflowPlanner";

export type WorkflowRunnerConfig = {
  getLlmProvider: () => LlmProvider;
  getActiveModel: () => string;
  getLanguage: () => SupportedLanguage;
  emit: (event: AgentEvent) => void;
  parserAgent: ParserAgent;
};

export type RunInput = {
  requestId: string;
  runId: string;
  prompt: string;
  clipboardText: string;
  contextText?: string;
  fileContext?: FileContextInput[];
  contexts?: ContextAttachment[];
  history?: { role: "user" | "assistant" | "system"; content: string }[];
  skillId?: string;
  profileId?: string;
  spaceId?: string;
  signal?: AbortSignal;
};

export type ResumeInput = RunInput & {
  approved: boolean;
};

export function mergeSpaceFileContext(
  spaceFiles: FileContextInput[],
  sessionFiles: FileContextInput[],
): FileContextInput[] {
  const filesByPath = new Map<string, FileContextInput>();
  for (const file of spaceFiles) filesByPath.set(file.path, file);
  for (const file of sessionFiles) filesByPath.set(file.path, file);
  return Array.from(filesByPath.values());
}

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
  executionGrant?: ExecutionGrant;
  allowedMcpServers?: string[];
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
  private getLanguage: () => SupportedLanguage;
  private emit: (event: AgentEvent) => void;
  private planner: WorkflowPlanner;
  private toolExecutor: ToolExecutor;
  private parserAgent: ParserAgent;

  constructor(config: WorkflowRunnerConfig) {
    this.getLlmProvider = config.getLlmProvider;
    this.getActiveModel = config.getActiveModel;
    this.getLanguage = config.getLanguage;
    this.emit = config.emit;
    this.parserAgent = config.parserAgent;
    this.planner = new WorkflowPlanner({
      getLlmProvider: config.getLlmProvider,
      getActiveModel: config.getActiveModel,
      getLanguage: config.getLanguage,
    });
    this.toolExecutor = new ToolExecutor(config.emit, () => config.getLlmProvider().name);
  }

  private get lang(): SupportedLanguage {
    return this.getLanguage();
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
    const space = input.spaceId ? getStoredSpace(db, input.spaceId) : null;
    const spaceDocuments =
      input.spaceId && space?.memoryEnabled
        ? listSpaceDocumentIds(db, input.spaceId)
            .map((id) => getParsedDocument(db, id))
            .filter((document): document is NonNullable<typeof document> => Boolean(document))
        : [];
    const effectiveFileContext = mergeSpaceFileContext(
      spaceDocuments.map(toFileContextInput),
      input.fileContext ?? [],
    );
    const fileContextSection = await this.buildFileContext(effectiveFileContext, input.contextText);
    const attachmentSection = this.buildAttachmentContext(input.contexts, Boolean(input.fileContext?.length));

    let memorySection = "";
    let spaceInstructionSection = "";
    let activeFacts: { id: string; content: string }[] = [];
    if (input.spaceId && space) {
      if (space.instructions.trim()) {
        spaceInstructionSection = `Space instructions (follow for this space only):\n${space.instructions.trim()}`;
      }
      if (space.memoryEnabled) {
        const facts = listActiveStoredMemoryFacts(db, input.spaceId);
        activeFacts = facts.map((f) => ({ id: f.id, content: f.content }));
        if (facts.length > 0) {
          const factLines = facts.map((f) => `- ${f.content}`).join("\n");
          memorySection = `Space memory (use as persistent context):\n${factLines}`;
        }
      }
    }

    const contextSections = [
      space?.folderPath
        ? `Space root folder (authorized local scope): ${space.folderPath}\nUse this root when the user asks to inspect, search, edit, run, or discuss files in this Space.`
        : "",
      fileContextSection.trim() ? `Contexto de arquivos anexados:\n${fileContextSection}` : "",
      attachmentSection,
      spaceInstructionSection,
      memorySection,
      spaceDocuments.length > 0
        ? `Space pinned sources available in file context: ${spaceDocuments.map((document) => document.displayName).join(", ")}`
        : "",
    ].filter(Boolean);

    if (input.spaceId || activeFacts.length > 0 || spaceDocuments.length > 0) {
      saveExecutionContextSnapshot(db, {
        runId: run.id,
        spaceId: input.spaceId ?? null,
        facts: activeFacts,
        instructions: space?.instructions ?? "",
        sources: spaceDocuments.map((doc) => ({ documentId: doc.id, displayName: doc.displayName })),
        fileContextPaths: effectiveFileContext.map((f) => f.path),
      });
    }

    const effectivePrompt = contextSections.length
      ? `${input.prompt}\n\n${contextSections.join("\n\n")}`
      : input.prompt;
    const provider = this.getLlmProvider();
    const model = this.getActiveModel() || "gpt-4o";

    const profileId =
      input.profileId ?? space?.profileId ?? (run.metadata.profileId as string | undefined);
    const profile = profileId ? getAgentProfile(db, profileId) : null;

    let template: WorkflowTemplate | null = null;
    if (run.workflowTemplateId) {
      template = getWorkflowTemplate(db, run.workflowTemplateId);
    }

    if (!template) {
      const skill = input.skillId ? getSkill(db, input.skillId) : null;
      template = await this.planner.plan({
        prompt: effectivePrompt,
        clipboard: input.clipboardText,
        history: input.history,
        mode: run.mode as ExecutionMode,
        maxSteps: run.maxSteps,
        skill: skill ?? undefined,
        profile: profile ?? undefined,
        fileContext: effectiveFileContext,
      });
    }

    const settings = template.settings ?? {};
    const maxSteps = Math.min(template.maxSteps ?? run.maxSteps ?? 8, settings.maxSteps ?? 8);
    const approvalThreshold = settings.approvalThreshold;
    const toolExecutor = this.toolExecutor;
    const mcpSessionManager = new McpSessionManager(() => db);
    const connectorContexts = (input.contexts ?? []).filter(
      (context) => context.source === "connector" && context.enabled,
    );
    const allowedMcpServers = connectorContexts.flatMap((context) => {
      const ids = context.metadata?.mcpAllowlist;
      return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string") : [];
    });
    if (connectorContexts.length > 0 && allowedMcpServers.length === 0) {
      throw new Error("CONNECTOR_NOT_ALLOWED: nenhum connector selecionado para esta execução");
    }

    const workflowContext: WorkflowContext = {
      prompt: effectivePrompt,
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

        let executionGrant: ExecutionGrant | undefined;
        const plannedTool = step.kind === "tool" ? registry.get(step.toolName ?? "") : undefined;

        if (step.status === "waiting_approval" && resumeApproved !== undefined) {
          if (!resumeApproved) {
            await this.failStepAndRun(db, run, step, t("errors:workflow.approvalDenied", this.lang), emitter);
            return getWorkflowRun(db, run.id) as WorkflowRun;
          }
          if (plannedTool?.executionPolicy === "explicit_approval" && step.permissionLevel) {
            const resolvedConfig = resolveVariables(step.config ?? {}, workflowContext);
            executionGrant = createExecutionGrant(
              plannedTool.name,
              step.permissionLevel,
              resolvedConfig.args ?? {},
              step.id,
            );
          }
          step.status = "pending";
          step.requiresApproval = false;
          if (!executionGrant) step.permissionLevel = undefined;
        }

        if (
          step.status !== "waiting_approval" &&
          step.permissionLevel &&
          !executionGrant &&
          requiresApproval(step.permissionLevel, approvalThreshold, plannedTool?.executionPolicy)
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
            reason: t("errors:workflow.approvalDetail", this.lang, { toolName: step.toolName ?? step.title }),
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
          prompt: effectivePrompt,
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
          executionGrant,
          allowedMcpServers: connectorContexts.length > 0 ? allowedMcpServers : undefined,
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

  private async buildFileContext(fileContext?: FileContextInput[], contextText?: string): Promise<string> {
    if (!fileContext || fileContext.length === 0) {
      return contextText ?? "";
    }

    const parsed = await this.parserAgent.parseFileContext(fileContext);
    const parts: string[] = [];

    parts.push("Arquivos anexados:");
    for (const file of fileContext) {
      const lines = [
        `- ${file.displayName} (${file.parsedFormat ?? file.mimeType}, ${file.encoding}, ${file.size} bytes)`,
      ];
      if (file.parsedMetadata?.pages != null) lines.push(`  Páginas: ${file.parsedMetadata.pages}`);
      if (file.parsedMetadata?.rows != null) lines.push(`  Linhas: ${file.parsedMetadata.rows}`);
      if (file.parsedMetadata?.columns != null) lines.push(`  Colunas: ${file.parsedMetadata.columns}`);
      if (file.preview) lines.push(`  Preview: ${file.preview.slice(0, 300)}`);
      parts.push(lines.join("\n"));
    }

    const suppliedContent = fileContext
      .filter((file) => file.content?.trim())
      .map((file) => ({ displayName: file.displayName, content: file.content as string }));
    const successfulParses = [
      ...suppliedContent,
      ...parsed.filter((r): r is typeof r & { content: string } => Boolean(r.content && !r.error)),
    ];
    if (successfulParses.length > 0) {
      parts.push("\nConteúdo extraído automaticamente:");
      for (const result of successfulParses) {
        parts.push(`--- ${result.displayName} ---\n${result.content}`);
      }
    }

    const failedParses = parsed.filter((r) => r.error);
    if (failedParses.length > 0) {
      parts.push("\nFalhas na extração:");
      for (const result of failedParses) {
        parts.push(`- ${result.displayName}: ${result.error}`);
      }
    }

    return parts.join("\n\n");
  }

  private buildAttachmentContext(contexts?: ContextAttachment[], hasLegacyFiles = false): string {
    const included = (contexts ?? []).filter(
      (context) =>
        context.enabled && context.content?.trim() && !(hasLegacyFiles && context.source === "file"),
    );
    if (included.length === 0) return "";
    return [
      "Contextos nativos anexados:",
      ...included.map((context) => {
        const warning = [
          context.metadata?.truncated ? "truncado" : "",
          context.metadata?.redactions ? "com redactions" : "",
        ].filter(Boolean);
        return `--- ${context.label} (${context.source}${warning.length ? `; ${warning.join(", ")}` : ""}) ---\n${context.content}`;
      }),
    ].join("\n\n");
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

    return runAgentLoop({
      requestId: ctx.requestId,
      provider,
      model,
      systemPrompt: system,
      messages: [...ctx.history, { role: "user", content: prompt }],
      toolExecutor: ctx.toolExecutor,
      emit: ctx.emit,
      maxSteps: 8,
      temperature,
      signal: ctx.signal,
    });
  }

  private async executeToolStep(
    config: Record<string, unknown>,
    ctx: StepExecutionContext,
  ): Promise<unknown> {
    const toolName = (config.toolName as string) ?? "";
    if (!toolName) throw new Error("toolName is required for tool step");
    const result = await ctx.toolExecutor.execute(
      ctx.requestId,
      toolName,
      config.args ?? {},
      ctx.executionGrant,
    );
    return result.output;
  }

  private async executeMcpStep(config: Record<string, unknown>, ctx: StepExecutionContext): Promise<unknown> {
    const serverId = (config.serverId as string) ?? "";
    const toolName = (config.toolName as string) ?? "";
    if (!serverId || !toolName) throw new Error("serverId and toolName are required for mcp step");
    if (ctx.allowedMcpServers && !ctx.allowedMcpServers.includes(serverId)) {
      throw new Error(`CONNECTOR_NOT_ALLOWED: server ${serverId} is not selected for this execution`);
    }

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
    const _toolAllowlist = skill.toolAllowlist ?? (config.toolAllowlist as string[] | undefined);
    const _maxSteps = skill.maxSteps ?? (config.maxSteps as number) ?? 5;
    const _temperature = skill.temperature ?? (config.temperature as number) ?? 0.3;

    return runResponseEngine(
      ctx.requestId,
      prompt,
      clipboard,
      ctx.history,
      {
        provider: ctx.provider,
        model: (config.model as string) || skill.model || ctx.model,
        systemPrompt,
        emit: ctx.emit,
        signal: ctx.signal,
        toolExecutor: ctx.toolExecutor,
        temperature: (config.temperature as number) ?? 0.3,
        toolAllowlist: (config.toolAllowlist as string[] | undefined) ?? skill.toolAllowlist,
        maxSteps: (config.maxSteps as number) ?? 5,
      },
      this.lang,
    );
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
    throw new Error(t("errors:workflow.aborted"));
  }
}

type Database = ReturnType<typeof getDb>;
