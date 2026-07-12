import type { LlmProvider } from "@desktop-agent/provider-gateway";
import type { AgentEvent } from "@desktop-agent/shared";
import { parseAgentDecision, stripThinkingMarkup } from "@desktop-agent/shared";
import type { SupportedLanguage } from "../i18n";
import { t } from "../i18n";
import type { ToolExecutor } from "./ToolExecutor";

export type ResponseEngineConfig = {
  provider: LlmProvider;
  model: string;
  systemPrompt?: string;
  temperature?: number;
  toolAllowlist?: string[];
  maxSteps?: number;
  emit: (event: AgentEvent) => void;
  toolExecutor: ToolExecutor;
  signal?: AbortSignal;
};

export async function runResponseEngine(
  requestId: string,
  prompt: string,
  clipboardText: string,
  history: { role: "user" | "assistant" | "system"; content: string }[],
  config: ResponseEngineConfig,
  lang: SupportedLanguage,
): Promise<string> {
  const { provider, model, toolExecutor, emit, signal } = config;
  const maxSteps = config.maxSteps ?? 5;
  const temperature = config.temperature ?? 0.2;

  const tools = toolExecutor.list(config.toolAllowlist);
  const toolCatalog = tools.map((t) => `- ${t.name}: ${t.description}`).join("\n");

  const systemPrompt = [
    config.systemPrompt ?? "Você é o Helix, um assistente pessoal local rodando no desktop do usuário.",
    "",
    "CAPACIDADES",
    "- Comunique-se em português, claro e objetivo.",
    "- Você pode usar as ferramentas listadas abaixo quando necessário.",
    "- Se nenhuma ferramenta for necessária, responda diretamente.",
    "- Se o usuário mencionar arquivos anexados e você precisar do conteúdo completo, use a ferramenta agent.file.parse.",
    "",
    "FERRAMENTAS DISPONÍVEIS",
    toolCatalog,
    "",
    "REGRAS",
    "- Use o clipboard apenas quando relevante e não estiver vazio.",
    "- Se arquivos estiverem anexados, o conteúdo de PDFs e documentos binários já foi extraído automaticamente. Use agent.file.parse se precisar de arquivos adicionais.",
    'Responda APENAS com JSON no formato: {"toolName": "...", "toolInput": {...}, "directResponse": null}',
    "Se não for usar ferramenta, use toolName null e directResponse com a resposta final.",
    "Não use blocos de código markdown para o JSON.",
  ].join("\n");

  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: systemPrompt },
    ...history,
    {
      role: "user",
      content: `Comando do usuário: "${prompt}"\nConteúdo do clipboard (${clipboardText ? `${clipboardText.length} caracteres` : "vazio"}): "${clipboardText}"`,
    },
  ];

  let steps = 0;
  let finalResult = "";
  let emittedChunk = false;

  while (steps < maxSteps) {
    steps++;
    throwIfAborted(signal, lang);

    emit({ type: "agent.thought", requestId, thought: t("errors:orchestrator.thinkingNextAction", lang) });

    const res = await provider.complete({
      model,
      messages,
      temperature,
      signal,
    });

    const responseText = res.content.trim();
    const parsed = parseAgentDecision(responseText);

    if (parsed.toolName) {
      const toolName = parsed.toolName;
      emit({
        type: "agent.thought",
        requestId,
        thought: t("errors:orchestrator.executingTool", lang, { tool: toolName, query: prompt }),
      });
      try {
        throwIfAborted(signal, lang);
        const result = await toolExecutor.execute(requestId, toolName, parsed.toolInput ?? {});
        const outputString = JSON.stringify(result.output);

        messages.push({
          role: "assistant",
          content: JSON.stringify({ toolName, toolInput: parsed.toolInput, directResponse: null }),
        });
        messages.push({ role: "user", content: `Resultado da ferramenta ${toolName}: ${outputString}` });
      } catch (toolErr) {
        const errorMsg = toolErr instanceof Error ? toolErr.message : String(toolErr);
        messages.push({
          role: "assistant",
          content: JSON.stringify({ toolName, toolInput: parsed.toolInput, directResponse: null }),
        });
        messages.push({ role: "user", content: `Erro ao executar ferramenta ${toolName}: ${errorMsg}` });
      }
    } else {
      finalResult =
        parsed.directResponse?.trim() ||
        stripThinkingMarkup(responseText) ||
        t("errors:orchestrator.responseError", lang);

      emit({ type: "agent.thought", requestId, thought: t("errors:orchestrator.thinkingNextAction", lang) });
      throwIfAborted(signal, lang);

      for await (const chunk of provider.stream({
        model,
        temperature: 0.3,
        signal,
        messages: [
          {
            role: "system",
            content:
              "Você é o Helix. Responda ao usuário diretamente em Markdown, sem JSON e sem descrever seu raciocínio.",
          },
          ...history,
          {
            role: "user",
            content: clipboardText.trim()
              ? `${prompt}\n\nContexto opcional do clipboard:\n${clipboardText}`
              : prompt,
          },
        ],
      })) {
        throwIfAborted(signal, lang);
        if (chunk.content) {
          emittedChunk = true;
          emit({ type: "agent.chunk", requestId, chunk: chunk.content });
        }
      }

      if (!emittedChunk) {
        emit({ type: "agent.chunk", requestId, chunk: finalResult });
      }

      break;
    }
  }

  return finalResult;
}

function throwIfAborted(signal: AbortSignal | undefined, lang: SupportedLanguage) {
  if (signal?.aborted) {
    throw new Error(t("errors:orchestrator.aborted", lang));
  }
}
