export type AgentDecision = {
  toolName: string | null;
  toolInput: unknown;
  directResponse: string | null;
  structured: boolean;
};

function unwrapJsonFence(text: string): string {
  const match = text.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i);
  return match?.[1]?.trim() ?? text;
}

function toAgentDecision(value: unknown): AgentDecision | null {
  if (typeof value === "string") {
    try {
      return toAgentDecision(JSON.parse(value));
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const record = value as Record<string, unknown>;
  const fields = Object.keys(record);
  const hasDecisionField = ["toolName", "toolInput", "directResponse"].some((field) =>
    fields.includes(field),
  );
  if (!hasDecisionField) return null;

  return {
    toolName: typeof record.toolName === "string" && record.toolName.trim() ? record.toolName : null,
    toolInput: record.toolInput ?? null,
    directResponse: typeof record.directResponse === "string" ? record.directResponse : null,
    structured: true,
  };
}

function parseJsonDecision(text: string): AgentDecision | null {
  try {
    return toAgentDecision(JSON.parse(text));
  } catch {
    return null;
  }
}

function extractEmbeddedDecisions(text: string): AgentDecision[] {
  const decisions: AgentDecision[] = [];

  for (let start = 0; start < text.length; start += 1) {
    if (text[start] !== "{") continue;

    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let end = start; end < text.length; end += 1) {
      const character = text[end];

      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (character === "\\") {
          escaped = true;
        } else if (character === '"') {
          inString = false;
        }
        continue;
      }

      if (character === '"') {
        inString = true;
      } else if (character === "{") {
        depth += 1;
      } else if (character === "}") {
        depth -= 1;
        if (depth === 0) {
          const decision = parseJsonDecision(text.slice(start, end + 1));
          if (decision) {
            decisions.push(decision);
            start = end;
          }
          break;
        }
      }
    }
  }

  return decisions;
}

export function stripThinkingMarkup(text: string): string {
  return text
    .replace(/<think(?:ing)?>[\s\S]*?<\/think(?:ing)?>/gi, "")
    .replace(/^[\s\S]*?<\/think(?:ing)?>/i, "")
    .trim();
}

export function parseAgentDecision(responseText: string): AgentDecision {
  const content = responseText.trim();
  const direct = parseJsonDecision(unwrapJsonFence(content));
  if (direct) return direct;

  const embedded = extractEmbeddedDecisions(content);
  const lastDecision = embedded[embedded.length - 1];
  if (lastDecision) return lastDecision;

  return {
    toolName: null,
    toolInput: null,
    directResponse: stripThinkingMarkup(content),
    structured: false,
  };
}

export function unwrapAgentResponse(responseText: string): string {
  const parsed = parseAgentDecision(responseText);
  return parsed.structured && parsed.directResponse !== null
    ? parsed.directResponse
    : stripThinkingMarkup(responseText);
}
