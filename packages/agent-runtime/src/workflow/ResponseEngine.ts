import type { LlmProvider } from "@desktop-agent/provider-gateway";
import type { AgentEvent } from "@desktop-agent/shared";
import type { SupportedLanguage } from "../i18n";
import { t } from "../i18n";
import { runAgentLoop } from "./AgentLoop";
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
  _lang: SupportedLanguage,
): Promise<string> {
  const { provider, model, toolExecutor, emit, signal } = config;
  const temperature = config.temperature ?? 0.2;

  const tools = toolExecutor.list(config.toolAllowlist);
  const toolCatalog = tools.map((t) => `- ${t.name}: ${t.description}`).join("\n");

  const systemPrompt = [
    config.systemPrompt ?? "Você é o Helix, um assistente pessoal local rodando no desktop do usuário.",
    "",
    "CAPACIDADES",
    "- RESPONDA SEMPRE EM PORTUGUÊS (pt-BR), independente do idioma da pergunta.",
    "- NUNCA responda em espanhol. Se o usuário escrever em outro idioma, responda em português.",
    "- Comunique-se de forma clara e objetiva.",
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
    "- Ferramentas de arquivo/diretório só acessam caminhos autorizados.",
    "- Não descreva seu raciocínio; use ferramentas para obter dados.",
  ].join("\n");

  const messages = [
    ...history,
    {
      role: "user" as const,
      content: `Comando do usuário: "${prompt}"\nConteúdo do clipboard (${clipboardText ? `${clipboardText.length} caracteres` : "vazio"}): "${clipboardText}"`,
    },
  ];

  return runAgentLoop({
    requestId,
    provider,
    model,
    systemPrompt,
    messages,
    toolExecutor,
    emit,
    maxSteps: config.maxSteps ?? 5,
    temperature,
    signal,
  });
}

function _throwIfAborted(signal: AbortSignal | undefined, lang: SupportedLanguage) {
  if (signal?.aborted) {
    throw new Error(t("errors:orchestrator.aborted", lang));
  }
}
