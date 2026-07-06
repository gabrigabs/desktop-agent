import { Clock, Database, Eye, EyeOff, KeyRound, Layers, Link, Settings, X } from "lucide-react";
import { GLOBAL_SHORTCUT_LABEL, PINSTRIPES_MODELS } from "./constants";

type Props = {
  onClose: () => void;
  formProvider: string;
  formApiKey: string;
  formBaseUrl: string;
  formModel: string;
  formHidePet: boolean;
  formTimeout: number;
  showKey: boolean;
  fetchedModels: string[];
  loadingModels: boolean;
  savingSettings: boolean;
  setFormProvider: (v: string) => void;
  setFormApiKey: (v: string) => void;
  setFormBaseUrl: (v: string) => void;
  setFormModel: (v: string) => void;
  setFormHidePet: (v: boolean) => void;
  setFormTimeout: (v: number) => void;
  setShowKey: (v: boolean) => void;
  handleSaveSettings: (e: React.FormEvent) => Promise<boolean | undefined>;
};

export function SettingsPanel(p: Props) {
  return (
    <div className="absolute inset-0 bg-ink/95 backdrop-blur-lg z-30 flex flex-col p-4 select-none border border-line rounded-2xl">
      <div className="flex items-center justify-between border-b border-line pb-3 mb-3">
        <span className="text-xs font-bold text-fg flex items-center gap-2">
          <Settings className="w-4 h-4 text-signal" />
          Configurações
        </span>
        <button
          type="button"
          onClick={p.onClose}
          className="p-1.5 rounded-md text-mute hover:text-fg hover:bg-white/5 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void p.handleSaveSettings(e).then((ok) => {
            if (ok) p.onClose();
          });
        }}
        className="flex-1 flex flex-col gap-4 overflow-y-auto pr-1"
      >
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] text-mute uppercase font-bold flex items-center gap-1">
            <Layers className="w-3.5 h-3.5" /> Provedor
          </span>
          <select
            value={p.formProvider}
            onChange={(e) => {
              const next = e.target.value;
              p.setFormProvider(next);
              if (next === "mock") p.setFormModel("mock-model");
              else if (next === "pinstripes") {
                const has = PINSTRIPES_MODELS.some((m) => m.id === p.formModel);
                p.setFormModel(has ? p.formModel : "ps/warp");
              }
            }}
            className="w-full bg-ink border border-line rounded-lg px-3 py-2 text-xs text-fg outline-none cursor-pointer hover:border-line-strong"
          >
            <option value="pinstripes">Pinstripes API</option>
            <option value="mock">Mock local</option>
            <option value="openai">OpenAI Compatible</option>
            <option value="gemini">Gemini Compatible (Google API)</option>
          </select>
        </div>

        {p.formProvider !== "mock" && (
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] text-mute uppercase font-bold flex items-center gap-1">
              <KeyRound className="w-3.5 h-3.5" /> Chave API
            </span>
            <div className="relative">
              <input
                type={p.showKey ? "text" : "password"}
                value={p.formApiKey}
                onChange={(e) => p.setFormApiKey(e.target.value)}
                placeholder="Insira ou cole sua chave de API secreta"
                className="w-full bg-ink border border-line rounded-lg pl-3 pr-9 py-2 text-xs text-fg outline-none select-text"
                required
              />
              <button
                type="button"
                onClick={() => p.setShowKey(!p.showKey)}
                className="absolute right-3 top-2.5 text-mute hover:text-fg cursor-pointer"
              >
                {p.showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}

        {(p.formProvider === "openai" || p.formProvider === "gemini") && (
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] text-mute uppercase font-bold flex items-center gap-1">
              <Link className="w-3.5 h-3.5" /> URL Base
            </span>
            <input
              type="text"
              value={p.formBaseUrl}
              onChange={(e) => p.setFormBaseUrl(e.target.value)}
              placeholder={
                p.formProvider === "openai"
                  ? "https://api.openai.com/v1"
                  : "https://generativetooling.googleapis.com/v1"
              }
              className="w-full bg-ink border border-line rounded-lg px-3 py-2 text-xs text-fg outline-none select-text"
            />
          </div>
        )}

        {p.formProvider !== "mock" && p.formProvider !== "pinstripes" && (
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] text-mute uppercase font-bold flex justify-between items-center">
              <span className="flex items-center gap-1">
                <Database className="w-3.5 h-3.5" /> Modelo
              </span>
              {p.loadingModels && <span className="text-[8px] text-signal animate-pulse">conectando...</span>}
            </span>
            {p.fetchedModels.length > 0 ? (
              <select
                value={p.formModel}
                onChange={(e) => p.setFormModel(e.target.value)}
                className="w-full bg-ink border border-line rounded-lg px-3 py-2 text-xs text-fg outline-none cursor-pointer hover:border-line-strong"
              >
                {p.fetchedModels.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={p.formModel}
                onChange={(e) => p.setFormModel(e.target.value)}
                placeholder="gpt-4o-mini ou modelo customizado..."
                className="w-full bg-ink border border-line rounded-lg px-3 py-2 text-xs text-fg outline-none select-text"
                required
              />
            )}
          </div>
        )}

        {p.formProvider === "pinstripes" && (
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] text-mute uppercase font-bold flex items-center gap-1">
              <Database className="w-3.5 h-3.5" /> Modelo Pinstripes
            </span>
            <select
              value={p.formModel || "ps/warp"}
              onChange={(e) => p.setFormModel(e.target.value)}
              className="w-full bg-ink border border-line rounded-lg px-3 py-2 text-xs text-fg outline-none cursor-pointer hover:border-line-strong"
            >
              {PINSTRIPES_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} — {m.description}
                </option>
              ))}
            </select>
            <span className="text-[9px] text-faint leading-normal">
              Warp para velocidade, Thinking para raciocínio e Pro para respostas mais deliberadas.
            </span>
          </div>
        )}

        {p.formProvider === "mock" && (
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] text-mute uppercase font-bold flex items-center gap-1">
              <Database className="w-3.5 h-3.5" /> Modelo Ativo
            </span>
            <div className="bg-ink border border-line rounded-lg px-3 py-2 text-xs text-faint font-mono select-none">
              mock-model
            </div>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] text-mute uppercase font-bold flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" /> Timeout (segundos)
          </span>
          <input
            type="number"
            value={p.formTimeout}
            onChange={(e) => p.setFormTimeout(Number(e.target.value))}
            min={5}
            max={600}
            placeholder="120"
            className="w-full bg-ink border border-line rounded-lg px-3 py-2 text-xs text-fg outline-none select-text"
            required
          />
        </div>

        <div className="flex items-start gap-3 bg-white/[0.03] border border-line rounded-lg p-3">
          <input
            type="checkbox"
            id="hidePet"
            checked={p.formHidePet}
            onChange={(e) => p.setFormHidePet(e.target.checked)}
            className="w-4 h-4 bg-ink border-line rounded focus:ring-0 mt-0.5 cursor-pointer accent-[var(--color-signal)]"
          />
          <label
            htmlFor="hidePet"
            className="text-[11px] text-mute font-bold cursor-pointer flex flex-col gap-0.5 leading-tight select-none"
          >
            <span>Ocultar Pet Flutuante</span>
            <span className="text-[9px] text-faint font-normal leading-normal">
              O Pet desaparece da tela e o app roda em segundo plano. Reabre com{" "}
              <kbd className="px-1 py-0.2 bg-ink text-[8px] rounded border border-line text-mute font-mono">
                {GLOBAL_SHORTCUT_LABEL}
              </kbd>{" "}
              ou pelo ícone do menu bar.
            </span>
          </label>
        </div>

        <div className="mt-auto pt-4 flex gap-2">
          <button
            type="button"
            onClick={p.onClose}
            className="flex-1 px-3 py-2.5 rounded-lg border border-line text-xs text-mute hover:text-fg hover:bg-white/5 transition-colors cursor-pointer font-bold"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={p.savingSettings}
            className="flex-1 px-3 py-2.5 rounded-lg bg-signal hover:brightness-110 text-ink text-xs transition-colors cursor-pointer font-bold disabled:opacity-50"
          >
            {p.savingSettings ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </form>
    </div>
  );
}
