import { type ArtifactAction, HELIX_ARTIFACTS, type HelixArtifact } from "@desktop-agent/shared";
import {
  ArrowRight,
  Boxes,
  Code2,
  GraduationCap,
  Landmark,
  LayoutGrid,
  Orbit,
  PenLine,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import type { ComponentType } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "../../components/ui/badge";

type Props = {
  onUseAction: (artifact: HelixArtifact, action: ArtifactAction) => void;
  variant?: "compact" | "page";
};

const ICONS: Record<string, ComponentType<{ className?: string }>> = {
  landmark: Landmark,
  "code-2": Code2,
  "graduation-cap": GraduationCap,
  "pen-line": PenLine,
  boxes: Boxes,
};

function useModeLabels(): Record<"collapsed" | "normal" | "expanded", string> {
  const { t } = useTranslation("helix");
  return {
    collapsed: t("helix:artifactsPanel.modeCollapsed"),
    normal: t("helix:artifactsPanel.modeNormal"),
    expanded: t("helix:artifactsPanel.modeExpanded"),
  };
}

function getArtifactActionKey(artifactId: string, actionId: string): string {
  const suffix = actionId.replace(`${artifactId}-`, "");
  return `helix:radialArtifacts.${artifactId}.${suffix}`;
}

export function ArtifactsPanel({ onUseAction, variant = "page" }: Props) {
  const { t } = useTranslation("helix");
  const modeLabels = useModeLabels();
  return (
    <div className="flex flex-col gap-6">
      <header
        className={`grid gap-4 border-b border-line ${
          variant === "page"
            ? "pb-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"
            : "pb-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
        }`}
      >
        <div className="min-w-0">
          {variant === "page" && (
            <>
              <div className="mb-2 flex items-center gap-2 text-[9px] font-mono uppercase tracking-[0.16em] text-faint">
                <Orbit className="h-3 w-3 text-signal" />
                {t("helix:artifactsPanel.catalog")}
              </div>
              <h2 className="text-lg font-semibold tracking-tight text-fg">
                {t("helix:artifactsPanel.title")}
              </h2>
            </>
          )}
          <p
            className={`${variant === "page" ? "mt-1.5 text-xs" : "text-[10px]"} max-w-2xl leading-relaxed text-mute`}
          >
            {t("helix:artifactsPanel.description")}
          </p>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-faint">
          <LayoutGrid className="h-3.5 w-3.5" />
          {t("helix:artifactsPanel.availableCount", { count: HELIX_ARTIFACTS.length })}
        </div>
      </header>

      <div className="grid gap-3 lg:grid-cols-2">
        {HELIX_ARTIFACTS.map((artifact) => {
          const Icon = ICONS[artifact.icon] ?? Orbit;
          return (
            <article
              key={artifact.id}
              className="group relative flex min-w-0 flex-col overflow-hidden rounded-2xl border border-line bg-white/[0.018] transition-colors hover:border-line-strong hover:bg-white/[0.028]"
            >
              <span
                className="absolute inset-y-0 left-0 w-px opacity-75"
                style={{ backgroundColor: artifact.color }}
                aria-hidden="true"
              />
              <div className="flex items-start gap-3.5 p-4 pb-3.5">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border"
                  style={{
                    color: artifact.color,
                    borderColor: `${artifact.color}32`,
                    backgroundColor: `${artifact.color}0d`,
                  }}
                >
                  <Icon className="h-4.5 w-4.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="truncate text-sm font-semibold text-fg">
                      {t(`helix:radialArtifacts.${artifact.id}.name`)}
                    </h3>
                    <Badge className="shrink-0 font-mono">{modeLabels[artifact.ui.preferredMode]}</Badge>
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-mute">
                    {t(`helix:radialArtifacts.${artifact.id}.shortDescription`)}
                  </p>
                </div>
              </div>

              <p className="px-4 pb-3 text-[10px] leading-relaxed text-faint">
                {t(`helix:radialArtifacts.${artifact.id}.description`)}
              </p>

              <div className="mx-4 flex flex-wrap gap-x-3 gap-y-1 border-y border-line py-2.5">
                {artifact.capabilities.slice(0, 3).map((capability) => (
                  <span key={capability} className="text-[9px] text-mute">
                    {capability}
                  </span>
                ))}
              </div>

              <div className="mt-3 grid gap-px bg-line">
                {artifact.quickActions.map((action) => (
                  <button
                    key={action.id}
                    type="button"
                    aria-label={`${t(`helix:radialArtifacts.${artifact.id}.name`)}: ${t(getArtifactActionKey(artifact.id, action.id))}`}
                    onClick={() => onUseAction(artifact, action)}
                    className="group/action grid min-h-11 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 bg-[#0e0c14] px-4 py-2.5 text-left transition-colors hover:bg-white/[0.045]"
                  >
                    <span className="min-w-0">
                      <span className="block text-[10px] font-semibold text-fg">
                        {t(getArtifactActionKey(artifact.id, action.id))}
                      </span>
                      {action.description && (
                        <span className="mt-0.5 block truncate text-[9px] text-faint">
                          {t(`${getArtifactActionKey(artifact.id, action.id)}Description`)}
                        </span>
                      )}
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 text-faint transition-transform group-hover/action:translate-x-0.5 group-hover/action:text-fg" />
                  </button>
                ))}
              </div>

              <div className="mt-auto flex flex-wrap items-center gap-3 px-4 py-3 text-[8px] text-faint">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3" />
                  {t("helix:artifactsPanel.confirmation")}{" "}
                  {artifact.contextPolicy.requiresConfirmationForSensitiveActions
                    ? t("helix:artifactsPanel.confirmationActive")
                    : t("helix:artifactsPanel.confirmationOnDemand")}
                </span>
                <span className="flex items-center gap-1">
                  <Wrench className="h-3 w-3" />
                  {artifact.tools.length} {t("helix:artifactsPanel.toolsLabel")}
                </span>
                <span className="ml-auto font-mono">v{artifact.version}</span>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
