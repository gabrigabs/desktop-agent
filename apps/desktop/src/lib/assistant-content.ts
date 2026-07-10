import type { MessageBlock } from "@desktop-agent/shared";

const THINKING_TAG = /<\/?think(?:ing)?>/gi;
const TAG_PREFIXES = ["<think>", "</think>", "<thinking>", "</thinking>"];

function trimBoundaryLines(text: string): string {
  return text.replace(/^\n+/, "").replace(/\n+$/, "");
}

function trailingPartialTagIndex(text: string): number {
  const index = text.lastIndexOf("<");
  if (index === -1) return -1;

  const candidate = text.slice(index).toLowerCase();
  return TAG_PREFIXES.some((tag) => tag.startsWith(candidate)) ? index : -1;
}

export function parseAssistantContent(raw: string, streaming: boolean): MessageBlock[] {
  const blocks: MessageBlock[] = [];
  let cursor = 0;
  let thinking = false;
  let match = THINKING_TAG.exec(raw);

  const push = (type: "text" | "thinking", value: string) => {
    const content = trimBoundaryLines(value);
    if (!content) return;

    const last = blocks[blocks.length - 1];
    if (last?.type === type) {
      last.content += content;
      return;
    }

    if (type === "thinking") {
      blocks.push({ type, content, collapsed: true });
    } else {
      blocks.push({ type, content });
    }
  };

  while (match) {
    const tag = match[0].toLowerCase();
    const isClosing = tag.startsWith("</");
    const before = raw.slice(cursor, match.index);

    if (isClosing && !thinking) {
      push("thinking", before);
    } else {
      push(thinking ? "thinking" : "text", before);
    }

    thinking = !isClosing;
    cursor = match.index + match[0].length;
    match = THINKING_TAG.exec(raw);
  }

  let remainder = raw.slice(cursor);
  if (streaming) {
    const partialTagIndex = trailingPartialTagIndex(remainder);
    if (partialTagIndex !== -1) remainder = remainder.slice(0, partialTagIndex);
  }
  push(thinking ? "thinking" : "text", remainder);

  return blocks;
}
