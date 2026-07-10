import type {
  AgentProfile,
  ConnectorConfig,
  McpTestResult,
  PromptTemplate,
  Skill,
  Turn,
  WorkflowStep,
  WorkflowStepKind,
  WorkflowTemplate,
  WorkflowTemplateSettings,
} from "@desktop-agent/shared";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Clipboard,
  Maximize2,
  RefreshCw,
  Sparkles,
  Workflow,
  X,
} from "lucide-react";
import type { RefObject } from "react";
import { useTranslation } from "react-i18next";
import { AgentIdentity } from "../../components/ui/agent-identity";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { HeroHome } from "../../components/ui/hero-home";
import { IconButton } from "../../components/ui/icon-button";
import { MarkdownRenderer } from "../../components/ui/markdown-renderer";
import { Separator } from "../../components/ui/separator";
import { ArtifactsPanel } from "./ArtifactsPanel";
import { ChatView } from "./ChatView";
import { Composer } from "./Composer";
import { ConnectorsPanel } from "./ConnectorsPanel";
import { HistoryList } from "./history-list";
import type { SaveConnectorInput } from "./hooks/useCapabilities";
import type { ContextChipItem } from "./hooks/useContextChips";
import { PromptsPanel } from "./PromptsPanel";
import { SkillsPanel } from "./SkillsPanel";
import type { HelixMode } from "./types";
import { WorkflowsPanel } from "./WorkflowsPanel";

type Props = {
  error: string | null;
  result: string | null;
  streaming: boolean;
  query: string;
  clipboardText: string;
  hasClipboard: boolean;
  ignoreClipboard: boolean;
  setIgnoreClipboard: (v: boolean) => void;
  onReloadClipboard: () => void;
  taskActive: boolean;
  taskStatus: string;
  messages: Turn[];
  workflowSteps: WorkflowStep[];
  approval?: { reason: string; permissionLevel: string; inputPreview: string };
  visibleLogs: { id: string; type: string; text: string }[];
  latestLogText: string | undefined;
  connectors: ConnectorConfig[];
  testingConnectorId: string | null;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  mode: HelixMode;
  activeRequestId: string | null;
  copied: boolean;
  executionMode: "simple" | "workflow";
  selectedWorkflowId: string | null;
  selectedSkillId: string | null;
  composerPlaceholder: string;
  chips?: ContextChipItem[];
  starterChips?: ContextChipItem[];
  clipboardActions?: ContextChipItem[];
  onChipClick?: (chip: ContextChipItem) => void;
  onExecute: () => void;
  onAbort: () => void;
  onApproval: (approved: boolean) => void;
  onCopy: () => void;
  onNewTask: () => void;
  onExpandedMode: () => void;
  onToastSuccess?: (message: string, duration?: number) => void;
  onToastError?: (message: string, duration?: number) => void;
  onStarterAction: (prompt: string, modeOverride?: "simple" | "workflow") => void;
  onTestConnector: (id: string) => void;
  onToggleConnector: (id: string) => void;
  onRefreshCapabilities: () => void;
  onSaveConnector?: (input: SaveConnectorInput) => void;
  onDeleteConnector?: (id: string) => void;
  onStartEditing?: (id: string) => void;
  onCancelEditing?: () => void;
  onShowAddConnector?: (v: boolean) => void;
  connectorTestResults?: Record<string, McpTestResult>;
  editingConnectorId?: string | null;
  showAddConnector?: boolean;
  onEditPrompt: (text: string) => void;
  onCopyResponse: (text: string) => void;
  onRegenerate: () => void;
  setMode: (m: HelixMode | "settings") => void;
  setExecutionMode: (m: "simple" | "workflow") => void;
  setSelectedWorkflowId: (id: string | null) => void;
  setSelectedSkillId: (id: string | null) => void;
  setQuery: (q: string) => void;
  prompts: PromptTemplate[];
  profiles: AgentProfile[];
  activeProfileId: string | null;
  onSavePrompt: (input: {
    id?: string;
    title: string;
    prompt: string;
    category?: string;
    icon?: string;
    executionMode?: "simple" | "workflow";
  }) => void;
  onDeletePrompt: (id: string) => void;
  onSaveProfile: (input: {
    id?: string;
    name: string;
    systemPrompt?: string;
    description?: string;
    icon?: string;
    tone?: string;
    responseStyle?: string;
    constraints?: string;
  }) => void;
  onDeleteProfile: (id: string) => void;
  onSetActiveProfile: (profileId: string | null) => void;
  workflowTemplates: WorkflowTemplate[];
  skills: Skill[];
  onSaveWorkflowTemplate: (input: {
    id?: string;
    name: string;
    description?: string;
    prompt: string;
    settings?: WorkflowTemplateSettings;
    steps?: Array<{ name: string; kind: WorkflowStepKind; config: Record<string, unknown> }>;
    enabled?: boolean;
  }) => void;
  onDeleteWorkflowTemplate: (id: string) => void;
  onSaveSkill: (input: {
    id?: string;
    name: string;
    description?: string;
    prompt: string;
    systemPrompt?: string;
    provider?: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
    toolAllowlist?: string[];
    mcpAllowlist?: string[];
    maxSteps?: number;
    metadata?: Record<string, string>;
    compatibility?: string;
    enabled?: boolean;
  }) => void;
  onDeleteSkill: (id: string) => void;
};

export function NormalCommandView(p: Props) {
  const { t } = useTranslation("helix");
  return (
    <div className="h-full w-full overflow-y-auto p-4 text-fg">
      {p.mode === "command" ? (
        p.messages.length > 0 ? (
          <ChatActive {...p} />
        ) : p.taskActive ? (
          <TaskActive {...p} />
        ) : (
          <CommandHome {...p} />
        )
      ) : p.mode === "history" ? (
        <PanelWrapper title={t("helix:normalCommandView.history")} onBack={() => p.setMode("command")}>
          <HistoryList onSelectConversation={() => p.setMode("command")} />
        </PanelWrapper>
      ) : p.mode === "artifacts" ? (
        <PanelWrapper title={t("helix:normalCommandView.artifacts")} onBack={() => p.setMode("command")}>
          <ArtifactsPanel
            onUseAction={(_artifact, action) => {
              p.onStarterAction(action.prompt);
              p.setMode("command");
            }}
          />
        </PanelWrapper>
      ) : p.mode === "prompts" ? (
        <PanelWrapper title={t("helix:normalCommandView.profiles")} onBack={() => p.setMode("command")}>
          <PromptsPanel
            prompts={p.prompts}
            profiles={p.profiles}
            activeProfileId={p.activeProfileId}
            onSavePrompt={p.onSavePrompt}
            onDeletePrompt={p.onDeletePrompt}
            onSaveProfile={p.onSaveProfile}
            onDeleteProfile={p.onDeleteProfile}
            onSetActiveProfile={p.onSetActiveProfile}
            onUsePrompt={(prompt, mode) => {
              p.onStarterAction(prompt, mode);
              p.setMode("command");
            }}
          />
        </PanelWrapper>
      ) : p.mode === "workflows" ? (
        <PanelWrapper title={t("helix:normalCommandView.workflows")} onBack={() => p.setMode("command")}>
          <WorkflowsPanel
            templates={p.workflowTemplates}
            skills={p.skills}
            onSave={p.onSaveWorkflowTemplate}
            onDelete={p.onDeleteWorkflowTemplate}
          />
        </PanelWrapper>
      ) : p.mode === "skills" ? (
        <PanelWrapper title={t("helix:normalCommandView.skills")} onBack={() => p.setMode("command")}>
          <SkillsPanel skills={p.skills} onSave={p.onSaveSkill} onDelete={p.onDeleteSkill} />
        </PanelWrapper>
      ) : (
        <PanelWrapper title={t("helix:normalCommandView.connectors")} onBack={() => p.setMode("command")}>
          <ConnectorsPanel
            connectors={p.connectors.slice(0, 7)}
            testingConnectorId={p.testingConnectorId}
            connectorTestResults={p.connectorTestResults}
            editingConnectorId={p.editingConnectorId}
            showAddConnector={p.showAddConnector}
            onTest={p.onTestConnector}
            onToggle={p.onToggleConnector}
            onRefresh={p.onRefreshCapabilities}
            onSaveConnector={p.onSaveConnector}
            onDeleteConnector={p.onDeleteConnector}
            onStartEditing={p.onStartEditing}
            onCancelEditing={p.onCancelEditing}
            onShowAddConnector={p.onShowAddConnector}
          />
        </PanelWrapper>
      )}
    </div>
  );
}

function PanelWrapper({
  title,
  onBack,
  children,
}: {
  title: string;
  onBack: () => void;
  children: React.ReactNode;
}) {
  const { t } = useTranslation("helix");
  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="w-3.5 h-3.5" />
          {t("helix:normalCommandView.back")}
        </Button>
        <span className="text-xs font-semibold text-fg">{title}</span>
      </div>
      <Separator />
      <div className="flex-1 min-h-0 overflow-y-auto pr-1">{children}</div>
    </div>
  );
}

function CommandHome(p: Props) {
  return (
    <div className="min-h-full w-full flex flex-col items-center justify-center gap-4 py-2">
      <HeroHome />

      <div className="w-full max-w-md flex flex-col gap-3 px-5">
        <Composer
          query={p.query}
          setQuery={p.setQuery}
          placeholder={p.composerPlaceholder}
          disabled={p.streaming}
          streaming={p.streaming}
          clipboardText={p.clipboardText}
          hasClipboard={p.hasClipboard}
          ignoreClipboard={p.ignoreClipboard}
          setIgnoreClipboard={p.setIgnoreClipboard}
          textareaRef={p.textareaRef}
          starterChips={p.starterChips}
          clipboardActions={p.clipboardActions}
          onChipClick={p.onChipClick}
          onReloadClipboard={p.onReloadClipboard}
          onExecute={p.onExecute}
        />
      </div>
    </div>
  );
}

function ChatActive(p: Props) {
  const { t } = useTranslation("helix");
  const selectedWorkflow = p.workflowTemplates.find((t) => t.id === p.selectedWorkflowId);

  return (
    <div className="flex flex-col h-full gap-3">
      <div className="flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Button variant="ghost" size="sm" onClick={p.onNewTask} disabled={p.streaming}>
            <ArrowLeft className="w-3.5 h-3.5" /> {t("helix:normalCommandView.newConversation")}
          </Button>
          <AgentIdentity
            profiles={p.profiles}
            activeProfileId={p.activeProfileId}
            onSetActiveProfile={p.onSetActiveProfile}
          />
          {selectedWorkflow ? (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-signal/10 text-signal border border-signal/30 truncate max-w-[140px]">
              {selectedWorkflow.name}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant={p.error ? "error" : p.streaming ? "warning" : "success"}>{p.taskStatus}</Badge>
          {p.streaming && (
            <Button variant="danger" size="sm" onClick={p.onAbort} disabled={!p.activeRequestId}>
              <X className="w-3.5 h-3.5" /> {t("helix:normalCommandView.stop")}
            </Button>
          )}
          <IconButton title={t("helix:normalCommandView.expandedMode")} onClick={p.onExpandedMode}>
            <Maximize2 className="w-3.5 h-3.5" />
          </IconButton>
        </div>
      </div>

      <ChatView
        turns={p.messages}
        streaming={p.streaming}
        onEditPrompt={p.onEditPrompt}
        onCopyResponse={p.onCopyResponse}
        onRegenerate={p.onRegenerate}
        onToastSuccess={p.onToastSuccess}
        onToastError={p.onToastError}
      />

      <div className="shrink-0">
        <Composer
          query={p.query}
          setQuery={p.setQuery}
          placeholder={p.composerPlaceholder}
          disabled={p.streaming}
          streaming={p.streaming}
          clipboardText={p.clipboardText}
          hasClipboard={p.hasClipboard}
          ignoreClipboard={p.ignoreClipboard}
          setIgnoreClipboard={p.setIgnoreClipboard}
          textareaRef={p.textareaRef}
          starterChips={p.starterChips}
          clipboardActions={p.clipboardActions}
          onChipClick={p.onChipClick}
          onReloadClipboard={p.onReloadClipboard}
          onExecute={p.onExecute}
        />
      </div>
    </div>
  );
}

function TaskActive(p: Props) {
  const { t } = useTranslation("helix");
  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={p.onNewTask} disabled={p.streaming}>
          <ArrowLeft className="w-3.5 h-3.5" /> {t("helix:normalCommandView.newConversation")}
        </Button>
        <Badge variant={p.error ? "error" : p.streaming ? "warning" : "success"}>{p.taskStatus}</Badge>
        {p.streaming && (
          <Button variant="danger" size="sm" onClick={p.onAbort} disabled={!p.activeRequestId}>
            <X className="w-3.5 h-3.5" /> {t("helix:normalCommandView.stop")}
          </Button>
        )}
      </div>

      <section className="rounded-xl bg-white/[0.03] border border-line p-4 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[10px] text-mute font-medium tracking-tight mb-1">
              {t("helix:normalCommandView.request")}
            </div>
            <p className="text-sm leading-relaxed text-fg select-text whitespace-pre-wrap">{p.query}</p>
          </div>
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              p.error ? "bg-bad/10 text-bad" : p.streaming ? "bg-warn/10 text-warn" : "bg-good/10 text-good"
            }`}
          >
            {p.streaming ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : p.error ? (
              <AlertCircle className="w-4 h-4" />
            ) : (
              <Check className="w-4 h-4" />
            )}
          </div>
        </div>
      </section>

      {p.workflowSteps.length > 0 && (
        <section className="rounded-xl border border-line p-3 flex flex-col gap-2.5 bg-white/[0.02]">
          <div className="text-[10px] text-mute font-medium tracking-tight flex items-center gap-1.5">
            <Workflow className="w-3.5 h-3.5 text-signal" /> {t("helix:normalCommandView.steps")}
          </div>
          <div className="grid gap-2">
            {p.workflowSteps.map((step) => (
              <div
                key={step.id}
                className="grid grid-cols-[18px_1fr_auto] items-start gap-2 rounded-lg bg-white/[0.03] px-2.5 py-2"
              >
                <span
                  className={`mt-1.5 w-2 h-2 rounded-full ${
                    step.status === "completed"
                      ? "bg-good"
                      : step.status === "running"
                        ? "bg-warn animate-pulse"
                        : step.status === "waiting_approval"
                          ? "bg-signal animate-pulse"
                          : step.status === "failed"
                            ? "bg-bad"
                            : "bg-faint"
                  }`}
                />
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-fg truncate">{step.title}</div>
                  <div className="text-[10px] text-mute leading-relaxed line-clamp-2">
                    {step.detail || step.kind}
                  </div>
                </div>
                <span className="text-[9px] font-mono uppercase text-faint">{step.kind}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {p.approval && (
        <section className="rounded-xl bg-signal/10 border border-signal/30 p-3.5 flex flex-col gap-3">
          <div className="flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-signal mt-0.5 shrink-0" />
            <div className="min-w-0">
              <div className="text-xs font-semibold text-signal">
                {t("helix:normalCommandView.approvalRequired")}
              </div>
              <p className="text-[11px] text-signal/80 leading-relaxed mt-1">{p.approval.reason}</p>
              <p className="text-[10px] text-faint mt-1 truncate">{p.approval.inputPreview}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="primary" size="sm" onClick={() => p.onApproval(true)} disabled={p.streaming}>
              {t("helix:normalCommandView.approve")}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => p.onApproval(false)} disabled={p.streaming}>
              {t("helix:normalCommandView.deny")}
            </Button>
          </div>
        </section>
      )}

      {p.visibleLogs.length > 0 && (
        <section className="rounded-xl bg-white/[0.02] p-3 flex flex-col gap-2 border border-line">
          <div className="text-[10px] text-mute font-medium tracking-tight">
            {t("helix:normalCommandView.activity")}
          </div>
          {p.visibleLogs.map((log) => (
            <div key={log.id} className="flex items-start gap-2.5 min-w-0">
              <span
                className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${
                  log.type === "tool_fail"
                    ? "bg-bad"
                    : log.type === "tool_start"
                      ? "bg-warn animate-pulse"
                      : log.type === "tool_complete"
                        ? "bg-good"
                        : "bg-signal"
                }`}
              />
              <p className="text-xs text-mute leading-relaxed truncate min-w-0">{log.text}</p>
            </div>
          ))}
        </section>
      )}

      {p.error && (
        <section className="p-3.5 bg-bad/10 rounded-xl text-bad text-xs flex gap-2.5 items-start border border-bad/20">
          <AlertCircle className="w-4 h-4 text-bad flex-shrink-0 mt-0.5" />
          <div className="select-text">{p.error}</div>
        </section>
      )}

      <section className="flex-1 min-h-[200px] rounded-2xl bg-white/[0.03] overflow-hidden flex flex-col border border-line">
        <div className="px-4 py-3 flex items-center justify-between bg-white/[0.03]">
          <span className="text-[10px] text-mute font-medium tracking-tight">
            {t("helix:normalCommandView.result")}
          </span>
          {p.result && (
            <Button variant="ghost" size="sm" onClick={p.onCopy}>
              {p.copied ? <Check className="w-3.5 h-3.5" /> : <Clipboard className="w-3.5 h-3.5" />}
              {p.copied ? t("helix:normalCommandView.copied") : t("helix:normalCommandView.copy")}
            </Button>
          )}
        </div>
        <div className="flex-1 p-4 text-sm text-fg leading-relaxed overflow-y-auto select-text">
          {p.result ? (
            <>
              <MarkdownRenderer content={p.result} />
              {p.streaming && (
                <span className="inline-block w-1.5 h-4 ml-1 align-[-2px] rounded-sm bg-warn animate-pulse" />
              )}
            </>
          ) : (
            <span className="text-faint">{t("helix:normalCommandView.resultPlaceholder")}</span>
          )}
        </div>
      </section>

      <div className="shrink-0">
        <Composer
          query={p.query}
          setQuery={p.setQuery}
          placeholder={p.composerPlaceholder}
          disabled={p.streaming}
          streaming={p.streaming}
          clipboardText={p.clipboardText}
          hasClipboard={p.hasClipboard}
          ignoreClipboard={p.ignoreClipboard}
          setIgnoreClipboard={p.setIgnoreClipboard}
          textareaRef={p.textareaRef}
          starterChips={p.starterChips}
          clipboardActions={p.clipboardActions}
          onChipClick={p.onChipClick}
          onReloadClipboard={p.onReloadClipboard}
          onExecute={p.onExecute}
        />
      </div>
    </div>
  );
}
