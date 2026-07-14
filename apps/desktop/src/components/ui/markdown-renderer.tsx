import { open } from "@tauri-apps/plugin-shell";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { prepareMarkdown } from "../../lib/markdown";
import { isTauriRuntime } from "../../lib/window";
import { CodeBlock } from "./code-block";
import { MermaidBlock } from "./mermaid-block";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

async function handleLinkClick(url: string) {
  if (!/^(https?:|mailto:)/i.test(url)) return;

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

  const prepared = prepareMarkdown(content);

  return (
    <div
      className={`text-sm leading-relaxed text-fg break-words select-text [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 ${className}`}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="my-3">{children}</p>,
          h1: ({ children }) => (
            <h1 className="text-lg font-bold mt-5 mb-2.5 text-fg first:mt-0 leading-tight">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-base font-bold mt-4 mb-2 text-fg first:mt-0 leading-tight">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-sm font-semibold mt-3.5 mb-1.5 text-fg first:mt-0 leading-tight">
              {children}
            </h3>
          ),
          ul: ({ children }) => (
            <ul className="list-disc pl-5 my-2.5 space-y-1 marker:text-faint">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal pl-5 my-2.5 space-y-1 marker:text-faint">{children}</ol>
          ),
          li: ({ children }) => (
            <li className="text-sm leading-relaxed text-fg/90 pl-1 [&>p]:my-0 [&>ul]:my-1.5 [&>ol]:my-1.5">
              {children}
            </li>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-signal/40 pl-3.5 my-3 text-mute [&>p]:my-0">
              {children}
            </blockquote>
          ),
          strong: ({ children }) => <strong className="font-semibold text-fg">{children}</strong>,
          em: ({ children }) => <em className="italic text-fg/90">{children}</em>,
          a: ({ href, children }) => {
            const url = href ?? "";
            return (
              <a
                href={url}
                onClick={(event) => {
                  event.preventDefault();
                  void handleLinkClick(url);
                }}
                className="text-signal hover:underline inline-flex items-center gap-0.5 cursor-pointer break-all"
              >
                {children}
              </a>
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
        {prepared}
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
    const language = match?.[1] ?? "";
    const code = typeof children === "string" ? children : String(children ?? "");
    if (language === "mermaid") {
      return <MermaidBlock code={code} />;
    }
    return <CodeBlock language={language}>{children as ReactNode}</CodeBlock>;
  }

  return (
    <code className="px-1 py-0.5 rounded bg-white/[0.06] font-mono text-[0.85em] text-warn" {...props}>
      {children}
    </code>
  );
}
