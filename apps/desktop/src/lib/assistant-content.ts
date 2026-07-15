import type { MessageBlock } from "@desktop-agent/shared";

const THINKING_TAG = /<\/?think(?:ing)?>/gi;
const TOOL_CALL_TAG = /<tool_call\s+name="([^"]+)"\s*>/i;
const TOOL_CALL_CLOSE = /<\/tool_call>/i;
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
  let seenAnyTag = false;
  let seenToolCall = false;
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
    seenAnyTag = true;
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
  let hadPartialTag = false;
  if (streaming) {
    const partialTagIndex = trailingPartialTagIndex(remainder);
    if (partialTagIndex !== -1) {
      remainder = remainder.slice(0, partialTagIndex);
      hadPartialTag = true;
    }
  }

  if (TOOL_CALL_TAG.test(remainder)) {
    seenToolCall = true;
  }

  if (streaming && !seenAnyTag && !hadPartialTag && !seenToolCall) {
    push("thinking", remainder);
  } else {
    push(thinking ? "thinking" : "text", remainder);
  }

  return parseToolCallBlocks(blocks);
}

function parseToolCallBlocks(blocks: MessageBlock[]): MessageBlock[] {
  const result: MessageBlock[] = [];
  for (const block of blocks) {
    if (block.type !== "text") {
      result.push(block);
      continue;
    }
    let content = block.content;
    while (content.length > 0) {
      const openMatch = content.match(TOOL_CALL_TAG);
      if (!openMatch) {
        result.push({ type: "text", content });
        break;
      }
      const toolName = openMatch[1] as string;
      const startIndex = openMatch.index as number;
      const before = content.slice(0, startIndex);
      if (before.trim()) {
        result.push({ type: "text", content: before });
      }
      const closeMatch = content.match(TOOL_CALL_CLOSE);
      if (!closeMatch) {
        const inner = content.slice(startIndex + openMatch[0].length);
        result.push({ type: "tool_call", toolName, status: "running", input: inner });
        break;
      }
      const closeIndex = closeMatch.index as number;
      const closeLength = closeMatch[0].length;
      const inner = content.slice(startIndex + openMatch[0].length, closeIndex);
      result.push({
        type: "tool_call",
        toolName,
        status: "running",
        input: inner,
      });
      content = content.slice(closeIndex + closeLength);
    }
  }
  return result;
}
