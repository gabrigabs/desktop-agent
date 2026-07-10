import { useCallback, useEffect, useRef, useState } from "react";
import { HelixDrawer } from "../../components/ui/helix-drawer";
import { HelixHeader } from "../../components/ui/helix-header";
import { HelixSidebar } from "../../components/ui/helix-sidebar";
import { getAgent } from "../../lib/rpc";
import { closeApp, setWindowMode } from "../../lib/window";
import { useAgentStore } from "../../stores/agent";
import { ExpandedView } from "./ExpandedView";
import { useCapabilities } from "./hooks/useCapabilities";
import { useClipboard } from "./hooks/useClipboard";
import { type ContextChipItem, useContextChips } from "./hooks/useContextChips";
import { useExecute } from "./hooks/useExecute";
import { useKeyboard } from "./hooks/useKeyboard";
import { usePrompts } from "./hooks/usePrompts";
import { useSettingsForm } from "./hooks/useSettingsForm";
import { NormalCommandView } from "./NormalCommandView";
import { SettingsPanel } from "./SettingsPanel";

type HelixProps = {
  onToastSuccess?: (message: string, duration?: number) => void;
  onToastError?: (message: string, duration?: number) => void;
  onToggleAlwaysOnTop: () => void;
};

type HelixMode = "command" | "history" | "prompts" | "connectors";

export function Helix({ onToastSuccess, onToastError, onToggleAlwaysOnTop }: HelixProps) {
  const {
    query,
    result,
    streaming,
    error,
    messages,
    setQuery,
    executionMode,
    setExecutionMode,
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
  const [drawerOpen, setDrawerOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const clipboard = useClipboard();
  const capabilities = useCapabilities();
  const promptsHook = usePrompts();
  const exec = useExecute();
  const ignoreClipboard = useAgentStore((s) => s.ignoreClipboard);
  const setIgnoreClipboard = useAgentStore((s) => s.setIgnoreClipboard);
  const contextChips = useContextChips(clipboard.hasClipboard, ignoreClipboard);
  const settingsForm = useSettingsForm(showSettings, onToastSuccess, onToastError);

  const handleChipClick = useCallback(
    (chip: ContextChipItem) => {
      if (chip.action === "ignore-clipboard") {
        const currentQuery = useAgentStore.getState().query;
        if (ignoreClipboard) {
          setIgnoreClipboard(false);
          const marker = currentQuery.includes("[CLIPBOARD]")
            ? currentQuery
            : `${currentQuery ? `${currentQuery} ` : ""}[CLIPBOARD]`;
          setQuery(marker);
        } else {
          setIgnoreClipboard(true);
          setQuery(currentQuery.replace(/\s?\[CLIPBOARD\]\s?/g, ""));
        }
        requestAnimationFrame(() => textareaRef.current?.focus());
        return;
      }
      const next = chip.usesClipboard ? `${chip.prompt}${chip.prompt ? " " : ""}[CLIPBOARD]` : chip.prompt;
      setIgnoreClipboard(!chip.usesClipboard);
      setQuery(next);
      requestAnimationFrame(() => textareaRef.current?.focus());
    },
    [ignoreClipboard, setIgnoreClipboard, setQuery],
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

  const handleChangeMode = useCallback(
    (next: "command" | "history" | "prompts" | "connectors" | "settings") => {
      if (next === "settings") {
        setShowSettings(true);
        return;
      }
      setMode(next);
    },
    [],
  );

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
        onToastSuccess?.("Resposta copiada");
      } catch (err) {
        console.error("Failed to copy response:", err);
        onToastError?.("Erro ao copiar resposta");
      }
    },
    [onToastSuccess, onToastError],
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

    const newMessages = store.messages.slice(0, lastUserIndex);
    store.setMessages(newMessages);
    store.setResult(null);
    store.setError(null);
    onToastSuccess?.("Regenerando resposta");
    void exec.handleExecute(promptText.content);
  }, [exec, onToastSuccess]);

  const taskActive =
    streaming || result !== null || Boolean(error) || agentLogs.length > 0 || Boolean(workflowRun);
  const taskStatus =
    workflowRun?.status === "waiting_approval"
      ? "Aguardando aprovação"
      : error
        ? "Algo falhou"
        : streaming
          ? agentLogs[agentLogs.length - 1]?.type === "tool_start"
            ? "Usando ferramenta"
            : "Pensando"
          : result
            ? "Resultado pronto"
            : "Preparando";
  const latestLog = agentLogs.length > 0 ? agentLogs[agentLogs.length - 1] : undefined;
  const visibleLogs = agentLogs.slice(-4).reverse();
  const workflowSteps = workflowRun?.steps ?? [];
  const approval = workflowRun?.approval;
  const visibleConnectors = connectors.slice(0, 7);
  const composerPlaceholder = "Pergunte algo, peça um rascunho ou comece por uma ação abaixo.";

  const commonProps = {
    error,
    result,
    streaming,
    query,
    clipboardText: clipboard.clipboardText,
    hasClipboard: clipboard.hasClipboard,
    ignoreClipboard,
    setIgnoreClipboard,
    onReloadClipboard: clipboard.checkClipboard,
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
    chips: contextChips.chips,
    starterChips: contextChips.starterChips,
    clipboardActions: contextChips.clipboardChips,
    onChipClick: handleChipClick,
    onExecute: exec.handleExecute,
    onAbort: () => {
      exec.handleAbort();
      onToastSuccess?.("Resposta cancelada");
    },
    onCopy: exec.handleCopyResult,
    onNewTask: handleNewTask,
    onStarterAction,
    onEditPrompt,
    onCopyResponse,
    onRegenerate,
    onApproval: exec.handleApproval,
    setMode: handleChangeMode,
    setExecutionMode,
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
  };

  if (uiMode === "expanded") {
    return (
      <>
        <div className="h-full w-full flex flex-col">
          <HelixHeader
            expanded
            alwaysOnTop={settings.alwaysOnTop}
            onToggleAlwaysOnTop={onToggleAlwaysOnTop}
            onToggleExpand={handleToggleExpand}
            onMinimize={handleMinimize}
            onClose={handleClose}
          />
          <div className="flex-1 min-h-0 flex">
            <HelixSidebar
              mode={mode}
              onChangeMode={handleChangeMode}
              onNewTask={handleNewTask}
              onToggleExpand={handleToggleExpand}
            />
            <main className="flex-1 min-h-0 overflow-hidden">
              <ExpandedView {...commonProps} />
            </main>
          </div>
        </div>
        {showSettings && (
          <SettingsPanel
            variant="expanded"
            onClose={() => setShowSettings(false)}
            settings={settings}
            formProvider={settingsForm.formProvider}
            setFormProvider={settingsForm.setFormProvider}
            formApiKey={settingsForm.formApiKey}
            setFormApiKey={settingsForm.setFormApiKey}
            formBaseUrl={settingsForm.formBaseUrl}
            setFormBaseUrl={settingsForm.setFormBaseUrl}
            formModel={settingsForm.formModel}
            setFormModel={settingsForm.setFormModel}
            formHidePet={settingsForm.formHidePet}
            setFormHidePet={settingsForm.setFormHidePet}
            formTimeout={settingsForm.formTimeout}
            setFormTimeout={settingsForm.setFormTimeout}
            formWindowOpacity={settingsForm.formWindowOpacity}
            setFormWindowOpacity={settingsForm.setFormWindowOpacity}
            formPetSize={settingsForm.formPetSize}
            setFormPetSize={settingsForm.setFormPetSize}
            showKey={settingsForm.showKey}
            setShowKey={settingsForm.setShowKey}
            fetchedModels={settingsForm.fetchedModels}
            loadingModels={settingsForm.loadingModels}
            savingSettings={settingsForm.savingSettings}
            handleSaveSettings={settingsForm.handleSaveSettings}
          />
        )}
      </>
    );
  }

  return (
    <>
      <div className="h-full w-full flex flex-col">
        <HelixHeader
          expanded={false}
          alwaysOnTop={settings.alwaysOnTop}
          onToggleAlwaysOnTop={onToggleAlwaysOnTop}
          onToggleExpand={handleToggleExpand}
          onMinimize={handleMinimize}
          onClose={handleClose}
          onOpenMenu={() => setDrawerOpen(true)}
        />
        <HelixDrawer
          open={drawerOpen}
          mode={mode}
          onClose={() => setDrawerOpen(false)}
          onChangeMode={handleChangeMode}
          onNewTask={handleNewTask}
        />
        <main className="flex-1 min-h-0 overflow-hidden relative">
          <NormalCommandView {...commonProps} onExpandedMode={handleToggleExpand} />
        </main>
      </div>
      {showSettings && (
        <SettingsPanel
          onClose={() => setShowSettings(false)}
          settings={settings}
          formProvider={settingsForm.formProvider}
          setFormProvider={settingsForm.setFormProvider}
          formApiKey={settingsForm.formApiKey}
          setFormApiKey={settingsForm.setFormApiKey}
          formBaseUrl={settingsForm.formBaseUrl}
          setFormBaseUrl={settingsForm.setFormBaseUrl}
          formModel={settingsForm.formModel}
          setFormModel={settingsForm.setFormModel}
          formHidePet={settingsForm.formHidePet}
          setFormHidePet={settingsForm.setFormHidePet}
          formTimeout={settingsForm.formTimeout}
          setFormTimeout={settingsForm.setFormTimeout}
          formWindowOpacity={settingsForm.formWindowOpacity}
          setFormWindowOpacity={settingsForm.setFormWindowOpacity}
          formPetSize={settingsForm.formPetSize}
          setFormPetSize={settingsForm.setFormPetSize}
          showKey={settingsForm.showKey}
          setShowKey={settingsForm.setShowKey}
          fetchedModels={settingsForm.fetchedModels}
          loadingModels={settingsForm.loadingModels}
          savingSettings={settingsForm.savingSettings}
          handleSaveSettings={settingsForm.handleSaveSettings}
        />
      )}
    </>
  );
}
