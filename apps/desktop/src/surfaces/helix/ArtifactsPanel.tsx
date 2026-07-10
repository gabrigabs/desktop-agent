import { type ArtifactAction, HELIX_ARTIFACTS, type HelixArtifact } from "@desktop-agent/shared";
import {
  ArrowRight,
  Boxes,
  Check,
  Code2,
  GraduationCap,
  Landmark,
  Orbit,
  PenLine,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import type { ComponentType } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";

type Props = {
  onUseAction: (artifact: HelixArtifact, action: ArtifactAction) => void;
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

export function ArtifactsPanel({ onUseAction }: Props) {
  const { t } = useTranslation("helix");
  const modeLabels = useModeLabels();
  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Orbit className="w-4 h-4 text-signal" />
            <h2 className="text-sm font-bold text-fg">{t("helix:artifactsPanel.title")}</h2>
            <Badge variant="signal">{t("helix:artifactsPanel.experimental")}</Badge>
          </div>
          <p className="mt-1.5 max-w-2xl text-[11px] leading-relaxed text-mute">
            {t("helix:artifactsPanel.description")}
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          className="whitespace-nowrap"
          disabled
          title={t("helix:artifactsPanel.createDisabled")}
        >
          {t("helix:artifactsPanel.createArtifact")}
        </Button>
      </header>

      <div className="grid gap-4 xl:grid-cols-2">
        {HELIX_ARTIFACTS.map((artifact, index) => {
          const Icon = ICONS[artifact.icon] ?? Orbit;
          return (
            <Card
              key={artifact.id}
              className={`flex flex-col gap-4 bg-ink/45 ${index === 0 ? "border-good/30" : ""}`}
            >
              <div className="flex items-start gap-3">
                <div
                  className="w-10 h-10 shrink-0 rounded-xl border flex items-center justify-center"
                  style={{
                    color: artifact.color,
                    borderColor: `${artifact.color}40`,
                    backgroundColor: `${artifact.color}12`,
                  }}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-bold text-fg">
                      {t(`helix:radialArtifacts.${artifact.id}.name`)}
                    </h3>
                    {index === 0 && <Badge variant="success">{t("helix:artifactsPanel.featured")}</Badge>}
                    <Badge>{modeLabels[artifact.ui.preferredMode]}</Badge>
                  </div>
                  <p className="mt-1 text-[11px] font-medium text-mute">
                    {t(`helix:radialArtifacts.${artifact.id}.shortDescription`)}
                  </p>
                </div>
              </div>

              <p className="text-[11px] leading-relaxed text-mute">
                {t(`helix:radialArtifacts.${artifact.id}.description`)}
              </p>

              <div className="flex flex-wrap gap-1.5">
                {artifact.capabilities.slice(0, 4).map((capability) => (
                  <Badge key={capability}>{capability}</Badge>
                ))}
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                {artifact.quickActions.map((action) => (
                  <button
                    key={action.id}
                    type="button"
                    aria-label={`${t(`helix:radialArtifacts.${artifact.id}.name`)}: ${t(getArtifactActionKey(artifact.id, action.id))}`}
                    onClick={() => onUseAction(artifact, action)}
                    className="group min-h-14 rounded-xl border border-line-strong bg-ink/35 px-3 py-2.5 text-left transition-colors hover:border-signal/30 hover:bg-white/[0.06]"
                  >
                    <span className="flex items-center justify-between gap-2 text-[11px] font-semibold text-fg">
                      {t(getArtifactActionKey(artifact.id, action.id))}
                      <ArrowRight className="w-3.5 h-3.5 text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-fg" />
                    </span>
                    {action.description && (
                      <span className="mt-1 block text-[9px] leading-relaxed text-mute">
                        {t(`${getArtifactActionKey(artifact.id, action.id)}Description`)}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              <div className="mt-auto flex flex-wrap items-center gap-3 border-t border-line pt-3 text-[9px] text-mute">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  {t("helix:artifactsPanel.confirmation")}{" "}
                  {artifact.contextPolicy.requiresConfirmationForSensitiveActions
                    ? t("helix:artifactsPanel.confirmationActive")
                    : t("helix:artifactsPanel.confirmationOnDemand")}
                </span>
                <span className="flex items-center gap-1">
                  <Wrench className="w-3 h-3" />
                  {artifact.tools.length} {t("helix:artifactsPanel.toolsLabel")}
                </span>
                <span className="flex items-center gap-1 text-good">
                  <Check className="w-3 h-3" />v{artifact.version}
                </span>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
