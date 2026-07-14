import type { FollowUpSession, WorkflowRun } from "@desktop-agent/shared";
import { AlertTriangle, ArrowUpRight, Check, LoaderCircle, RotateCcw, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Pet } from "./pet";

type Props = {
  run: WorkflowRun | null;
  streaming: boolean;
  result: string | null;
  error: string | null;
  latestLog?: string;
  followUp: FollowUpSession | null;
  petSize: number;
  onOpen: () => void;
  onApproval: (approved: boolean) => void;
  onDismiss: () => void;
};

export function TaskWidget({
  run,
  streaming,
  result,
  error,
  latestLog,
  followUp,
  petSize,
  onOpen,
  onApproval,
  onDismiss,
}: Props) {
  const { t } = useTranslation("helix");
  const approval = run?.status === "waiting_approval" ? run.approval : null;
  const status = approval
    ? t("helix:collapsedTask.approval")
    : error
      ? t("helix:collapsedTask.failed")
      : streaming
        ? t("helix:collapsedTask.running")
        : result
          ? t("helix:collapsedTask.ready")
          : t("helix:collapsedTask.preparing");
  const detail = approval?.toolName ?? latestLog ?? error ?? result ?? followUp?.objective ?? status;

  return (
    <section
      className="relative h-full w-full overflow-hidden rounded-[24px] border border-white/[0.09] bg-[rgba(13,12,19,0.97)] text-fg shadow-[0_16px_42px_rgba(0,0,0,0.42)] backdrop-blur-2xl"
      aria-label={t("helix:collapsedTask.label")}
    >
      <div className="absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-signal/70 to-transparent" />
      <div className="flex h-full items-center gap-2.5 px-3 py-2.5">
        <button
          type="button"
          onClick={onOpen}
          className="relative flex h-[62px] w-[48px] shrink-0 items-center justify-center rounded-[17px] border border-white/[0.06] bg-white/[0.025] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/60"
          aria-label={t("helix:collapsedTask.open")}
        >
          <Pet size={Math.min(petSize, 44)} />
          <span
            className={`absolute bottom-1.5 right-1.5 h-1.5 w-1.5 rounded-full ${
              error
                ? "bg-bad"
                : approval
                  ? "bg-warn"
                  : streaming
                    ? "bg-signal motion-safe:animate-pulse"
                    : "bg-good"
            }`}
          />
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {error ? (
              <AlertTriangle className="h-3 w-3 shrink-0 text-bad" />
            ) : streaming ? (
              <LoaderCircle className="h-3 w-3 shrink-0 animate-spin text-signal" />
            ) : (
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${approval ? "bg-warn" : "bg-good"}`} />
            )}
            <span className="truncate text-[9px] font-semibold uppercase tracking-[0.13em] text-mute">
              {status}
            </span>
            {followUp && (
              <span className="ml-auto rounded-full border border-signal/20 bg-signal/[0.07] px-1.5 py-0.5 text-[7px] font-semibold uppercase tracking-wider text-signal">
                {t("helix:collapsedTask.followUp")}
              </span>
            )}
          </div>
          <p className="mt-1 line-clamp-2 min-h-7 text-[10px] leading-[1.35] text-fg/85">{detail}</p>

          <div className="mt-1.5 flex items-center gap-1">
            {approval ? (
              <>
                <button
                  type="button"
                  onClick={() => onApproval(true)}
                  className="flex h-6 flex-1 items-center justify-center gap-1 rounded-lg bg-good/15 text-[9px] font-semibold text-good hover:bg-good/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-good/50"
                >
                  <Check className="h-3 w-3" />
                  {t("helix:collapsedTask.approve")}
                </button>
                <button
                  type="button"
                  onClick={() => onApproval(false)}
                  className="flex h-6 w-7 items-center justify-center rounded-lg bg-bad/10 text-bad hover:bg-bad/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bad/50"
                  aria-label={t("helix:collapsedTask.deny")}
                >
                  <X className="h-3 w-3" />
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onOpen}
                  className="flex h-6 flex-1 items-center justify-center gap-1 rounded-lg border border-white/[0.07] bg-white/[0.035] text-[9px] font-semibold text-mute hover:border-signal/25 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/50"
                >
                  {error ? <RotateCcw className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
                  {t("helix:collapsedTask.open")}
                </button>
                {!streaming && (
                  <button
                    type="button"
                    onClick={onDismiss}
                    className="flex h-6 w-7 items-center justify-center rounded-lg text-faint hover:bg-white/[0.05] hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/50"
                    aria-label={t("helix:collapsedTask.dismiss")}
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
