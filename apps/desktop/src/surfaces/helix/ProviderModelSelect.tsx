import { useEffect, useState } from "react";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { getAgent } from "../../lib/rpc";
import { useAgentStore } from "../../stores/agent";
import { PINSTRIPES_MODELS, SELECT_CLASS } from "./constants";

const PROVIDERS = [
  { value: "", label: "Padrão do app" },
  { value: "pinstripes", label: "Pinstripes API" },
  { value: "mock", label: "Mock local" },
  { value: "openai", label: "OpenAI Compatible" },
  { value: "gemini", label: "Gemini Compatible" },
] as const;

type Props = {
  provider: string;
  model: string;
  onProviderChange: (provider: string) => void;
  onModelChange: (model: string) => void;
  providerId?: string;
  modelId?: string;
};

export function ProviderModelSelect(p: Props) {
  const settings = useAgentStore((s) => s.settings);
  const [fetchedModels, setFetchedModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);

  const providerId = p.providerId ?? "pm-provider";
  const modelId = p.modelId ?? "pm-model";

  useEffect(() => {
    if (!p.provider || p.provider === "mock" || p.provider === "pinstripes") {
      setFetchedModels([]);
      return;
    }
    const apiKey = settings.apiKey;
    if (!apiKey) {
      setFetchedModels([]);
      return;
    }

    let active = true;
    async function fetch() {
      setLoadingModels(true);
      try {
        const api = await getAgent();
        const models = await api.fetchModels(p.provider, apiKey, settings.baseUrl);
        if (active) setFetchedModels(models);
      } catch {
        if (active) setFetchedModels([]);
      } finally {
        if (active) setLoadingModels(false);
      }
    }

    const timer = setTimeout(fetch, 400);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [p.provider, settings.apiKey, settings.baseUrl]);

  function handleProviderChange(next: string) {
    p.onProviderChange(next);
    if (next === "") {
      p.onModelChange("");
    } else if (next === "mock") {
      p.onModelChange("mock-model");
    } else if (next === "pinstripes") {
      p.onModelChange("ps/warp");
    } else {
      p.onModelChange("");
    }
  }

  const showPinstripesModels = p.provider === "pinstripes";
  const showFetchedModels = (p.provider === "openai" || p.provider === "gemini") && fetchedModels.length > 0;
  const showModelText = (p.provider === "openai" || p.provider === "gemini") && fetchedModels.length === 0;
  const showModelHint = !p.provider || p.provider === "mock";

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-1">
        <Label htmlFor={providerId}>Provedor</Label>
        <select
          id={providerId}
          className={SELECT_CLASS}
          value={p.provider}
          onChange={(e) => handleProviderChange(e.target.value)}
        >
          {PROVIDERS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <Label htmlFor={modelId} className="flex items-center justify-between">
          <span>Modelo</span>
          {loadingModels && (
            <span className="text-[9px] text-signal animate-pulse normal-case">carregando...</span>
          )}
        </Label>

        {showPinstripesModels ? (
          <select
            id={modelId}
            className={SELECT_CLASS}
            value={p.model || "ps/warp"}
            onChange={(e) => p.onModelChange(e.target.value)}
          >
            {PINSTRIPES_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} — {m.description}
              </option>
            ))}
          </select>
        ) : showFetchedModels ? (
          <select
            id={modelId}
            className={SELECT_CLASS}
            value={p.model}
            onChange={(e) => p.onModelChange(e.target.value)}
          >
            {fetchedModels.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        ) : showModelText ? (
          <Input
            id={modelId}
            value={p.model}
            onChange={(e) => p.onModelChange(e.target.value)}
            placeholder="gpt-4o-mini ou modelo customizado..."
          />
        ) : showModelHint ? (
          <div className="h-9 flex items-center px-2 rounded-md border border-line/40 bg-white/[0.01] text-[11px] text-faint">
            {p.provider === "mock" ? "mock-model" : "Herdado do app"}
          </div>
        ) : (
          <Input
            id={modelId}
            value={p.model}
            onChange={(e) => p.onModelChange(e.target.value)}
            placeholder="gpt-4o-mini ou modelo customizado..."
          />
        )}
      </div>
    </div>
  );
}
