import { useCallback, useEffect, useRef, useState } from "react";
import { getAgent } from "../../lib/rpc";
import { closeApp, hideWindow, isTauriRuntime, setWindowMode } from "../../lib/window";
import { useAgentStore } from "../../stores/agent";
import { getActiveBadgeText } from "./constants";
import { ExpandedView } from "./ExpandedView";
import { useCapabilities } from "./hooks/useCapabilities";
import { useClipboard } from "./hooks/useClipboard";
import { useExecute } from "./hooks/useExecute";
import { useKeyboard } from "./hooks/useKeyboard";
import { useSettingsForm } from "./hooks/useSettingsForm";
import { MiniView } from "./MiniView";
import { NormalCommandView } from "./NormalCommandView";
import { SettingsPanel } from "./SettingsPanel";

type HelixProps = {
  onToastSuccess?: (message: string, duration?: number) => void;
  onToastError?: (message: string, duration?: number) => void;
};

export function Helix({ onToastSuccess, onToastError }: HelixProps) {
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

  const [mode, setMode] = useState<"command" | "history" | "connectors">("command");
  const [showSettings, setShowSettings] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const clipboard = useClipboard();
  const capabilities = useCapabilities();
  const exec = useExecute();
  const settingsForm = useSettingsForm(showSettings, onToastSuccess, onToastError);

  const persistWindowMode = useCallback(
    async (nextMode: "mini" | "normal" | "expanded" | "collapsed") => {
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

  const handleOpenMode = useCallback(
    async (nextMode: "mini" | "normal" | "expanded") => {
      setUiMode(nextMode);
      await setWindowMode(nextMode, { alwaysOnTop: settings.alwaysOnTop });
      await persistWindowMode(nextMode);
    },
    [setUiMode, settings.alwaysOnTop, persistWindowMode],
  );

  const handleExpandedMode = useCallback(async () => {
    const nextMode = uiMode === "expanded" ? "normal" : "expanded";
    setUiMode(nextMode);
    await setWindowMode(nextMode, { alwaysOnTop: settings.alwaysOnTop });
    await persistWindowMode(nextMode);
  }, [uiMode, setUiMode, settings.alwaysOnTop, persistWindowMode]);

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

  const onStarterAction = useCallback(
    (prompt: string, modeOverride?: "simple" | "workflow") => {
      exec.handleStarterAction(prompt, modeOverride, textareaRef);
      requestAnimationFrame(() => textareaRef.current?.focus());
    },
    [exec],
  );

  const onMiniStarterAction = useCallback(
    async (prompt: string, modeOverride?: "simple" | "workflow") => {
      exec.handleStarterAction(prompt, modeOverride, textareaRef);
      setMode("command");
      await handleOpenMode("normal");
      requestAnimationFrame(() => textareaRef.current?.focus());
    },
    [exec, handleOpenMode],
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
        if (isTauriRuntime()) {
          const { writeText } = await import("@tauri-apps/plugin-clipboard-manager");
          await writeText(text);
        } else {
          await navigator.clipboard?.writeText(text);
        }
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
    const lastUserTurn = [...store.messages].reverse().find((t) => t.role === "user");
    if (!lastUserTurn || store.streaming) return;

    const promptText = lastUserTurn.blocks.find((b) => b.type === "text");
    if (promptText?.type !== "text") return;

    const newMessages = store.messages.slice(0, -1);
    store.setMessages(newMessages);
    store.setResult(null);
    store.setError(null);
    onToastSuccess?.("Regenerando resposta");
    void exec.handleExecute(promptText.content, lastUserTurn.sourceMode);
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
  const expandedMode = uiMode === "expanded";
  const inputModeLabel = exec.inputMode === "clipboard" ? "Interagir com clipboard" : "Conteúdo avulso";
  const taskModeLabel = `${executionMode === "workflow" ? "Workflow" : "Simples"} · ${exec.activeTaskMode === "clipboard" ? "Clipboard" : "Livre"}`;
  const composerPlaceholder =
    exec.inputMode === "clipboard"
      ? "Diga o que fazer com o texto copiado."
      : "Pergunte algo, peça um rascunho ou comece por uma ação abaixo.";
  const badgeText = getActiveBadgeText(settings.activeProvider, settings.model);

  if (uiMode === "mini") {
    return (
      <MiniView
        error={error}
        result={result}
        streaming={streaming}
        taskActive={taskActive}
        taskStatus={taskStatus}
        taskModeLabel={taskModeLabel}
        latestLogText={latestLog?.text}
        clipboardText={clipboard.clipboardText}
        hasClipboard={clipboard.hasClipboard}
        activeRequestId={exec.activeRequestId}
        copied={exec.copied}
        onAbort={() => {
          exec.handleAbort();
          onToastSuccess?.("Resposta cancelada");
        }}
        onCopy={exec.handleCopyResult}
        onOpenMode={handleOpenMode}
        onQuickAction={exec.handleQuickAction}
        onStarterAction={onMiniStarterAction}
      />
    );
  }

  if (uiMode === "expanded") {
    return (
      <>
        <ExpandedView
          error={error}
          result={result}
          streaming={streaming}
          query={query}
          clipboardText={clipboard.clipboardText}
          hasClipboard={clipboard.hasClipboard}
          taskActive={taskActive}
          taskStatus={taskStatus}
          taskModeLabel={taskModeLabel}
          inputModeLabel={inputModeLabel}
          composerPlaceholder={composerPlaceholder}
          inputMode={exec.inputMode}
          executionMode={executionMode}
          mode={mode}
          activeRequestId={exec.activeRequestId}
          copied={exec.copied}
          messages={messages}
          workflowSteps={workflowSteps}
          visibleLogs={visibleLogs}
          latestLogText={latestLog?.text}
          connectors={visibleConnectors}
          testingConnectorId={capabilities.testingConnectorId}
          textareaRef={textareaRef}
          badgeText={badgeText}
          showSettings={showSettings}
          setMode={setMode}
          setInputMode={exec.setInputMode}
          setExecutionMode={setExecutionMode}
          setQuery={setQuery}
          setShowSettings={setShowSettings}
          onExecute={() => exec.handleExecute()}
          onAbort={() => {
            exec.handleAbort();
            onToastSuccess?.("Resposta cancelada");
          }}
          onCopy={exec.handleCopyResult}
          onNewTask={exec.handleNewTask}
          onOpenMode={handleOpenMode}
          onStarterAction={onStarterAction}
          onQuickAction={exec.handleQuickAction}
          onTestConnector={capabilities.handleTestConnector}
          onToggleConnector={capabilities.handleToggleConnector}
          onEditPrompt={onEditPrompt}
          onCopyResponse={onCopyResponse}
          onRegenerate={onRegenerate}
          onToastSuccess={onToastSuccess}
          onToastError={onToastError}
        />
        {showSettings && (
          <SettingsPanel
            variant="expanded"
            onClose={() => setShowSettings(false)}
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
      <NormalCommandView
        error={error}
        result={result}
        streaming={streaming}
        query={query}
        clipboardText={clipboard.clipboardText}
        hasClipboard={clipboard.hasClipboard}
        taskActive={taskActive}
        taskStatus={taskStatus}
        taskModeLabel={taskModeLabel}
        inputModeLabel={inputModeLabel}
        composerPlaceholder={composerPlaceholder}
        inputMode={exec.inputMode}
        executionMode={executionMode}
        mode={mode}
        expandedMode={expandedMode}
        activeRequestId={exec.activeRequestId}
        copied={exec.copied}
        messages={messages}
        workflowSteps={workflowSteps}
        approval={
          approval
            ? {
                reason: approval.reason,
                permissionLevel: approval.permissionLevel,
                inputPreview: approval.inputPreview,
              }
            : undefined
        }
        visibleLogs={visibleLogs}
        latestLogText={latestLog?.text}
        connectors={visibleConnectors}
        testingConnectorId={capabilities.testingConnectorId}
        textareaRef={textareaRef}
        badgeText={badgeText}
        showSettings={showSettings}
        setMode={setMode}
        setInputMode={exec.setInputMode}
        setExecutionMode={setExecutionMode}
        setQuery={setQuery}
        setShowSettings={setShowSettings}
        onExecute={() => exec.handleExecute()}
        onAbort={() => {
          exec.handleAbort();
          onToastSuccess?.("Resposta cancelada");
        }}
        onApproval={exec.handleApproval}
        onCopy={exec.handleCopyResult}
        onNewTask={exec.handleNewTask}
        onExpandedMode={handleExpandedMode}
        onClose={async () => {
          await closeApp();
        }}
        onMinimize={async () => {
          await hideWindow();
        }}
        onStarterAction={onStarterAction}
        onQuickAction={exec.handleQuickAction}
        onTestConnector={capabilities.handleTestConnector}
        onToggleConnector={capabilities.handleToggleConnector}
        onRefreshCapabilities={capabilities.refreshCapabilities}
        onEditPrompt={onEditPrompt}
        onCopyResponse={onCopyResponse}
        onRegenerate={onRegenerate}
        onToastSuccess={onToastSuccess}
        onToastError={onToastError}
      />
      {showSettings && (
        <SettingsPanel
          onClose={() => setShowSettings(false)}
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
