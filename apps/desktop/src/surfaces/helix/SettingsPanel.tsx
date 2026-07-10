import { type AppSettings, HELIX_ARTIFACTS } from "@desktop-agent/shared";
import {
  AppWindow,
  Bot,
  ChevronDown,
  Clock,
  Database,
  Eye,
  EyeOff,
  FileClock,
  History,
  Keyboard,
  KeyRound,
  Layers,
  Link,
  Monitor,
  Orbit,
  Plug,
  Settings,
  ShieldCheck,
  Sparkles,
  Terminal,
  Workflow,
  X,
} from "lucide-react";
import { useEffect, useId, useState } from "react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { IconButton } from "../../components/ui/icon-button";
import { Input } from "../../components/ui/input";
import { GLOBAL_SHORTCUT_LABEL, PINSTRIPES_MODELS } from "./constants";

type SettingsSection =
  | "general"
  | "model"
  | "pet"
  | "shortcuts"
  | "privacy"
  | "connectors"
  | "artifacts"
  | "workflows"
  | "data"
  | "advanced";

export type SettingsPanelProps = {
  variant?: "normal" | "expanded";
  onClose: () => void;
  settings: AppSettings;
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

const GENERAL_SECTION = {
  id: "general",
  label: "Geral",
  description: "Inicialização e modo padrão",
  icon: Settings,
} as const;

const SECTIONS: {
  id: SettingsSection;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  GENERAL_SECTION,
  { id: "model", label: "Modelo e API", description: "Provider, chave e estratégia", icon: Bot },
  { id: "pet", label: "Pet e janela", description: "Presença e aparência", icon: Sparkles },
  { id: "shortcuts", label: "Atalhos", description: "Acesso rápido pelo teclado", icon: Keyboard },
  {
    id: "privacy",
    label: "Contexto e privacidade",
    description: "O que o Helix pode ver",
    icon: ShieldCheck,
  },
  { id: "connectors", label: "Conectores", description: "Serviços e permissões", icon: Plug },
  { id: "artifacts", label: "Artefatos", description: "Assistentes especializados", icon: Orbit },
  { id: "workflows", label: "Workflows", description: "Sequências e automações", icon: Workflow },
  { id: "data", label: "Dados e histórico", description: "Retenção e exportação", icon: History },
  { id: "advanced", label: "Avançado", description: "Runtime e diagnóstico", icon: Terminal },
];

function useDirtyCheck(p: SettingsPanelProps) {
  return (
    p.formProvider !== p.settings.activeProvider ||
    p.formApiKey !== p.settings.apiKey ||
    p.formBaseUrl !== p.settings.baseUrl ||
    p.formModel !== p.settings.model ||
    p.formHidePet !== p.settings.hidePet ||
    p.formTimeout !== p.settings.timeout ||
    Math.abs(p.formWindowOpacity - p.settings.windowOpacity) > 0.005 ||
    p.formPetSize !== p.settings.petSize
  );
}

function useInlineSaveFeedback(savingSettings: boolean) {
  const [justSaved, setJustSaved] = useState(false);
  useEffect(() => {
    if (!savingSettings && justSaved) {
      const timer = setTimeout(() => setJustSaved(false), 2000);
      return () => clearTimeout(timer);
    }
    if (savingSettings) setJustSaved(true);
  }, [savingSettings, justSaved]);
  return justSaved;
}

function opacityLabel(value: number) {
  const percentage = Math.round(value * 100);
  if (percentage <= 50) return `${percentage}% — muito translúcido`;
  if (percentage <= 80) return `${percentage}% — translúcido`;
  if (percentage < 100) return `${percentage}% — levemente translúcido`;
  return `${percentage}% — sólido`;
}

function petSizeLabel(value: number) {
  if (value <= 54) return `${value}px — compacto`;
  if (value <= 72) return `${value}px — padrão`;
  return `${value}px — grande`;
}

export function SettingsPanel(p: SettingsPanelProps) {
  const [activeSection, setActiveSection] = useState<SettingsSection>("general");
  const isDirty = useDirtyCheck(p);
  const justSaved = useInlineSaveFeedback(p.savingSettings);
  const needsApiKey = p.formProvider !== "mock" && !p.formApiKey.trim();
  const timeoutOutOfRange = p.formTimeout < 5 || p.formTimeout > 600;
  const currentSection = SECTIONS.find((section) => section.id === activeSection) ?? GENERAL_SECTION;

  const submitSettings = (event: React.FormEvent) => {
    event.preventDefault();
    void p.handleSaveSettings(event).then((ok) => {
      if (ok) p.onClose();
    });
  };

  const handleProviderChange = (next: string) => {
    p.setFormProvider(next);
    if (next === "mock") p.setFormModel("mock-model");
    else if (next === "pinstripes") {
      const currentModelIsValid = PINSTRIPES_MODELS.some((model) => model.id === p.formModel);
      p.setFormModel(currentModelIsValid ? p.formModel : "ps/warp");
    }
  };

  const compact = p.variant !== "expanded";

  return (
    <div className="absolute inset-0 z-30 flex select-none bg-ink/96 backdrop-blur-xl">
      <form
        onSubmit={submitSettings}
        className={`grid h-full w-full ${compact ? "grid-rows-[auto_minmax(0,1fr)_auto]" : "grid-cols-[224px_minmax(0,1fr)]"}`}
      >
        <aside
          className={`min-w-0 border-line bg-white/[0.015] ${
            compact ? "border-b px-4 py-3" : "row-span-2 border-r p-4"
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-bold text-fg flex items-center gap-2">
                Configurações
                {isDirty && !p.savingSettings && (
                  <span className="w-1.5 h-1.5 rounded-full bg-warn" title="Alterações não salvas" />
                )}
              </div>
              {!compact && <div className="mt-1 text-xs text-faint">Centro de controle do Helix</div>}
            </div>
            <IconButton title="Fechar configurações" onClick={p.onClose}>
              <X className="w-4 h-4" />
            </IconButton>
          </div>

          {compact ? (
            <label className="relative mt-3 block">
              <span className="sr-only">Seção de configurações</span>
              <select
                value={activeSection}
                onChange={(event) => setActiveSection(event.target.value as SettingsSection)}
                className="h-10 w-full appearance-none rounded-lg border border-line bg-ink px-3 pr-9 text-xs text-fg"
              >
                {SECTIONS.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-3 w-4 h-4 text-faint" />
            </label>
          ) : (
            <nav className="mt-5 grid gap-1" aria-label="Seções de configurações">
              {SECTIONS.map((section) => {
                const Icon = section.icon;
                const active = section.id === activeSection;
                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => setActiveSection(section.id)}
                    className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                      active
                        ? "border-signal/25 bg-signal/10 text-fg"
                        : "border-transparent text-mute hover:bg-white/[0.035] hover:text-fg"
                    }`}
                  >
                    <span className="flex items-center gap-2 text-xs font-semibold">
                      <Icon className={`w-3.5 h-3.5 ${active ? "text-signal" : "text-faint"}`} />
                      {section.label}
                    </span>
                    <span className="mt-0.5 block pl-5.5 text-[9px] leading-relaxed text-faint">
                      {section.description}
                    </span>
                  </button>
                );
              })}
            </nav>
          )}

          {!compact && (
            <div className="mt-4 rounded-xl border border-line bg-white/[0.02] p-3 text-[10px] leading-relaxed text-faint">
              Mudanças ficam locais. Recursos marcados como planejados ainda não criam estado persistente.
            </div>
          )}
        </aside>

        <main className="min-w-0 min-h-0 flex flex-col overflow-hidden">
          <header className="border-b border-line px-5 py-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-fg">{currentSection.label}</h2>
              {p.savingSettings && <Badge variant="signal">Salvando</Badge>}
              {justSaved && !p.savingSettings && <Badge variant="success">Salvo</Badge>}
            </div>
            <p className="mt-1 text-xs text-faint">{currentSection.description}</p>
          </header>

          <div className="flex-1 overflow-y-auto p-5">
            <div className="mx-auto w-full max-w-4xl">
              {activeSection === "general" && <GeneralSection settings={p.settings} />}
              {activeSection === "model" && (
                <ModelSection p={p} needsApiKey={needsApiKey} onProviderChange={handleProviderChange} />
              )}
              {activeSection === "pet" && <PetSection p={p} />}
              {activeSection === "shortcuts" && <ShortcutsSection />}
              {activeSection === "privacy" && <PrivacySection />}
              {activeSection === "connectors" && <ConnectorsSection />}
              {activeSection === "artifacts" && <ArtifactsSection />}
              {activeSection === "workflows" && <WorkflowsSection />}
              {activeSection === "data" && <DataSection />}
              {activeSection === "advanced" && (
                <AdvancedSection p={p} timeoutOutOfRange={timeoutOutOfRange} />
              )}
            </div>
          </div>
        </main>

        <footer
          className={`border-line bg-white/[0.012] px-5 py-3 flex items-center justify-end gap-2 ${
            compact ? "border-t" : "border-t"
          }`}
        >
          <Button type="button" variant="secondary" onClick={p.onClose}>
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={p.savingSettings || needsApiKey || timeoutOutOfRange}
          >
            {p.savingSettings ? "Salvando..." : "Salvar configurações"}
          </Button>
        </footer>
      </form>
    </div>
  );
}

function SectionIntro({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-4">
      <h3 className="text-sm font-bold text-fg">{title}</h3>
      <p className="mt-1 text-xs leading-relaxed text-mute">{description}</p>
    </div>
  );
}

function StatusRow({
  title,
  description,
  status = "Planejado",
}: {
  title: string;
  description: string;
  status?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-line bg-white/[0.02] p-3.5">
      <div className="min-w-0">
        <div className="text-xs font-semibold text-fg">{title}</div>
        <div className="mt-1 text-[11px] leading-relaxed text-faint">{description}</div>
      </div>
      <Badge>{status}</Badge>
    </div>
  );
}

function GeneralSection({ settings }: { settings: AppSettings }) {
  const modeLabel = { collapsed: "Pet", normal: "Normal", expanded: "Expandido" }[settings.lastWindowMode];
  return (
    <div>
      <SectionIntro
        title="Comportamento geral"
        description="Resumo do modo atual e das preferências que já existem. Novos controles serão habilitados quando tiverem persistência ponta a ponta."
      />
      <div className="grid gap-3 md:grid-cols-2">
        <Card>
          <div className="flex items-center gap-2 text-xs font-semibold text-fg">
            <AppWindow className="w-4 h-4 text-signal" /> Modo restaurado
          </div>
          <div className="mt-3 text-lg font-bold text-fg">{modeLabel}</div>
          <p className="mt-1 text-[11px] text-faint">Último modo persistido pelo gerenciador de janela.</p>
        </Card>
        <Card>
          <div className="flex items-center gap-2 text-xs font-semibold text-fg">
            <Layers className="w-4 h-4 text-good" /> Idioma
          </div>
          <div className="mt-3 text-lg font-bold text-fg">Português (Brasil)</div>
          <p className="mt-1 text-[11px] text-faint">Idioma atual da interface.</p>
        </Card>
      </div>
      <div className="mt-4 grid gap-2">
        <StatusRow
          title="Abrir ao iniciar o sistema"
          description="Integração nativa de autostart ainda não implementada."
        />
        <StatusRow
          title="Reabrir última sessão"
          description="Exige contrato explícito entre janela, conversa e retenção."
        />
      </div>
    </div>
  );
}

function ModelSection({
  p,
  needsApiKey,
  onProviderChange,
}: {
  p: SettingsPanelProps;
  needsApiKey: boolean;
  onProviderChange: (provider: string) => void;
}) {
  const apiKeyId = useId();
  return (
    <div>
      <SectionIntro
        title="Modelo e acesso"
        description="Escolha o caminho de inferência. A chave permanece mascarada e opções técnicas ficam em Avançado."
      />
      <Card className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-mute">Provider</span>
          <select
            value={p.formProvider}
            onChange={(event) => onProviderChange(event.target.value)}
            className="h-10 rounded-lg border border-line bg-ink px-3 text-xs text-fg"
          >
            <option value="pinstripes">Pinstripes API</option>
            <option value="mock">Mock local</option>
            <option value="openai">OpenAI Compatible</option>
            <option value="gemini">Gemini Compatible (experimental)</option>
          </select>
        </label>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-mute">Modelo padrão</span>
          {p.formProvider === "pinstripes" ? (
            <select
              aria-label="Modelo padrão"
              value={p.formModel || "ps/warp"}
              onChange={(event) => p.setFormModel(event.target.value)}
              className="h-10 rounded-lg border border-line bg-ink px-3 text-xs text-fg"
            >
              {PINSTRIPES_MODELS.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name} — {model.description}
                </option>
              ))}
            </select>
          ) : p.formProvider === "mock" ? (
            <div className="h-10 rounded-lg border border-line bg-ink px-3 flex items-center text-xs font-mono text-faint">
              mock-model
            </div>
          ) : p.fetchedModels.length > 0 ? (
            <select
              aria-label="Modelo padrão"
              value={p.formModel}
              onChange={(event) => p.setFormModel(event.target.value)}
              className="h-10 rounded-lg border border-line bg-ink px-3 text-xs text-fg"
            >
              {p.fetchedModels.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </select>
          ) : (
            <Input
              aria-label="Modelo padrão"
              value={p.formModel}
              onChange={(event) => p.setFormModel(event.target.value)}
              placeholder={p.loadingModels ? "Buscando modelos..." : "Modelo customizado"}
              required
            />
          )}
        </div>

        {p.formProvider !== "mock" && (
          <label htmlFor={apiKeyId} className="md:col-span-2 flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-mute flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5" /> Chave API
            </span>
            <div className="relative">
              <Input
                id={apiKeyId}
                type={p.showKey ? "text" : "password"}
                value={p.formApiKey}
                onChange={(event) => p.setFormApiKey(event.target.value)}
                placeholder="Insira ou cole sua chave secreta"
                invalid={needsApiKey}
                required
              />
              <IconButton
                title={p.showKey ? "Ocultar chave" : "Mostrar chave"}
                onClick={() => p.setShowKey(!p.showKey)}
                className="absolute right-2 top-1.5"
              >
                {p.showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </IconButton>
            </div>
            {needsApiKey && <span className="text-[10px] text-bad">Necessária para este provider.</span>}
          </label>
        )}
      </Card>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {[
          ["Rápido", "Warp e respostas curtas"],
          ["Equilibrado", "Qualidade e latência"],
          ["Melhor resposta", "Raciocínio deliberado"],
        ].map(([title, description], index) => (
          <Card key={title} className={index === 0 ? "border-signal/25 bg-signal/[0.04]" : ""}>
            <div className="text-xs font-semibold text-fg">{title}</div>
            <div className="mt-1 text-[10px] text-faint">{description}</div>
            <Badge className="mt-3">Estratégia futura</Badge>
          </Card>
        ))}
      </div>
    </div>
  );
}

function PetSection({ p }: { p: SettingsPanelProps }) {
  return (
    <div>
      <SectionIntro
        title="Pet e comportamento da janela"
        description="Ajustes reais da presença flutuante. Os contratos de clique são exibidos abaixo para deixar o fluxo previsível."
      />
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <label className="flex flex-col gap-2 text-xs font-semibold text-fg">
            <span className="flex items-center gap-2">
              <Monitor className="w-4 h-4 text-signal" /> Opacidade da janela
            </span>
            <input
              type="range"
              min={0.4}
              max={1}
              step={0.01}
              value={p.formWindowOpacity}
              onChange={(event) => p.setFormWindowOpacity(Number(event.target.value))}
              className="w-full accent-[var(--color-signal)]"
            />
            <span className="text-[10px] font-normal text-faint">{opacityLabel(p.formWindowOpacity)}</span>
          </label>
        </Card>
        <Card>
          <label className="flex flex-col gap-2 text-xs font-semibold text-fg">
            <span className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-signal" /> Tamanho do pet
            </span>
            <input
              type="range"
              min={48}
              max={90}
              step={1}
              value={p.formPetSize}
              onChange={(event) => p.setFormPetSize(Number(event.target.value))}
              className="w-full accent-[var(--color-signal)]"
            />
            <span className="text-[10px] font-normal text-faint">{petSizeLabel(p.formPetSize)}</span>
          </label>
        </Card>
      </div>

      <label className="mt-4 flex items-start gap-3 rounded-xl border border-line bg-white/[0.025] p-4 cursor-pointer">
        <input
          type="checkbox"
          checked={p.formHidePet}
          onChange={(event) => p.setFormHidePet(event.target.checked)}
          className="mt-0.5 h-4 w-4 accent-[var(--color-signal)]"
        />
        <span>
          <span className="block text-xs font-semibold text-fg">Ocultar pet flutuante</span>
          <span className="mt-1 block text-[11px] leading-relaxed text-faint">
            O app continua em segundo plano e reabre com {GLOBAL_SHORTCUT_LABEL} ou menu bar.
          </span>
        </span>
      </label>

      <div className="mt-4 grid gap-2 md:grid-cols-2">
        <StatusRow
          title="Clique simples"
          description="Abre o radial com as seis intenções principais."
          status="Ativo"
        />
        <StatusRow title="Duplo clique" description="Abre o composer no modo normal." status="Ativo" />
        <StatusRow
          title="Arrastar"
          description="Reposiciona a janela do pet sem disparar uma ação."
          status="Ativo"
        />
        <StatusRow
          title="Inspector no expandido"
          description="Preferência persistida entra na próxima migration."
        />
      </div>
    </div>
  );
}

function ShortcutsSection() {
  const shortcuts = [
    ["Abrir radial", GLOBAL_SHORTCUT_LABEL, "Ativo"],
    ["Abrir composer", "Duplo clique no pet", "Ativo"],
    ["Capturar tela", "Não definido", "Planejado"],
    ["Alternar normal/expandido", "Não definido", "Planejado"],
  ];
  return (
    <div>
      <SectionIntro
        title="Atalhos"
        description="Mapa atual de acesso rápido. Edição de atalhos depende do host Tauri."
      />
      <div className="grid gap-2">
        {shortcuts.map(([title, value, status]) => (
          <div
            key={title}
            className="flex items-center justify-between gap-4 rounded-xl border border-line p-4"
          >
            <div>
              <div className="text-xs font-semibold text-fg">{title}</div>
              <kbd className="mt-1 inline-block rounded border border-line bg-ink px-2 py-1 text-[10px] text-mute">
                {value}
              </kbd>
            </div>
            <Badge variant={status === "Ativo" ? "success" : "default"}>{status}</Badge>
          </div>
        ))}
      </div>
    </div>
  );
}

function PrivacySection() {
  return (
    <div>
      <SectionIntro
        title="Contexto e privacidade"
        description="O Helix deve tornar visível o contexto usado e pedir confirmação para leituras sensíveis."
      />
      <div className="grid gap-2">
        <StatusRow
          title="Clipboard quando acionado"
          description="Usado pelo composer e indicado na Context Bar."
          status="Ativo"
        />
        <StatusRow
          title="Captura de tela com confirmação"
          description="O workflow de OCR exige aprovação antes da leitura."
          status="Ativo"
        />
        <StatusRow
          title="Leitura contínua da tela"
          description="Fora de escopo até existir política e indicador persistente."
          status="Bloqueado"
        />
        <StatusRow
          title="Ocultar segredos detectados"
          description="Exige pipeline de redaction antes do envio ao provider."
        />
        <StatusRow
          title="Retenção de contexto"
          description="Será integrada à política de dados e Artifacts."
        />
      </div>
    </div>
  );
}

function ConnectorsSection() {
  return (
    <div>
      <SectionIntro
        title="Conectores"
        description="A gestão detalhada continua na página Conectores; este centro reunirá status, permissões e último uso."
      />
      <div className="grid gap-3 md:grid-cols-2">
        {["Brave Search", "Filesystem escopado", "Firecrawl", "GitHub", "Jina Reader/Search"].map(
          (connector, index) => (
            <Card key={connector}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-fg">{connector}</span>
                <Badge variant={index === 4 ? "success" : "default"}>
                  {index === 4 ? "Disponível" : "Configurar na página"}
                </Badge>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-faint">
                Permissões, teste de saúde e Artifacts consumidores serão consolidados aqui.
              </p>
            </Card>
          ),
        )}
      </div>
    </div>
  );
}

function ArtifactsSection() {
  return (
    <div>
      <SectionIntro
        title="Artefatos experimentais"
        description="O catálogo inicial é somente leitura. Persistência, edição e fixação no radial virão depois da fundação."
      />
      <div className="grid gap-3 md:grid-cols-2">
        {HELIX_ARTIFACTS.map((artifact) => (
          <Card key={artifact.id}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-fg">{artifact.name}</span>
              <Badge variant="signal">v{artifact.version}</Badge>
            </div>
            <p className="mt-2 text-[11px] text-faint">{artifact.shortDescription}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {artifact.quickActions.slice(0, 3).map((action) => (
                <Badge key={action.id}>{action.title}</Badge>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function WorkflowsSection() {
  return (
    <div>
      <SectionIntro
        title="Workflows"
        description="Templates e execuções continuam na página Workflows. Preferências globais entram após validação do runtime."
      />
      <StatusRow
        title="Fixar no radial"
        description="Será alimentado pelo mesmo Action Registry usado pelo pet."
      />
      <div className="mt-2">
        <StatusRow
          title="Aprovação padrão"
          description="Precisa respeitar permission levels do workflow e da ferramenta."
        />
      </div>
    </div>
  );
}

function DataSection() {
  return (
    <div>
      <SectionIntro
        title="Dados e histórico"
        description="Ações destrutivas só serão habilitadas com escopo, confirmação e leitura de volta."
      />
      <div className="grid gap-2">
        <StatusRow title="Retenção do histórico" description="Política configurável ainda não persistida." />
        <StatusRow
          title="Exportar dados"
          description="Formato e conteúdo do pacote precisam ser definidos."
        />
        <StatusRow
          title="Limpar cache"
          description="Exige separar cache reconstruível de dados do usuário."
        />
        <StatusRow
          title="Resetar estado local"
          description="Permanecerá protegido por confirmação explícita."
          status="Bloqueado"
        />
      </div>
    </div>
  );
}

function AdvancedSection({ p, timeoutOutOfRange }: { p: SettingsPanelProps; timeoutOutOfRange: boolean }) {
  const timeoutId = useId();
  const baseUrlId = useId();
  return (
    <div>
      <SectionIntro
        title="Avançado"
        description="Opções técnicas reais e pontos de diagnóstico do Bun sidecar."
      />
      <Card className="grid gap-4 md:grid-cols-2">
        <label htmlFor={timeoutId} className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-mute flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" /> Timeout
          </span>
          <Input
            id={timeoutId}
            type="number"
            value={p.formTimeout}
            onChange={(event) => p.setFormTimeout(Number(event.target.value))}
            min={5}
            max={600}
            invalid={timeoutOutOfRange}
            required
          />
          <span className={`text-[10px] ${timeoutOutOfRange ? "text-bad" : "text-faint"}`}>
            {timeoutOutOfRange ? "Use um valor entre 5 e 600 segundos." : "Entre 5 e 600 segundos."}
          </span>
        </label>

        <label htmlFor={baseUrlId} className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-mute flex items-center gap-1.5">
            <Link className="w-3.5 h-3.5" /> Base URL
          </span>
          <Input
            id={baseUrlId}
            value={p.formBaseUrl}
            onChange={(event) => p.setFormBaseUrl(event.target.value)}
            placeholder="URL do provider compatível"
            disabled={p.formProvider === "pinstripes" || p.formProvider === "mock"}
          />
          <span className="text-[10px] text-faint">Disponível para providers compatíveis.</span>
        </label>
      </Card>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <Card>
          <Database className="w-4 h-4 text-signal" />
          <div className="mt-2 text-xs font-semibold text-fg">Storage local</div>
          <div className="mt-1 text-[10px] text-faint">SQLite com migrations versionadas.</div>
        </Card>
        <Card>
          <FileClock className="w-4 h-4 text-good" />
          <div className="mt-2 text-xs font-semibold text-fg">Logs do runtime</div>
          <div className="mt-1 text-[10px] text-faint">Visíveis durante execução; exportação planejada.</div>
        </Card>
        <Card>
          <Terminal className="w-4 h-4 text-warn" />
          <div className="mt-2 text-xs font-semibold text-fg">Bun sidecar</div>
          <div className="mt-1 text-[10px] text-faint">Health check e restart já fazem parte do shell.</div>
        </Card>
      </div>
    </div>
  );
}
