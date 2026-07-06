import { useEffect } from "react";
import { setWindowMode } from "../../../lib/window";
import { useAgentStore } from "../../../stores/agent";
import type { InputMode } from "../constants";

type Deps = {
  handleExecute: (forceInstruction?: string, forceInputMode?: InputMode) => void;
  showSettings: boolean;
  setShowSettings: (v: boolean) => void;
  persistWindowMode: (mode: "mini" | "normal" | "expanded" | "collapsed") => Promise<void>;
};

export function useKeyboard({ handleExecute, showSettings, setShowSettings, persistWindowMode }: Deps) {
  const streaming = useAgentStore((s) => s.streaming);
  const query = useAgentStore((s) => s.query);
  const result = useAgentStore((s) => s.result);
  const error = useAgentStore((s) => s.error);
  const uiMode = useAgentStore((s) => s.uiMode);
  const setUiMode = useAgentStore((s) => s.setUiMode);
  const reset = useAgentStore((s) => s.reset);
  const alwaysOnTop = useAgentStore((s) => s.settings.alwaysOnTop);

  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (!streaming && !showSettings) handleExecute();
      }
      if (e.key === "Escape") {
        if (showSettings) {
          setShowSettings(false);
        } else if (query || result || error) {
          reset();
        } else {
          const nextMode = uiMode === "expanded" ? "normal" : uiMode === "normal" ? "mini" : "collapsed";
          setUiMode(nextMode);
          await setWindowMode(nextMode, { alwaysOnTop });
          await persistWindowMode(nextMode);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    handleExecute,
    streaming,
    query,
    result,
    error,
    reset,
    setUiMode,
    showSettings,
    setShowSettings,
    uiMode,
    alwaysOnTop,
    persistWindowMode,
  ]);
}
