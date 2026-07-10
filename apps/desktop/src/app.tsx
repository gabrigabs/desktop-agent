import { listen } from "@tauri-apps/api/event";
import { type CSSProperties, useCallback, useEffect, useRef } from "react";
import { BootScreen } from "./components/ui/boot-screen";
import { ErrorBoundary } from "./components/ui/error-boundary";
import { HelixLauncher } from "./components/ui/helix-launcher";
import { Starfield } from "./components/ui/starfield";
import { ToastContainer } from "./components/ui/toast";
import { useToast } from "./hooks/use-toast";
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
  const { uiMode, setUiMode, settings, setSettings, bootState } = useAgentStore();
  const { toasts, dismiss, success, error } = useToast();
  const restoredWindowMode = useRef(false);

  useEffect(() => {
    // Proactively boot the sidecar once on mount
    void getAgent().catch(() => undefined);
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const message = (e as CustomEvent).detail || "Falha na conexão com o agente";
      error(`Problema no sidecar: ${message}`);
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
      await setWindowMode(mode, { alwaysOnTop: settings.alwaysOnTop });

      if (settings.lastWindowMode !== mode) {
        await saveAppSettings({ ...settings, lastWindowMode: mode });
      }
    },
    [saveAppSettings, setUiMode, settings],
  );

  // Ensure always on top is synced with state
  useEffect(() => {
    apiSetAlwaysOnTop(settings.alwaysOnTop);
  }, [settings.alwaysOnTop]);

  // Restore persisted window mode once on mount.
  useEffect(() => {
    if (restoredWindowMode.current) return;

    restoredWindowMode.current = true;
    const mode =
      settings.hidePet && settings.lastWindowMode === "collapsed" ? "normal" : settings.lastWindowMode;
    setUiMode(mode);
    setWindowMode(mode, { alwaysOnTop: settings.alwaysOnTop });
  }, [settings.alwaysOnTop, settings.hidePet, settings.lastWindowMode, setUiMode]);

  // Sync pet hide visibility lifecycle
  useEffect(() => {
    if (settings.hidePet && uiMode === "collapsed") {
      hideWindow();
      setUiMode("normal");
      setWindowMode("normal", { alwaysOnTop: settings.alwaysOnTop });
      saveAppSettings({ ...settings, lastWindowMode: "normal" });
    }
  }, [saveAppSettings, settings, uiMode, setUiMode]);

  // Listen to tray-click event emitted from Rust
  useEffect(() => {
    if (!isTauriRuntime()) return;

    let unlistenFn: (() => void) | undefined;

    listen<string>("tray-click", () => {
      applyWindowMode("normal");
    }).then((fn) => {
      unlistenFn = fn;
    });

    return () => {
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
      <div className="agent-window-frame launcher-frame overflow-visible" data-tauri-drag-region>
        <div className="w-full h-full rounded-full overflow-visible flex items-center justify-center">
          {bootState !== "ready" ? (
            <BootScreen compact />
          ) : (
            <HelixLauncher
              petSize={settings.petSize ?? 72}
              onOpenNormal={() => applyWindowMode("normal")}
              onAction={(action) => {
                sessionStorage.setItem("helix.pending-action", action.id);
                void applyWindowMode("normal");
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
