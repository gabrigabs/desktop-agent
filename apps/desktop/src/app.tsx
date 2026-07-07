import { listen } from "@tauri-apps/api/event";
import { Maximize2, Minimize2, Pin, Sparkles } from "lucide-react";
import { type CSSProperties, useCallback, useEffect, useRef } from "react";
import { ErrorBoundary } from "./components/ui/error-boundary";
import { Pet } from "./components/ui/pet";
import { ToastContainer } from "./components/ui/toast";
import { useToast } from "./hooks/use-toast";
import { getAgent } from "./lib/rpc";
import {
  setAlwaysOnTop as apiSetAlwaysOnTop,
  hideWindow,
  isTauriRuntime,
  setWindowMode,
  startWindowDrag,
} from "./lib/window";
import { useAgentStore } from "./stores/agent";
import { Helix } from "./surfaces/helix";

export function App() {
  const { connected, uiMode, setUiMode, settings, setSettings } = useAgentStore();
  const { toasts, dismiss, success, error } = useToast();
  const dragStart = useRef({ x: 0, y: 0 });
  const restoredWindowMode = useRef(false);

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
    async (mode: typeof uiMode) => {
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

  // Restore persisted window mode once settings are loaded from the sidecar.
  useEffect(() => {
    if (!connected || restoredWindowMode.current) return;

    restoredWindowMode.current = true;
    const mode =
      settings.hidePet && settings.lastWindowMode === "collapsed" ? "normal" : settings.lastWindowMode;
    setUiMode(mode);
    setWindowMode(mode, { alwaysOnTop: settings.alwaysOnTop });
  }, [connected, settings.alwaysOnTop, settings.hidePet, settings.lastWindowMode, setUiMode]);

  // Sync pet hide visibility lifecycle
  useEffect(() => {
    if (settings.hidePet && uiMode === "collapsed") {
      hideWindow();
      // Auto expand to normal mode so that next time the shortcut is pressed, it shows Helix directly
      setUiMode("normal");
      setWindowMode("normal", { alwaysOnTop: settings.alwaysOnTop });
      saveAppSettings({ ...settings, lastWindowMode: "normal" });
    }
  }, [saveAppSettings, settings, uiMode, setUiMode]);

  // Listen to tray-click event emitted from Rust
  useEffect(() => {
    if (!isTauriRuntime()) return;

    let unlistenFn: (() => void) | undefined;

    listen<string>("tray-click", (event) => {
      if (event.payload === "normal") {
        applyWindowMode("normal");
      }
    }).then((fn) => {
      unlistenFn = fn;
    });

    return () => {
      if (unlistenFn) {
        unlistenFn();
      }
    };
  }, [applyWindowMode]);

  const handleNormal = async () => {
    await applyWindowMode("normal");
  };

  const handleMini = async () => {
    await applyWindowMode("mini");
  };

  const handleCollapse = async () => {
    if (settings.hidePet) {
      setUiMode("collapsed");
      await hideWindow();
      // Instantly reset mode to normal for next launch
      setUiMode("normal");
      await setWindowMode("normal", { alwaysOnTop: settings.alwaysOnTop });
      await saveAppSettings({ ...settings, lastWindowMode: "normal" });
    } else {
      await applyWindowMode("collapsed");
    }
  };

  const handleExpanded = async () => {
    const nextMode = uiMode === "expanded" ? "normal" : "expanded";
    await applyWindowMode(nextMode);
  };

  const toggleAlwaysOnTop = async () => {
    const nextSettings = { ...settings, alwaysOnTop: !settings.alwaysOnTop };
    await apiSetAlwaysOnTop(nextSettings.alwaysOnTop);
    await saveAppSettings(nextSettings);
  };

  const handleMouseDown = async (e: React.MouseEvent) => {
    if (e.buttons === 1) {
      dragStart.current = { x: e.screenX, y: e.screenY };
      await startWindowDrag();
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    const dx = e.screenX - dragStart.current.x;
    const dy = e.screenY - dragStart.current.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    // Se o mouse moveu menos de 5 pixels, tratamos como clique para expandir
    if (dist < 5) {
      handleNormal();
    }
  };

  const modeLabel = uiMode === "expanded" ? "expandido" : uiMode === "mini" ? "mini" : "normal";
  const shellRadius =
    uiMode === "expanded" ? "rounded-[18px]" : uiMode === "mini" ? "rounded-[20px]" : "rounded-[24px]";

  if (uiMode === "collapsed" && !settings.hidePet) {
    return (
      // biome-ignore lint/a11y/useSemanticElements: We need a div here to allow programmatic Tauri window dragging
      <div
        role="button"
        tabIndex={0}
        className="w-[92px] h-[92px] flex items-center justify-center cursor-pointer group active:scale-95 transition-transform duration-150 focus:outline-none bg-transparent border-0"
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            handleNormal();
          }
        }}
        data-tauri-drag-region
        title="Abrir Helix"
        aria-label="Abrir Helix"
      >
        <div className="w-full h-full flex items-center justify-center transition-all duration-300 group-hover:scale-[1.04] relative pointer-events-none">
          <Pet size={settings.petSize ?? 48} />
        </div>
      </div>
    );
  }

  return (
    <div className="agent-window-frame">
      <div
        className={`w-full h-full flex flex-col agent-shell ${shellRadius} overflow-hidden relative select-none`}
        style={{ "--window-opacity": settings.windowOpacity ?? 0.72 } as CSSProperties}
      >
        {/* Custom Titlebar / Header */}
        <header
          className="h-11 flex items-center justify-between px-3 border-b border-line bg-white/[0.02] relative z-10"
          data-tauri-drag-region
        >
          <div className="flex items-center gap-2" data-tauri-drag-region>
            <div className="flex items-center justify-center w-4 h-4">
              <Pet size={10} variant="dot" />
            </div>
            <div className="flex flex-col" data-tauri-drag-region>
              <span
                className="text-[13px] font-semibold tracking-tight text-fg leading-none"
                data-tauri-drag-region
              >
                Helix
              </span>
              <span className="text-[10px] text-faint leading-none mt-0.5" data-tauri-drag-region>
                {connected ? modeLabel : "conectando…"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-0.5 relative z-20">
            {/* Mini mode toggle */}
            <button
              type="button"
              onClick={handleMini}
              className={`p-1.5 rounded-md hover:bg-white/5 transition-colors ${uiMode === "mini" ? "text-warn" : "text-faint hover:text-fg"}`}
              title={uiMode === "mini" ? "Modo mini ativo" : "Abrir modo mini"}
            >
              <Sparkles className="w-3.5 h-3.5" />
            </button>

            {/* Expanded mode toggle */}
            <button
              type="button"
              onClick={handleExpanded}
              className={`p-1.5 rounded-md hover:bg-white/5 transition-colors ${uiMode === "expanded" ? "text-signal" : "text-faint hover:text-fg"}`}
              title={uiMode === "expanded" ? "Voltar ao modo normal" : "Abrir modo expandido"}
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>

            {/* Always on top toggle */}
            <button
              type="button"
              onClick={toggleAlwaysOnTop}
              className={`p-1.5 rounded-md hover:bg-white/5 transition-colors ${settings.alwaysOnTop ? "text-signal" : "text-faint hover:text-fg"}`}
              title={settings.alwaysOnTop ? "Fixado no topo" : "Fixar no topo"}
            >
              <Pin className="w-3.5 h-3.5" />
            </button>

            {/* Collapse Button */}
            <button
              type="button"
              onClick={handleCollapse}
              className="p-1.5 rounded-md text-faint hover:text-fg hover:bg-white/5 transition-colors"
              title={settings.hidePet ? "Ocultar janela" : "Minimizar para o Pet"}
            >
              <Minimize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-hidden relative z-10">
          <ErrorBoundary>
            <Helix onToastSuccess={success} onToastError={error} />
          </ErrorBoundary>
        </main>
      </div>
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
