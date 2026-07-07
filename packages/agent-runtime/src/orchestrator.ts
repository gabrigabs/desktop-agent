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

export type OrchestratorConfig = {
  provider: LlmProvider;
  model?: string;
  dbPath?: string;
};

function loadActiveProfile() {
  const db = getDb();
  const id = getSetting(db, "activeProfileId");
  if (!id) return null;
  return getAgentProfile(db, id);
}

export type ExecutionResult = {
  result: ToolResult;
  events: AgentEvent[];
};

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw new Error("Execução abortada pelo usuário.");
  }
}

async function sleep(ms: number, signal?: AbortSignal) {
  await new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error("Execução abortada pelo usuário."));
      return;
    }

    const timeout = setTimeout(() => {
      signal?.removeEventListener("abort", abort);
      resolve();
    }, ms);

    const abort = () => {
      clearTimeout(timeout);
      reject(new Error("Execução abortada pelo usuário."));
    };

    signal?.addEventListener("abort", abort, { once: true });
  });
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
    emit: (event: AgentEvent) => void,
    getLlmProviderFn: () => any,
    getActiveModelFn: () => string,
    signal?: AbortSignal,
  ): Promise<string> {
    emit({ type: "agent.started", requestId });
    throwIfAborted(signal);

    const provider = getLlmProviderFn();
    const model = getActiveModelFn() || "gpt-4o";

    const tools = registry.list();
    const toolsList = tools.map((t) => `- ${t.name}: ${t.description}`).join("\n");

    const profile = loadActiveProfile();
    const profileParts: string[] = [];
    if (profile) {
      if (profile.systemPrompt) profileParts.push(profile.systemPrompt);
      if (profile.tone) profileParts.push(`Tom: ${profile.tone}.`);
      if (profile.responseStyle) profileParts.push(`Estilo de resposta: ${profile.responseStyle}.`);
      if (profile.constraints) profileParts.push(`Restrições: ${profile.constraints}.`);
    }
    const profileInstructions = profileParts.length > 0 ? `\n${profileParts.join("\n")}\n` : "";

    const systemPrompt = `Você é o "Helix", um agente pessoal leve rodando no desktop do usuário.
Você pode receber um pedido livre do usuário, o conteúdo atual do clipboard e acesso a ferramentas locais.

Seu objetivo é ajudar o usuário com seu comando.
Analise a requisição do usuário e use o clipboard apenas quando ele for relevante e não estiver vazio.
Se o clipboard estiver vazio, irrelevante ou a tarefa for uma pergunta geral, responda diretamente preenchendo o campo "directResponse".
Se precisar usar uma ferramenta local para processar texto do clipboard, selecione a ferramenta apropriada no JSON de resposta.
Não invente conteúdo de clipboard quando ele vier vazio.
${profileInstructions}
Ferramentas disponíveis:
${toolsList}

IMPORTANTE: Você deve responder ESTRITAMENTE com um objeto JSON no formato abaixo, sem blocos de código markdown ou texto extra:
{
  "thought": "Explicação passo a passo do que você está fazendo",
  "toolName": "nome.da.ferramenta" ou null,
  "toolInput": { ... argumentos da ferramenta ... } ou null,
  "directResponse": "sua resposta final legível para o usuário" ou null
}
`;

    const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `Comando do usuário: "${query}"\nConteúdo do clipboard (${clipboardText ? `${clipboardText.length} caracteres` : "vazio"}): "${clipboardText}"`,
      },
    ];

    let steps = 0;
    const maxSteps = 5;
    let finalResult = "";

    while (steps < maxSteps) {
      steps++;
      throwIfAborted(signal);

      if (provider.name === "mock") {
        emit({ type: "agent.thought", requestId, thought: "Analisando comando no modo mock..." });
        await sleep(600, signal);

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
            thought: `Executando ferramenta ${selectedTool} para a requisição: ${query}`,
          });
          await sleep(600, signal);
          throwIfAborted(signal);
          const executionResult = await this.execute(requestId, selectedTool, {
            text: clipboardText,
            instruction: query,
          });
          const text =
            (executionResult.result.output as any).rewritten ||
            (executionResult.result.output as any).summary ||
            (executionResult.result.output as any).translation ||
            JSON.stringify(executionResult.result.output);

          const words = text.split(" ");
          let acc = "";
          for (const word of words) {
            throwIfAborted(signal);
            const chunk = `${word} `;
            acc += chunk;
            emit({ type: "agent.chunk", requestId, chunk });
            await sleep(20, signal);
          }
          finalResult = acc;
        } else {
          const text = `[Mock] Executado com sucesso. Comando: "${query}". Clipboard: "${clipboardText.slice(0, 50)}".`;
          const words = text.split(" ");
          let acc = "";
          for (const word of words) {
            throwIfAborted(signal);
            const chunk = `${word} `;
            acc += chunk;
            emit({ type: "agent.chunk", requestId, chunk });
            await sleep(20, signal);
          }
          finalResult = acc;
        }
        break;
      }

      emit({ type: "agent.thought", requestId, thought: "Pensando na próxima ação..." });
      throwIfAborted(signal);
      const res = await provider.complete({
        model,
        messages,
        temperature: 0.2,
        signal,
      });

      const responseText = res.content.trim();
      let parsed: {
        thought: string;
        toolName: string | null;
        toolInput: any;
        directResponse: string | null;
      };

      try {
        const jsonText = responseText
          .replace(/```json/g, "")
          .replace(/```/g, "")
          .trim();
        parsed = JSON.parse(jsonText);
      } catch (err) {
        console.error("Failed to parse agent JSON response:", responseText, err);
        parsed = {
          thought: "Falha ao analisar JSON. Tratando como resposta direta.",
          toolName: null,
          toolInput: null,
          directResponse: responseText,
        };
      }

      if (parsed.thought) {
        emit({ type: "agent.thought", requestId, thought: parsed.thought });
      }

      if (parsed.toolName) {
        emit({ type: "agent.thought", requestId, thought: `Executando ferramenta: ${parsed.toolName}` });
        try {
          throwIfAborted(signal);
          const execution = await this.execute(requestId, parsed.toolName, parsed.toolInput);
          const outputString = JSON.stringify(execution.result.output);

          messages.push({
            role: "assistant",
            content: JSON.stringify(parsed),
          });
          messages.push({
            role: "user",
            content: `Resultado da ferramenta ${parsed.toolName}: ${outputString}`,
          });
        } catch (toolErr) {
          const errorMsg = toolErr instanceof Error ? toolErr.message : String(toolErr);
          messages.push({
            role: "assistant",
            content: JSON.stringify(parsed),
          });
          messages.push({
            role: "user",
            content: `Erro ao executar ferramenta ${parsed.toolName}: ${errorMsg}`,
          });
        }
      } else {
        emit({ type: "agent.thought", requestId, thought: "Gerando resposta final com streaming..." });
        const finalMessages = [
          {
            role: "system",
            content:
              "Você é o AI Desktop Core. Escreva a resposta final direta para o usuário baseando-se no histórico e na requisição do usuário. Escreva em formato Markdown claro e objetivo, sem encapsular em blocos de código JSON.",
          },
          ...messages.slice(1),
          {
            role: "assistant",
            content: parsed.thought ? `Pensamento: ${parsed.thought}` : "",
          },
        ];

        let accumulatedText = "";
        for await (const chunk of provider.stream({
          model,
          messages: finalMessages,
          temperature: 0.3,
          signal,
        })) {
          throwIfAborted(signal);
          if (chunk.content) {
            accumulatedText += chunk.content;
            emit({ type: "agent.chunk", requestId, chunk: chunk.content });
          }
        }
        finalResult = accumulatedText || parsed.directResponse || responseText;
        break;
      }
    }

    if (!finalResult) {
      finalResult = "Não foi possível obter uma resposta do agente.";
    }

    emit({ type: "agent.completed", requestId });
    return finalResult;
  }

  shutdown(): void {
    closeDb();
  }
}
