import { open } from "@tauri-apps/plugin-shell";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { isTauriRuntime } from "../../lib/window";
import { CodeBlock } from "./code-block";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

function normalizeMarkdownSpacing(content: string): string {
  // Split content into code blocks and non-code segments to avoid modifying code.
  const segments = splitCodeBlocks(content);
  const normalized: string[] = [];

  for (const seg of segments) {
    if (seg.isCode) {
      normalized.push(normalizeCodeBlock(seg.text));
      continue;
    }
    normalized.push(normalizeTextSegment(seg.text));
  }

  // Join segments ensuring a blank line between code blocks and text.
  let out = "";
  for (const raw of normalized) {
    const part = raw.trim();
    if (part === "") continue;

    if (out === "") {
      out = part;
      continue;
    }

    if (out.endsWith("\n\n") || part.startsWith("\n\n")) {
      out += part;
    } else if (out.endsWith("\n") || part.startsWith("\n")) {
      out += `\n${part}`;
    } else {
      out += `\n\n${part}`;
    }
  }

  return out;
}

function splitCodeBlocks(text: string): { text: string; isCode: boolean }[] {
  const segments: { text: string; isCode: boolean }[] = [];
  let cursor = 0;
  const fenceRegex = /```/g;
  let match: RegExpExecArray | null = fenceRegex.exec(text);

  while (match !== null) {
    const start = match.index;
    if (start > cursor) {
      segments.push({ text: text.slice(cursor, start), isCode: false });
    }

    const closeMatch = fenceRegex.exec(text);
    if (closeMatch) {
      const end = closeMatch.index + 3;
      segments.push({ text: text.slice(start, end), isCode: true });
      cursor = end;
    } else {
      // No closing fence — treat rest as code
      segments.push({ text: text.slice(start), isCode: true });
      cursor = text.length;
      break;
    }

    match = fenceRegex.exec(text);
  }

  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), isCode: false });
  }

  return segments.length > 0 ? segments : [{ text, isCode: false }];
}

function normalizeCodeBlock(text: string): string {
  const firstBreak = text.indexOf("\n");

  if (firstBreak === -1) {
    // Single-line fence, e.g. ```pythonfoo or ```
    const match = text.match(/^```(\S*)\s?(.*)$/);
    if (match) {
      const lang = match[1] ?? "";
      const rest = (match[2] ?? "").trim();
      if (rest) return `\`\`\`${lang}\n${rest}\n\`\`\``;
      return `\`\`\`${lang}\n\`\`\``;
    }
    return text;
  }

  const firstLine = text.slice(0, firstBreak);
  const firstMatch = firstLine.match(/^```(\S*)\s?(.*)$/);
  if (firstMatch) {
    const lang = firstMatch[1] ?? "";
    const restOnLine = (firstMatch[2] ?? "").trim();
    if (restOnLine) {
      return `\`\`\`${lang}\n${restOnLine}\n${text.slice(firstBreak + 1)}`;
    }
  }

  return text;
}

function normalizeTextSegment(text: string): string {
  let out = text;

  // Fix missing space after punctuation: .word -> . word, ,word -> , word
  out = out.replace(/([.,;:!?])([A-Za-zÀ-ÿ])/g, "$1 $2");

  // Fix missing space before opening parenthesis after a word: word( -> word (
  out = out.replace(/([A-Za-zÀ-ÿ])\(/g, "$1 (");

  // Fix missing space after closing parenthesis before a word: )word -> ) word
  out = out.replace(/\)([A-Za-zÀ-ÿ])/g, ") $1");

  // Insert newline before heading markers that appear inline after text: word### -> word\n\n###
  out = out.replace(/([^\n #])(#{1,6}) /g, "$1\n\n$2 ");

  // Insert newline after closing brace followed by text or heading: }### or }word
  out = out.replace(/\}(#{1,6} |[A-Za-zÀ-ÿ])/g, "}\n\n$1");

  // Insert newline after colon followed by heading marker: :### -> :\n\n###
  out = out.replace(/:(#{1,6} )/g, ":\n\n$1");

  // Insert newline after colon followed by code fence: :``` -> :\n\n```
  out = out.replace(/:(```)/g, ":\n\n$1");

  // Insert newline after colon followed by blockquote: :> -> :\n\n>
  out = out.replace(/:(> )/g, ":\n\n> ");

  // Insert newline before blockquote markers that appear inline after text: word> -> word\n\n>
  out = out.replace(/([^\n >])> /g, "$1\n\n> ");

  // Convert single newlines (that are not already double) into double newlines for paragraph breaks
  out = out.replace(/([^\n])\n([^\n#\-*\d>|\s])/g, "$1\n\n$2");

  // Split a heading and a paragraph that were concatenated on the same line.
  out = out.replace(/^(#{1,6} .+)$/gm, (line) => {
    for (let i = 1; i < line.length - 1; i++) {
      const prev = line[i - 1];
      const curr = line[i];
      if (!prev || !curr) continue;

      const rest = line.slice(i);
      const before = line.slice(0, i);
      if (before.length <= 10 || rest.length <= 10) continue;

      const isWordBoundary = /[a-zà-ÿ]/.test(prev) && /[A-ZÀ-Ý]/.test(curr);
      const isListBoundary = /^\d+\. /.test(rest) || /^[-*] /.test(rest);

      if (!isWordBoundary && !isListBoundary) continue;

      const nextWord = isListBoundary
        ? rest.match(/^(\d+\. |[-*] )/)?.[0]
        : rest.match(/[A-ZÀ-Ý][a-zà-ÿA-ZÀ-Ý]+/)?.[0];

      if (nextWord && (nextWord.length >= 2 || isListBoundary)) {
        return `${before}\n\n${rest}`;
      }
    }
    return line;
  });

  // Ensure heading after a paragraph is separated
  out = out.replace(/([^\n])\n(#{1,6} )/g, "$1\n\n$2");

  // Insert blank line before list items after a paragraph
  out = out.replace(/([^\n])\n([-*]|\d+\. )/g, "$1\n\n$2");

  // Split ordered list items concatenated inline: 1. a. 2. b. -> 1. a.\n\n2. b.
  out = out.replace(/(\d+\. [^\n]{3,}?)(?=\d+\. )/g, "$1\n\n");

  // Split unordered list items concatenated inline: - a. - b. -> - a.\n\n- b.
  out = out.replace(/([-*] [^\n]{3,}?)(?=[-*] )/g, "$1\n\n");

  // Fix inline code pasted without surrounding spaces: text`code` -> text `code` and `code`text -> `code` text
  out = out.replace(/([A-Za-z0-9À-ÿ])(`[^`\n]+`)/g, "$1 $2");
  out = out.replace(/(`[^`\n]+`)([A-Za-z0-9À-ÿ])/g, "$1 $2");
  out = out.replace(/([A-Za-z0-9À-ÿ])(``[^`]+``)/g, "$1 $2");
  out = out.replace(/(``[^`]+``)([A-Za-z0-9À-ÿ])/g, "$1 $2");

  // Fix bold+italic markers concatenated with words: ***text***word -> ***text*** word
  out = out.replace(/(\*{3}[^*]+\*{3})([A-Za-z0-9À-ÿ])/g, "$1 $2");
  out = out.replace(/([A-Za-z0-9À-ÿ])(\*{3}[^*]+\*{3})/g, "$1 $2");

  // Normalize inline markdown tables
  out = out.replace(/^(\s*\|.+\|\s*)$/gm, (line) => normalizeTableLine(line));

  // Collapse 3+ newlines into 2
  out = out.replace(/\n{3,}/g, "\n\n");

  return out;
}

function normalizeTableLine(line: string): string {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) return line;

  // Split concatenated rows such as | a | b || c | d | into two lines.
  // Only split on adjacent || pipes (not on single | separators with spaces).
  const rows = trimmed.replace(/\|(\|)(?=[^|])/g, "|\n|");

  const lines = rows
    .split("\n")
    .map((row) => row.trim())
    .filter((row) => row.startsWith("|") && row.endsWith("|"));

  if (lines.length < 2) return rows;

  // If there is no separator line, insert a default one after the first row.
  const hasSeparator = lines.some((row) => /^\|\s*(:?-+:?)\s*(\|\s*(:?-+:?)\s*)*\|$/.test(row));
  if (!hasSeparator) {
    const header = lines[0];
    if (!header) return rows;
    const cells = header.split("|").filter((cell) => cell !== "");
    const separator = `|${" --- |".repeat(cells.length)}`;
    return [header, separator, ...lines.slice(1)].join("\n");
  }

  return lines.join("\n");
}

async function handleLinkClick(url: string) {
  try {
    if (isTauriRuntime()) {
      await open(url);
    } else {
      window.open(url, "_blank");
    }
  } catch (err) {
    console.error("Failed to open link:", err);
  }
}

export function MarkdownRenderer({ content, className = "" }: MarkdownRendererProps) {
  if (!content.trim()) return null;

  const normalized = normalizeMarkdownSpacing(content);

  return (
    <div className={`text-sm leading-relaxed text-fg break-words ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="my-2.5 first:mt-0 last:mb-0">{children}</p>,
          h1: ({ children }) => (
            <h1 className="text-lg font-bold mt-5 mb-2.5 text-fg first:mt-0 leading-tight">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-base font-bold mt-4 mb-2 text-fg first:mt-0 leading-tight">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-sm font-bold mt-3.5 mb-1.5 text-fg first:mt-0 uppercase tracking-wide leading-tight">
              {children}
            </h3>
          ),
          ul: ({ children }) => (
            <ul className="list-disc pl-5 my-2.5 space-y-1 marker:text-faint">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal pl-5 my-2.5 space-y-1 marker:text-faint">{children}</ol>
          ),
          li: ({ children }) => <li className="text-sm leading-relaxed text-fg/90 pl-1">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-signal/40 pl-3.5 my-3 italic text-mute">
              {children}
            </blockquote>
          ),
          strong: ({ children }) => <strong className="font-semibold text-fg">{children}</strong>,
          em: ({ children }) => <em className="italic text-fg/90">{children}</em>,
          a: ({ href, children }) => {
            const url = href ?? "";
            return (
              <button
                type="button"
                onClick={() => handleLinkClick(url)}
                className="text-signal hover:underline inline-flex items-center gap-0.5 cursor-pointer break-all"
              >
                {children}
              </button>
            );
          },
          pre: ({ children }) => <>{children}</>,
          code: codeComponent,
          table: ({ children }) => (
            <div className="overflow-x-auto my-3">
              <table className="w-full text-xs border-collapse">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-white/[0.03]">{children}</thead>,
          th: ({ children }) => (
            <th className="border border-line px-2.5 py-1.5 text-left font-semibold text-fg">{children}</th>
          ),
          td: ({ children }) => <td className="border border-line px-2.5 py-1.5 text-fg/90">{children}</td>,
          hr: () => <hr className="helix-rule my-4" />,
        }}
      >
        {normalized}
      </ReactMarkdown>
    </div>
  );
}

function codeComponent({ className, children, ...props }: ComponentPropsWithoutRef<"code">) {
  const match = /language-([^\s]+)/.exec(className ?? "");
  const isBlock =
    Boolean(match) ||
    (typeof children === "string" ? children.includes("\n") : String(children ?? "").includes("\n"));

  if (isBlock) {
    return <CodeBlock language={match?.[1] ?? ""}>{children as ReactNode}</CodeBlock>;
  }

  return (
    <code className="px-1 py-0.5 rounded bg-white/[0.06] font-mono text-[0.85em] text-warn" {...props}>
      {children}
    </code>
  );
}
