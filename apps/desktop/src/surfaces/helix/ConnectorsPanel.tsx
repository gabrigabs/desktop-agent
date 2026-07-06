import type { ConnectorConfig } from "@desktop-agent/shared";
import { RefreshCw } from "lucide-react";

type Props = {
  connectors: ConnectorConfig[];
  testingConnectorId: string | null;
  onTest: (id: string) => void;
  onToggle: (id: string) => void;
  onRefresh?: () => void;
  variant?: "list" | "grid";
};

export function ConnectorsPanel({
  connectors,
  testingConnectorId,
  onTest,
  onToggle,
  onRefresh,
  variant = "list",
}: Props) {
  if (connectors.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-xs text-faint">Nenhum conector carregado ainda.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {onRefresh && (
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-fg">Conectores e capacidades</p>
            <p className="text-[10px] text-faint mt-0.5">
              MCPs ficam desligados por padrão. Ações sensíveis pedem aprovação no workflow.
            </p>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            className="h-8 px-2.5 rounded-lg border border-line text-[10px] font-semibold text-mute hover:text-fg transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Atualizar
          </button>
        </div>
      )}

      <div className={variant === "grid" ? "grid grid-cols-2 gap-3" : "flex flex-col gap-2"}>
        {connectors.map((c) => (
          <div
            key={c.id}
            className={`rounded-lg border border-line p-3 flex ${variant === "grid" ? "flex-col gap-3" : "items-start justify-between gap-3"} bg-white/[0.02]`}
          >
            <div className="min-w-0">
              <div className="text-xs font-semibold text-fg truncate">{c.name}</div>
              <div className="text-[10px] text-faint mt-0.5 truncate font-mono">{c.command || c.kind}</div>
              <div className="flex flex-wrap gap-1 mt-2">
                {c.permissionPolicy.map((perm) => (
                  <span
                    key={perm}
                    className="px-1.5 py-0.5 rounded bg-white/5 text-[9px] font-mono text-faint"
                  >
                    {perm}
                  </span>
                ))}
              </div>
            </div>
            <div className={`shrink-0 flex ${variant === "grid" ? "mt-auto" : "flex-col items-end"} gap-2`}>
              <span
                className={`px-2 py-0.5 rounded text-[9px] font-mono uppercase ${c.enabled ? "text-good bg-good/10 border border-good/20" : "text-faint bg-white/5 border border-line"}`}
              >
                {c.enabled ? "Ativo" : "Off"}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onTest(c.id)}
                  disabled={testingConnectorId === c.id}
                  className="h-7 px-2 rounded-md border border-line text-[10px] font-semibold text-mute hover:text-fg transition-colors cursor-pointer disabled:opacity-50"
                >
                  {testingConnectorId === c.id ? "Testando" : "Testar"}
                </button>
                <button
                  type="button"
                  onClick={() => onToggle(c.id)}
                  className="h-7 px-2 rounded-md border border-line text-[10px] font-semibold text-mute hover:text-fg transition-colors cursor-pointer"
                >
                  {c.enabled ? "Desligar" : "Ligar"}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
