import type {
  AgentProfile,
  ConnectorConfig,
  FileContextInput,
  McpTestResult,
  PromptTemplate,
  Skill,
  Turn,
  WorkflowStep,
  WorkflowStepKind,
  WorkflowTemplate,
  WorkflowTemplateSettings,
} from "@desktop-agent/shared";
import { unwrapAgentResponse } from "@desktop-agent/shared";
import { AlertCircle, ArrowLeft, Check, Maximize2, RefreshCw, Workflow, X } from "lucide-react";
import type { RefObject } from "react";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { CompactResultCard } from "../../../components/ui/content/compact-result-card";
import { HelixMark } from "../../../components/ui/helix/helix-mark";
import { AgentIdentity } from "../../../components/ui/identity/agent-identity";
import { RecentConversations } from "../../../components/ui/identity/recent-conversations";
import { Badge } from "../../../components/ui/primitives/badge";
import { Button } from "../../../components/ui/primitives/button";
import { IconButton } from "../../../components/ui/primitives/icon-button";
import { Separator } from "../../../components/ui/primitives/separator";
import { Composer } from "../composer/Composer";
import { GLOBAL_SHORTCUT_GLYPH } from "../constants";
import { HistoryList } from "../history/history-list";
import type { SaveConnectorInput } from "../hooks/useCapabilities";
import type { QuickActionItem } from "../hooks/useQuickActions";
import type { useSpaces } from "../hooks/useSpaces";
import { ConnectorsPanel } from "../panels/ConnectorsPanel";
import { SourcesPanel } from "../panels/SourcesPanel";
import { ParserModePanel } from "../parser-mode/ParserModePanel";
import type { ParserModeState } from "../parser-mode/useParserMode";
import { ApprovalCard, type ApprovalViewModel } from "../response/ApprovalCard";
import { SpaceShell } from "../space/SpaceShell";
import { SpaceSwitcher } from "../space/SpaceSwitcher";
import type { HelixMode } from "../types";
import { ChatView } from "./ChatView";

type Props = {
  error: string | null;
  result: string | null;
  streaming: boolean;
  query: string;
  clipboardText: string;
  hasClipboard: boolean;
  ignoreClipboard: boolean;
  setIgnoreClipboard: (v: boolean) => void;
  onPasteClipboard: (text: string) => void;
  taskActive: boolean;
  taskStatus: string;
  messages: Turn[];
  workflowSteps: WorkflowStep[];
  approval?: ApprovalViewModel;
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
  quickActions?: QuickActionItem[];
  onQuickAction?: (action: QuickActionItem) => void;
  onExecute: () => void;
  onAbort: () => void;
  onApproval: (approved: boolean) => void;
  onCopy: () => void;
  onNewTask: () => void;
  onExpandedMode: () => void;
  onRefine?: (text: string) => void;
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
  fileContext?: FileContextInput[];
  onAttachFiles?: (paths: string[]) => void;
  onRemoveFile?: (path: string) => void;
  isDraggingFile?: boolean;
  onSelectRecentConversation?: (conversationId: string) => void;
  onPromoteToMemory?: (turn: Turn) => Promise<string | null>;
  parser: ParserModeState;
  spaces: ReturnType<typeof useSpaces>;
};

export function NormalCommandView(p: Props) {
  const { t } = useTranslation("helix");
  const spacesHook = p.spaces;

  const handlePromoteToMemory = useCallback(
    async (turn: Turn): Promise<string | null> => {
      if (!spacesHook.activeSpaceId) return null;
      const text = turn.blocks
        .filter((b): b is { type: "text"; content: string } => b.type === "text")
        .map((b) => unwrapAgentResponse(b.content))
        .join("");
      if (!text.trim()) return null;
      return spacesHook.promoteChatResponseToMemoryFact(spacesHook.activeSpaceId, text, turn.id);
    },
    [spacesHook.activeSpaceId, spacesHook.promoteChatResponseToMemoryFact],
  );

  return (
    <div className="helix-view-enter h-full w-full overflow-hidden p-4 text-fg">
      {p.mode === "command" ? (
        p.messages.length > 0 ? (
          <ChatActive {...p} onPromoteToMemory={handlePromoteToMemory} />
        ) : p.taskActive ? (
          <TaskActive {...p} />
        ) : (
          <CommandHome {...p} />
        )
      ) : p.mode === "history" ? (
        <PanelWrapper title={t("helix:normalCommandView.history")} onBack={() => p.setMode("command")}>
          <HistoryList onSelectConversation={() => p.setMode("command")} />
        </PanelWrapper>
      ) : p.mode === "parser" ? (
        <ParserModePanel
          variant="compact"
          parser={p.parser}
          onBack={() => p.setMode("command")}
          setQuery={p.setQuery}
          setMode={p.setMode}
          onToastSuccess={p.onToastSuccess}
          onToastError={p.onToastError}
        />
      ) : p.mode === "space" ? (
        <PanelWrapper title={t("helix:navigation.space", "Space")} onBack={() => p.setMode("command")}>
          <SpaceShell
            ws={spacesHook}
            onBack={() => p.setMode("command")}
            onOpenChat={() => p.setMode("command")}
            profiles={p.profiles}
          />
        </PanelWrapper>
      ) : p.mode === "sources" ? (
        <PanelWrapper title={t("helix:navigation.sources")} onBack={() => p.setMode("command")}>
          <SourcesPanel
            variant="normal"
            parser={p.parser}
            connectors={p.connectors}
            testingConnectorId={p.testingConnectorId}
            connectorTestResults={p.connectorTestResults}
            editingConnectorId={p.editingConnectorId}
            showAddConnector={p.showAddConnector}
            onTestConnector={p.onTestConnector}
            onToggleConnector={p.onToggleConnector}
            onRefreshCapabilities={p.onRefreshCapabilities}
            onSaveConnector={p.onSaveConnector}
            onDeleteConnector={p.onDeleteConnector}
            onStartEditing={p.onStartEditing}
            onCancelEditing={p.onCancelEditing}
            onShowAddConnector={p.onShowAddConnector}
            setQuery={p.setQuery}
            setMode={p.setMode}
            onToastSuccess={p.onToastSuccess}
            onToastError={p.onToastError}
          />
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
  const { t } = useTranslation("helix");

  return (
    <div className="min-h-full w-full flex flex-col items-center justify-center py-8 px-5">
      <div className="w-full max-w-lg flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4 px-1">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-signal/15 bg-signal/[0.06]">
              <HelixMark size={25} />
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold tracking-tight text-fg">
                {t("helix:normalCommandView.commandTitle")}
              </h1>
              <p className="mt-0.5 truncate text-[10px] text-mute">
                {t("helix:normalCommandView.commandDescription")}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <SpaceSwitcher compact />
            <kbd className="rounded-md border border-line bg-white/[0.025] px-2 py-1 text-[8px] font-mono text-faint">
              {GLOBAL_SHORTCUT_GLYPH}
            </kbd>
          </div>
        </div>

        <Composer
          mode="normal"
          query={p.query}
          setQuery={p.setQuery}
          placeholder={p.composerPlaceholder}
          disabled={p.streaming}
          streaming={p.streaming}
          clipboardText={p.clipboardText}
          hasClipboard={p.hasClipboard}
          ignoreClipboard={p.ignoreClipboard}
          setIgnoreClipboard={p.setIgnoreClipboard}
          onPasteClipboard={p.onPasteClipboard}
          textareaRef={p.textareaRef}
          quickActions={p.quickActions}
          onQuickAction={p.onQuickAction}
          onExecute={p.onExecute}
          onAbort={p.onAbort}
          fileContext={p.fileContext}
          onAttachFiles={p.onAttachFiles}
          onRemoveFile={p.onRemoveFile}
          isDraggingFile={p.isDraggingFile}
          approval={p.approval}
          onApproval={p.onApproval}
        />

        <RecentConversations limit={3} onSelect={p.onSelectRecentConversation} />
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
          <SpaceSwitcher compact />
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
        onPromoteToMemory={p.onPromoteToMemory}
        onToastSuccess={p.onToastSuccess}
        onToastError={p.onToastError}
        approval={p.approval}
        onApproval={p.onApproval}
      />

      <div className="sticky bottom-0 z-20 shrink-0 bg-gradient-to-t from-ink via-ink/95 to-transparent pt-3 pb-1">
        <Composer
          mode="normal"
          query={p.query}
          setQuery={p.setQuery}
          placeholder={p.composerPlaceholder}
          disabled={p.streaming}
          streaming={p.streaming}
          clipboardText={p.clipboardText}
          hasClipboard={p.hasClipboard}
          ignoreClipboard={p.ignoreClipboard}
          setIgnoreClipboard={p.setIgnoreClipboard}
          onPasteClipboard={p.onPasteClipboard}
          textareaRef={p.textareaRef}
          quickActions={p.quickActions}
          onQuickAction={p.onQuickAction}
          onExecute={p.onExecute}
          onAbort={p.onAbort}
          showQuickActions={false}
          fileContext={p.fileContext}
          onAttachFiles={p.onAttachFiles}
          onRemoveFile={p.onRemoveFile}
          isDraggingFile={p.isDraggingFile}
          approval={p.approval}
          onApproval={p.onApproval}
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
        <div className="flex min-w-0 items-center gap-2">
          <Button variant="ghost" size="sm" onClick={p.onNewTask} disabled={p.streaming}>
            <ArrowLeft className="w-3.5 h-3.5" /> {t("helix:normalCommandView.newConversation")}
          </Button>
          <SpaceSwitcher compact />
        </div>
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

      {p.approval && <ApprovalCard approval={p.approval} onDecision={p.onApproval} busy={p.streaming} />}

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

      <CompactResultCard
        result={p.result}
        streaming={p.streaming}
        copied={p.copied}
        onCopy={p.onCopy}
        onRefine={(text) => p.onRefine?.(text)}
        onExpand={p.onExpandedMode}
      />

      <div className="sticky bottom-0 z-20 shrink-0 bg-gradient-to-t from-ink via-ink/95 to-transparent pt-3 pb-1">
        <Composer
          mode="normal"
          query={p.query}
          setQuery={p.setQuery}
          placeholder={p.composerPlaceholder}
          disabled={p.streaming}
          streaming={p.streaming}
          clipboardText={p.clipboardText}
          hasClipboard={p.hasClipboard}
          ignoreClipboard={p.ignoreClipboard}
          setIgnoreClipboard={p.setIgnoreClipboard}
          onPasteClipboard={p.onPasteClipboard}
          textareaRef={p.textareaRef}
          quickActions={p.quickActions}
          onQuickAction={p.onQuickAction}
          onExecute={p.onExecute}
          onAbort={p.onAbort}
          showQuickActions={false}
          fileContext={p.fileContext}
          onAttachFiles={p.onAttachFiles}
          onRemoveFile={p.onRemoveFile}
          isDraggingFile={p.isDraggingFile}
          approval={p.approval}
          onApproval={p.onApproval}
        />
      </div>
    </div>
  );
}
