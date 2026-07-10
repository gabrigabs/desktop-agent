import { randomUUID } from "node:crypto";
import type { LlmProvider } from "@desktop-agent/provider-gateway";
import type {
  ExecutionMode,
  Skill,
  WorkflowStepTemplate,
  WorkflowTemplate,
  WorkflowTemplateSettings,
} from "@desktop-agent/shared";
import { ToolExecutor } from "./ToolExecutor";

type ToolPlan = {
  toolName: string;
  input: unknown;
  reason: string;
};

type WorkflowStepTemplateInput = Omit<
  WorkflowStepTemplate,
  "id" | "templateId" | "stepIndex" | "createdAt" | "updatedAt"
>;

export type WorkflowPlannerConfig = {
  getLlmProvider: () => LlmProvider;
  getActiveModel: () => string;
};

export class WorkflowPlanner {
  constructor(private config: WorkflowPlannerConfig) {}

  async plan(input: {
    prompt: string;
    clipboard: string;
    history?: { role: "user" | "assistant" | "system"; content: string }[];
    mode: ExecutionMode;
    maxSteps?: number;
    settings?: WorkflowTemplateSettings;
    skill?: Skill | null;
  }): Promise<WorkflowTemplate> {
    const settings = input.settings ?? {};
    const mode = input.mode;
    const maxSteps = settings.maxSteps ?? input.maxSteps ?? 8;
    const toolAllowlist = settings.toolAllowlist;
    const approvalThreshold = settings.approvalThreshold ?? "all";
    const temperature = settings.temperature ?? 0.3;
    const model = settings.model ?? (this.config.getActiveModel() || "gpt-4o");
    const providerId = settings.providerId ?? this.config.getLlmProvider().name;
    const systemPrompt = settings.systemPrompt ?? "";

    if (input.skill) {
      return this.planFromSkill(input, input.skill, settings);
    }

    if (mode === "simple") {
      return this.createTemplate({
        settings: {
          mode,
          maxSteps,
          approvalThreshold,
          toolAllowlist,
          temperature,
          model,
          providerId,
          systemPrompt,
        },
        steps: [
          {
            name: "Resposta",
            kind: "llm",
            config: {
              system: systemPrompt,
              prompt: input.clipboard.trim()
                ? "{{$prompt}}\n\nContexto do clipboard:\n{{$clipboard}}"
                : "{{$prompt}}",
              model,
              temperature,
            },
          },
        ],
      });
    }

    const toolPlan = await this.selectTool(input, toolAllowlist);

    if (!toolPlan) {
      return this.createTemplate({
        settings: {
          mode,
          maxSteps,
          approvalThreshold,
          toolAllowlist,
          temperature,
          model,
          providerId,
          systemPrompt,
        },
        steps: [
          {
            name: "Resposta",
            kind: "llm",
            config: {
              system: systemPrompt,
              prompt: input.clipboard.trim()
                ? "{{$prompt}}\n\nContexto do clipboard:\n{{$clipboard}}"
                : "{{$prompt}}",
              model,
              temperature,
            },
          },
        ],
      });
    }

    const toolStep = this.toolStepFromPlan(toolPlan, temperature);
    const steps: WorkflowStepTemplateInput[] = [
      toolStep,
      {
        name: "Resposta final",
        kind: "llm",
        config: {
          system: systemPrompt,
          prompt: "Responda ao usuário com base no resultado abaixo:\n\n{{step[1].output}}",
          model,
          temperature,
        },
      },
    ];

    return this.createTemplate({
      settings: {
        mode,
        maxSteps,
        approvalThreshold,
        toolAllowlist,
        temperature,
        model,
        providerId,
        systemPrompt,
      },
      steps,
    });
  }

  private async planFromSkill(
    input: {
      prompt: string;
      clipboard: string;
      history?: { role: "user" | "assistant" | "system"; content: string }[];
      mode: ExecutionMode;
      settings?: WorkflowTemplateSettings;
    },
    skill: Skill,
    settings: WorkflowTemplateSettings,
  ): Promise<WorkflowTemplate> {
    const temperature = settings.temperature ?? 0.3;
    const model = settings.model ?? (this.config.getActiveModel() || "gpt-4o");
    const providerId = settings.providerId ?? this.config.getLlmProvider().name;

    return this.createTemplate({
      settings: {
        mode: input.mode,
        maxSteps: settings.maxSteps ?? 8,
        approvalThreshold: settings.approvalThreshold ?? "all",
        toolAllowlist: skill.toolAllowlist ?? settings.toolAllowlist,
        temperature,
        model,
        providerId,
        systemPrompt: skill.systemPrompt ?? settings.systemPrompt,
      },
      steps: [
        {
          name: skill.name,
          kind: "skill",
          config: {
            skillId: skill.id,
            args: input.clipboard.trim()
              ? { prompt: "{{$prompt}}", clipboard: "{{$clipboard}}" }
              : { prompt: "{{$prompt}}" },
            model,
            temperature,
          },
        },
      ],
    });
  }

  private createTemplate(params: {
    settings: WorkflowTemplateSettings;
    steps: WorkflowStepTemplateInput[];
  }): WorkflowTemplate {
    const now = new Date().toISOString();
    return {
      id: randomUUID(),
      name: "Plano gerado",
      description: "Workflow gerado automaticamente para a requisição.",
      prompt: "",
      settings: params.settings,
      mode: params.settings.mode ?? "workflow",
      maxSteps: params.settings.maxSteps ?? 8,
      enabled: true,
      createdAt: now,
      updatedAt: now,
      steps: params.steps.map((step, index) => ({
        ...step,
        id: randomUUID(),
        templateId: "",
        stepIndex: index + 1,
        createdAt: now,
        updatedAt: now,
      })),
    };
  }

  private toolStepFromPlan(toolPlan: ToolPlan, temperature: number): WorkflowStepTemplateInput {
    if (toolPlan.toolName.startsWith("mcp.")) {
      const parts = toolPlan.toolName.split(".");
      const serverId = parts[1] ?? "";
      const mcpToolName = parts.slice(2).join(".");
      return {
        name: `MCP ${mcpToolName}`,
        kind: "mcp",
        config: {
          serverId,
          toolName: mcpToolName,
          args: toolPlan.input,
          temperature,
        },
      };
    }

    return {
      name: toolPlan.toolName,
      kind: "tool",
      config: {
        toolName: toolPlan.toolName,
        args: toolPlan.input,
        temperature,
      },
    };
  }

  private async selectTool(
    input: {
      prompt: string;
      clipboard: string;
      history?: { role: "user" | "assistant" | "system"; content: string }[];
    },
    allowlist?: string[],
  ): Promise<ToolPlan | null> {
    const keywordPlan = this.selectToolKeyword(input.prompt, input.clipboard);
    if (keywordPlan) {
      if (!allowlist || allowlist.includes(keywordPlan.toolName)) {
        return keywordPlan;
      }
    }

    const provider = this.config.getLlmProvider();
    if (provider.name === "mock") return null;

    const toolExecutor = new ToolExecutor(
      () => {},
      () => provider.name,
    );
    const tools = toolExecutor.list(allowlist);
    if (tools.length === 0) return null;

    const toolCatalog = tools
      .map((t) => `- ${t.name}: ${t.description} (categoria: ${t.category})`)
      .join("\n");
    const systemPrompt = [
      "Você é um seletor de ferramentas. Analise o pedido e o clipboard.",
      'Responda APENAS com JSON: {"toolName": "...", "reason": "...", "input": {...}}',
      'Se nenhuma ferramenta for adequada, responda: {"toolName": null, "reason": "...", "input": {}}',
      "Não use blocos markdown.",
      "",
      "Ferramentas disponíveis:",
      toolCatalog,
    ].join("\n");

    const userMessage = [`Pedido: ${input.prompt}`, `Clipboard: ${input.clipboard || "(vazio)"}`].join("\n");

    try {
      const res = await provider.complete({
        model: this.config.getActiveModel() || "gpt-4o",
        temperature: 0,
        signal: undefined,
        messages: [
          { role: "system", content: systemPrompt },
          ...(input.history ?? []),
          { role: "user", content: userMessage },
        ],
      });

      const content = res.content.trim();
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;

      const parsed = JSON.parse(jsonMatch[0]) as {
        toolName: string | null;
        reason?: string;
        input?: unknown;
      };

      if (!parsed.toolName) return null;

      if (allowlist && !allowlist.includes(parsed.toolName)) return null;

      return {
        toolName: parsed.toolName,
        reason: parsed.reason ?? `Usar ${parsed.toolName} conforme decisão do LLM.`,
        input: parsed.input ?? {},
      };
    } catch {
      return null;
    }
  }

  private selectToolKeyword(prompt: string, clipboard: string): ToolPlan | null {
    const query = prompt.toLowerCase();
    const hasClipboard = clipboard.trim().length > 0;
    const urlMatch = prompt.match(/https?:\/\/[^\s]+/i);

    if (hasClipboard && (query.includes("melhor") || query.includes("rewrite") || query.includes("corrig"))) {
      return {
        toolName: "text.rewrite",
        input: { text: clipboard, instruction: prompt },
        reason: "Melhorar texto do clipboard.",
      };
    }
    if (hasClipboard && query.includes("resum")) {
      return {
        toolName: "text.summarize",
        input: { text: clipboard, style: "bullets" },
        reason: "Resumir texto do clipboard.",
      };
    }
    if (hasClipboard && query.includes("traduz")) {
      return {
        toolName: "text.translate",
        input: { text: clipboard, targetLanguage: "inglês" },
        reason: "Traduzir texto do clipboard.",
      };
    }
    if (urlMatch) {
      return {
        toolName: "web.extract",
        input: { url: urlMatch[0], maxCharacters: 8000, provider: "jina" },
        reason: "Ler conteúdo de URL.",
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
        input: { query: prompt, maxResults: 5, provider: "jina" },
        reason: "Buscar contexto na web.",
      };
    }
    if (query.includes("ocr") || query.includes("screenshot") || query.includes("tela")) {
      return {
        toolName: "ocr.screenshot",
        input: { instruction: prompt },
        reason: "Ler conteúdo visual da tela.",
      };
    }

    return null;
  }
}
