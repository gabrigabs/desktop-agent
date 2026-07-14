import { Copy, Download } from "lucide-react";
import { memo, type ReactNode, useMemo, useState } from "react";
import { PrismLight } from "react-syntax-highlighter";
import bash from "react-syntax-highlighter/dist/esm/languages/prism/bash";
import css from "react-syntax-highlighter/dist/esm/languages/prism/css";
import javascript from "react-syntax-highlighter/dist/esm/languages/prism/javascript";
import json from "react-syntax-highlighter/dist/esm/languages/prism/json";
import markdown from "react-syntax-highlighter/dist/esm/languages/prism/markdown";
import markup from "react-syntax-highlighter/dist/esm/languages/prism/markup";
import python from "react-syntax-highlighter/dist/esm/languages/prism/python";
import tsx from "react-syntax-highlighter/dist/esm/languages/prism/tsx";
import typescript from "react-syntax-highlighter/dist/esm/languages/prism/typescript";
import vscDarkPlus from "react-syntax-highlighter/dist/esm/styles/prism/vsc-dark-plus";
import { copyToClipboard, downloadFile, getCodeFilename, normalizeLanguage } from "../../../lib/code-utils";
import { IconButton } from "../primitives/icon-button";

PrismLight.registerLanguage("bash", bash);
PrismLight.registerLanguage("css", css);
PrismLight.registerLanguage("javascript", javascript);
PrismLight.registerLanguage("json", json);
PrismLight.registerLanguage("markdown", markdown);
PrismLight.registerLanguage("markup", markup);
PrismLight.registerLanguage("python", python);
PrismLight.registerLanguage("typescript", typescript);
PrismLight.registerLanguage("tsx", tsx);

PrismLight.alias("markup", ["html", "xml"]);

interface CodeBlockProps {
  language?: string;
  className?: string;
  children?: ReactNode;
}

function toCodeString(children: ReactNode): string {
  if (typeof children === "string") return children;
  if (Array.isArray(children)) return children.map(toCodeString).join("");
  if (children == null) return "";
  return String(children);
}

export const CodeBlock = memo(function CodeBlock({ language, children }: CodeBlockProps) {
  const code = useMemo(() => toCodeString(children), [children]);
  const normalizedLang = useMemo(() => normalizeLanguage(language ?? ""), [language]);
  const displayLang = useMemo(() => (language ? language.trim().toLowerCase() : "text"), [language]);
  const filename = useMemo(() => getCodeFilename(normalizedLang), [normalizedLang]);

  const [copied, setCopied] = useState(false);

  const hasLanguage = Boolean(language?.trim());

  const handleCopy = async () => {
    await copyToClipboard(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    downloadFile(code, filename);
  };

  return (
    <div className="my-3 rounded-lg border border-line overflow-hidden bg-ink/80">
      <div className="flex items-center justify-between px-3 py-2 border-b border-line bg-white/[0.03]">
        <span className="text-[10px] font-mono uppercase tracking-wider text-faint">{displayLang}</span>
        <div className="flex items-center gap-1">
          <IconButton
            title={copied ? "Copiado" : "Copiar"}
            onClick={handleCopy}
            className={copied ? "text-good" : ""}
          >
            <Copy className="w-3.5 h-3.5" />
          </IconButton>
          <IconButton title="Baixar" onClick={handleDownload}>
            <Download className="w-3.5 h-3.5" />
          </IconButton>
        </div>
      </div>
      {hasLanguage ? (
        <PrismLight
          language={normalizedLang}
          style={vscDarkPlus}
          showLineNumbers={false}
          PreTag="div"
          customStyle={{
            margin: 0,
            padding: "1rem",
            background: "transparent",
            fontSize: "0.8125rem",
            lineHeight: "1.5",
          }}
          codeTagProps={{
            style: { fontFamily: "var(--font-mono)" },
          }}
        >
          {code}
        </PrismLight>
      ) : (
        <div className="p-4 overflow-x-auto">
          <code className="font-mono text-sm text-fg/95 whitespace-pre">{code}</code>
        </div>
      )}
    </div>
  );
});
