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

const MODE_LABELS = {
  collapsed: "Pet",
  normal: "Normal",
  expanded: "Expandido",
} as const;

export function ArtifactsPanel({ onUseAction }: Props) {
  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Orbit className="w-4 h-4 text-signal" />
            <h2 className="text-sm font-bold text-fg">Artefatos</h2>
            <Badge variant="signal">Experimental</Badge>
          </div>
          <p className="mt-1.5 max-w-2xl text-[11px] leading-relaxed text-mute">
            Assistentes especializados com identidade, ações e política de contexto próprias. Nesta fase, o
            catálogo é local e as ações iniciam uma conversa normal.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          className="whitespace-nowrap"
          disabled
          title="Criação e persistência entram em uma próxima fase"
        >
          Criar artefato
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
                    <h3 className="text-sm font-bold text-fg">{artifact.name}</h3>
                    {index === 0 && <Badge variant="success">Destaque</Badge>}
                    <Badge>{MODE_LABELS[artifact.ui.preferredMode]}</Badge>
                  </div>
                  <p className="mt-1 text-[11px] font-medium text-mute">{artifact.shortDescription}</p>
                </div>
              </div>

              <p className="text-[11px] leading-relaxed text-mute">{artifact.description}</p>

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
                    aria-label={`${artifact.name}: ${action.title}`}
                    onClick={() => onUseAction(artifact, action)}
                    className="group min-h-14 rounded-xl border border-line-strong bg-ink/35 px-3 py-2.5 text-left transition-colors hover:border-signal/30 hover:bg-white/[0.06]"
                  >
                    <span className="flex items-center justify-between gap-2 text-[11px] font-semibold text-fg">
                      {action.title}
                      <ArrowRight className="w-3.5 h-3.5 text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-fg" />
                    </span>
                    {action.description && (
                      <span className="mt-1 block text-[9px] leading-relaxed text-mute">
                        {action.description}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              <div className="mt-auto flex flex-wrap items-center gap-3 border-t border-line pt-3 text-[9px] text-mute">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  Confirmação{" "}
                  {artifact.contextPolicy.requiresConfirmationForSensitiveActions ? "ativa" : "sob demanda"}
                </span>
                <span className="flex items-center gap-1">
                  <Wrench className="w-3 h-3" />
                  {artifact.tools.length} ferramentas previstas
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
