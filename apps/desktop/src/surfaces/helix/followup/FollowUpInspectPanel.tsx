import type { FollowUpObservationStatus, FollowUpSession } from "@desktop-agent/shared";
import { CheckCircle2, Circle, Clock3, Crosshair, GitCompare, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../../../components/ui/primitives/button";

type Props = {
  session: FollowUpSession;
  onAddAnnotation: (input: { content: string; target: string; selector?: string }) => void;
  onUpdateStatus: (id: string, status: FollowUpObservationStatus) => void;
  onComplete: (summary: string) => void;
  onRunInspection?: (prompt: string) => void;
};

const STATUS_ICONS = {
  pending: Circle,
  in_progress: Clock3,
  resolved: CheckCircle2,
} as const;

export function FollowUpInspectPanel({
  session,
  onAddAnnotation,
  onUpdateStatus,
  onComplete,
  onRunInspection,
}: Props) {
  const { t } = useTranslation("helix");
  const [target, setTarget] = useState("");
  const [selector, setSelector] = useState("");
  const [content, setContent] = useState("");
  const [summary, setSummary] = useState("");
  const annotations = session.observations.filter(
    (observation) => observation.target || observation.metadata.selector,
  );

  const add = () => {
    if (!target.trim() || !content.trim()) return;
    onAddAnnotation({
      target: target.trim(),
      content: content.trim(),
      selector: selector.trim() || undefined,
    });
    setContent("");
  };

  return (
    <div className="grid gap-4">
      <section className="rounded-xl border border-line bg-white/[0.02] p-3">
        <div className="mb-2 flex items-center gap-2">
          <Crosshair className="h-3.5 w-3.5 text-signal" />
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-mute">
            {t("helix:followUp.inspect.target")}
          </h3>
        </div>
        <p className="mb-3 text-xs leading-relaxed text-mute">{session.objective}</p>
        <div className="grid gap-2">
          <input
            value={target}
            onChange={(event) => setTarget(event.target.value)}
            placeholder={t("helix:followUp.inspect.targetPlaceholder")}
            className="h-9 rounded-lg border border-line bg-ink px-3 text-xs text-fg outline-none focus:border-signal/45"
          />
          <input
            value={selector}
            onChange={(event) => setSelector(event.target.value)}
            placeholder={t("helix:followUp.inspect.selectorPlaceholder")}
            className="h-9 rounded-lg border border-line bg-ink px-3 font-mono text-[10px] text-fg outline-none focus:border-signal/45"
          />
          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder={t("helix:followUp.inspect.annotationPlaceholder")}
            rows={3}
            className="rounded-lg border border-line bg-ink p-3 text-xs text-fg outline-none focus:border-signal/45"
          />
          <Button variant="primary" size="sm" onClick={add} disabled={!target.trim() || !content.trim()}>
            {t("helix:followUp.inspect.add")}
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                onRunInspection?.(t("helix:followUp.inspect.refreshPrompt", { target: target.trim() }))
              }
              disabled={!target.trim() || !onRunInspection}
            >
              <RefreshCw className="mr-1.5 h-3 w-3" />
              {t("helix:followUp.inspect.refresh")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                onRunInspection?.(t("helix:followUp.inspect.comparePrompt", { target: target.trim() }))
              }
              disabled={!target.trim() || !onRunInspection}
            >
              <GitCompare className="mr-1.5 h-3 w-3" />
              {t("helix:followUp.inspect.compare")}
            </Button>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-mute">
            {t("helix:followUp.inspect.annotations")}
          </h3>
          <span className="text-[9px] text-faint">{annotations.length}</span>
        </div>
        <div className="grid gap-2">
          {annotations.length === 0 && (
            <p className="rounded-lg border border-line/50 px-3 py-2 text-[10px] italic text-faint">
              {t("helix:followUp.inspect.empty")}
            </p>
          )}
          {annotations.map((annotation) => {
            const Icon = STATUS_ICONS[annotation.status];
            return (
              <article key={annotation.id} className="rounded-xl border border-line bg-white/[0.02] p-3">
                <div className="flex items-start gap-2">
                  <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-signal" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-mono text-[9px] text-signal/80">
                      {annotation.target}
                      {typeof annotation.metadata.selector === "string"
                        ? ` · ${annotation.metadata.selector}`
                        : ""}
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-fg">{annotation.content}</p>
                  </div>
                </div>
                <select
                  value={annotation.status}
                  onChange={(event) =>
                    onUpdateStatus(annotation.id, event.target.value as FollowUpObservationStatus)
                  }
                  className="mt-2 h-7 w-full rounded-lg border border-line bg-ink px-2 text-[10px] text-mute"
                  aria-label={t("helix:followUp.inspect.status")}
                >
                  <option value="pending">{t("helix:followUp.observationStatus.pending")}</option>
                  <option value="in_progress">{t("helix:followUp.observationStatus.in_progress")}</option>
                  <option value="resolved">{t("helix:followUp.observationStatus.resolved")}</option>
                </select>
              </article>
            );
          })}
        </div>
      </section>

      <section className="rounded-xl border border-line bg-white/[0.02] p-3">
        <textarea
          value={summary}
          onChange={(event) => setSummary(event.target.value)}
          placeholder={t("helix:followUp.inspect.summaryPlaceholder")}
          rows={3}
          className="w-full rounded-lg border border-line bg-ink p-3 text-xs text-fg outline-none focus:border-signal/45"
        />
        <Button
          className="mt-2 w-full"
          variant="ghost"
          size="sm"
          onClick={() => onComplete(summary.trim())}
          disabled={!summary.trim()}
        >
          {t("helix:followUp.writing.complete")}
        </Button>
      </section>
    </div>
  );
}
