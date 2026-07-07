import type { ConnectorConfig, McpTestResult, PermissionLevel } from "@desktop-agent/shared";
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronRight,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import { useId, useState } from "react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { IconButton } from "../../components/ui/icon-button";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import type { SaveConnectorInput } from "./hooks/useCapabilities";

type Props = {
  connectors: ConnectorConfig[];
  testingConnectorId: string | null;
  connectorTestResults?: Record<string, McpTestResult>;
  editingConnectorId?: string | null;
  showAddConnector?: boolean;
  onTest: (id: string) => void;
  onToggle: (id: string) => void;
  onRefresh?: () => void;
  onSaveConnector?: (input: SaveConnectorInput) => void;
  onDeleteConnector?: (id: string) => void;
  onStartEditing?: (id: string) => void;
  onCancelEditing?: () => void;
  onShowAddConnector?: (v: boolean) => void;
  variant?: "list" | "grid";
};

const ALL_PERMISSIONS: PermissionLevel[] = [
  "local.read",
  "local.write",
  "network",
  "browser.control",
  "screen.read",
  "external",
];

function timeAgo(iso?: string): string {
  if (!iso) return "Não testado";
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `Testado há ${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `Testado há ${min}min`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `Testado há ${hr}h`;
  return `Testado há ${Math.floor(hr / 24)}d`;
}

function ConnectorEditor({
  connector,
  onSave,
  onCancel,
}: {
  connector?: ConnectorConfig;
  onSave: (input: SaveConnectorInput) => void;
  onCancel: () => void;
}) {
  const isPreset = connector?.preset ?? false;
  const [name, setName] = useState(connector?.name ?? "");
  const [command, setCommand] = useState(connector?.command ?? "npx");
  const [argsText, setArgsText] = useState((connector?.args ?? []).join("\n"));
  const [envText, setEnvText] = useState(
    Object.entries(connector?.env ?? {})
      .map(([k, v]) => `${k}=${v || ""}`)
      .join("\n"),
  );
  const nameId = useId();
  const commandId = useId();
  const argsId = useId();
  const envId = useId();
  const [permissions, setPermissions] = useState<PermissionLevel[]>(
    connector?.permissionPolicy ?? ["local.read"],
  );

  const togglePerm = (perm: PermissionLevel) => {
    setPermissions((prev) => (prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const args = argsText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    const env: Record<string, string> = {};
    for (const line of envText.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx > 0) {
        env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
      }
    }
    onSave({
      id: connector?.id,
      name: name.trim() || "Sem nome",
      command: command.trim(),
      args,
      env,
      enabled: connector?.enabled ?? false,
      preset: isPreset,
      permissionPolicy: permissions,
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-3 rounded-lg border border-signal/20 bg-signal/[0.03] p-3 flex flex-col gap-2.5"
    >
      <label htmlFor={nameId} className="flex flex-col gap-1">
        <span className="text-[9px] text-mute uppercase font-bold">Nome</span>
        <Input
          id={nameId}
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={isPreset}
          placeholder="Meu MCP"
        />
      </label>
      <label htmlFor={commandId} className="flex flex-col gap-1">
        <span className="text-[9px] text-mute uppercase font-bold">Comando</span>
        <Input
          id={commandId}
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          disabled={isPreset}
          placeholder="npx"
          className="font-mono"
        />
      </label>
      <label htmlFor={argsId} className="flex flex-col gap-1">
        <span className="text-[9px] text-mute uppercase font-bold">Args (um por linha)</span>
        <Textarea
          id={argsId}
          value={argsText}
          onChange={(e) => setArgsText(e.target.value)}
          rows={3}
          placeholder={"-y\n@modelcontextprotocol/server-filesystem\n$HOME/Desktop"}
          className="font-mono resize-y"
        />
      </label>
      <label htmlFor={envId} className="flex flex-col gap-1">
        <span className="text-[9px] text-mute uppercase font-bold">Env vars (KEY=value, uma por linha)</span>
        <Textarea
          id={envId}
          value={envText}
          onChange={(e) => setEnvText(e.target.value)}
          rows={2}
          placeholder="API_KEY=sua-chave-aqui"
          className="font-mono resize-y"
        />
      </label>
      <div className="flex flex-col gap-1">
        <span className="text-[9px] text-mute uppercase font-bold">Permissões</span>
        <div className="flex flex-wrap gap-1">
          {ALL_PERMISSIONS.map((perm) => (
            <button
              key={perm}
              type="button"
              onClick={() => togglePerm(perm)}
              className={`px-1.5 py-0.5 rounded text-[9px] font-mono transition-colors cursor-pointer ${
                permissions.includes(perm)
                  ? "bg-signal/15 text-signal border border-signal/30"
                  : "bg-white/5 text-faint border border-line hover:text-mute"
              }`}
            >
              {perm}
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2 pt-1">
        <Button type="submit" variant="primary" size="sm">
          Salvar
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

function ConnectorCard({
  c,
  variant,
  testingConnectorId,
  testResult,
  isEditing,
  onTest,
  onToggle,
  onSaveConnector,
  onDeleteConnector,
  onStartEditing,
  onCancelEditing,
}: {
  c: ConnectorConfig;
  variant: "list" | "grid";
  testingConnectorId: string | null;
  testResult?: McpTestResult;
  isEditing: boolean;
  onTest: (id: string) => void;
  onToggle: (id: string) => void;
  onSaveConnector?: (input: SaveConnectorInput) => void;
  onDeleteConnector?: (id: string) => void;
  onStartEditing?: (id: string) => void;
  onCancelEditing?: () => void;
}) {
  const [showTools, setShowTools] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isTesting = testingConnectorId === c.id;
  const hasTestResult = Boolean(testResult);
  const testOk = testResult?.ok === true;
  const testError = testResult?.ok === false ? testResult.error : undefined;
  const tools = testResult?.tools ?? [];
  const hasError = Boolean(c.lastError);
  const borderClass = hasTestResult
    ? testOk
      ? "border-good/30"
      : "border-bad/30"
    : hasError
      ? "border-bad/20"
      : "border-line";

  return (
    <div
      className={`rounded-lg border ${borderClass} p-3 flex ${variant === "grid" ? "flex-col gap-3" : "items-start justify-between gap-3"} bg-white/[0.02] transition-colors`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-fg truncate">{c.name}</span>
          {c.preset && <Badge variant="default">preset</Badge>}
        </div>
        <div className="text-[10px] text-faint mt-0.5 truncate font-mono">
          {c.command || c.kind}
          {c.args && c.args.length > 0 ? ` ${c.args.join(" ")}` : ""}
        </div>

        {/* Status feedback */}
        <div className="flex items-center gap-2 mt-1.5">
          <Badge variant={c.enabled ? "success" : "default"}>{c.enabled ? "Ativo" : "Off"}</Badge>
          <span className="text-[9px] text-faint">{timeAgo(c.lastCheckedAt)}</span>
        </div>

        {/* Test error feedback */}
        {testError && (
          <div className="mt-2 flex items-start gap-1.5 rounded-md bg-bad/5 border border-bad/20 px-2 py-1.5">
            <AlertCircle className="w-3 h-3 text-bad shrink-0 mt-0.5" />
            <span className="text-[10px] text-bad leading-relaxed">{testError}</span>
          </div>
        )}

        {/* Test success with tools */}
        {testOk && tools.length > 0 && (
          <div className="mt-2">
            <button
              type="button"
              onClick={() => setShowTools(!showTools)}
              className="flex items-center gap-1 text-[10px] text-good font-semibold hover:text-good/80 transition-colors cursor-pointer"
            >
              {showTools ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              {tools.length} tools detectadas
            </button>
            {showTools && (
              <div className="mt-1.5 flex flex-col gap-1 animate-in fade-in duration-200">
                {tools.map((t) => (
                  <div key={t.name} className="rounded-md bg-white/[0.03] border border-line px-2 py-1">
                    <div className="text-[10px] font-mono text-fg">{t.name}</div>
                    {t.description && (
                      <div className="text-[9px] text-faint mt-0.5 leading-relaxed line-clamp-2">
                        {t.description}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {testOk && tools.length === 0 && (
          <div className="mt-2 flex items-center gap-1 text-[10px] text-good">
            <Check className="w-3 h-3" />
            <span>Conectou sem tools expostas</span>
          </div>
        )}

        {/* Permission tags */}
        <div className="flex flex-wrap gap-1 mt-2">
          {c.permissionPolicy.map((perm) => (
            <span key={perm} className="px-1.5 py-0.5 rounded bg-white/5 text-[9px] font-mono text-faint">
              {perm}
            </span>
          ))}
        </div>

        {/* Env var indicators (masked) */}
        {c.env && Object.keys(c.env).length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {Object.entries(c.env).map(([key, value]) => (
              <span key={key} className="px-1.5 py-0.5 rounded bg-white/5 text-[9px] font-mono text-faint">
                {key}={value ? "••••••••" : "vazio"}
              </span>
            ))}
          </div>
        )}

        {/* Editor */}
        {isEditing && onSaveConnector && onCancelEditing && (
          <ConnectorEditor connector={c} onSave={onSaveConnector} onCancel={onCancelEditing} />
        )}

        {/* Delete confirmation */}
        {confirmDelete && onDeleteConnector && (
          <div className="mt-2 flex items-center gap-2 rounded-md bg-bad/5 border border-bad/20 px-2.5 py-2">
            <span className="text-[10px] text-bad">Remover este conector?</span>
            <Button variant="danger" size="sm" onClick={() => onDeleteConnector(c.id)}>
              Remover
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setConfirmDelete(false)}>
              Não
            </Button>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className={`shrink-0 flex ${variant === "grid" ? "mt-auto" : "flex-col items-end"} gap-1.5`}>
        <div className="flex items-center gap-1.5">
          <Button variant="secondary" size="sm" onClick={() => onTest(c.id)} disabled={isTesting}>
            {isTesting ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
            {isTesting ? "Testando" : "Testar"}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => onToggle(c.id)}>
            {c.enabled ? "Desligar" : "Ligar"}
          </Button>
        </div>
        <div className="flex items-center gap-1.5">
          {onStartEditing && onCancelEditing && onSaveConnector && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => (isEditing ? onCancelEditing() : onStartEditing(c.id))}
            >
              <Pencil className="w-3 h-3" />
              {isEditing ? "Fechar" : "Editar"}
            </Button>
          )}
          {!c.preset && onDeleteConnector && (
            <IconButton
              title="Deletar conector"
              onClick={() => setConfirmDelete(!confirmDelete)}
              className="hover:text-bad"
            >
              <Trash2 className="w-3 h-3" />
            </IconButton>
          )}
        </div>
      </div>
    </div>
  );
}

export function ConnectorsPanel({
  connectors,
  testingConnectorId,
  connectorTestResults,
  editingConnectorId,
  showAddConnector,
  onTest,
  onToggle,
  onRefresh,
  onSaveConnector,
  onDeleteConnector,
  onStartEditing,
  onCancelEditing,
  onShowAddConnector,
  variant = "list",
}: Props) {
  if (connectors.length === 0 && !showAddConnector) {
    return (
      <div className="py-8 text-center flex flex-col gap-3">
        <p className="text-xs text-faint">Nenhum conector carregado ainda.</p>
        {onShowAddConnector && (
          <Button variant="secondary" size="sm" onClick={() => onShowAddConnector(true)} className="mx-auto">
            <Plus className="w-3.5 h-3.5" /> Adicionar conector
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-fg">Conectores e capacidades</p>
          <p className="text-[10px] text-faint mt-0.5">
            MCPs ficam desligados por padrão. Teste antes de ativar.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {onShowAddConnector && (
            <Button
              variant={showAddConnector ? "primary" : "secondary"}
              size="sm"
              onClick={() => onShowAddConnector(!showAddConnector)}
            >
              <Plus className="w-3.5 h-3.5" /> Adicionar
            </Button>
          )}
          {onRefresh && (
            <Button variant="secondary" size="sm" onClick={onRefresh}>
              <RefreshCw className="w-3.5 h-3.5" /> Atualizar
            </Button>
          )}
        </div>
      </div>

      {/* Add connector form */}
      {showAddConnector && onSaveConnector && onCancelEditing && (
        <div className="rounded-lg border border-signal/20 bg-signal/[0.02] p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-signal uppercase">Novo conector MCP</span>
            <IconButton title="Cancelar" onClick={onCancelEditing}>
              <X className="w-3.5 h-3.5" />
            </IconButton>
          </div>
          <ConnectorEditor onSave={onSaveConnector} onCancel={onCancelEditing} />
        </div>
      )}

      <div className={variant === "grid" ? "grid grid-cols-2 gap-3" : "flex flex-col gap-2"}>
        {connectors.map((c) => (
          <ConnectorCard
            key={c.id}
            c={c}
            variant={variant}
            testingConnectorId={testingConnectorId}
            testResult={connectorTestResults?.[c.id]}
            isEditing={editingConnectorId === c.id}
            onTest={onTest}
            onToggle={onToggle}
            onSaveConnector={onSaveConnector}
            onDeleteConnector={onDeleteConnector}
            onStartEditing={onStartEditing}
            onCancelEditing={onCancelEditing}
          />
        ))}
      </div>
    </div>
  );
}
