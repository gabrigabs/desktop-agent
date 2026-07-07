import { useCallback, useEffect, useState } from "react";
import { getAgent } from "../../../lib/rpc";
import { useAgentStore } from "../../../stores/agent";

export function useSettingsForm(
  showSettings: boolean,
  onToastSuccess?: (message: string, duration?: number) => void,
  onToastError?: (message: string, duration?: number) => void,
) {
  const settings = useAgentStore((s) => s.settings);
  const setSettings = useAgentStore((s) => s.setSettings);

  const [formProvider, setFormProvider] = useState(settings.activeProvider);
  const [formApiKey, setFormApiKey] = useState(settings.apiKey);
  const [formBaseUrl, setFormBaseUrl] = useState(settings.baseUrl);
  const [formModel, setFormModel] = useState(settings.model);
  const [formHidePet, setFormHidePet] = useState(settings.hidePet);
  const [formTimeout, setFormTimeout] = useState(settings.timeout || 120);
  const [formWindowOpacity, setFormWindowOpacity] = useState(settings.windowOpacity ?? 0.72);
  const [formPetSize, setFormPetSize] = useState(settings.petSize ?? 58);
  const [showKey, setShowKey] = useState(false);
  const [fetchedModels, setFetchedModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    if (showSettings) {
      setFormProvider(settings.activeProvider);
      setFormApiKey(settings.apiKey);
      setFormBaseUrl(settings.baseUrl);
      setFormModel(settings.model);
      setFormHidePet(settings.hidePet);
      setFormTimeout(settings.timeout || 120);
      setFormWindowOpacity(settings.windowOpacity ?? 0.72);
      setFormPetSize(settings.petSize ?? 58);
    }
  }, [showSettings, settings]);

  useEffect(() => {
    if (formProvider === "mock" || formProvider === "pinstripes") {
      setFetchedModels([]);
      return;
    }
    if (!formApiKey) {
      setFetchedModels([]);
      return;
    }

    let active = true;
    async function fetchModels() {
      setLoadingModels(true);
      try {
        const api = await getAgent();
        const models = await api.fetchModels(formProvider, formApiKey, formBaseUrl);
        if (active) {
          setFetchedModels(models);
          if (!models.includes(formModel) && models.length > 0) {
            setFormModel(models[0] || "");
          }
        }
      } catch (err) {
        console.error("Failed to fetch models dynamically:", err);
      } finally {
        if (active) setLoadingModels(false);
      }
    }

    const timer = setTimeout(fetchModels, 500);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [formProvider, formApiKey, formBaseUrl, formModel]);

  const handleSaveSettings = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setSavingSettings(true);
      try {
        const api = await getAgent();
        const newSettings = {
          ...settings,
          activeProvider: formProvider,
          apiKey: formApiKey,
          baseUrl: formBaseUrl,
          model: formProvider === "pinstripes" ? formModel || "ps/warp" : formModel,
          hidePet: formHidePet,
          timeout: Number(formTimeout),
          windowOpacity: Number(formWindowOpacity),
          petSize: Number(formPetSize),
        };
        await api.saveSettings(newSettings);
        setSettings(newSettings);
        onToastSuccess?.("Configurações salvas");
        return true;
      } catch (err) {
        console.error("Failed to save settings:", err);
        onToastError?.("Erro ao salvar configurações");
        return false;
      } finally {
        setSavingSettings(false);
      }
    },
    [
      settings,
      formProvider,
      formApiKey,
      formBaseUrl,
      formModel,
      formHidePet,
      formTimeout,
      formWindowOpacity,
      formPetSize,
      setSettings,
      onToastSuccess,
      onToastError,
    ],
  );

  return {
    formProvider,
    setFormProvider,
    formApiKey,
    setFormApiKey,
    formBaseUrl,
    setFormBaseUrl,
    formModel,
    setFormModel,
    formHidePet,
    setFormHidePet,
    formTimeout,
    setFormTimeout,
    formWindowOpacity,
    setFormWindowOpacity,
    formPetSize,
    setFormPetSize,
    showKey,
    setShowKey,
    fetchedModels,
    loadingModels,
    savingSettings,
    handleSaveSettings,
  };
}
