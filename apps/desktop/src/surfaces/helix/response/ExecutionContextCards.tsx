import type { ExecutionContextSummary, Turn } from "@desktop-agent/shared";
import {
  Brain,
  CheckCircle2,
  ChevronDown,
  FileOutput,
  FileText,
  SlidersHorizontal,
  Wrench,
  XCircle,
} from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

function ContextCard({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <details className="group/context border-t border-line/70 first:border-t-0">
      <summary className="flex cursor-pointer list-none items-center gap-2 py-2 text-[10px] font-medium text-mute transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/35 [&::-webkit-details-marker]:hidden">
        <span className="text-faint">{icon}</span>
        <span className="flex-1">{label}</span>
        <ChevronDown className="h-3 w-3 text-faint transition-transform group-open/context:rotate-180" />
      </summary>
      <div className="pb-3 pl-5 pr-1 text-[10px] leading-relaxed text-mute">{children}</div>
    </details>
  );
}

function liveToolSummary(turn: Turn): ExecutionContextSummary["toolsUsed"] {
  return turn.blocks
    .filter((block) => block.type === "tool_call")
    .map((block) => ({
      toolName: block.toolName,
      inputPreview: JSON.stringify(block.input ?? "").slice(0, 500),
      outputPreview: JSON.stringify(block.output ?? "").slice(0, 500),
      durationMs: 0,
      success: block.status === "done",
    }));
}

export function ExecutionContextCards({ turn }: { turn: Turn }) {
  const { t } = useTranslation("helix");
  const summary = turn.blocks.find((block) => block.type === "execution_context")?.summary;
  const tools = summary?.toolsUsed.length ? summary.toolsUsed : liveToolSummary(turn);
  const hasContent = Boolean(
    summary?.facts.length ||
      summary?.filesRead.length ||
      summary?.filesWritten.length ||
      tools.length ||
      summary?.instructions.trim(),
  );
  if (!hasContent) return null;

  return (
    <section
      className="mt-3 rounded-lg border border-line/80 bg-white/[0.018] px-3"
      aria-label={t("helix:executionContext.title", "Contexto de execução")}
    >
      <div className="flex items-center gap-2 py-2 text-[9px] font-medium uppercase tracking-[0.12em] text-faint">
        <SlidersHorizontal className="h-3 w-3 text-signal/70" />
        {t("helix:executionContext.title", "Contexto de execução")}
        {summary?.spaceName && (
          <span className="ml-auto normal-case tracking-normal text-mute">{summary.spaceName}</span>
        )}
      </div>

      {summary && summary.facts.length > 0 && (
        <ContextCard
          icon={<Brain className="h-3 w-3" />}
          label={t("helix:executionContext.memory", {
            count: summary.facts.length,
            defaultValue: `Memória usada (${summary.facts.length})`,
          })}
        >
          <ul className="grid gap-2">
            {summary.facts.map((fact) => (
              <li key={fact.id} className="border-l border-line-strong pl-2.5">
                <p className="whitespace-pre-wrap text-fg/85">{fact.content}</p>
                <span className="mt-0.5 block text-[9px] text-faint">
                  {fact.origin === "assistant"
                    ? t("helix:executionContext.assistantOrigin", "Salva de uma resposta")
                    : t("helix:executionContext.manualOrigin", "Adicionada manualmente")}
                </span>
              </li>
            ))}
          </ul>
        </ContextCard>
      )}

      {summary && summary.filesRead.length > 0 && (
        <ContextCard
          icon={<FileText className="h-3 w-3" />}
          label={t("helix:executionContext.filesRead", {
            count: summary.filesRead.length,
            defaultValue: `Arquivos lidos (${summary.filesRead.length})`,
          })}
        >
          <ul className="grid gap-2">
            {summary.filesRead.map((file) => (
              <li key={`${file.source}-${file.displayName}-${file.mimeType}-${file.preview.slice(0, 24)}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-fg/85">{file.displayName}</span>
                  <span className="text-[9px] text-faint">
                    {file.source === "space" ? "Space" : file.mimeType}
                  </span>
                </div>
                {file.preview && (
                  <p className="mt-0.5 line-clamp-3 whitespace-pre-wrap text-faint">{file.preview}</p>
                )}
              </li>
            ))}
          </ul>
        </ContextCard>
      )}

      {summary && summary.filesWritten.length > 0 && (
        <ContextCard
          icon={<FileOutput className="h-3 w-3" />}
          label={t("helix:executionContext.filesWritten", {
            count: summary.filesWritten.length,
            defaultValue: `Arquivos escritos (${summary.filesWritten.length})`,
          })}
        >
          <ul className="grid gap-2">
            {summary.filesWritten.map((file) => (
              <li key={`${file.displayName}-${file.preview.slice(0, 24)}`}>
                <span className="font-medium text-fg/85">{file.displayName}</span>
                {file.preview && <p className="mt-0.5 line-clamp-3 font-mono text-faint">{file.preview}</p>}
              </li>
            ))}
          </ul>
        </ContextCard>
      )}

      {tools.length > 0 && (
        <ContextCard
          icon={<Wrench className="h-3 w-3" />}
          label={t("helix:executionContext.tools", {
            count: tools.length,
            defaultValue: `Ferramentas usadas (${tools.length})`,
          })}
        >
          <ul className="grid gap-2.5">
            {tools.map((tool) => (
              <li
                key={`${tool.toolName}-${tool.inputPreview}-${tool.outputPreview}-${tool.durationMs}`}
                className="rounded-md border border-line/70 p-2"
              >
                <div className="flex items-center gap-1.5">
                  {tool.success ? (
                    <CheckCircle2 className="h-3 w-3 text-good" />
                  ) : (
                    <XCircle className="h-3 w-3 text-warn" />
                  )}
                  <span className="font-mono text-fg/90">{tool.toolName}</span>
                  {tool.durationMs > 0 && (
                    <span className="ml-auto text-[9px] text-faint">{tool.durationMs} ms</span>
                  )}
                </div>
                {tool.inputPreview && (
                  <pre className="mt-1.5 max-h-24 overflow-auto whitespace-pre-wrap break-all text-[9px] text-faint">
                    {tool.inputPreview}
                  </pre>
                )}
                {tool.outputPreview && (
                  <pre className="mt-1 max-h-24 overflow-auto whitespace-pre-wrap break-all text-[9px] text-faint">
                    {tool.outputPreview}
                  </pre>
                )}
              </li>
            ))}
          </ul>
        </ContextCard>
      )}

      {summary?.instructions.trim() && (
        <ContextCard
          icon={<SlidersHorizontal className="h-3 w-3" />}
          label={t("helix:executionContext.instructions", "Instruções aplicadas")}
        >
          <p className="whitespace-pre-wrap text-fg/85">{summary.instructions}</p>
        </ContextCard>
      )}
    </section>
  );
}
