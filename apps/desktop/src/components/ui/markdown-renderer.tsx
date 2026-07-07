import { open } from "@tauri-apps/plugin-shell";
import type { ComponentPropsWithoutRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { isTauriRuntime } from "../../lib/window";

interface MarkdownRendererProps {
  content: string;
  className?: string;
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

  return (
    <div className={`text-sm leading-relaxed text-fg ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="my-1.5 first:mt-0 last:mb-0">{children}</p>,
          h1: ({ children }) => (
            <h1 className="text-base font-bold mt-4 mb-2 text-fg first:mt-0">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-sm font-bold mt-3.5 mb-1.5 text-fg first:mt-0">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-xs font-bold mt-3 mb-1 text-fg first:mt-0 uppercase tracking-wide">
              {children}
            </h3>
          ),
          ul: ({ children }) => <ul className="list-disc pl-4 my-1.5 space-y-0.5">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-4 my-1.5 space-y-0.5">{children}</ol>,
          li: ({ children }) => <li className="text-sm leading-relaxed text-fg/90">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-signal/40 pl-3 my-2 italic text-mute">
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
                className="text-signal hover:underline inline-flex items-center gap-0.5 cursor-pointer"
              >
                {children}
              </button>
            );
          },
          pre: ({ children }) => (
            <pre className="overflow-x-auto my-2.5 rounded-lg bg-ink/80 border border-line p-3.5">
              {children}
            </pre>
          ),
          code: codeComponent,
          table: ({ children }) => (
            <div className="overflow-x-auto my-2.5">
              <table className="w-full text-xs border-collapse">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-white/[0.03]">{children}</thead>,
          th: ({ children }) => (
            <th className="border border-line px-2.5 py-1.5 text-left font-semibold text-fg">{children}</th>
          ),
          td: ({ children }) => <td className="border border-line px-2.5 py-1.5 text-fg/90">{children}</td>,
          hr: () => <hr className="helix-rule my-3" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

function codeComponent({ className, children, ...props }: ComponentPropsWithoutRef<"code">) {
  const match = /language-(\w+)/.exec(className ?? "");
  const isBlock = Boolean(match);

  if (isBlock) {
    return (
      <>
        {match && (
          <div className="text-[10px] text-faint font-mono uppercase tracking-wider mb-1.5 -mt-0.5">
            {match[1]}
          </div>
        )}
        <code className="font-mono text-[0.85em] text-fg/95 leading-relaxed block" {...props}>
          {children}
        </code>
      </>
    );
  }

  return (
    <code className="px-1 py-0.5 rounded bg-white/[0.06] font-mono text-[0.85em] text-warn" {...props}>
      {children}
    </code>
  );
}
