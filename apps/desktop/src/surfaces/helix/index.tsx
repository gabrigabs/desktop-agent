import { type ContextAttachment, getHelixAction } from "@desktop-agent/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { HelixBottomNav } from "../../components/ui/helix-bottom-nav";
import { HelixDrawer } from "../../components/ui/helix-drawer";
import { HelixHeader } from "../../components/ui/helix-header";
import { getAgent } from "../../lib/rpc";
import { closeApp, setWindowMode } from "../../lib/window";
import { useAgentStore } from "../../stores/agent";
import { ExpandedView } from "./ExpandedView";
import { useCapabilities } from "./hooks/useCapabilities";
import { useClipboard } from "./hooks/useClipboard";
import { useDragDrop } from "./hooks/useDragDrop";
import { useExecute } from "./hooks/useExecute";
import { useFileContext } from "./hooks/useFileContext";
import { useKeyboard } from "./hooks/useKeyboard";
import { usePrompts } from "./hooks/usePrompts";
import { type QuickActionItem, useQuickActions } from "./hooks/useQuickActions";
import { useSettingsForm } from "./hooks/useSettingsForm";
import { useSkills } from "./hooks/useSkills";
import { useWorkflows } from "./hooks/useWorkflows";
import { NormalCommandView } from "./NormalCommandView";
import { useParserMode } from "./parser-mode/useParserMode";
import { SettingsPanel, type SettingsSection } from "./SettingsPanel";

type HelixProps = {
  onToastSuccess?: (message: string, duration?: number) => void;
  onToastError?: (message: string, duration?: number) => void;
  onToggleAlwaysOnTop: () => void;
};

import type { HelixMode } from "./types";

export function Helix({ onToastSuccess, onToastError, onToggleAlwaysOnTop }: HelixProps) {
  const { t } = useTranslation("helix");
  const {
    query,
    result,
    streaming,
    error,
    messages,
    setQuery,
    executionMode,
    setExecutionMode,
    selectedWorkflowId,
    setSelectedWorkflowId,
    selectedSkillId,
    setSelectedSkillId,
    workflowRun,
    connectors,
    agentLogs,
    uiMode,
    setUiMode,
    settings,
    setSettings,
  } = useAgentStore();

  const [mode, setMode] = useState<HelixMode>("command");
  const [showSettings, setShowSettings] = useState(false);
  const [settingsSection, setSettingsSection] = useState<SettingsSection>("general");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const clipboard = useClipboard();
  const capabilities = useCapabilities();
  const promptsHook = usePrompts();
  const workflows = useWorkflows();
  const skills = useSkills();
  const fileCtx = useFileContext(onToastError);
  const exec = useExecute(promptsHook.activeProfileId);
  const { isDragging: isDraggingFile } = useDragDrop((paths) => {
    if (mode === "parser") return;
    fileCtx.attachFiles(paths);
  });
  const ignoreClipboard = useAgentStore((s) => s.ignoreClipboard);
  const setIgnoreClipboard = useAgentStore((s) => s.setIgnoreClipboard);
  const setClipboardText = useAgentStore((s) => s.setClipboardText);
  const quickActions = useQuickActions(clipboard.hasClipboard, ignoreClipboard);
  const settingsForm = useSettingsForm(showSettings, onToastSuccess, onToastError);
  const parser = useParserMode(
    (msg) => onToastError?.(msg),
    (key) => onToastSuccess?.(t(`helix:${key}`)),
  );

  const handleQuickAction = useCallback(
    (action: QuickActionItem) => {
      const usesClipboard = action.requiredContext?.includes("clipboard");
      const prefix = action.prompt ? `${action.prompt} ` : "";
      const next = usesClipboard ? `${prefix}[CLIPBOARD]`.trim() : action.prompt;
      setIgnoreClipboard(!usesClipboard);
      setQuery(next);
      if (action.executionMode) {
        setExecutionMode(action.executionMode);
      }
      requestAnimationFrame(() => textareaRef.current?.focus());
    },
    [setIgnoreClipboard, setQuery, setExecutionMode],
  );

  const persistWindowMode = useCallback(
    async (nextMode: "normal" | "expanded" | "collapsed") => {
      const nextSettings = { ...settings, lastWindowMode: nextMode };
      setSettings(nextSettings);
      try {
        const api = await getAgent();
        await api.saveSettings(nextSettings);
      } catch (err) {
        console.error("Failed to persist window mode:", err);
      }
    },
    [setSettings, settings],
  );

  const handleToggleExpand = useCallback(async () => {
    const nextMode = uiMode === "expanded" ? "normal" : "expanded";
    setUiMode(nextMode);
    await setWindowMode(nextMode, { alwaysOnTop: settings.alwaysOnTop });
    await persistWindowMode(nextMode);
  }, [uiMode, setUiMode, settings.alwaysOnTop, persistWindowMode]);

  const handleMinimize = useCallback(async () => {
    setUiMode("collapsed");
    await setWindowMode("collapsed", { alwaysOnTop: settings.alwaysOnTop });
    await persistWindowMode("collapsed");
  }, [setUiMode, settings.alwaysOnTop, persistWindowMode]);

  const handleClose = useCallback(async () => {
    await closeApp();
  }, []);

  const handleNewTask = useCallback(() => {
    exec.handleNewTask();
    setMode("command");
  }, [exec]);

  const handleChangeMode = useCallback((next: HelixMode | "settings") => {
    if (next === "settings") {
      setSettingsSection("general");
      setShowSettings(true);
      return;
    }
    setShowSettings(false);
    setMode(next);
  }, []);

  useKeyboard({
    handleExecute: exec.handleExecute,
    showSettings,
    setShowSettings,
    mode,
    setMode,
  });

  useEffect(() => {
    if (mode === "command" && textareaRef.current && !showSettings) {
      textareaRef.current.focus();
    }
  }, [mode, showSettings]);

  useEffect(() => {
    const handler = () => setShowSettings(true);
    window.addEventListener("open-settings", handler);
    return () => window.removeEventListener("open-settings", handler);
  }, []);

  useEffect(() => {
    const raw = sessionStorage.getItem("helix.pending-action");
    if (!raw) return;

    sessionStorage.removeItem("helix.pending-action");

    let pending: { actionId: string; secondaryId?: string } | null = null;
    try {
      pending = JSON.parse(raw) as { actionId: string; secondaryId?: string };
    } catch {
      pending = { actionId: raw };
    }

    if (!pending?.actionId) return;

    if (pending.actionId === "artifacts") {
      setMode("artifacts");
      return;
    }
    if (pending.actionId === "workflow") {
      setSettingsSection("workflows");
      setShowSettings(true);
      return;
    }

    const action = getHelixAction(pending.actionId);
    if (!action) return;

    const secondary = pending.secondaryId
      ? action.secondaryActions?.find((s) => s.id === pending.secondaryId)
      : undefined;

    setMode("command");
    setExecutionMode(secondary?.executionMode ?? action.executionMode ?? "simple");
    const requiredContext = secondary?.requiredContext ?? action.requiredContext;
    setIgnoreClipboard(!requiredContext?.includes("clipboard"));
    setQuery(secondary?.prompt ?? action.prompt);
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, [setExecutionMode, setIgnoreClipboard, setQuery]);

  const onStarterAction = useCallback(
    (prompt: string, modeOverride?: "simple" | "workflow") => {
      exec.handleStarterAction(prompt, modeOverride, textareaRef);
      requestAnimationFrame(() => textareaRef.current?.focus());
    },
    [exec],
  );

  const onEditPrompt = useCallback(
    (text: string) => {
      setQuery(text);
      requestAnimationFrame(() => textareaRef.current?.focus());
    },
    [setQuery],
  );

  const onCopyResponse = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard?.writeText(text);
        onToastSuccess?.(t("helix:helixIndex.responseCopied"));
      } catch (err) {
        console.error("Failed to copy response:", err);
        onToastError?.(t("helix:helixIndex.copyError"));
      }
    },
    [onToastSuccess, onToastError, t],
  );

  const onRegenerate = useCallback(() => {
    const store = useAgentStore.getState();
    let lastUserIndex = -1;
    for (let index = store.messages.length - 1; index >= 0; index -= 1) {
      if (store.messages[index]?.role === "user") {
        lastUserIndex = index;
        break;
      }
    }
    const lastUserTurn = store.messages[lastUserIndex];
    if (!lastUserTurn || store.streaming) return;

    const promptText = lastUserTurn.blocks.find((b) => b.type === "text");
    if (promptText?.type !== "text") return;
    const clipboardContext = lastUserTurn.blocks.find(
      (b) => b.type === "context" && b.source === "clipboard",
    );

    const newMessages = store.messages.slice(0, lastUserIndex);
    store.setMessages(newMessages);
    if (clipboardContext?.type === "context") {
      store.setClipboardText(clipboardContext.content ?? clipboardContext.preview);
      store.setIgnoreClipboard(false);
    } else {
      store.setIgnoreClipboard(true);
    }
    store.setContexts(
      lastUserTurn.blocks.flatMap((block, index) => {
        if (block.type !== "context" || block.source === "clipboard" || block.source === "web") return [];
        return [
          {
            id: `regenerated:${block.source}:${index}`,
            source: block.source,
            label: typeof block.metadata?.label === "string" ? block.metadata.label : block.source,
            preview: block.preview,
            content: block.content,
            metadata: block.metadata,
            policy: block.policy,
            sensitive: block.source !== "file",
            enabled: true,
          } as ContextAttachment,
        ];
      }),
    );
    store.setResult(null);
    store.setError(null);
    onToastSuccess?.(t("helix:helixIndex.regenerating"));
    void exec.handleExecute(promptText.content);
  }, [exec, onToastSuccess, t]);

  const onAbort = useCallback(() => {
    exec.handleAbort();
    onToastSuccess?.(t("helix:helixIndex.responseCancelled"));
  }, [exec, onToastSuccess, t]);

  const onSelectRecentConversation = useCallback(
    async (id: string) => {
      try {
        const api = await getAgent();
        const turns = await api.listTurns({ conversationId: id });
        const store = useAgentStore.getState();
        const lastAssistant = [...turns].reverse().find((turn) => turn.role === "assistant");
        const result = lastAssistant?.blocks
          .filter((block) => block.type === "text")
          .map((block) => (block.type === "text" ? block.content : ""))
          .join("");

        const profileId = turns.find((turn) => turn.profileId)?.profileId ?? null;
        store.setCurrentProfileId(profileId);
        store.setCurrentConversationId(id);
        store.setMessages(turns);
        store.setResult(result || null);
        store.setStreaming(false);
        store.setError(null);
        store.setWorkflowRun(null);
      } catch (err) {
        console.error("Failed to load recent conversation:", err);
        onToastError?.(t("helix:helixIndex.openRecentError"));
      }
    },
    [onToastError, t],
  );

  const taskActive =
    streaming || result !== null || Boolean(error) || agentLogs.length > 0 || Boolean(workflowRun);
  const taskStatus =
    workflowRun?.status === "waiting_approval"
      ? t("helix:helixIndex.waitingApproval")
      : error
        ? JSON.stringify(error)
        : streaming
          ? agentLogs[agentLogs.length - 1]?.type === "tool_start"
            ? t("helix:helixIndex.usingTool")
            : t("helix:helixIndex.thinking")
          : result
            ? t("helix:helixIndex.resultReady")
            : t("helix:helixIndex.preparing");
  const latestLog = agentLogs.length > 0 ? agentLogs[agentLogs.length - 1] : undefined;
  const visibleLogs = agentLogs.slice(-4).reverse();
  const workflowSteps = workflowRun?.steps ?? [];
  const approval = workflowRun?.approval;
  const visibleConnectors = connectors.slice(0, 7);
  const composerPlaceholder = t("helix:helixIndex.composerPlaceholder");

  const commonProps = {
    error,
    result,
    streaming,
    query,
    clipboardText: clipboard.clipboardText,
    hasClipboard: clipboard.hasClipboard,
    ignoreClipboard,
    setIgnoreClipboard,
    onPasteClipboard: setClipboardText,
    taskActive,
    taskStatus,
    messages,
    workflowSteps,
    approval: approval
      ? {
          reason: approval.reason,
          permissionLevel: approval.permissionLevel,
          inputPreview: approval.inputPreview,
        }
      : undefined,
    visibleLogs,
    latestLogText: latestLog?.text,
    connectors: visibleConnectors,
    testingConnectorId: capabilities.testingConnectorId,
    textareaRef,
    mode,
    activeRequestId: exec.activeRequestId,
    copied: exec.copied,
    executionMode,
    composerPlaceholder,
    quickActions: quickActions,
    onQuickAction: handleQuickAction,
    onExecute: exec.handleExecute,
    onAbort: onAbort,
    onCopy: exec.handleCopyResult,
    onRefine: onEditPrompt,
    onNewTask: handleNewTask,
    onSelectRecentConversation,
    onStarterAction,
    onEditPrompt,
    onCopyResponse,
    onRegenerate,
    onApproval: exec.handleApproval,
    setMode: handleChangeMode,
    setExecutionMode,
    selectedWorkflowId,
    setSelectedWorkflowId,
    selectedSkillId,
    setSelectedSkillId,
    setQuery,
    onTestConnector: capabilities.handleTestConnector,
    onToggleConnector: capabilities.handleToggleConnector,
    onRefreshCapabilities: capabilities.refreshCapabilities,
    onSaveConnector: capabilities.handleSaveConnector,
    onDeleteConnector: capabilities.handleDeleteConnector,
    onStartEditing: capabilities.handleStartEditing,
    onCancelEditing: capabilities.handleCancelEditing,
    onShowAddConnector: capabilities.setShowAddConnector,
    connectorTestResults: capabilities.connectorTestResults,
    editingConnectorId: capabilities.editingConnectorId,
    showAddConnector: capabilities.showAddConnector,
    prompts: promptsHook.prompts,
    profiles: promptsHook.profiles,
    activeProfileId: promptsHook.activeProfileId,
    onSavePrompt: promptsHook.handleSavePrompt,
    onDeletePrompt: promptsHook.handleDeletePrompt,
    onSaveProfile: promptsHook.handleSaveProfile,
    onDeleteProfile: promptsHook.handleDeleteProfile,
    onSetActiveProfile: promptsHook.handleSetActiveProfile,
    workflowTemplates: workflows.templates,
    skills: skills.skills,
    onSaveWorkflowTemplate: workflows.handleSave,
    onDeleteWorkflowTemplate: workflows.handleDelete,
    onSaveSkill: skills.handleSave,
    onDeleteSkill: skills.handleDelete,
    fileContext: fileCtx.fileContext,
    onAttachFiles: fileCtx.attachFiles,
    onRemoveFile: fileCtx.removeFile,
    isDraggingFile,
    parser,
  };

  const settingsPanelProps = {
    onClose: () => setShowSettings(false),
    settings,
    formProvider: settingsForm.formProvider,
    setFormProvider: settingsForm.setFormProvider,
    formApiKey: settingsForm.formApiKey,
    setFormApiKey: settingsForm.setFormApiKey,
    formBaseUrl: settingsForm.formBaseUrl,
    setFormBaseUrl: settingsForm.setFormBaseUrl,
    formModel: settingsForm.formModel,
    setFormModel: settingsForm.setFormModel,
    formHidePet: settingsForm.formHidePet,
    setFormHidePet: settingsForm.setFormHidePet,
    formTimeout: settingsForm.formTimeout,
    setFormTimeout: settingsForm.setFormTimeout,
    formWindowOpacity: settingsForm.formWindowOpacity,
    setFormWindowOpacity: settingsForm.setFormWindowOpacity,
    formPetSize: settingsForm.formPetSize,
    setFormPetSize: settingsForm.setFormPetSize,
    formLanguage: settingsForm.formLanguage,
    setFormLanguage: settingsForm.setFormLanguage,
    showKey: settingsForm.showKey,
    setShowKey: settingsForm.setShowKey,
    fetchedModels: settingsForm.fetchedModels,
    loadingModels: settingsForm.loadingModels,
    savingSettings: settingsForm.savingSettings,
    handleSaveSettings: settingsForm.handleSaveSettings,
    initialSection: settingsSection,
    sections: {
      profiles: {
        prompts: promptsHook.prompts,
        profiles: promptsHook.profiles,
        activeProfileId: promptsHook.activeProfileId,
        onSavePrompt: promptsHook.handleSavePrompt,
        onDeletePrompt: promptsHook.handleDeletePrompt,
        onSaveProfile: promptsHook.handleSaveProfile,
        onDeleteProfile: promptsHook.handleDeleteProfile,
        onSetActiveProfile: promptsHook.handleSetActiveProfile,
        onUsePrompt: (prompt: string, execMode?: "simple" | "workflow") => {
          setShowSettings(false);
          onStarterAction(prompt, execMode);
        },
      },
      workflows: {
        templates: workflows.templates,
        skills: skills.skills,
        onSave: workflows.handleSave,
        onDelete: workflows.handleDelete,
      },
      skills: {
        skills: skills.skills,
        onSave: skills.handleSave,
        onDelete: skills.handleDelete,
      },
    },
  };

  if (uiMode === "expanded") {
    return (
      <div className="h-full w-full flex flex-col">
        <HelixHeader
          expanded
          alwaysOnTop={settings.alwaysOnTop}
          onToggleAlwaysOnTop={onToggleAlwaysOnTop}
          onToggleExpand={handleToggleExpand}
          onMinimize={handleMinimize}
          onClose={handleClose}
        />
        <div className="flex-1 min-h-0 flex flex-col">
          <main className="relative flex-1 min-h-0 overflow-hidden">
            {showSettings ? (
              <SettingsPanel variant="expanded" {...settingsPanelProps} />
            ) : (
              <ExpandedView {...commonProps} />
            )}
          </main>
          <HelixBottomNav
            mode={showSettings ? "settings" : mode}
            onChangeMode={handleChangeMode}
            onNewTask={handleNewTask}
            onToggleExpand={handleToggleExpand}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col">
      <HelixHeader
        expanded={false}
        alwaysOnTop={settings.alwaysOnTop}
        onToggleAlwaysOnTop={onToggleAlwaysOnTop}
        onToggleExpand={handleToggleExpand}
        onMinimize={handleMinimize}
        onClose={handleClose}
        onOpenMenu={() => setDrawerOpen((open) => !open)}
        menuOpen={drawerOpen}
      />
      <HelixDrawer
        open={drawerOpen}
        mode={mode}
        onClose={() => setDrawerOpen(false)}
        onChangeMode={handleChangeMode}
        onNewTask={handleNewTask}
      />
      <main className="flex-1 min-h-0 overflow-hidden relative">
        {showSettings ? (
          <SettingsPanel {...settingsPanelProps} />
        ) : (
          <NormalCommandView {...commonProps} onExpandedMode={handleToggleExpand} />
        )}
      </main>
    </div>
  );
}
