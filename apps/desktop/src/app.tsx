import { listen } from "@tauri-apps/api/event";
import { readText as readClipboard } from "@tauri-apps/plugin-clipboard-manager";
import { type CSSProperties, useCallback, useEffect, useRef } from "react";
import { ErrorBoundary } from "./components/ui/feedback/error-boundary";
import { HelixLauncher } from "./components/ui/helix/helix-launcher";
import { TaskWidget } from "./components/ui/helix/task-widget";
import { BootScreen } from "./components/ui/layout/boot-screen";
import { Starfield } from "./components/ui/layout/starfield";
import { ToastContainer } from "./components/ui/primitives/toast";
import { useToast } from "./hooks/use-toast";
import i18n, { normalizeLanguage } from "./i18n";
import { getAgent } from "./lib/rpc";
import {
  setAlwaysOnTop as apiSetAlwaysOnTop,
  closeApp,
  hideWindow,
  isTauriRuntime,
  setWindowMode,
} from "./lib/window";
import { useAgentStore } from "./stores/agent";
import { Helix } from "./surfaces/helix";

export function App() {
  const {
    uiMode,
    setUiMode,
    settings,
    setSettings,
    bootState,
    streaming,
    result,
    error: taskError,
    workflowRun,
    agentLogs,
    activeFollowUpSession,
    setResult,
    setError,
    setWorkflowRun,
    clearAgentLogs,
  } = useAgentStore();
  const { toasts, dismiss, success, error } = useToast();
  const restoredWindowMode = useRef(false);
  const taskActive =
    streaming ||
    result !== null ||
    Boolean(taskError) ||
    agentLogs.length > 0 ||
    Boolean(workflowRun) ||
    Boolean(activeFollowUpSession);

  useEffect(() => {
    // Proactively boot the sidecar once on mount
    void getAgent().catch(() => undefined);
  }, []);

  useEffect(() => {
    // Detect system language on first boot and persist if no saved language exists
    if (settings.language) return;
    const detected = normalizeLanguage(navigator.language);
    const nextSettings = { ...settings, language: detected };
    setSettings(nextSettings);
    void getAgent()
      .then((api) => api.saveSettings(nextSettings))
      .catch(() => undefined);
  }, [settings, setSettings]);

  useEffect(() => {
    // Keep i18n language in sync with persisted settings
    if (settings.language && i18n.language !== settings.language) {
      void i18n.changeLanguage(settings.language);
    }
  }, [settings.language]);

  useEffect(() => {
    const handler = (e: Event) => {
      const message = (e as CustomEvent).detail || i18n.t("helix:status.connectionError", { message: "" });
      error(i18n.t("helix:status.connectionError", { message }));
    };
    window.addEventListener("agent-connection-error", handler);
    return () => window.removeEventListener("agent-connection-error", handler);
  }, [error]);

  const saveAppSettings = useCallback(
    async (nextSettings: typeof settings) => {
      setSettings(nextSettings);
      try {
        const api = await getAgent();
        await api.saveSettings(nextSettings);
      } catch (err) {
        console.error("Failed to persist app settings:", err);
      }
    },
    [setSettings],
  );

  const applyWindowMode = useCallback(
    async (mode: "collapsed" | "normal" | "expanded") => {
      setUiMode(mode);
      await setWindowMode(mode, {
        alwaysOnTop: settings.alwaysOnTop,
        collapsedTaskActive: mode === "collapsed" && taskActive,
      });
    },
    [setUiMode, settings.alwaysOnTop, taskActive],
  );

  // Ensure always on top is synced with state
  useEffect(() => {
    apiSetAlwaysOnTop(settings.alwaysOnTop);
  }, [settings.alwaysOnTop]);

  // Apply the configured cold-start mode once. Session changes never rewrite it.
  useEffect(() => {
    if (restoredWindowMode.current) return;

    restoredWindowMode.current = true;
    const mode =
      settings.hidePet && settings.defaultWindowMode === "collapsed" ? "normal" : settings.defaultWindowMode;
    setUiMode(mode);
    setWindowMode(mode, {
      alwaysOnTop: settings.alwaysOnTop,
      collapsedTaskActive: mode === "collapsed" && taskActive,
    });
  }, [settings.alwaysOnTop, settings.defaultWindowMode, settings.hidePet, setUiMode, taskActive]);

  useEffect(() => {
    if (uiMode !== "collapsed" || settings.hidePet) return;
    void setWindowMode("collapsed", {
      alwaysOnTop: settings.alwaysOnTop,
      collapsedTaskActive: taskActive,
    });
  }, [settings.alwaysOnTop, settings.hidePet, taskActive, uiMode]);

  // Sync pet hide visibility lifecycle
  useEffect(() => {
    if (settings.hidePet && uiMode === "collapsed") {
      hideWindow();
      setUiMode("normal");
      setWindowMode("normal", { alwaysOnTop: settings.alwaysOnTop });
    }
  }, [settings.alwaysOnTop, settings.hidePet, uiMode, setUiMode]);

  // Listen to tray-click event emitted from Rust
  useEffect(() => {
    if (!isTauriRuntime()) return;

    let unlistenFn: (() => void) | undefined;
    let disposed = false;

    void listen<string>("tray-click", () => {
      void applyWindowMode("normal");
    })
      .then((fn) => {
        if (disposed) {
          fn();
          return;
        }
        unlistenFn = fn;
      })
      .catch((err) => {
        if (!disposed) {
          console.error("Failed to listen for tray events:", err);
        }
      });

    return () => {
      disposed = true;
      if (unlistenFn) {
        unlistenFn();
      }
    };
  }, [applyWindowMode]);

  const toggleAlwaysOnTop = async () => {
    const nextSettings = { ...settings, alwaysOnTop: !settings.alwaysOnTop };
    await apiSetAlwaysOnTop(nextSettings.alwaysOnTop);
    await saveAppSettings(nextSettings);
  };

  if (uiMode === "collapsed" && !settings.hidePet) {
    return (
      <div
        className={`agent-window-frame overflow-visible ${taskActive ? "task-widget-frame" : "launcher-frame"}`}
        data-tauri-drag-region
      >
        <div
          className={`flex h-full w-full items-center justify-center overflow-visible ${taskActive ? "rounded-[24px]" : "rounded-full"}`}
        >
          {bootState !== "ready" ? (
            <BootScreen compact />
          ) : taskActive ? (
            <TaskWidget
              run={workflowRun}
              streaming={streaming}
              result={result}
              error={taskError}
              latestLog={agentLogs[agentLogs.length - 1]?.text}
              followUp={activeFollowUpSession}
              petSize={settings.petSize ?? 56}
              onOpen={() => void applyWindowMode("normal")}
              onApproval={(approved) => {
                sessionStorage.setItem("helix.pending-approval", String(approved));
                void applyWindowMode("normal");
              }}
              onDismiss={() => {
                setResult(null);
                setError(null);
                setWorkflowRun(null);
                clearAgentLogs();
              }}
            />
          ) : (
            <HelixLauncher
              petSize={settings.petSize ?? 56}
              onOpenNormal={() => applyWindowMode("normal")}
              onAction={(action, secondaryAction) => {
                const pending = secondaryAction
                  ? { actionId: action.id, secondaryId: secondaryAction.id }
                  : { actionId: action.id };
                sessionStorage.setItem("helix.pending-action", JSON.stringify(pending));
                void applyWindowMode(action.category === "screen" ? "expanded" : "normal");
              }}
              onQuickAction={(action, secondaryAction) => {
                void (async () => {
                  let execute = true;
                  if (secondaryAction.requiredContext?.includes("clipboard")) {
                    try {
                      const text = await readClipboard();
                      const store = useAgentStore.getState();
                      store.setClipboardText(text ?? "");
                      store.setIgnoreClipboard(false);
                      execute = Boolean(text?.trim());
                    } catch {
                      // The normal composer will surface an empty clipboard if native access fails.
                      execute = false;
                    }
                  }
                  sessionStorage.setItem(
                    "helix.pending-action",
                    JSON.stringify({ actionId: action.id, secondaryId: secondaryAction.id, execute }),
                  );
                  await applyWindowMode(action.category === "screen" ? "expanded" : "normal");
                })();
              }}
            />
          )}
        </div>
      </div>
    );
  }

  const shellRadius = uiMode === "expanded" ? "rounded-[18px]" : "rounded-[24px]";

  return (
    <div className="agent-window-frame">
      <div
        className={`w-full h-full flex flex-col agent-shell ${shellRadius} overflow-hidden relative select-none`}
        style={{ "--window-opacity": settings.windowOpacity ?? 0.72 } as CSSProperties}
      >
        <div className="absolute inset-0 z-0 pointer-events-none opacity-70">
          <Starfield density={24} />
        </div>
        <main className="flex-1 overflow-hidden relative z-10">
          <ErrorBoundary>
            <Helix onToastSuccess={success} onToastError={error} onToggleAlwaysOnTop={toggleAlwaysOnTop} />
          </ErrorBoundary>
        </main>
        {bootState !== "ready" && <BootScreen />}
      </div>
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}

export { closeApp };
