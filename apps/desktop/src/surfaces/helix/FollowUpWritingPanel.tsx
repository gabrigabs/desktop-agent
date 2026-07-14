import type { FollowUpSession } from "@desktop-agent/shared";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../../components/ui/button";

type Props = {
  session: FollowUpSession;
  onAddObservation: (content: string) => void;
  onComplete: (summary: string) => void;
};

export function FollowUpWritingPanel({ session, onAddObservation, onComplete }: Props) {
  const { t } = useTranslation("helix");
  const [observation, setObservation] = useState("");
  const [summary, setSummary] = useState("");
  const [showComplete, setShowComplete] = useState(false);

  const handleAdd = () => {
    if (!observation.trim()) return;
    onAddObservation(observation.trim());
    setObservation("");
  };

  const handleComplete = () => {
    if (!summary.trim()) return;
    onComplete(summary.trim());
  };

  const assistantVersions = session.observations.filter((o) => o.source === "assistant");
  const userObservations = session.observations.filter((o) => o.source !== "assistant");

  return (
    <div className="grid gap-4">
      <section className="rounded-lg border border-line bg-white/[0.02] p-3">
        <div className="mb-2 flex items-center gap-1.5">
          <span className="h-1 w-1 rounded-full bg-signal" />
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-mute">
            {t("helix:followUp.writing.briefing")}
          </h3>
        </div>
        <p className="text-xs text-mute leading-relaxed">{session.objective}</p>
      </section>

      <section>
        <div className="mb-2 flex items-center gap-1.5">
          <span className="h-1 w-1 rounded-full bg-signal" />
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-mute">
            {t("helix:followUp.writing.userObservations")}
          </h3>
          <span className="ml-auto text-[9px] text-faint">{userObservations.length}</span>
        </div>
        <div className="grid gap-1.5">
          {userObservations.length === 0 && (
            <p className="rounded-lg border border-line/50 bg-white/[0.01] px-3 py-2 text-[10px] text-faint italic">
              {t("helix:followUp.writing.noUserObservations")}
            </p>
          )}
          {userObservations.map((obs) => (
            <div key={obs.id} className="rounded-lg border border-line bg-white/[0.02] p-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium text-signal/80">{obs.source}</span>
                <span className="text-[9px] text-faint">{obs.timestamp}</span>
              </div>
              <p className="mt-1 text-xs text-fg leading-relaxed">{obs.content}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-center gap-1.5">
          <span className="h-1 w-1 rounded-full bg-signal" />
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-mute">
            {t("helix:followUp.writing.versions")}
          </h3>
          <span className="ml-auto text-[9px] text-faint">{assistantVersions.length}</span>
        </div>
        <div className="grid gap-1.5">
          {assistantVersions.length === 0 && (
            <p className="rounded-lg border border-line/50 bg-white/[0.01] px-3 py-2 text-[10px] text-faint italic">
              {t("helix:followUp.writing.noVersions")}
            </p>
          )}
          {assistantVersions.map((obs, i) => (
            <div key={obs.id} className="rounded-lg border border-line bg-white/[0.02] p-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium text-signal/80">
                  {t("helix:followUp.writing.version", { n: i + 1 })}
                </span>
                <span className="text-[9px] text-faint">{obs.timestamp}</span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-xs text-fg leading-relaxed">{obs.content}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-line bg-white/[0.02] p-3">
        <div className="mb-2 flex items-center gap-1.5">
          <span className="h-1 w-1 rounded-full bg-signal" />
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-mute">
            {t("helix:followUp.writing.addObservation")}
          </h3>
        </div>
        <div className="flex flex-col gap-2">
          <textarea
            value={observation}
            onChange={(e) => setObservation(e.target.value)}
            placeholder={t("helix:followUp.writing.observationPlaceholder")}
            className="min-h-[80px] w-full rounded border border-line bg-ink px-3 py-2 text-xs text-fg placeholder:text-faint"
          />
          <div className="flex justify-end">
            <Button variant="primary" size="sm" onClick={handleAdd} disabled={!observation.trim()}>
              {t("helix:followUp.writing.submit")}
            </Button>
          </div>
        </div>
      </section>

      {showComplete ? (
        <section className="rounded-lg border border-line bg-white/[0.02] p-3">
          <div className="mb-2 flex items-center gap-1.5">
            <span className="h-1 w-1 rounded-full bg-signal" />
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-mute">
              {t("helix:followUp.writing.completeSummary")}
            </h3>
          </div>
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder={t("helix:followUp.writing.summaryPlaceholder")}
            className="min-h-[80px] w-full rounded border border-line bg-ink px-3 py-2 text-xs text-fg placeholder:text-faint"
          />
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowComplete(false)}>
              {t("helix:followUp.writing.cancel")}
            </Button>
            <Button variant="primary" size="sm" onClick={handleComplete} disabled={!summary.trim()}>
              {t("helix:followUp.writing.confirmComplete")}
            </Button>
          </div>
        </section>
      ) : (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={() => setShowComplete(true)}>
            {t("helix:followUp.writing.complete")}
          </Button>
        </div>
      )}
    </div>
  );
}
