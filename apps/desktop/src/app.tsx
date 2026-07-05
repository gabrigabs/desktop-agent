import { listen } from "@tauri-apps/api/event";
import { Maximize2, Minimize2, Pin } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Pet } from "./components/ui/pet";
import {
  setAlwaysOnTop as apiSetAlwaysOnTop,
  hideWindow,
  isTauriRuntime,
  setWindowMode,
  startWindowDrag,
} from "./lib/window";
import { useAgentStore } from "./stores/agent";
import { CommandPalette } from "./surfaces/command-palette";

export function App() {
  const { connected, uiMode, setUiMode, settings } = useAgentStore();
  const [alwaysOnTop, setAlwaysOnTopState] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

  // Ensure always on top is synced with state
  useEffect(() => {
    apiSetAlwaysOnTop(alwaysOnTop);
  }, [alwaysOnTop]);

  // Sync pet hide visibility lifecycle
  useEffect(() => {
    if (settings.hidePet && uiMode === "collapsed") {
      hideWindow();
      // Auto expand to expanded mode so that next time the shortcut is pressed, it shows the command palette directly
      setUiMode("expanded");
      setWindowMode("expanded");
    }
  }, [settings.hidePet, uiMode, setUiMode]);

  // Listen to tray-click event emitted from Rust
  useEffect(() => {
    if (!isTauriRuntime()) return;

    let unlistenFn: (() => void) | undefined;

    listen<string>("tray-click", (event) => {
      if (event.payload === "expanded") {
        setUiMode("expanded");
      }
    }).then((fn) => {
      unlistenFn = fn;
    });

    return () => {
      if (unlistenFn) {
        unlistenFn();
      }
    };
  }, [setUiMode]);

  const handleExpand = async () => {
    setUiMode("expanded");
    await setWindowMode("expanded");
  };

  const handleCollapse = async () => {
    if (settings.hidePet) {
      setUiMode("collapsed");
      await hideWindow();
      // Instantly reset mode to expanded for next launch
      setUiMode("expanded");
      await setWindowMode("expanded");
    } else {
      setUiMode("collapsed");
      await setWindowMode("collapsed");
    }
  };

  const handleWorkspace = async () => {
    const nextMode = uiMode === "workspace" ? "expanded" : "workspace";
    setUiMode(nextMode);
    await setWindowMode(nextMode);
  };

  const toggleAlwaysOnTop = () => {
    setAlwaysOnTopState(!alwaysOnTop);
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
      handleExpand();
    }
  };

  if (uiMode === "collapsed" && !settings.hidePet) {
    return (
      // biome-ignore lint/a11y/useSemanticElements: We need a div here to allow programmatic Tauri window dragging
      <div
        role="button"
        tabIndex={0}
        className="w-[104px] h-[104px] flex items-center justify-center cursor-pointer group active:scale-95 transition-transform duration-150 focus:outline-none bg-transparent border-0 p-0"
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            handleExpand();
          }
        }}
        data-tauri-drag-region
        title="Abrir Desktop Agent"
        aria-label="Abrir Desktop Agent"
      >
        <div className="w-[92px] h-[92px] rounded-full flex items-center justify-center transition-transform duration-300 group-hover:scale-105 relative pointer-events-none bg-zinc-950/90 shadow-[0_0_0_1px_rgba(255,255,255,0.28),0_0_0_7px_rgba(255,255,255,0.07),0_20px_45px_rgba(0,0,0,0.58)] backdrop-blur-md">
          <div className="absolute inset-2 rounded-full bg-[radial-gradient(circle_at_50%_42%,rgba(244,114,182,0.24),rgba(9,9,11,0)_62%)]" />
          <Pet size={62} />
          <div
            className={`absolute right-[18px] bottom-[18px] w-3 h-3 rounded-full ring-4 ring-zinc-950/95 shadow-[0_0_18px_currentColor] ${
              connected ? "bg-emerald-400 text-emerald-300" : "bg-amber-400 text-amber-300"
            }`}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen flex flex-col agent-shell rounded-[24px] overflow-hidden relative select-none">
      {/* Custom Titlebar / Header */}
      <header
        className="h-12 flex items-center justify-between px-4 border-b border-zinc-800/60 bg-zinc-950/40 relative z-10"
        data-tauri-drag-region
      >
        <div className="flex items-center gap-2" data-tauri-drag-region>
          <Pet size={24} />
          <div className="flex flex-col" data-tauri-drag-region>
            <span className="text-xs font-mono font-bold tracking-wide text-zinc-200" data-tauri-drag-region>
              Desktop Agent
            </span>
            <span
              className="text-[9px] font-mono text-zinc-500 flex items-center gap-1"
              data-tauri-drag-region
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`}
              />
              {connected ? "online" : "connecting"}
            </span>
          </div>
        </div>

        {/* Drag handle center marker */}
        <div
          className="flex gap-1 justify-center opacity-30 group-hover:opacity-60 transition-opacity"
          data-tauri-drag-region
        >
          <div className="w-1 h-1 bg-zinc-400 rounded-full" data-tauri-drag-region />
          <div className="w-1 h-1 bg-zinc-400 rounded-full" data-tauri-drag-region />
          <div className="w-1 h-1 bg-zinc-400 rounded-full" data-tauri-drag-region />
        </div>

        <div className="flex items-center gap-1.5 relative z-20">
          {/* Always on top toggle */}
          <button
            type="button"
            onClick={handleWorkspace}
            className={`p-1.5 rounded-md hover:bg-zinc-800/80 transition-colors ${uiMode === "workspace" ? "text-violet-300" : "text-zinc-500 hover:text-zinc-300"}`}
            title={uiMode === "workspace" ? "Voltar ao painel compacto" : "Abrir workspace"}
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>

          {/* Always on top toggle */}
          <button
            type="button"
            onClick={toggleAlwaysOnTop}
            className={`p-1.5 rounded-md hover:bg-zinc-800/80 transition-colors ${alwaysOnTop ? "text-indigo-400" : "text-zinc-500 hover:text-zinc-300"}`}
            title={alwaysOnTop ? "Fixado no topo" : "Fixar no topo"}
          >
            <Pin className="w-3.5 h-3.5" />
          </button>

          {/* Collapse Button */}
          <button
            type="button"
            onClick={handleCollapse}
            className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/80 transition-colors"
            title={settings.hidePet ? "Ocultar janela" : "Minimizar para o Pet"}
          >
            <Minimize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden relative z-10">
        <CommandPalette />
      </main>
    </div>
  );
}
