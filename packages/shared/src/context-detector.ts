export type ContextType = "url" | "code" | "error" | "long_text" | "message" | "plain_text";

export type ContextSource = "clipboard";

export interface DetectedContext {
  source: ContextSource;
  type: ContextType;
  confidence: "high" | "medium" | "low";
}

export interface ContextSuggestion {
  type: ContextType;
  label: string;
  prompt: string;
}

const URL_REGEX = /^https?:\/\/\S+/i;

const CODE_INDICATORS = [
  /\bfunction\b/,
  /\bclass\b/,
  /\bconst\b/,
  /\blet\b/,
  /\bvar\b/,
  /=>/,
  /\bimport\b/,
  /\bexport\b/,
  /\{[\s\S]*\}/,
  /;\s*$/m,
];

const ERROR_INDICATORS = [
  /\bError\b/,
  /\bException\b/,
  /\bTraceback\b/,
  /\s+at\s+.+:\d+:\d+/,
  /\s+at\s+\w+/,
  /\([\w./-]+:\d+:\d+\)/,
];

const MESSAGE_INDICATORS = [/^>\s/m, /On .+ wrote:/, /Forwarded message:/i, /From:\s*.+\nTo:\s*.+/];

const LONG_TEXT_THRESHOLD = 800;

function looksLikeCode(text: string): boolean {
  const score = CODE_INDICATORS.reduce((acc, regex) => acc + (regex.test(text) ? 1 : 0), 0);
  return score >= 3 && (text.includes("{") || text.includes("}"));
}

function looksLikeError(text: string): boolean {
  return ERROR_INDICATORS.some((regex) => regex.test(text));
}

function looksLikeMessage(text: string): boolean {
  return MESSAGE_INDICATORS.some((regex) => regex.test(text));
}

export function detectContextType(text: string): ContextType {
  const trimmed = text.trim();
  if (trimmed.length === 0) return "plain_text";

  const firstLine = trimmed.split(/\r?\n/)[0] ?? "";
  if (URL_REGEX.test(firstLine)) return "url";

  if (looksLikeError(trimmed)) return "error";
  if (looksLikeCode(trimmed)) return "code";
  if (looksLikeMessage(trimmed)) return "message";
  if (trimmed.length > LONG_TEXT_THRESHOLD) return "long_text";

  return "plain_text";
}

export function detectContext(text: string, source: ContextSource = "clipboard"): DetectedContext[] {
  const type = detectContextType(text);
  if (type === "plain_text" && text.trim().length === 0) {
    return [];
  }
  return [{ source, type, confidence: "high" }];
}

const SUGGESTIONS_BY_TYPE: Record<ContextType, ContextSuggestion[]> = {
  url: [
    { type: "url", label: "Resumir link", prompt: "Resuma os pontos principais deste link:" },
    { type: "url", label: "Extrair ideias", prompt: "Extraia os pontos-chave deste link:" },
  ],
  code: [
    { type: "code", label: "Explicar código", prompt: "Explique o que este código faz de forma clara:" },
    { type: "code", label: "Comentar código", prompt: "Adicione comentários úteis a este código:" },
  ],
  error: [
    { type: "error", label: "Explicar erro", prompt: "Explique este erro e sugira uma correção:" },
    { type: "error", label: "Depurar", prompt: "Depure este stack trace e indique a causa provável:" },
  ],
  long_text: [
    { type: "long_text", label: "Resumir texto", prompt: "Resuma este texto de forma concisa:" },
    { type: "long_text", label: "Extrair tópicos", prompt: "Extraia os tópicos principais deste texto:" },
  ],
  message: [
    {
      type: "message",
      label: "Responder mensagem",
      prompt: "Escreva uma resposta natural e educada para esta mensagem:",
    },
    { type: "message", label: "Reescrever", prompt: "Reescreva esta mensagem de forma mais clara:" },
  ],
  plain_text: [
    { type: "plain_text", label: "Resumir texto", prompt: "Resuma este texto:" },
    { type: "plain_text", label: "Explicar", prompt: "Explique este texto em linguagem simples:" },
  ],
};

export function getContextSuggestions(type: ContextType): ContextSuggestion[] {
  return SUGGESTIONS_BY_TYPE[type] ?? SUGGESTIONS_BY_TYPE.plain_text;
}
