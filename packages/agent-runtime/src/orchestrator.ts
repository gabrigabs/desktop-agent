import type { LlmProvider } from "@desktop-agent/provider-gateway";
import type { AgentEvent, ToolResult } from "@desktop-agent/shared";
import {
  closeDb,
  createInteraction,
  getAgentProfile,
  getDb,
  getSetting,
  runMigrations,
} from "@desktop-agent/storage";
import { registry } from "@desktop-agent/tool-registry";
import type { SupportedLanguage } from "./i18n";
import { t } from "./i18n";
import { runAgentLoop } from "./workflow/AgentLoop";
import { ToolExecutor } from "./workflow/ToolExecutor";

export type OrchestratorConfig = {
  provider: LlmProvider;
  model?: string;
  dbPath?: string;
};

function loadProfile(profileId?: string) {
  const db = getDb();
  if (profileId) {
    return getAgentProfile(db, profileId);
  }
  const id = getSetting(db, "activeProfileId");
  if (!id) return null;
  return getAgentProfile(db, id);
}

export type ExecutionResult = {
  result: ToolResult;
  events: AgentEvent[];
};

function throwIfAborted(signal: AbortSignal | undefined, lang: SupportedLanguage) {
  if (signal?.aborted) {
    throw new Error(t("errors:orchestrator.aborted", lang));
  }
}

async function sleep(ms: number, signal: AbortSignal | undefined, lang: SupportedLanguage) {
  await new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error(t("errors:orchestrator.aborted", lang)));
      return;
    }

    const timeout = setTimeout(() => {
      signal?.removeEventListener("abort", abort);
      resolve();
    }, ms);

    const abort = () => {
      clearTimeout(timeout);
      reject(new Error(t("errors:orchestrator.aborted", lang)));
    };

    signal?.addEventListener("abort", abort, { once: true });
  });
}

async function _emitResponseChunks(
  text: string,
  requestId: string,
  emit: (event: AgentEvent) => void,
  lang: SupportedLanguage,
  signal?: AbortSignal,
) {
  const characters = Array.from(text);
  const chunkSize = 56;

  for (let index = 0; index < characters.length; index += chunkSize) {
    throwIfAborted(signal, lang);
    emit({
      type: "agent.chunk",
      requestId,
      chunk: characters.slice(index, index + chunkSize).join(""),
    });
    if (index + chunkSize < characters.length) await sleep(8, signal, lang);
  }
}

export class Orchestrator {
  private provider: LlmProvider;
  private model: string;

  constructor(config: OrchestratorConfig) {
    this.provider = config.provider;
    this.model = config.model ?? "gpt-4o";

    const db = getDb(config.dbPath);
    runMigrations(db);
  }

  async execute(requestId: string, toolName: string, input: unknown): Promise<ExecutionResult> {
    const events: AgentEvent[] = [];

    const emit = (event: AgentEvent) => events.push(event);
    emit({ type: "agent.started", requestId });

    const tool = registry.get(toolName);
    if (!tool) {
      emit({
        type: "tool.failed",
        requestId,
        toolName,
        error: `Unknown tool: ${toolName}`,
      });
      emit({ type: "agent.completed", requestId });
      throw new Error(`Unknown tool: ${toolName}`);
    }

    // This compatibility executor has no step-bound approval channel. Sensitive
    // native tools must therefore fail closed instead of bypassing the central
    // WorkflowRunner/ToolExecutor grant flow.
    if (tool.executionPolicy === "explicit_approval") {
      const error = "EXPLICIT_APPROVAL_REQUIRED: this tool needs a step-bound approval grant";
      emit({ type: "tool.failed", requestId, toolName, error });
      emit({ type: "agent.completed", requestId });
      throw new Error(error);
    }

    emit({ type: "tool.started", requestId, toolName });
    const startedAt = Date.now();

    try {
      const output = await tool.handler(input);
      const durationMs = Date.now() - startedAt;

      emit({ type: "tool.completed", requestId, toolName });

      const result: ToolResult = {
        toolName,
        input,
        output,
        providerId: this.provider.name,
        durationMs,
      };

      try {
        createInteraction(getDb(), {
          toolName,
          providerId: this.provider.name,
          permissionLevel: tool.permissionLevel,
          inputPreview: JSON.stringify(input).slice(0, 500),
          outputPreview: JSON.stringify(output).slice(0, 500),
          durationMs,
          success: true,
        });
      } catch {
        // Audit log failure is non-fatal
      }

      emit({ type: "agent.completed", requestId });
      return { result, events };
    } catch (err) {
      const durationMs = Date.now() - startedAt;
      const errorMessage = err instanceof Error ? err.message : String(err);

      emit({ type: "tool.failed", requestId, toolName, error: errorMessage });

      try {
        createInteraction(getDb(), {
          toolName,
          providerId: this.provider.name,
          permissionLevel: tool.permissionLevel,
          inputPreview: JSON.stringify(input).slice(0, 500),
          outputPreview: "",
          durationMs,
          success: false,
          errorMessage,
        });
      } catch {
        // Audit log failure is non-fatal
      }

      emit({ type: "agent.completed", requestId });
      throw err;
    }
  }

  async *streamExecute(requestId: string, toolName: string, input: unknown): AsyncIterable<AgentEvent> {
    yield { type: "agent.started", requestId };

    const tool = registry.get(toolName);
    if (!tool) {
      yield {
        type: "tool.failed",
        requestId,
        toolName,
        error: `Unknown tool: ${toolName}`,
      };
      yield { type: "agent.completed", requestId };
      return;
    }

    yield { type: "tool.started", requestId, toolName };

    try {
      const handlerFn = tool.streamHandler ?? tool.handler;
      const res = await handlerFn(input);
      if (res && typeof res === "object" && Symbol.asyncIterator in res) {
        for await (const _chunk of res as AsyncIterable<unknown>) {
          yield { type: "tool.completed", requestId, toolName };
        }
      } else {
        yield { type: "tool.completed", requestId, toolName };
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      yield { type: "tool.failed", requestId, toolName, error: errorMessage };
    }

    yield { type: "agent.completed", requestId };
  }

  async runAgent(
    requestId: string,
    query: string,
    clipboardText: string,
    history: { role: "user" | "assistant" | "system"; content: string }[],
    emit: (event: AgentEvent) => void,
    getLlmProviderFn: () => LlmProvider,
    getActiveModelFn: () => string,
    lang: SupportedLanguage,
    signal?: AbortSignal,
    profileId?: string,
  ): Promise<string> {
    emit({ type: "agent.started", requestId });
    throwIfAborted(signal, lang);

    const provider = getLlmProviderFn();
    const model = getActiveModelFn() || "gpt-4o";

    const tools = registry.list();
    const toolsList = tools.map((t) => `- ${t.name}: ${t.description}`).join("\n");

    const profile = loadProfile(profileId);
    const profileParts: string[] = [];
    if (profile) {
      if (profile.systemPrompt) profileParts.push(profile.systemPrompt);
      if (profile.tone) profileParts.push(`Tom: ${profile.tone}.`);
      if (profile.responseStyle) profileParts.push(`Estilo de resposta: ${profile.responseStyle}.`);
      if (profile.constraints) profileParts.push(`Restrições: ${profile.constraints}.`);
    }
    const profileInstructions = profileParts.length > 0 ? `\n${profileParts.join("\n")}\n` : "";

    const systemPrompt = `Você é o "Helix", um agente pessoal leve rodando no desktop do usuário.

IDENTIDADE
- Você é o Helix, assistente pessoal local.
- RESPONDA SEMPRE EM PORTUGUÊS (pt-BR), independente do idioma da pergunta.
- NUNCA responda em espanhol. Se o usuário escrever em outro idioma, responda em português.
- Comunique-se de forma clara e objetiva.

CAPACIDADES
- Recebe o comando do usuário, o conteúdo atual do clipboard e acesso a ferramentas locais.
- Ferramentas disponíveis:
${toolsList}

RESTRIÇÕES
- Use o clipboard apenas quando relevante e não estiver vazio.
- Não invente conteúdo de clipboard vazio.
- Não execute ações sem a ferramenta correta.
- Arquivos/diretórios só podem ser lidos dentro das pastas autorizadas.
${profileInstructions}

REGRAS DE FORMATAÇÃO
- Escreva em Markdown válido.
- Espaço após pontuação.
- Parágrafos separados por uma linha em branco.
- Headings, listas e blocos de código separados do texto por uma linha em branco.
- Palavras separadas por espaço; nunca concatene palavras.
- Use **negrito**, *itálico* e \`código\` inline.
- Todo código, comando, JSON, etc. deve estar em bloco fenced code com linguagem identificada.
- Não descreva seu raciocínio ou processo interno; use ferramentas para obter dados.
`;

    const messages = [
      ...history,
      {
        role: "user" as const,
        content: `Comando do usuário: "${query}"\nConteúdo do clipboard (${clipboardText ? `${clipboardText.length} caracteres` : "vazio"}): "${clipboardText}"`,
      },
    ];

    const toolExecutor = new ToolExecutor(
      (event) => {
        if (event.type === "agent.started" || event.type === "agent.completed") return;
        emit(event);
      },
      () => provider.name,
    );

    const result = await runAgentLoop({
      requestId,
      provider,
      model,
      systemPrompt,
      messages,
      toolExecutor,
      emit,
      maxSteps: 5,
      temperature: 0.2,
      signal,
    });

    emit({ type: "agent.completed", requestId });
    return result;
  }

  shutdown(): void {
    closeDb();
  }
}
