import { useEffect } from "react";
import { hideWindow } from "../../../lib/window";
import { useAgentStore } from "../../../stores/agent";
import type { InputMode } from "../constants";

type Deps = {
  handleExecute: (forceInstruction?: string, forceInputMode?: InputMode) => void;
  showSettings: boolean;
  setShowSettings: (v: boolean) => void;
  mode?: "command" | "history" | "connectors";
  setMode?: (m: "command" | "history" | "connectors") => void;
};

export function useKeyboard({ handleExecute, showSettings, setShowSettings, mode, setMode }: Deps) {
  const streaming = useAgentStore((s) => s.streaming);
  const query = useAgentStore((s) => s.query);
  const result = useAgentStore((s) => s.result);
  const error = useAgentStore((s) => s.error);
  const reset = useAgentStore((s) => s.reset);

  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (!streaming && !showSettings) handleExecute();
      }
      if (e.key === "Escape") {
        if (showSettings) {
          setShowSettings(false);
          return;
        }
        if (mode && mode !== "command" && setMode) {
          setMode("command");
          return;
        }
        if (query || result || error) {
          reset();
          return;
        }
        await hideWindow();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleExecute, streaming, query, result, error, reset, showSettings, setShowSettings, mode, setMode]);
}
