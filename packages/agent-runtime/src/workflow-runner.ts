import { randomUUID } from "node:crypto";
import type { LlmProvider } from "@desktop-agent/provider-gateway";
import type {
  AgentEvent,
  ApprovalRequest,
  PermissionLevel,
  RunStatus,
  WorkflowRun,
  WorkflowStep,
  WorkflowStepKind,
  WorkflowStepStatus,
} from "@desktop-agent/shared";
import {
  createWorkflowStep,
  getDb,
  getWorkflowRun,
  listWorkflowSteps,
  updateWorkflowRun,
  updateWorkflowStep,
} from "@desktop-agent/storage";
import { registry } from "@desktop-agent/tool-registry";
import type { Orchestrator } from "./orchestrator";

type WorkflowRunnerConfig = {
  orchestrator: Orchestrator;
  getLlmProvider: () => LlmProvider;
  getActiveModel: () => string;
  emit: (event: AgentEvent) => void;
};

type RunInput = {
  requestId: string;
  runId: string;
  prompt: string;
  clipboardText: string;
  history?: { role: "user" | "assistant" | "system"; content: string }[];
  signal?: AbortSignal;
};

type ToolPlan = {
  toolName: string;
  input: unknown;
  reason: string;
};

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw new Error("Workflow abortado pelo usuário.");
  }
}

function isTerminalStatus(status: RunStatus) {
  return status === "completed" || status === "failed" || status === "cancelled";
}

function requiresApproval(permissionLevel?: PermissionLevel) {
  return (
    permissionLevel === "local.write" ||
    permissionLevel === "network" ||
    permissionLevel === "browser.control" ||
    permissionLevel === "screen.read" ||
    permissionLevel === "external"
  );
}

function normalize(value: string) {
  return value.toLowerCase();
}

function nowIso() {
  return new Date().toISOString();
}

function stringifyOutput(output: unknown) {
  if (typeof output === "string") return output;
  try {
    return JSON.stringify(output, null, 2);
  } catch {
    return String(output);
  }
}

export class WorkflowRunner {
  private orchestrator: Orchestrator;
  private getLlmProvider: () => LlmProvider;
  private getActiveModel: () => string;
  private emit: (event: AgentEvent) => void;

  constructor(config: WorkflowRunnerConfig) {
    this.orchestrator = config.orchestrator;
    this.getLlmProvider = config.getLlmProvider;
    this.getActiveModel = config.getActiveModel;
    this.emit = config.emit;
  }

  async start(input: RunInput): Promise<WorkflowRun> {
    const run = getWorkflowRun(getDb(), input.runId);
    if (!run) {
      throw new Error(`Workflow run não encontrado: ${input.runId}`);
    }

    if (isTerminalStatus(run.status)) {
      return run;
    }

    this.emit({ type: "workflow.started", requestId: input.requestId, runId: run.id, mode: run.mode });
    updateWorkflowRun(getDb(), run.id, { status: "running" });

    try {
      if (run.mode === "simple") {
        return await this.runSimple(input);
      }
      return await this.runWorkflow(input);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      const status = input.signal?.aborted ? "cancelled" : "failed";
      updateWorkflowRun(getDb(), run.id, {
        status,
        completedAt: nowIso(),
        errorMessage,
      });
      const failedRun = getWorkflowRun(getDb(), run.id) as WorkflowRun;
      this.emit({ type: "workflow.completed", requestId: input.requestId, runId: run.id, status });
      return failedRun;
    }
  }

  async resume(input: RunInput & { approved: boolean }): Promise<WorkflowRun> {
    const run = getWorkflowRun(getDb(), input.runId);
    if (!run) {
      throw new Error(`Workflow run não encontrado: ${input.runId}`);
    }

    if (!run.approval) {
      return run;
    }

    const approvalStep = (run.steps ?? []).find((step) => step.status === "waiting_approval");
    if (!input.approved) {
      if (approvalStep) {
        this.updateStep(input.requestId, run.id, approvalStep.id, {
          status: "failed",
          errorMessage: "Aprovação negada pelo usuário.",
          completedAt: nowIso(),
        });
      }
      updateWorkflowRun(getDb(), run.id, {
        status: "cancelled",
        approval: null,
        completedAt: nowIso(),
        errorMessage: "Aprovação negada pelo usuário.",
      });
      const cancelledRun = getWorkflowRun(getDb(), run.id) as WorkflowRun;
      this.emit({
        type: "workflow.completed",
        requestId: input.requestId,
        runId: run.id,
        status: "cancelled",
      });
      return cancelledRun;
    }

    if (approvalStep) {
      this.updateStep(input.requestId, run.id, approvalStep.id, {
        status: "completed",
        detail: "Aprovado pelo usuário.",
        completedAt: nowIso(),
      });
    }
    updateWorkflowRun(getDb(), run.id, { status: "running", approval: null });

    const payload = approvalStep?.input as { toolName?: string; toolInput?: unknown } | undefined;
    if (!payload?.toolName) {
      return this.runWorkflowLoop(input, []);
    }

    const toolOutput = await this.executeTool(input, {
      toolName: payload.toolName,
      input: payload.toolInput ?? {},
      reason: "Execução retomada após aprovação.",
    });
    this.recordObservation(input, { tool: payload.toolName, output: toolOutput, next: "continue" });
    return this.runWorkflowLoop(input, [toolOutput]);
  }

  private async runSimple(input: RunInput): Promise<WorkflowRun> {
    const run = getWorkflowRun(getDb(), input.runId) as WorkflowRun;
    this.createStep(input.requestId, run.id, {
      kind: "hook",
      status: "completed",
      title: "run_start",
      detail: "Modo simples iniciado.",
    });

    const responseStep = this.createStep(input.requestId, run.id, {
      kind: "response",
      status: "running",
      title: "Resposta simples",
      detail: "Gerando uma resposta direta.",
      startedAt: nowIso(),
    });

    throwIfAborted(input.signal);
    const result = await this.orchestrator.runAgent(
      input.requestId,
      input.prompt,
      input.clipboardText,
      input.history ?? [],
      this.emit,
      this.getLlmProvider,
      this.getActiveModel,
      input.signal,
    );

    this.updateStep(input.requestId, run.id, responseStep.id, {
      status: "completed",
      output: { result },
      completedAt: nowIso(),
    });
    this.createStep(input.requestId, run.id, {
      kind: "hook",
      status: "completed",
      title: "before_finish",
      detail: "Resposta simples pronta.",
    });
    updateWorkflowRun(getDb(), run.id, {
      status: "completed",
      currentStep: this.nextStepIndex(run.id) - 1,
      result,
      completedAt: nowIso(),
    });
    this.emit({ type: "workflow.completed", requestId: input.requestId, runId: run.id, status: "completed" });
    return getWorkflowRun(getDb(), run.id) as WorkflowRun;
  }

  private async runWorkflow(input: RunInput): Promise<WorkflowRun> {
    const run = getWorkflowRun(getDb(), input.runId) as WorkflowRun;
    this.createStep(input.requestId, run.id, {
      kind: "hook",
      status: "completed",
      title: "run_start",
      detail: "Workflow iniciado.",
    });

    const planStep = this.createStep(input.requestId, run.id, {
      kind: "plan",
      status: "running",
      title: "Plano",
      detail: "Definindo próximos passos.",
      input: {
        prompt: input.prompt,
        hasClipboard: input.clipboardText.trim().length > 0,
        maxSteps: run.maxSteps,
      },
      startedAt: nowIso(),
    });

    this.updateStep(input.requestId, run.id, planStep.id, {
      status: "completed",
      detail: `Workflow de até ${run.maxSteps} passos com observações intermediárias.`,
      output: {
        steps: ["Entender pedido", "Selecionar ferramenta", "Executar", "Observar", "Repetir ou finalizar"],
      },
      completedAt: nowIso(),
    });

    return this.runWorkflowLoop(input, []);
  }

  private async runWorkflowLoop(input: RunInput, observations: unknown[]): Promise<WorkflowRun> {
    const run = getWorkflowRun(getDb(), input.runId) as WorkflowRun;

    while (observations.length < run.maxSteps) {
      throwIfAborted(input.signal);

      const toolPlan = await this.selectTool(input, observations);
      if (!toolPlan) {
        break;
      }

      const tool = registry.get(toolPlan.toolName);
      if (!tool) {
        this.recordObservation(input, {
          error: `Ferramenta indisponível: ${toolPlan.toolName}`,
          next: "continue",
        });
        continue;
      }

      if (requiresApproval(tool.permissionLevel)) {
        return this.waitForApproval(input, toolPlan, tool.permissionLevel);
      }

      try {
        const toolOutput = await this.executeTool(input, toolPlan);
        this.recordObservation(input, { tool: toolPlan.toolName, output: toolOutput, next: "continue" });
        observations.push(toolOutput);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.recordObservation(input, { error: message, tool: toolPlan.toolName, next: "continue" });
      }
    }

    return this.finishWorkflow(input, observations);
  }

  private async waitForApproval(
    input: RunInput,
    toolPlan: ToolPlan,
    permissionLevel: PermissionLevel,
  ): Promise<WorkflowRun> {
    const run = getWorkflowRun(getDb(), input.runId) as WorkflowRun;
    const step = this.createStep(input.requestId, run.id, {
      kind: "approval",
      status: "waiting_approval",
      title: "Aprovação necessária",
      detail: `Confirmar uso de ${toolPlan.toolName}.`,
      toolName: toolPlan.toolName,
      permissionLevel,
      input: {
        toolName: toolPlan.toolName,
        toolInput: toolPlan.input,
        reason: toolPlan.reason,
      },
      requiresApproval: true,
      startedAt: nowIso(),
    });
    const approval: ApprovalRequest = {
      id: randomUUID(),
      runId: run.id,
      stepId: step.id,
      toolName: toolPlan.toolName,
      permissionLevel,
      reason: toolPlan.reason,
      inputPreview: stringifyOutput(toolPlan.input).slice(0, 500),
      createdAt: nowIso(),
    };

    updateWorkflowRun(getDb(), run.id, {
      status: "waiting_approval",
      currentStep: step.stepIndex,
      approval,
    });
    this.createStep(input.requestId, run.id, {
      kind: "hook",
      status: "completed",
      title: "waiting_for_input",
      detail: "Workflow pausado aguardando aprovação.",
    });
    this.emit({ type: "workflow.approval_required", requestId: input.requestId, runId: run.id, approval });
    this.emit({
      type: "workflow.completed",
      requestId: input.requestId,
      runId: run.id,
      status: "waiting_approval",
    });
    return getWorkflowRun(getDb(), run.id) as WorkflowRun;
  }

  private async executeTool(input: RunInput, toolPlan: ToolPlan): Promise<unknown> {
    const run = getWorkflowRun(getDb(), input.runId) as WorkflowRun;
    const tool = registry.get(toolPlan.toolName);
    if (!tool) {
      throw new Error(`Ferramenta indisponível: ${toolPlan.toolName}`);
    }

    this.createStep(input.requestId, run.id, {
      kind: "hook",
      status: "completed",
      title: "before_tool",
      detail: `Preparando ${toolPlan.toolName}.`,
      output: { permissionLevel: tool.permissionLevel },
    });

    const toolStep = this.createStep(input.requestId, run.id, {
      kind: "tool",
      status: "running",
      title: toolPlan.toolName,
      detail: toolPlan.reason,
      toolName: toolPlan.toolName,
      permissionLevel: tool.permissionLevel,
      input: toolPlan.input,
      startedAt: nowIso(),
    });

    throwIfAborted(input.signal);
    const execution = await this.orchestrator.execute(input.requestId, toolPlan.toolName, toolPlan.input);
    for (const event of execution.events) {
      if (event.type === "agent.started" || event.type === "agent.completed") continue;
      this.emit(event);
    }

    this.updateStep(input.requestId, run.id, toolStep.id, {
      status: "completed",
      output: execution.result.output,
      completedAt: nowIso(),
    });
    this.createStep(input.requestId, run.id, {
      kind: "hook",
      status: "completed",
      title: "after_tool",
      detail: `${toolPlan.toolName} concluída.`,
    });

    return execution.result.output;
  }

  private recordObservation(input: RunInput, observation: unknown) {
    this.createStep(input.requestId, input.runId, {
      kind: "observation",
      status: "completed",
      title: "Observação",
      detail: "Resultado auditado; próximos passos definidos antes da resposta final.",
      output: {
        preview: stringifyOutput(observation).slice(0, 1200),
        ...(typeof observation === "object" && observation !== null
          ? (observation as Record<string, unknown>)
          : {}),
      },
      completedAt: nowIso(),
    });
  }

  private async finishWorkflow(input: RunInput, observations: unknown[]): Promise<WorkflowRun> {
    const run = getWorkflowRun(getDb(), input.runId) as WorkflowRun;
    const responseStep = this.createStep(input.requestId, run.id, {
      kind: "response",
      status: "running",
      title: "Resposta final",
      detail: "Sintetizando resultado.",
      input: {
        prompt: input.prompt,
        observations,
      },
      startedAt: nowIso(),
    });

    throwIfAborted(input.signal);
    const result = await this.generateFinalResponse(input, observations);
    this.updateStep(input.requestId, run.id, responseStep.id, {
      status: "completed",
      output: { result },
      completedAt: nowIso(),
    });
    this.createStep(input.requestId, run.id, {
      kind: "hook",
      status: "completed",
      title: "before_finish",
      detail: "Workflow pronto para encerrar.",
    });
    updateWorkflowRun(getDb(), run.id, {
      status: "completed",
      currentStep: this.nextStepIndex(run.id) - 1,
      result,
      completedAt: nowIso(),
    });
    this.emit({ type: "workflow.completed", requestId: input.requestId, runId: run.id, status: "completed" });
    return getWorkflowRun(getDb(), run.id) as WorkflowRun;
  }

  private async generateFinalResponse(input: RunInput, observations: unknown[]) {
    const provider = this.getLlmProvider();
    const model = this.getActiveModel() || "gpt-4o";
    if (provider.name === "mock") {
      const result =
        observations.length > 0
          ? `[Workflow] Concluído. Pedido: "${input.prompt}". Observações: ${observations.map(stringifyOutput).join(" | ")}`
          : `[Workflow] Concluído. Pedido: "${input.prompt}".`;
      for (const word of result.split(" ")) {
        throwIfAborted(input.signal);
        this.emit({ type: "agent.chunk", requestId: input.requestId, chunk: `${word} ` });
      }
      return result;
    }

    const history = input.history ?? [];
    let result = "";
    let emittedChunk = false;
    for await (const chunk of provider.stream({
      model,
      temperature: 0.3,
      signal: input.signal,
      messages: [
        {
          role: "system",
          content: `Você é o Helix em modo workflow. Responda de forma objetiva em Markdown, explicando o resultado e próximos passos quando útil.

REGRAS DE FORMATAÇÃO
- Escreva em Markdown válido.
- Espaço após pontuação (pontos, vírgulas, dois-pontos, ponto-e-vírgula, exclamação, interrogação).
- Parágrafos separados por uma linha em branco.
- Headings, listas e blocos de código separados do texto por uma linha em branco.
- Palavras separadas por espaço; nunca concatene palavras.
- Use **negrito**, *itálico* e \`código\` para formatação inline.
- Todo código, comando shell, HTML, JSON, etc. deve estar em um bloco fenced code com linguagem: \`\`\`linguagem ... \`\`\`.
- Linguagens preferidas: bash (ou sh), html, javascript, typescript, python, json, css, markdown.
- A primeira linha do bloco deve ser apenas \`\`\`linguagem; nunca coloque código na mesma linha.
- Não use blocos indentados; sempre fenced blocks.`,
        },
        ...history,
        {
          role: "user",
          content: `Pedido: ${input.prompt}\nClipboard: ${input.clipboardText || "(vazio)"}\nObservações:\n${observations.map(stringifyOutput).join("\n\n")}`,
        },
      ],
    })) {
      throwIfAborted(input.signal);
      if (chunk.content) {
        result += chunk.content;
        emittedChunk = true;
        this.emit({ type: "agent.chunk", requestId: input.requestId, chunk: chunk.content });
      }
    }

    const finalResult = result || "Workflow concluído sem conteúdo retornado.";
    if (!emittedChunk) {
      this.emit({ type: "agent.chunk", requestId: input.requestId, chunk: finalResult });
    }
    return finalResult;
  }

  private async selectTool(input: RunInput, observations: unknown[]): Promise<ToolPlan | null> {
    const keywordPlan = this.selectToolKeyword(input.prompt, input.clipboardText, observations);
    if (keywordPlan) return keywordPlan;

    return this.selectToolWithLlm(input, observations);
  }

  private selectToolKeyword(prompt: string, clipboardText: string, observations: unknown[]): ToolPlan | null {
    if (observations.length > 0) return null;

    const query = normalize(prompt);
    const hasClipboard = clipboardText.trim().length > 0;
    const urlMatch = prompt.match(/https?:\/\/[^\s]+/i);

    if (hasClipboard && (query.includes("melhor") || query.includes("rewrite") || query.includes("corrig"))) {
      return {
        toolName: "text.rewrite",
        reason: "Melhorar texto do clipboard.",
        input: { text: clipboardText, instruction: prompt },
      };
    }
    if (hasClipboard && query.includes("resum")) {
      return {
        toolName: "text.summarize",
        reason: "Resumir texto do clipboard.",
        input: { text: clipboardText, style: "bullets" },
      };
    }
    if (hasClipboard && query.includes("traduz")) {
      return {
        toolName: "text.translate",
        reason: "Traduzir texto do clipboard.",
        input: { text: clipboardText, targetLanguage: "inglês" },
      };
    }
    if (urlMatch) {
      return {
        toolName: "web.extract",
        reason: "Ler e normalizar conteúdo de uma URL com Jina Reader.",
        input: { url: urlMatch?.[0] ?? prompt.trim(), maxCharacters: 8000, provider: "jina" },
      };
    }
    if (
      query.includes("pesquis") ||
      query.includes("buscar") ||
      query.includes("notícia") ||
      query.includes("web")
    ) {
      return {
        toolName: "web.search",
        reason: "Buscar contexto atual com Jina Search.",
        input: { query: prompt, maxResults: 5, provider: "jina" },
      };
    }
    if (query.includes("ocr") || query.includes("screenshot") || query.includes("tela")) {
      return {
        toolName: "ocr.screenshot",
        reason: "Ler conteúdo visual da tela.",
        input: { instruction: prompt },
      };
    }

    return null;
  }

  private async selectToolWithLlm(input: RunInput, observations: unknown[]): Promise<ToolPlan | null> {
    const provider = this.getLlmProvider();
    if (provider.name === "mock") return null;

    const tools = registry.list();
    const toolCatalog = tools
      .map((t) => `- ${t.name}: ${t.description} (categoria: ${t.category})`)
      .join("\n");

    const systemPrompt = [
      "Você é um seletor de ferramentas para workflow multi-step. Analise o pedido, o histórico e as observações já coletadas.",
      'Responda APENAS com JSON no formato: {"toolName": "...", "reason": "...", "input": {...}}',
      'Se nenhuma ferramenta for mais necessária, responda: {"toolName": null, "reason": "resposta direta", "input": {}}',
      "Não use blocos de código markdown, apenas o JSON puro.",
      "",
      "Ferramentas disponíveis:",
      toolCatalog,
    ].join("\n");

    const userMessage = [
      `Pedido: ${input.prompt}`,
      `Clipboard: ${input.clipboardText || "(vazio)"}`,
      observations.length > 0
        ? `Observações já coletadas:\n${observations.map(stringifyOutput).join("\n\n")}`
        : "",
    ].join("\n");

    try {
      throwIfAborted(input.signal);
      const history = input.history ?? [];
      const result = await provider.complete({
        model: this.getActiveModel() || "gpt-4o",
        temperature: 0,
        signal: input.signal,
        messages: [
          { role: "system", content: systemPrompt },
          ...history,
          { role: "user", content: userMessage },
        ],
      });

      const content = result.content.trim();
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;

      const parsed = JSON.parse(jsonMatch[0]) as {
        toolName: string | null;
        reason?: string;
        input?: unknown;
      };

      if (!parsed.toolName) return null;

      const tool = registry.get(parsed.toolName);
      if (!tool) return null;

      return {
        toolName: parsed.toolName,
        reason: parsed.reason ?? `Usar ${parsed.toolName} conforme decisão do LLM.`,
        input: parsed.input ?? {},
      };
    } catch {
      return null;
    }
  }

  private createStep(
    requestId: string,
    runId: string,
    params: {
      kind: WorkflowStepKind;
      status: WorkflowStepStatus;
      title: string;
      detail?: string;
      toolName?: string;
      permissionLevel?: PermissionLevel;
      input?: unknown;
      output?: unknown;
      errorMessage?: string;
      requiresApproval?: boolean;
      startedAt?: string;
      completedAt?: string;
    },
  ): WorkflowStep {
    const stepIndex = this.nextStepIndex(runId);
    const id = createWorkflowStep(getDb(), {
      runId,
      stepIndex,
      ...params,
    });
    updateWorkflowRun(getDb(), runId, { currentStep: stepIndex });
    const step = listWorkflowSteps(getDb(), runId).find((item) => item.id === id) as WorkflowStep;
    this.emit({ type: "workflow.step", requestId, runId, step });
    return step;
  }

  private updateStep(
    requestId: string,
    runId: string,
    stepId: string,
    params: {
      status?: WorkflowStepStatus;
      detail?: string;
      output?: unknown;
      errorMessage?: string | null;
      requiresApproval?: boolean;
      startedAt?: string | null;
      completedAt?: string | null;
    },
  ): WorkflowStep {
    updateWorkflowStep(getDb(), stepId, params);
    const step = listWorkflowSteps(getDb(), runId).find((item) => item.id === stepId) as WorkflowStep;
    this.emit({ type: "workflow.step", requestId, runId, step });
    return step;
  }

  private nextStepIndex(runId: string) {
    const steps = listWorkflowSteps(getDb(), runId);
    return steps.length === 0 ? 1 : Math.max(...steps.map((step) => step.stepIndex)) + 1;
  }
}
