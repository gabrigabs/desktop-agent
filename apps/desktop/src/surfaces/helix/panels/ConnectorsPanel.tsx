import type { ConnectorConfig, McpTestResult, PermissionLevel } from "@desktop-agent/shared";
import {
  Activity,
  AlertCircle,
  Check,
  ChevronDown,
  ChevronRight,
  Pencil,
  Plus,
  RefreshCw,
  ServerCog,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "../../../components/ui/primitives/badge";
import { Button } from "../../../components/ui/primitives/button";
import { IconButton } from "../../../components/ui/primitives/icon-button";
import { Input } from "../../../components/ui/primitives/input";
import { Textarea } from "../../../components/ui/primitives/textarea";
import type { SaveConnectorInput } from "../hooks/useCapabilities";

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

function useTimeAgo(): (iso?: string) => string {
  const { t } = useTranslation("helix");
  return (iso?: string): string => {
    if (!iso) return t("helix:connectorsPanel.notTested");
    const diff = Date.now() - new Date(iso).getTime();
    const sec = Math.floor(diff / 1000);
    if (sec < 60) return t("helix:connectorsPanel.testedSeconds", { sec });
    const min = Math.floor(sec / 60);
    if (min < 60) return t("helix:connectorsPanel.testedMinutes", { min });
    const hr = Math.floor(min / 60);
    if (hr < 24) return t("helix:connectorsPanel.testedHours", { hr });
    return t("helix:connectorsPanel.testedDays", { days: Math.floor(hr / 24) });
  };
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
  const { t } = useTranslation("helix");
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
      name: name.trim() || t("helix:connectorsPanel.unnamed"),
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
        <span className="text-[9px] text-mute uppercase font-bold">{t("helix:connectorsPanel.name")}</span>
        <Input
          id={nameId}
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={isPreset}
          placeholder={t("helix:connectorsPanel.namePlaceholder")}
        />
      </label>
      <label htmlFor={commandId} className="flex flex-col gap-1">
        <span className="text-[9px] text-mute uppercase font-bold">{t("helix:connectorsPanel.command")}</span>
        <Input
          id={commandId}
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          disabled={isPreset}
          placeholder={t("helix:connectorsPanel.commandPlaceholder")}
          className="font-mono"
        />
      </label>
      <label htmlFor={argsId} className="flex flex-col gap-1">
        <span className="text-[9px] text-mute uppercase font-bold">{t("helix:connectorsPanel.args")}</span>
        <Textarea
          id={argsId}
          value={argsText}
          onChange={(e) => setArgsText(e.target.value)}
          rows={3}
          placeholder={t("helix:connectorsPanel.argsPlaceholder")}
          className="font-mono resize-y"
        />
      </label>
      <label htmlFor={envId} className="flex flex-col gap-1">
        <span className="text-[9px] text-mute uppercase font-bold">{t("helix:connectorsPanel.env")}</span>
        <Textarea
          id={envId}
          value={envText}
          onChange={(e) => setEnvText(e.target.value)}
          rows={2}
          placeholder={t("helix:connectorsPanel.envPlaceholder")}
          className="font-mono resize-y"
        />
      </label>
      <div className="flex flex-col gap-1">
        <span className="text-[9px] text-mute uppercase font-bold">
          {t("helix:connectorsPanel.permissions")}
        </span>
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
          {t("helix:connectorsPanel.save")}
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={onCancel}>
          {t("helix:connectorsPanel.cancel")}
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
  const { t } = useTranslation("helix");
  const timeAgo = useTimeAgo();
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
      className={`relative rounded-2xl border ${borderClass} p-4 flex ${variant === "grid" ? "flex-col gap-4" : "items-start justify-between gap-4"} ${isEditing ? "col-span-full" : ""} bg-white/[0.018] transition-colors hover:bg-white/[0.028]`}
    >
      <div className="min-w-0 flex-1">
        <div className="grid grid-cols-[36px_minmax(0,1fr)_auto] items-start gap-3">
          <span
            className={`flex h-9 w-9 items-center justify-center rounded-xl border ${
              c.enabled
                ? "border-good/20 bg-good/[0.06] text-good"
                : "border-line bg-white/[0.025] text-faint"
            }`}
          >
            <ServerCog className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate text-xs font-semibold text-fg">{c.name}</span>
              {c.preset && <Badge variant="default">{t("helix:connectorsPanel.preset")}</Badge>}
            </div>
            <div className="mt-1 truncate font-mono text-[9px] text-faint">
              {c.command || c.kind}
              {c.args && c.args.length > 0 ? ` ${c.args.join(" ")}` : ""}
            </div>
          </div>
          <span
            className={`mt-1 h-2 w-2 rounded-full ${c.enabled ? "bg-good shadow-[0_0_10px_rgba(95,208,160,0.5)]" : "bg-faint"}`}
            title={c.enabled ? t("helix:connectorsPanel.active") : t("helix:connectorsPanel.off")}
          />
        </div>

        <div className="mt-3 flex items-center gap-2 border-y border-line py-2 text-[9px] text-faint">
          <Activity className="h-3 w-3" />
          <span>{timeAgo(c.lastCheckedAt)}</span>
          <span className="ml-auto font-mono">
            {c.permissionPolicy.length}{" "}
            {t("helix:connectorsPanel.permissionCount", { count: c.permissionPolicy.length })}
          </span>
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
              {t("helix:connectorsPanel.toolsDetected", { count: tools.length })}
            </button>
            {showTools && (
              <div className="mt-1.5 flex flex-col gap-1 animate-in fade-in duration-200">
                {tools.map((tool) => (
                  <div key={tool.name} className="rounded-md bg-white/[0.03] border border-line px-2 py-1">
                    <div className="text-[10px] font-mono text-fg">{tool.name}</div>
                    {tool.description && (
                      <div className="text-[9px] text-faint mt-0.5 leading-relaxed line-clamp-2">
                        {tool.description}
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
            <span>{t("helix:connectorsPanel.connectedNoTools")}</span>
          </div>
        )}

        {/* Permission tags */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {c.permissionPolicy.map((perm) => (
            <span
              key={perm}
              className="inline-flex items-center gap-1 rounded-md border border-line bg-white/[0.025] px-1.5 py-0.5 font-mono text-[8px] text-faint"
            >
              <ShieldCheck className="h-2.5 w-2.5" />
              {perm}
            </span>
          ))}
        </div>

        {/* Env var indicators (masked) */}
        {c.env && Object.keys(c.env).length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {Object.entries(c.env).map(([key, value]) => (
              <span key={key} className="px-1.5 py-0.5 rounded bg-white/5 text-[9px] font-mono text-faint">
                {key}=
                {value ? t("helix:connectorsPanel.maskedEnvValue") : t("helix:connectorsPanel.emptyEnvValue")}
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
            <span className="text-[10px] text-bad">{t("helix:connectorsPanel.removeConfirm")}</span>
            <Button variant="danger" size="sm" onClick={() => onDeleteConnector(c.id)}>
              {t("helix:connectorsPanel.remove")}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setConfirmDelete(false)}>
              {t("helix:connectorsPanel.no")}
            </Button>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div
        className={`shrink-0 flex ${variant === "grid" ? "mt-auto border-t border-line pt-3" : "flex-col items-end"} gap-1.5`}
      >
        <div className="flex items-center gap-1.5">
          <Button variant="secondary" size="sm" onClick={() => onTest(c.id)} disabled={isTesting}>
            {isTesting ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
            {isTesting ? t("helix:connectorsPanel.testing") : t("helix:connectorsPanel.test")}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => onToggle(c.id)}>
            {c.enabled ? t("helix:connectorsPanel.disable") : t("helix:connectorsPanel.enable")}
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
              {isEditing ? t("helix:connectorsPanel.close") : t("helix:connectorsPanel.edit")}
            </Button>
          )}
          {!c.preset && onDeleteConnector && (
            <IconButton
              title={t("helix:connectorsPanel.deleteConnector")}
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
  const { t } = useTranslation("helix");
  const activeCount = connectors.filter((connector) => connector.enabled).length;
  const errorCount = connectors.filter((connector) => Boolean(connector.lastError)).length;
  if (connectors.length === 0 && !showAddConnector) {
    return (
      <div className="py-8 text-center flex flex-col gap-3">
        <p className="text-xs text-faint">{t("helix:connectorsPanel.noConnectors")}</p>
        {onShowAddConnector && (
          <Button variant="secondary" size="sm" onClick={() => onShowAddConnector(true)} className="mx-auto">
            <Plus className="w-3.5 h-3.5" /> {t("helix:connectorsPanel.addConnector")}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <header
        className={`grid gap-4 border-b border-line ${
          variant === "grid"
            ? "pb-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"
            : "pb-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
        }`}
      >
        <div className="min-w-0">
          {variant === "grid" && (
            <>
              <div className="mb-2 flex items-center gap-2 text-[9px] font-mono uppercase tracking-[0.16em] text-faint">
                <Activity className="h-3 w-3 text-good" />
                {t("helix:connectorsPanel.runtimeLayer")}
              </div>
              <p className="text-lg font-semibold tracking-tight text-fg">
                {t("helix:connectorsPanel.title")}
              </p>
            </>
          )}
          <p
            className={`${variant === "grid" ? "mt-1.5 text-xs" : "text-[10px]"} max-w-2xl leading-relaxed text-mute`}
          >
            {t("helix:connectorsPanel.description")}
          </p>
          <div className="mt-3 flex items-center gap-3 text-[9px] text-faint">
            <span>{t("helix:connectorsPanel.activeCount", { count: activeCount })}</span>
            <span className="h-1 w-1 rounded-full bg-line-strong" />
            <span>{t("helix:connectorsPanel.errorCount", { count: errorCount })}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onShowAddConnector && (
            <Button
              variant={showAddConnector ? "primary" : "secondary"}
              size="sm"
              onClick={() => onShowAddConnector(!showAddConnector)}
            >
              <Plus className="w-3.5 h-3.5" /> {t("helix:connectorsPanel.add")}
            </Button>
          )}
          {onRefresh && (
            <Button variant="secondary" size="sm" onClick={onRefresh}>
              <RefreshCw className="w-3.5 h-3.5" /> {t("helix:connectorsPanel.refresh")}
            </Button>
          )}
        </div>
      </header>

      {/* Add connector form */}
      {showAddConnector && onSaveConnector && onCancelEditing && (
        <div className="rounded-2xl border border-signal/20 bg-signal/[0.02] p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-signal uppercase">
              {t("helix:connectorsPanel.newConnector")}
            </span>
            <IconButton title={t("helix:connectorsPanel.cancel")} onClick={onCancelEditing}>
              <X className="w-3.5 h-3.5" />
            </IconButton>
          </div>
          <ConnectorEditor onSave={onSaveConnector} onCancel={onCancelEditing} />
        </div>
      )}

      <div className={variant === "grid" ? "grid gap-3 lg:grid-cols-2" : "flex flex-col gap-3"}>
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
