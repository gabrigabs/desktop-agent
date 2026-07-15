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
        <div className="mb-2 flex items-center gap-1.5">
          <span className="h-1 w-1 rounded-full bg-signal" />
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-mute">
            {t("helix:followUp.observations")}
          </h3>
          <span className="ml-auto text-[9px] text-faint">{session.observations.length}</span>
        </div>
        <div className="grid gap-1.5">
          {session.observations.length === 0 && (
            <p className="rounded-lg border border-line/50 bg-white/[0.01] px-3 py-2 text-[10px] text-faint italic">
              {t("helix:followUp.noObservations")}
            </p>
          )}
          {session.observations.map((obs) => (
            <div key={obs.id} className="rounded-lg border border-line bg-white/[0.02] p-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="text-[10px] font-medium text-signal/80">{obs.source}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[8px] font-medium ${
                      obs.status === "resolved"
                        ? "bg-good/10 text-good"
                        : obs.status === "in_progress"
                          ? "bg-signal/10 text-signal"
                          : "bg-warn/10 text-warn"
                    }`}
                  >
                    {t(`helix:followUp.observationStatus.${obs.status}`)}
                  </span>
                </div>
                <span className="text-[9px] text-faint">{obs.timestamp}</span>
              </div>
              {obs.target && (
                <div className="mt-1 truncate font-mono text-[9px] text-faint">{obs.target}</div>
              )}
              <p className="mt-1 text-xs text-fg leading-relaxed">{obs.content}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-center gap-1.5">
          <span className="h-1 w-1 rounded-full bg-signal" />
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-mute">
            {t("helix:followUp.hypotheses")}
          </h3>
          <span className="ml-auto text-[9px] text-faint">{session.hypotheses.length}</span>
        </div>
        <div className="grid gap-1.5">
          {session.hypotheses.length === 0 && (
            <p className="rounded-lg border border-line/50 bg-white/[0.01] px-3 py-2 text-[10px] text-faint italic">
              {t("helix:followUp.noHypotheses")}
            </p>
          )}
          {session.hypotheses.map((hyp) => (
            <div key={hyp.id} className="rounded-lg border border-line bg-white/[0.02] p-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-fg">{hyp.text}</span>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-medium ${
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
        <div className="mb-2 flex items-center gap-1.5">
          <span className="h-1 w-1 rounded-full bg-signal" />
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-mute">
            {t("helix:followUp.eventTimeline")}
          </h3>
        </div>
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
        <div className="mb-2 flex items-center gap-1.5">
          <span className="h-1 w-1 rounded-full bg-signal" />
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-mute">
            {t("helix:followUp.permissionsAudit")}
          </h3>
        </div>
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
      className={`rounded-lg border p-2 text-center text-[10px] font-medium transition-colors ${
        enabled ? "border-signal/30 bg-signal/10 text-fg" : "border-line bg-white/[0.01] text-faint"
      }`}
    >
      {label}
      <div className={`mt-1 text-[9px] ${enabled ? "text-signal" : "text-faint"}`}>
        {enabled ? "ON" : "OFF"}
      </div>
    </div>
  );
}
