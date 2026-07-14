import type { FollowUpMode } from "@desktop-agent/shared";
import { Activity, ChevronRight, Pause, Play, Square, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../../components/ui/button";
import type { useFollowUp } from "./hooks/useFollowUp";
import type { useSpaces } from "./hooks/useSpaces";
import { FollowUpDebugPanel } from "./FollowUpDebugPanel";
import { FollowUpTimeline } from "./FollowUpTimeline";
import { FollowUpWritingPanel } from "./FollowUpWritingPanel";

type Props = {
  followUp: ReturnType<typeof useFollowUp>;
  spaces: ReturnType<typeof useSpaces>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  compact?: boolean;
  onExpand?: () => void;
};

export function FollowUpDock({ followUp, spaces, open, onOpenChange, compact, onExpand }: Props) {
  const { t } = useTranslation("helix");
  const session = followUp.activeSession;
  const [creating, setCreating] = useState(false);
  const [objective, setObjective] = useState("");
  const [mode, setMode] = useState<Extract<FollowUpMode, "writing" | "debug">>("writing");
  const [spaceId, setSpaceId] = useState(spaces.activeSpaceId ?? "");

  const start = async () => {
    if (!objective.trim()) return;
    const created = await followUp.startSession(mode, objective.trim(), {
      spaceId: spaceId || null,
      memoryScope: "session",
    });
    if (!created) return;
    setCreating(false);
    setObjective("");
    onOpenChange(true);
  };

  return (
    <>
      {session ? (
        <div className="relative z-30 shrink-0 border-b border-cyan-300/15 bg-[#15141e]/95 px-3 py-2 backdrop-blur-xl">
          <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/70 to-transparent" />
          <div className="mx-auto flex max-w-6xl items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenChange(true)}
              className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-1.5 py-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50"
            >
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${
                  session.status === "active"
                    ? "bg-cyan-300 motion-safe:animate-pulse"
                    : session.status === "paused"
                      ? "bg-amber-400"
                      : "bg-red-400"
                }`}
              />
              <span className="min-w-0">
                <span className="block truncate text-[11px] font-semibold text-fg">{session.objective}</span>
                <span className="block text-[9px] uppercase tracking-[0.12em] text-faint">
                  {t(`helix:followUp.mode.${session.mode}`)} · {t(`helix:followUp.status.${session.status}`)}
                </span>
              </span>
            </button>
            {session.status === "active" ? (
              <button type="button" onClick={() => void followUp.pauseSession(session.id)} className="rounded-lg p-2 text-mute hover:bg-white/[0.05] hover:text-fg" aria-label={t("helix:followUp.pause")}>
                <Pause className="h-3.5 w-3.5" />
              </button>
            ) : session.status === "paused" ? (
              <button type="button" onClick={() => void followUp.resumeSession(session.id)} className="rounded-lg p-2 text-mute hover:bg-white/[0.05] hover:text-fg" aria-label={t("helix:followUp.resume")}>
                <Play className="h-3.5 w-3.5" />
              </button>
            ) : null}
            <button type="button" onClick={() => void followUp.stopSession(session.id, "Encerrado pelo usuário")} className="rounded-lg p-2 text-mute hover:bg-bad/10 hover:text-bad" aria-label={t("helix:followUp.stop")}>
              <Square className="h-3.5 w-3.5" />
            </button>
            {compact && onExpand && (
              <button type="button" onClick={onExpand} className="rounded-lg p-2 text-mute hover:bg-white/[0.05] hover:text-fg" aria-label={t("helix:followUp.expand")}>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="shrink-0 border-b border-line/50 bg-[#15141e]/70 px-3 py-1.5">
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="mx-auto flex items-center gap-2 text-[10px] text-faint transition-colors hover:text-cyan-300"
          >
            <Activity className="h-3.5 w-3.5" />
            {t("helix:followUp.start", "Iniciar acompanhamento")}
          </button>
        </div>
      )}

      {(open || creating) && (
        <div className="fixed inset-0 z-[90] flex justify-end bg-black/35 backdrop-blur-[2px]" onMouseDown={() => { onOpenChange(false); setCreating(false); }}>
          <aside
            className="h-full w-full max-w-[390px] overflow-y-auto border-l border-line bg-[#0b0b12] p-4 shadow-2xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-cyan-300" />
                <h2 className="text-sm font-semibold text-fg">{t("helix:followUp.title", "Acompanhamento")}</h2>
              </div>
              <button type="button" onClick={() => { onOpenChange(false); setCreating(false); }} className="rounded-lg p-2 text-faint hover:bg-white/[0.05] hover:text-fg">
                <X className="h-4 w-4" />
              </button>
            </div>

            {creating || !session ? (
              <div className="grid gap-4">
                <label className="grid gap-1.5 text-[10px] uppercase tracking-[0.12em] text-faint">
                  {t("helix:followUp.modeLabel", "Modo")}
                  <select value={mode} onChange={(event) => setMode(event.target.value as "writing" | "debug")} className="h-10 rounded-lg border border-line bg-ink px-3 text-xs text-fg">
                    <option value="writing">{t("helix:followUp.mode.writing")}</option>
                    <option value="debug">{t("helix:followUp.mode.debug")}</option>
                  </select>
                </label>
                <label className="grid gap-1.5 text-[10px] uppercase tracking-[0.12em] text-faint">
                  {t("helix:followUp.objective", "Objetivo")}
                  <textarea value={objective} onChange={(event) => setObjective(event.target.value)} rows={5} className="rounded-lg border border-line bg-ink p-3 text-xs normal-case tracking-normal text-fg outline-none focus:border-cyan-300/45" />
                </label>
                <label className="grid gap-1.5 text-[10px] uppercase tracking-[0.12em] text-faint">
                  {t("helix:followUp.space", "Espaço opcional")}
                  <select value={spaceId} onChange={(event) => setSpaceId(event.target.value)} className="h-10 rounded-lg border border-line bg-ink px-3 text-xs text-fg">
                    <option value="">{t("helix:followUp.noSpace", "Nenhum")}</option>
                    {spaces.spaces.map((space) => <option key={space.id} value={space.id}>{space.name}</option>)}
                  </select>
                </label>
                <Button variant="primary" onClick={() => void start()} disabled={!objective.trim()}>
                  {t("helix:followUp.start", "Iniciar acompanhamento")}
                </Button>
              </div>
            ) : session.mode === "writing" ? (
              <FollowUpWritingPanel
                session={session}
                onAddObservation={(content) => void followUp.addObservation(session.id, content, "manual")}
                onComplete={(summary) => void followUp.completeSession(session.id, summary)}
              />
            ) : session.mode === "debug" ? (
              <FollowUpDebugPanel
                session={session}
                onAddObservation={(content) => void followUp.addObservation(session.id, content, "manual")}
                onAddHypothesis={(text) => void followUp.addHypothesis(session.id, text)}
                onComplete={(summary) => void followUp.completeSession(session.id, summary)}
              />
            ) : (
              <FollowUpTimeline session={session} />
            )}
          </aside>
        </div>
      )}
    </>
  );
}
