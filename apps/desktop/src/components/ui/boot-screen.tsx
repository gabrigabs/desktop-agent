import { RefreshCw, Settings } from "lucide-react";
import { restartRpc } from "../../lib/rpc";
import { useAgentStore } from "../../stores/agent";
import { Button } from "./button";
import { Pet } from "./pet";

interface BootScreenProps {
  compact?: boolean;
}

const BOOT_LABELS = ["Inicializando agente...", "Carregando perfis...", "Conectando ao modelo..."];

export function BootScreen({ compact }: BootScreenProps) {
  const bootState = useAgentStore((s) => s.bootState);
  const bootError = useAgentStore((s) => s.bootError);

  const handleRetry = () => {
    void restartRpc().catch(() => undefined);
  };

  const handleOpenSettings = () => {
    window.dispatchEvent(new CustomEvent("open-settings"));
  };

  if (compact) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 p-2">
        <Pet size={48} variant="dot" />
        {bootState === "error" && bootError ? (
          <span className="text-[10px] text-bad text-center leading-relaxed max-w-[160px]">{bootError}</span>
        ) : (
          <span className="text-[10px] text-mute animate-pulse">Conectando...</span>
        )}
        {bootState === "error" && (
          <Button variant="secondary" size="sm" onClick={handleRetry} className="h-6 px-2 text-[10px]">
            <RefreshCw className="w-3 h-3" /> Retry
          </Button>
        )}
      </div>
    );
  }

  return (
    <div
      className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-6 p-6 text-fg"
      style={{
        background:
          "radial-gradient(120% 80% at 50% 0%, rgba(196, 153, 244, 0.10), transparent 45%), radial-gradient(110% 90% at 50% 100%, rgba(95, 208, 160, 0.07), transparent 50%), linear-gradient(180deg, rgba(14, 12, 22, 0.96), rgba(10, 9, 15, 0.98))",
        backdropFilter: "blur(20px) saturate(140%)",
        WebkitBackdropFilter: "blur(20px) saturate(140%)",
      }}
    >
      <div className="relative flex flex-col items-center gap-4">
        <div className="absolute inset-[-40%] rounded-full pointer-events-none animate-pulse-soft">
          <div
            className="w-full h-full rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgba(196, 153, 244, 0.18) 0%, rgba(95, 208, 160, 0.08) 35%, transparent 60%)",
              filter: "blur(24px)",
            }}
          />
        </div>

        <Pet size={120} variant="full" glow />

        <div className="flex flex-col items-center gap-2 z-10">
          <span className="text-xl font-semibold tracking-tight">Helix</span>
          {bootState === "error" ? (
            <span className="text-xs text-bad max-w-xs text-center leading-relaxed">
              {bootError || "Falha ao conectar com o agente."}
            </span>
          ) : (
            <span className="text-xs text-mute min-h-[1.25rem] animate-pulse">{BOOT_LABELS[0]}</span>
          )}
        </div>
      </div>

      {bootState === "error" ? (
        <div className="flex items-center gap-2 z-10">
          <Button variant="primary" size="md" onClick={handleRetry}>
            <RefreshCw className="w-3.5 h-3.5" /> Retry
          </Button>
          <Button variant="secondary" size="md" onClick={handleOpenSettings}>
            <Settings className="w-3.5 h-3.5" /> Abrir configurações
          </Button>
        </div>
      ) : (
        <div className="w-48 h-1 rounded-full bg-white/[0.06] overflow-hidden z-10">
          <div
            className="h-full bg-gradient-to-r from-signal to-good rounded-full animate-pulse-soft"
            style={{
              width: "60%",
              animation: "shimmer 1.5s ease-in-out infinite",
            }}
          />
        </div>
      )}

      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(166%); }
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-pulse-soft { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
