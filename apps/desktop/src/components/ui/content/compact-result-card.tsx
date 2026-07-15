import { Check, Clipboard, Expand, Maximize2, Wand2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "../primitives/button";
import { Card } from "../primitives/card";
import { MarkdownRenderer } from "./markdown-renderer";

interface CompactResultCardProps {
  result: string | null;
  streaming: boolean;
  copied: boolean;
  onCopy: () => void;
  onRefine: (text: string) => void;
  onExpand: () => void;
}

const REFINE_SUGGESTIONS = [
  { id: "concise", label: "compactResult.refineConcise", prompt: "compactResult.refineConcisePrompt" },
  { id: "detail", label: "compactResult.refineDetail", prompt: "compactResult.refineDetailPrompt" },
  { id: "examples", label: "compactResult.refineExamples", prompt: "compactResult.refineExamplesPrompt" },
];

export function CompactResultCard({
  result,
  streaming,
  copied,
  onCopy,
  onRefine,
  onExpand,
}: CompactResultCardProps) {
  const { t } = useTranslation("helix");

  if (!result) {
    return (
      <Card className="flex flex-col items-center justify-center gap-2 py-8 text-center min-h-[160px]">
        <Expand className="w-5 h-5 text-faint" />
        <p className="text-xs text-mute">{t("compactResult.emptyHint")}</p>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-3 min-h-[200px] overflow-hidden">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[10px] font-medium tracking-tight text-mute uppercase">
          {t("compactResult.title")}
        </span>
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="sm" onClick={onCopy} disabled={streaming}>
            {copied ? <Check className="w-3.5 h-3.5" /> : <Clipboard className="w-3.5 h-3.5" />}
            {copied ? t("compactResult.copied") : t("compactResult.copy")}
          </Button>
          <Button variant="ghost" size="sm" onClick={onExpand} disabled={streaming}>
            <Maximize2 className="w-3.5 h-3.5" />
            {t("compactResult.expand")}
          </Button>
        </div>
      </div>

      <div className="flex-1 text-sm text-fg leading-relaxed line-clamp-[8] overflow-hidden select-text">
        <MarkdownRenderer content={result} />
        {streaming && (
          <span className="inline-block w-1.5 h-4 ml-1 align-[-2px] rounded-sm bg-warn animate-pulse" />
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-line/50">
        <span className="text-[10px] text-mute mr-1">{t("compactResult.refine")}</span>
        {REFINE_SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion.id}
            type="button"
            onClick={() => onRefine(t(suggestion.prompt))}
            disabled={streaming}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white/[0.03] px-2 py-1 text-[10px] text-fg transition-colors hover:bg-white/[0.06] hover:border-line-strong disabled:opacity-50"
          >
            <Wand2 className="w-3 h-3 text-signal" />
            {t(suggestion.label)}
          </button>
        ))}
      </div>
    </Card>
  );
}
