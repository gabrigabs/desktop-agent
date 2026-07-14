import type { FollowUpSession } from "@desktop-agent/shared";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../../components/ui/button";

type Props = {
  session: FollowUpSession;
  onAddObservation: (content: string) => void;
  onAddHypothesis: (text: string) => void;
  onComplete: (summary: string) => void;
};

export function FollowUpDebugPanel({ session, onAddObservation, onAddHypothesis, onComplete }: Props) {
  const { t } = useTranslation("helix");
  const [obsText, setObsText] = useState("");
  const [hypText, setHypText] = useState("");
  const [summary, setSummary] = useState("");
  const [showComplete, setShowComplete] = useState(false);

  const handleAddObs = () => {
    if (!obsText.trim()) return;
    onAddObservation(obsText.trim());
    setObsText("");
  };

  const handleAddHyp = () => {
    if (!hypText.trim()) return;
    onAddHypothesis(hypText.trim());
    setHypText("");
  };

  const handleComplete = () => {
    if (!summary.trim()) return;
    onComplete(summary.trim());
  };

  const evidenceByHypothesis = session.hypotheses.map((hyp) => ({
    hypothesis: hyp,
    evidence: session.observations.filter((obs) => hyp.evidenceIds.includes(obs.id)),
  }));

  return (
    <div className="grid gap-4">
      <section className="rounded-lg border border-line p-3">
        <h3 className="text-xs font-semibold text-fg">{t("helix:followUp.debug.initialError")}</h3>
        <p className="mt-2 text-xs text-mute">{session.objective}</p>
      </section>

      <section>
        <h3 className="mb-2 text-xs font-semibold text-fg">
          {t("helix:followUp.debug.hypothesesAndEvidence")}
        </h3>
        <div className="grid gap-2">
          {evidenceByHypothesis.length === 0 && (
            <p className="text-[10px] text-faint">{t("helix:followUp.debug.noHypotheses")}</p>
          )}
          {evidenceByHypothesis.map(({ hypothesis, evidence }) => (
            <div key={hypothesis.id} className="rounded border border-line p-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-fg">{hypothesis.text}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[9px] font-medium ${
                    hypothesis.status === "confirmed"
                      ? "bg-good/20 text-good"
                      : hypothesis.status === "refuted"
                        ? "bg-bad/20 text-bad"
                        : "bg-white/[0.06] text-mute"
                  }`}
                >
                  {t(`helix:followUp.hypothesisStatus.${hypothesis.status}`)}
                </span>
              </div>
              {evidence.length > 0 && (
                <div className="mt-2 grid gap-1 pl-3">
                  {evidence.map((ev) => (
                    <div key={ev.id} className="border-l border-line pl-2">
                      <span className="text-[9px] text-faint">{ev.source}</span>
                      <p className="text-[10px] text-mute">{ev.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-line p-3">
        <h3 className="mb-2 text-xs font-semibold text-fg">{t("helix:followUp.debug.addEvidence")}</h3>
        <div className="flex gap-2">
          <input
            value={obsText}
            onChange={(e) => setObsText(e.target.value)}
            placeholder={t("helix:followUp.debug.evidencePlaceholder")}
            className="flex-1 rounded border border-line bg-ink px-3 py-1.5 text-xs text-fg placeholder:text-faint"
          />
          <Button variant="primary" size="sm" onClick={handleAddObs} disabled={!obsText.trim()}>
            {t("helix:followUp.debug.add")}
          </Button>
        </div>
      </section>

      <section className="rounded-lg border border-line p-3">
        <h3 className="mb-2 text-xs font-semibold text-fg">{t("helix:followUp.debug.addHypothesis")}</h3>
        <div className="flex gap-2">
          <input
            value={hypText}
            onChange={(e) => setHypText(e.target.value)}
            placeholder={t("helix:followUp.debug.hypothesisPlaceholder")}
            className="flex-1 rounded border border-line bg-ink px-3 py-1.5 text-xs text-fg placeholder:text-faint"
          />
          <Button variant="primary" size="sm" onClick={handleAddHyp} disabled={!hypText.trim()}>
            {t("helix:followUp.debug.add")}
          </Button>
        </div>
      </section>

      {showComplete ? (
        <section className="rounded-lg border border-line p-3">
          <h3 className="mb-2 text-xs font-semibold text-fg">{t("helix:followUp.debug.conclusion")}</h3>
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder={t("helix:followUp.debug.conclusionPlaceholder")}
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
