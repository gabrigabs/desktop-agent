import { Check, Copy, ZoomIn, ZoomOut } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { renderMermaid, svgToDataUrl } from "../../../lib/mermaid";
import { Button } from "../primitives/button";
import { CodeBlock } from "./code-block";

interface MermaidBlockProps {
  code: string;
}

export function MermaidBlock({ code }: MermaidBlockProps) {
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [scale, setScale] = useState(1);
  const [copied, setCopied] = useState(false);
  const diagramId = useRef(`mermaid-${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    let cancelled = false;

    const render = async () => {
      setLoading(true);
      setError(null);
      try {
        const rendered = await renderMermaid(diagramId.current, code);
        if (!cancelled) {
          setSvg(rendered);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void render();
    return () => {
      cancelled = true;
    };
  }, [code]);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error("Failed to copy mermaid code:", err);
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-line bg-white/[0.02] p-4">
        <div className="h-32 w-full animate-pulse rounded-lg bg-white/[0.05]" />
      </div>
    );
  }

  if (error || !svg) {
    return (
      <div className="flex flex-col gap-2 rounded-xl border border-line bg-white/[0.02] p-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-medium text-bad">Mermaid</span>
          <Button variant="ghost" size="sm" onClick={handleCopyCode}>
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
        {error && <p className="text-[10px] text-bad/80">{error}</p>}
        <CodeBlock language="mermaid">{code}</CodeBlock>
      </div>
    );
  }

  const svgUrl = svgToDataUrl(svg);
  if (!svgUrl) {
    return (
      <div className="flex flex-col gap-2 rounded-xl border border-line bg-white/[0.02] p-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-medium text-bad">Mermaid</span>
          <Button variant="ghost" size="sm" onClick={handleCopyCode}>
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
        <p className="text-[10px] text-bad/80">The diagram output was rejected as unsafe.</p>
        <CodeBlock language="mermaid">{code}</CodeBlock>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-line bg-white/[0.02] p-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-medium text-signal">Diagram</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setScale((s) => Math.max(0.5, s - 0.25))}
            className="rounded-md p-1 text-faint transition-colors hover:bg-white/5 hover:text-fg"
            title="Zoom out"
            aria-label="Zoom out"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <span className="min-w-[3ch] text-center text-[10px] text-mute">{Math.round(scale * 100)}%</span>
          <button
            type="button"
            onClick={() => setScale((s) => Math.min(2, s + 0.25))}
            className="rounded-md p-1 text-faint transition-colors hover:bg-white/5 hover:text-fg"
            title="Zoom in"
            aria-label="Zoom in"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
          <Button variant="ghost" size="sm" onClick={handleCopyCode}>
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      </div>
      <div className="overflow-auto rounded-lg bg-black/20 p-2">
        <img
          src={svgUrl}
          alt="Mermaid diagram"
          className="mermaid-diagram origin-top-left transition-transform"
          style={{ transform: `scale(${scale})`, transformOrigin: "top left" }}
        />
      </div>
    </div>
  );
}
