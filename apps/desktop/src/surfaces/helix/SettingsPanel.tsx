import {
  Clock,
  Database,
  Eye,
  EyeOff,
  KeyRound,
  Layers,
  Link,
  Monitor,
  Settings,
  Sparkles,
  X,
} from "lucide-react";
import { GLOBAL_SHORTCUT_LABEL, PINSTRIPES_MODELS } from "./constants";

type Props = {
  variant?: "normal" | "expanded";
  onClose: () => void;
  formProvider: string;
  formApiKey: string;
  formBaseUrl: string;
  formModel: string;
  formHidePet: boolean;
  formTimeout: number;
  formWindowOpacity: number;
  formPetSize: number;
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
  setFormWindowOpacity: (v: number) => void;
  setFormPetSize: (v: number) => void;
  setShowKey: (v: boolean) => void;
  handleSaveSettings: (e: React.FormEvent) => Promise<boolean | undefined>;
};

export function SettingsPanel(p: Props) {
  if (p.variant === "expanded") {
    return <ExpandedSettingsPanel {...p} />;
  }

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

        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] text-mute uppercase font-bold flex items-center gap-1">
            <Monitor className="w-3.5 h-3.5" /> Opacidade da janela
          </span>
          <input
            type="range"
            min={0.4}
            max={1}
            step={0.01}
            value={p.formWindowOpacity}
            onChange={(e) => p.setFormWindowOpacity(Number(e.target.value))}
            className="w-full accent-[var(--color-signal)] cursor-pointer"
            aria-label="Opacidade da janela"
          />
          <span className="text-[9px] text-faint">{Math.round(p.formWindowOpacity * 100)}% opaco</span>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] text-mute uppercase font-bold flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5" /> Tamanho do pet
          </span>
          <input
            type="range"
            min={48}
            max={90}
            step={1}
            value={p.formPetSize}
            onChange={(e) => p.setFormPetSize(Number(e.target.value))}
            className="w-full accent-[var(--color-signal)] cursor-pointer"
            aria-label="Tamanho do pet"
          />
          <span className="text-[9px] text-faint">{p.formPetSize}px</span>
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

function ExpandedSettingsPanel(p: Props) {
  const submitSettings = (e: React.FormEvent) => {
    e.preventDefault();
    void p.handleSaveSettings(e).then((ok) => {
      if (ok) p.onClose();
    });
  };

  const handleProviderChange = (next: string) => {
    p.setFormProvider(next);
    if (next === "mock") p.setFormModel("mock-model");
    else if (next === "pinstripes") {
      const has = PINSTRIPES_MODELS.some((m) => m.id === p.formModel);
      p.setFormModel(has ? p.formModel : "ps/warp");
    }
  };

  const modelLabel =
    p.formProvider === "mock"
      ? "mock-model"
      : p.formProvider === "pinstripes"
        ? (PINSTRIPES_MODELS.find((m) => m.id === p.formModel)?.name ?? "Warp")
        : p.formModel || "Modelo customizado";

  return (
    <div className="absolute inset-0 bg-ink/96 backdrop-blur-xl z-30 select-none">
      <form onSubmit={submitSettings} className="grid h-full grid-cols-[240px_minmax(0,1fr)]">
        <aside className="min-w-0 border-r border-line bg-white/[0.015] p-5 flex flex-col gap-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[9px] font-mono uppercase text-faint tracking-wider">Helix</div>
              <div className="mt-1 text-sm font-bold text-fg">Configurações</div>
            </div>
            <button
              type="button"
              onClick={p.onClose}
              className="p-1.5 rounded-md text-mute hover:text-fg hover:bg-white/5 transition-colors cursor-pointer"
              title="Fechar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <section className="rounded-xl border border-line bg-white/[0.025] p-3.5">
            <div className="text-[9px] font-mono uppercase text-faint mb-3">Sessão atual</div>
            <div className="grid gap-3">
              <div>
                <div className="text-[9px] text-faint uppercase font-bold">Provedor</div>
                <div className="mt-1 text-xs font-semibold text-fg truncate">{p.formProvider}</div>
              </div>
              <div>
                <div className="text-[9px] text-faint uppercase font-bold">Modelo</div>
                <div className="mt-1 text-xs font-semibold text-fg truncate">{modelLabel}</div>
              </div>
              <div>
                <div className="text-[9px] text-faint uppercase font-bold">Timeout</div>
                <div className="mt-1 text-xs font-semibold text-fg">{p.formTimeout}s</div>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-line bg-white/[0.02] p-3.5">
            <div className="text-[9px] font-mono uppercase text-faint mb-2">Acesso rápido</div>
            <div className="rounded-lg border border-line bg-ink/60 px-3 py-2 text-[11px] text-mute">
              Reabre com{" "}
              <kbd className="px-1.5 py-0.5 rounded border border-line text-[9px] font-mono text-fg">
                {GLOBAL_SHORTCUT_LABEL}
              </kbd>
            </div>
          </section>

          <div className="mt-auto rounded-xl border border-line bg-white/[0.018] p-3 text-[10px] leading-relaxed text-faint">
            As alterações ficam locais neste app e passam a valer na próxima execução do agente.
          </div>
        </aside>

        <main className="min-w-0 flex flex-col">
          <header className="h-16 border-b border-line px-6 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="text-[9px] font-mono uppercase text-faint tracking-wider">
                Preferências do agente
              </div>
              <div className="text-base font-bold text-fg truncate">Modelo, acesso e comportamento</div>
            </div>
            <button
              type="button"
              onClick={p.onClose}
              className="h-8 px-3 rounded-md border border-line text-[10px] font-semibold text-mute hover:text-fg hover:border-line-strong transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <X className="w-3.5 h-3.5" /> Fechar
            </button>
          </header>

          <div className="flex-1 overflow-y-auto p-6">
            <div className="grid grid-cols-[minmax(0,1fr)_320px] gap-5 items-start">
              <section className="rounded-2xl border border-line bg-white/[0.025] p-5">
                <div className="flex items-start gap-3 mb-5">
                  <div className="w-9 h-9 rounded-xl bg-signal/12 border border-signal/20 flex items-center justify-center text-signal">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-fg">Modelo e provedor</div>
                    <div className="text-[11px] text-mute mt-1">
                      Defina de onde o Helix responde e qual modelo deve ser usado.
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[10px] text-mute uppercase font-bold flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5" /> Provedor
                    </span>
                    <select
                      value={p.formProvider}
                      onChange={(e) => handleProviderChange(e.target.value)}
                      className="w-full bg-ink border border-line rounded-lg px-3 py-2.5 text-xs text-fg outline-none cursor-pointer hover:border-line-strong"
                    >
                      <option value="pinstripes">Pinstripes API</option>
                      <option value="mock">Mock local</option>
                      <option value="openai">OpenAI Compatible</option>
                      <option value="gemini">Gemini Compatible (Google API)</option>
                    </select>
                  </label>

                  {p.formProvider === "pinstripes" && (
                    <label className="flex flex-col gap-1.5">
                      <span className="text-[10px] text-mute uppercase font-bold flex items-center gap-1">
                        <Database className="w-3.5 h-3.5" /> Modelo Pinstripes
                      </span>
                      <select
                        value={p.formModel || "ps/warp"}
                        onChange={(e) => p.setFormModel(e.target.value)}
                        className="w-full bg-ink border border-line rounded-lg px-3 py-2.5 text-xs text-fg outline-none cursor-pointer hover:border-line-strong"
                      >
                        {PINSTRIPES_MODELS.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} — {m.description}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}

                  {p.formProvider === "mock" && (
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[10px] text-mute uppercase font-bold flex items-center gap-1">
                        <Database className="w-3.5 h-3.5" /> Modelo ativo
                      </span>
                      <div className="bg-ink border border-line rounded-lg px-3 py-2.5 text-xs text-faint font-mono select-none">
                        mock-model
                      </div>
                    </div>
                  )}

                  {p.formProvider !== "mock" && p.formProvider !== "pinstripes" && (
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[10px] text-mute uppercase font-bold flex justify-between items-center">
                        <span className="flex items-center gap-1">
                          <Database className="w-3.5 h-3.5" /> Modelo
                        </span>
                        {p.loadingModels && (
                          <span className="text-[8px] text-signal animate-pulse">conectando...</span>
                        )}
                      </span>
                      {p.fetchedModels.length > 0 ? (
                        <select
                          aria-label="Modelo"
                          value={p.formModel}
                          onChange={(e) => p.setFormModel(e.target.value)}
                          className="w-full bg-ink border border-line rounded-lg px-3 py-2.5 text-xs text-fg outline-none cursor-pointer hover:border-line-strong"
                        >
                          {p.fetchedModels.map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          aria-label="Modelo"
                          type="text"
                          value={p.formModel}
                          onChange={(e) => p.setFormModel(e.target.value)}
                          placeholder="gpt-4o-mini ou modelo customizado..."
                          className="w-full bg-ink border border-line rounded-lg px-3 py-2.5 text-xs text-fg outline-none select-text"
                          required
                        />
                      )}
                    </div>
                  )}

                  {p.formProvider !== "mock" && (
                    <label className="col-span-2 flex flex-col gap-1.5">
                      <span className="text-[10px] text-mute uppercase font-bold flex items-center gap-1">
                        <KeyRound className="w-3.5 h-3.5" /> Chave API
                      </span>
                      <div className="relative">
                        <input
                          type={p.showKey ? "text" : "password"}
                          value={p.formApiKey}
                          onChange={(e) => p.setFormApiKey(e.target.value)}
                          placeholder="Insira ou cole sua chave de API secreta"
                          className="w-full bg-ink border border-line rounded-lg pl-3 pr-10 py-2.5 text-xs text-fg outline-none select-text"
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
                    </label>
                  )}

                  {(p.formProvider === "openai" || p.formProvider === "gemini") && (
                    <label className="col-span-2 flex flex-col gap-1.5">
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
                        className="w-full bg-ink border border-line rounded-lg px-3 py-2.5 text-xs text-fg outline-none select-text"
                      />
                    </label>
                  )}
                </div>
              </section>

              <div className="grid gap-5">
                <section className="rounded-2xl border border-line bg-white/[0.025] p-5">
                  <div className="flex items-start gap-3 mb-5">
                    <div className="w-9 h-9 rounded-xl bg-good/10 border border-good/20 flex items-center justify-center text-good">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-fg">Comportamento</div>
                      <div className="text-[11px] text-mute mt-1">Janela, espera e presença na tela.</div>
                    </div>
                  </div>

                  <label className="flex flex-col gap-1.5">
                    <span className="text-[10px] text-mute uppercase font-bold flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" /> Timeout
                    </span>
                    <input
                      type="number"
                      value={p.formTimeout}
                      onChange={(e) => p.setFormTimeout(Number(e.target.value))}
                      min={5}
                      max={600}
                      placeholder="120"
                      className="w-full bg-ink border border-line rounded-lg px-3 py-2.5 text-xs text-fg outline-none select-text"
                      required
                    />
                    <span className="text-[9px] text-faint">Entre 5 e 600 segundos.</span>
                  </label>

                  <label className="mt-4 flex flex-col gap-1.5">
                    <span className="text-[10px] text-mute uppercase font-bold flex items-center gap-1">
                      <Monitor className="w-3.5 h-3.5" /> Opacidade da janela
                    </span>
                    <input
                      type="range"
                      min={0.4}
                      max={1}
                      step={0.01}
                      value={p.formWindowOpacity}
                      onChange={(e) => p.setFormWindowOpacity(Number(e.target.value))}
                      className="w-full accent-[var(--color-signal)] cursor-pointer"
                      aria-label="Opacidade da janela"
                    />
                    <span className="text-[9px] text-faint">
                      {Math.round(p.formWindowOpacity * 100)}% opaco
                    </span>
                  </label>

                  <label className="mt-4 flex flex-col gap-1.5">
                    <span className="text-[10px] text-mute uppercase font-bold flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5" /> Tamanho do pet
                    </span>
                    <input
                      type="range"
                      min={48}
                      max={90}
                      step={1}
                      value={p.formPetSize}
                      onChange={(e) => p.setFormPetSize(Number(e.target.value))}
                      className="w-full accent-[var(--color-signal)] cursor-pointer"
                      aria-label="Tamanho do pet"
                    />
                    <span className="text-[9px] text-faint">{p.formPetSize}px — afeta o modo colapsado</span>
                  </label>

                  <label
                    htmlFor="hidePetExpanded"
                    className="mt-4 flex items-start gap-3 bg-white/[0.03] border border-line rounded-xl p-3 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      id="hidePetExpanded"
                      checked={p.formHidePet}
                      onChange={(e) => p.setFormHidePet(e.target.checked)}
                      className="w-4 h-4 bg-ink border-line rounded focus:ring-0 mt-0.5 cursor-pointer accent-[var(--color-signal)]"
                    />
                    <span className="text-[11px] text-mute font-bold flex flex-col gap-0.5 leading-tight select-none">
                      <span>Ocultar Pet flutuante</span>
                      <span className="text-[9px] text-faint font-normal leading-normal">
                        Mantém o app em segundo plano e reabre pelo atalho ou menu bar.
                      </span>
                    </span>
                  </label>
                </section>

                {p.formProvider === "pinstripes" && (
                  <section className="rounded-2xl border border-line bg-white/[0.02] p-5">
                    <div className="text-[10px] text-mute uppercase font-bold mb-2">Modelos Pinstripes</div>
                    <div className="grid gap-2">
                      {PINSTRIPES_MODELS.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => p.setFormModel(m.id)}
                          className={`rounded-xl border px-3 py-2.5 text-left transition-colors cursor-pointer ${p.formModel === m.id ? "border-signal/35 bg-signal/12 text-fg" : "border-line text-mute hover:text-fg hover:bg-white/[0.03]"}`}
                        >
                          <span className="block text-xs font-semibold">{m.name}</span>
                          <span className="block text-[9px] text-faint mt-0.5">{m.description}</span>
                        </button>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            </div>
          </div>

          <footer className="h-16 border-t border-line bg-white/[0.012] px-6 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={p.onClose}
              className="h-9 px-4 rounded-lg border border-line text-[11px] font-semibold text-mute hover:text-fg hover:bg-white/5 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={p.savingSettings}
              className="h-9 px-4 rounded-lg bg-signal hover:brightness-110 text-ink text-[11px] transition-colors cursor-pointer font-bold disabled:opacity-50"
            >
              {p.savingSettings ? "Salvando..." : "Salvar configurações"}
            </button>
          </footer>
        </main>
      </form>
    </div>
  );
}
