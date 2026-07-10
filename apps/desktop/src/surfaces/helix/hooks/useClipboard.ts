import { readText as readClipboard } from "@tauri-apps/plugin-clipboard-manager";
import { useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { isTauriRuntime } from "../../../lib/window";
import { useAgentStore } from "../../../stores/agent";

export function useClipboard() {
  const { t } = useTranslation("helix");
  const clipboardText = useAgentStore((s) => s.clipboardText);
  const setClipboardText = useAgentStore((s) => s.setClipboardText);

  const checkClipboard = useCallback(async () => {
    if (!isTauriRuntime()) {
      setClipboardText("");
      return;
    }
    try {
      const text = await readClipboard();
      setClipboardText(text ?? "");
    } catch (err) {
      console.error(t("helix:helixIndex.readClipboardError"), err);
    }
  }, [setClipboardText, t]);

  useEffect(() => {
    checkClipboard();
    window.addEventListener("focus", checkClipboard);
    return () => window.removeEventListener("focus", checkClipboard);
  }, [checkClipboard]);

  return {
    clipboardText,
    hasClipboard: clipboardText.trim().length > 0,
    checkClipboard,
  };
}
