import type { FollowUpSession } from "@desktop-agent/shared";
import { useTranslation } from "react-i18next";

type Props = {
  session: FollowUpSession;
};

export function FollowUpTimeline({ session }: Props) {
  const { t } = useTranslation("helix");

  return (
    <div className="grid gap-4">
      <section>
        <h3 className="mb-2 text-xs font-semibold text-fg">{t("helix:followUp.observations")}</h3>
        <div className="grid gap-1.5">
          {session.observations.length === 0 && (
            <p className="text-[10px] text-faint">{t("helix:followUp.noObservations")}</p>
          )}
          {session.observations.map((obs) => (
            <div key={obs.id} className="rounded border border-line p-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium text-mute">{obs.source}</span>
                <span className="text-[9px] text-faint">{obs.timestamp}</span>
              </div>
              <p className="mt-1 text-xs text-fg">{obs.content}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-xs font-semibold text-fg">{t("helix:followUp.hypotheses")}</h3>
        <div className="grid gap-1.5">
          {session.hypotheses.length === 0 && (
            <p className="text-[10px] text-faint">{t("helix:followUp.noHypotheses")}</p>
          )}
          {session.hypotheses.map((hyp) => (
            <div key={hyp.id} className="rounded border border-line p-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-fg">{hyp.text}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[9px] font-medium ${
                    hyp.status === "confirmed"
                      ? "bg-good/20 text-good"
                      : hyp.status === "refuted"
                        ? "bg-bad/20 text-bad"
                        : "bg-white/[0.06] text-mute"
                  }`}
                >
                  {t(`helix:followUp.hypothesisStatus.${hyp.status}`)}
                </span>
              </div>
              {hyp.evidenceIds.length > 0 && (
                <div className="mt-1 text-[9px] text-faint">
                  {t("helix:followUp.evidence")}: {hyp.evidenceIds.length}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-xs font-semibold text-fg">{t("helix:followUp.eventTimeline")}</h3>
        <div className="grid gap-1">
          {session.events.map((event) => (
            <div key={event.id} className="flex items-center gap-2 text-[10px] text-faint">
              <span className="font-mono text-[9px] text-mute">{event.timestamp}</span>
              <span className="rounded bg-white/[0.04] px-1.5 py-0.5 font-medium text-mute">
                {t(`helix:followUp.eventType.${event.type}`)}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-xs font-semibold text-fg">{t("helix:followUp.permissionsAudit")}</h3>
        <div className="grid grid-cols-3 gap-2">
          <PermissionBadge
            label={t("helix:followUp.permScreenCapture")}
            enabled={session.contextPolicy.screenCapture}
          />
          <PermissionBadge
            label={t("helix:followUp.permClipboard")}
            enabled={session.contextPolicy.clipboard}
          />
          <PermissionBadge
            label={t("helix:followUp.permFileAccess")}
            enabled={session.contextPolicy.fileAccess}
          />
        </div>
      </section>
    </div>
  );
}

function PermissionBadge({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <div
      className={`rounded-lg border p-2 text-center text-[10px] font-medium ${
        enabled ? "border-signal/30 bg-signal/10 text-fg" : "border-line text-faint"
      }`}
    >
      {label}
      <div className={`mt-1 text-[9px] ${enabled ? "text-signal" : "text-faint"}`}>
        {enabled ? "ON" : "OFF"}
      </div>
    </div>
  );
}
