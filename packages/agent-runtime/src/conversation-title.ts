import type { Turn } from "@desktop-agent/shared";

const SENSITIVE_PATTERNS = [
  /\bsk-[A-Za-z0-9_-]{12,}\b/g,
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g,
  /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}\b/gi,
  /\beyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
];

export function sanitizeConversationTitle(value: string): string {
  let title = value;
  for (const pattern of SENSITIVE_PATTERNS) {
    title = title.replace(pattern, "[credencial removida]");
  }

  return title.replace(/\s+/g, " ").trim().slice(0, 80) || "Nova conversa";
}

export function conversationTitleFromTurns(turns: Turn[]): string {
  const firstUserTurn = turns.find((turn) => turn.role === "user");
  const titleBlock = firstUserTurn?.blocks.find((block) => block.type === "text");
  const content = titleBlock?.type === "text" ? titleBlock.content : "Nova conversa";
  return sanitizeConversationTitle(content);
}
