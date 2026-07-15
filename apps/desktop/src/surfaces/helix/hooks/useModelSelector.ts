import { useCallback, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { getAgent } from "../../../lib/rpc";
import { useAgentStore } from "../../../stores/agent";
import { useActiveBadgeText, usePinstripesModels } from "../constants";

const PROVIDERS = ["pinstripes", "mock", "openai", "gemini"] as const;

type Provider = (typeof PROVIDERS)[number];

export function useModelSelector() {
  const { t, i18n } = useTranslation("helix");
  const settings = useAgentStore((s) => s.settings);
  const setSettings = useAgentStore((s) => s.setSettings);
  const pinstripesModels = usePinstripesModels();
  const formatBadge = useActiveBadgeText();

  const provider = settings.activeProvider;
  const model = settings.model;

  const providerOptions = useMemo(
    () => [
      { value: "pinstripes", label: t("helix:providerModelSelect.pinstripesApi") },
      { value: "mock", label: t("helix:providerModelSelect.mockLocal") },
      { value: "openai", label: t("helix:providerModelSelect.openaiCompatible") },
      { value: "gemini", label: t("helix:providerModelSelect.geminiCompatible") },
    ],
    [t],
  );

  const modelOptions = useMemo(() => {
    if (provider === "pinstripes") {
      return pinstripesModels.map((m) => ({ value: m.id, label: `${m.name} — ${m.description}` }));
    }
    if (provider === "mock") {
      return [{ value: "mock-model", label: "mock-model" }];
    }
    return null;
  }, [provider, pinstripesModels]);

  const displayLabel = useMemo(() => formatBadge(provider, model), [formatBadge, provider, model]);

  const needsApiKey = provider !== "mock" && !settings.apiKey.trim();

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const savePartial = useCallback(
    async (next: { activeProvider?: string; model?: string }, debounce = false) => {
      const updated = { ...settings, ...next };
      setSettings(updated);

      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }

      const persist = async () => {
        try {
          const api = await getAgent();
          await api.saveSettings(updated);
        } catch (err) {
          console.error("Failed to save model settings:", err);
        }
      };

      if (debounce) {
        saveTimerRef.current = setTimeout(persist, 500);
      } else {
        await persist();
      }
    },
    [settings, setSettings],
  );

  const setProvider = useCallback(
    async (nextProvider: string) => {
      const isValid = PROVIDERS.includes(nextProvider as Provider);
      const normalized = isValid ? (nextProvider as Provider) : "mock";

      let nextModel = model;
      if (normalized === "mock") {
        nextModel = "mock-model";
      } else if (normalized === "pinstripes") {
        const currentValid = pinstripesModels.some((m) => m.id === model);
        nextModel = currentValid ? model : "ps/warp";
      }

      await savePartial({ activeProvider: normalized, model: nextModel });
    },
    [model, pinstripesModels, savePartial],
  );

  const setModel = useCallback(
    async (nextModel: string) => {
      await savePartial({ model: nextModel }, true);
    },
    [savePartial],
  );

  return {
    provider,
    model,
    displayLabel,
    providerOptions,
    modelOptions,
    needsApiKey,
    setProvider,
    setModel,
    language: i18n.language,
  };
}
