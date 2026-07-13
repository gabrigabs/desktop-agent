import type { LlmProvider } from "@desktop-agent/provider-gateway";
import type { AgentEvent, ToolResult } from "@desktop-agent/shared";
import { parseAgentDecision, stripThinkingMarkup } from "@desktop-agent/shared";
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

async function emitResponseChunks(
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
- Comunique-se em português, claro e objetivo.

CAPACIDADES
- Recebe o comando do usuário, o conteúdo atual do clipboard e acesso a ferramentas locais.
- Ferramentas disponíveis:
${toolsList}

RESTRIÇÕES
- Use o clipboard apenas quando relevante e não estiver vazio.
- Se o clipboard estiver vazio, irrelevante ou a pergunta for geral, preencha o campo "directResponse".
- Se precisar processar texto do clipboard, escolha a ferramenta apropriada no JSON.
- Não invente conteúdo de clipboard vazio.
- Não execute ações sem a ferramenta correta.
${profileInstructions}

FORMATO DE SAÍDA
Você deve responder ESTRITAMENTE com o JSON abaixo, sem texto adicional ou blocos de código markdown:
{
  "toolName": null,
  "toolInput": null,
  "directResponse": null
}

REGRAS DE FORMATAÇÃO DO CAMPO "directResponse"
- Escreva em Markdown válido.
- Espaço após pontuação (pontos, vírgulas, dois-pontos, ponto-e-vírgula, exclamação, interrogação).
- Parágrafos separados por uma linha em branco.
- Headings separados do texto por uma linha em branco antes e depois.
- Listas e blocos de código separados do texto adjacente por uma linha em branco.
- Palavras separadas por espaço; nunca concatene palavras.
- Use **negrito**, *itálico* e \`código\` para formatação inline.
- Todo código, comando shell, HTML, JSON, etc. deve estar em um bloco fenced code com linguagem identificada: \`\`\`linguagem ... \`\`\`.
- Linguagens preferidas: bash (ou sh), html, javascript, typescript, python, json, css, markdown.
- A primeira linha do bloco deve ser apenas \`\`\`linguagem; nunca coloque código na mesma linha.
- Não use blocos indentados; sempre fenced blocks.
`;

    const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: systemPrompt },
      ...history,
      {
        role: "user",
        content: `Comando do usuário: "${query}"\nConteúdo do clipboard (${clipboardText ? `${clipboardText.length} caracteres` : "vazio"}): "${clipboardText}"`,
      },
    ];

    let steps = 0;
    const maxSteps = 5;
    let finalResult = "";
    let emittedFinalResponse = false;

    while (steps < maxSteps) {
      steps++;
      throwIfAborted(signal, lang);

      if (provider.name === "mock") {
        emit({
          type: "agent.thought",
          requestId,
          thought: t("errors:orchestrator.thinkingNextAction", lang),
        });
        await sleep(600, signal, lang);

        let selectedTool = "";
        const normalizedQuery = query.toLowerCase();
        if (
          normalizedQuery.includes("melhor") ||
          normalizedQuery.includes("rewrite") ||
          normalizedQuery.includes("corrig")
        ) {
          selectedTool = "text.rewrite";
        } else if (normalizedQuery.includes("resum")) {
          selectedTool = "text.summarize";
        } else if (normalizedQuery.includes("traduz")) {
          selectedTool = "text.translate";
        }

        if (selectedTool && clipboardText.trim()) {
          emit({
            type: "agent.thought",
            requestId,
            thought: t("errors:orchestrator.executingTool", lang, { tool: selectedTool, query }),
          });
          await sleep(600, signal, lang);
          throwIfAborted(signal, lang);
          const executionResult = await this.execute(requestId, selectedTool, {
            text: clipboardText,
            instruction: query,
          });
          const output = executionResult.result.output;
          const outputRecord =
            typeof output === "object" && output !== null ? (output as Record<string, unknown>) : {};
          const text =
            [outputRecord.rewritten, outputRecord.summary, outputRecord.translation].find(
              (value): value is string => typeof value === "string",
            ) ?? JSON.stringify(output);

          emittedFinalResponse = true;
          await emitResponseChunks(text, requestId, emit, lang, signal);
          finalResult = text;
        } else {
          const text = `[Mock] Executado com sucesso. Comando: "${query}". Clipboard: "${clipboardText.slice(0, 50)}".`;
          emittedFinalResponse = true;
          await emitResponseChunks(text, requestId, emit, lang, signal);
          finalResult = text;
        }
        break;
      }

      emit({ type: "agent.thought", requestId, thought: t("errors:orchestrator.thinkingNextAction", lang) });
      throwIfAborted(signal, lang);
      const res = await provider.complete({
        model,
        messages,
        temperature: 0.2,
        signal,
      });

      const responseText = res.content.trim();
      const parsed = parseAgentDecision(responseText);
      const decisionMessage = JSON.stringify({
        toolName: parsed.toolName,
        toolInput: parsed.toolInput,
        directResponse: parsed.directResponse,
      });

      if (parsed.toolName) {
        emit({
          type: "agent.thought",
          requestId,
          thought: t("errors:orchestrator.executingTool", lang, { tool: parsed.toolName, query }),
        });
        try {
          throwIfAborted(signal, lang);
          const execution = await this.execute(requestId, parsed.toolName, parsed.toolInput);
          const outputString = JSON.stringify(execution.result.output);

          messages.push({
            role: "assistant",
            content: decisionMessage,
          });
          messages.push({
            role: "user",
            content: `Resultado da ferramenta ${parsed.toolName}: ${outputString}`,
          });
        } catch (toolErr) {
          const errorMsg = toolErr instanceof Error ? toolErr.message : String(toolErr);
          messages.push({
            role: "assistant",
            content: decisionMessage,
          });
          messages.push({
            role: "user",
            content: `Erro ao executar ferramenta ${parsed.toolName}: ${errorMsg}`,
          });
        }
      } else {
        if (parsed.structured && parsed.directResponse?.trim()) {
          finalResult = parsed.directResponse.trim();
        } else {
          emit({ type: "agent.thought", requestId, thought: "Preparando resposta final..." });
          const recovery = await provider.complete({
            model,
            messages: [
              {
                role: "system",
                content: `Você é o Helix. Responda diretamente ao usuário em português.

REGRAS
- Entregue apenas a resposta final em Markdown.
- Não retorne JSON.
- Não descreva seu raciocínio, planejamento, instruções ou processo interno.
- Preserve espaços, parágrafos, listas e blocos de código válidos.`,
              },
              ...history,
              {
                role: "user",
                content: clipboardText.trim()
                  ? `${query}\n\nContexto opcional do clipboard:\n${clipboardText}`
                  : query,
              },
            ],
            temperature: 0.3,
            signal,
          });
          const recoveredDecision = parseAgentDecision(recovery.content);
          finalResult =
            recoveredDecision.directResponse?.trim() ||
            stripThinkingMarkup(recovery.content) ||
            t("errors:orchestrator.finalResponseError", lang);
        }
        emittedFinalResponse = true;
        await emitResponseChunks(finalResult, requestId, emit, lang, signal);
        break;
      }
    }

    if (!finalResult) {
      finalResult = t("errors:orchestrator.responseError", lang);
    }

    if (!emittedFinalResponse) {
      emit({ type: "agent.chunk", requestId, chunk: finalResult });
    }

    emit({ type: "agent.completed", requestId });
    return finalResult;
  }

  shutdown(): void {
    closeDb();
  }
}
