import {
  type AgentProfile,
  type AppSettings,
  type PromptTemplate,
  type SaveProfileInput,
  type Skill,
  type WorkflowStepKind,
  type WorkflowTemplate,
  type WorkflowTemplateSettings,
} from "@desktop-agent/shared";
import {
  AppWindow,
  Bot,
  ChevronDown,
  Clock,
  Database,
  Eye,
  EyeOff,
  History,
  Keyboard,
  KeyRound,
  Layers,
  Link,
  Monitor,
  Plug,
  Settings,
  ShieldCheck,
  Sparkles,
  Terminal,
  Workflow,
  X,
} from "lucide-react";
import { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { IconButton } from "../../components/ui/icon-button";
import { Input } from "../../components/ui/input";
import { getAgent } from "../../lib/rpc";
import { useAgentStore } from "../../stores/agent";
import { GLOBAL_SHORTCUT_LABEL, usePinstripesModels } from "./constants";
import { PromptsPanel } from "./PromptsPanel";
import { SkillsPanel } from "./SkillsPanel";
import { WorkflowsPanel } from "./WorkflowsPanel";

export type SettingsSection =
  | "general"
  | "model"
  | "pet"
  | "shortcuts"
  | "privacy"
  | "profiles"
  | "connectors"
  | "workflows"
  | "skills"
  | "data"
  | "advanced";

export type ProfilesSectionProps = {
  prompts: PromptTemplate[];
  profiles: AgentProfile[];
  activeProfileId: string | null;
  onSavePrompt: (input: {
    id?: string;
    title: string;
    prompt: string;
    category?: string;
    icon?: string;
    executionMode?: "simple" | "workflow";
  }) => void;
  onDeletePrompt: (id: string) => void;
  onSaveProfile: (input: SaveProfileInput) => void;
  onDeleteProfile: (id: string) => void;
  onSetActiveProfile: (profileId: string | null) => void;
  onUsePrompt: (prompt: string, executionMode?: "simple" | "workflow") => void;
};

export type WorkflowsSectionProps = {
  templates: WorkflowTemplate[];
  skills: Skill[];
  onSave: (input: {
    id?: string;
    name: string;
    description?: string;
    prompt: string;
    settings?: WorkflowTemplateSettings;
    steps?: Array<{ name: string; kind: WorkflowStepKind; config: Record<string, unknown> }>;
    enabled?: boolean;
  }) => void;
  onDelete: (id: string) => void;
};

export type SkillsSectionProps = {
  skills: Skill[];
  onSave: (input: {
    id?: string;
    name: string;
    description?: string;
    prompt: string;
    systemPrompt?: string;
    provider?: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
    toolAllowlist?: string[];
    mcpAllowlist?: string[];
    maxSteps?: number;
    metadata?: Record<string, string>;
    compatibility?: string;
    enabled?: boolean;
  }) => void;
  onDelete: (id: string) => void;
};

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
  formLanguage: "pt-BR" | "en";
  formDefaultWindowMode: "collapsed" | "normal" | "expanded";
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
  setFormLanguage: (v: "pt-BR" | "en") => void;
  setFormDefaultWindowMode: (v: "collapsed" | "normal" | "expanded") => void;
  setShowKey: (v: boolean) => void;
  handleSaveSettings: (e: React.FormEvent) => Promise<boolean | undefined>;
  initialSection?: SettingsSection;
  sections?: {
    profiles?: ProfilesSectionProps;
    workflows?: WorkflowsSectionProps;
    skills?: SkillsSectionProps;
  };
};

function useSections(t: (key: string) => string) {
  const general = {
    id: "general" as const,
    label: t("settings:general.title"),
    description: t("settings:general.description"),
    icon: Settings,
  };
  return {
    general,
    all: [
      general,
      {
        id: "model" as const,
        label: t("common:model"),
        description: t("settings:model.description"),
        icon: Bot,
      },
      {
        id: "pet" as const,
        label: t("common:pet"),
        description: t("settings:pet.description"),
        icon: Sparkles,
      },
      {
        id: "shortcuts" as const,
        label: t("common:shortcuts"),
        description: t("settings:shortcuts.description"),
        icon: Keyboard,
      },
      {
        id: "privacy" as const,
        label: t("common:privacy"),
        description: t("settings:privacy.description"),
        icon: ShieldCheck,
      },
      {
        id: "profiles" as const,
        label: t("common:profiles"),
        description: t("settings:profiles.description"),
        icon: Bot,
      },
      {
        id: "connectors" as const,
        label: t("common:connectors"),
        description: t("settings:connectors.description"),
        icon: Plug,
      },
      {
        id: "workflows" as const,
        label: t("common:workflows"),
        description: t("settings:workflows.description"),
        icon: Workflow,
      },
      {
        id: "skills" as const,
        label: t("common:skills"),
        description: t("settings:skills.description"),
        icon: Sparkles,
      },
      {
        id: "data" as const,
        label: t("common:data"),
        description: t("settings:data.description"),
        icon: History,
      },
      {
        id: "advanced" as const,
        label: t("common:advanced"),
        description: t("settings:advanced.description"),
        icon: Terminal,
      },
    ],
  };
}

function useDirtyCheck(p: SettingsPanelProps) {
  return (
    p.formProvider !== p.settings.activeProvider ||
    p.formApiKey !== p.settings.apiKey ||
    p.formBaseUrl !== p.settings.baseUrl ||
    p.formModel !== p.settings.model ||
    p.formHidePet !== p.settings.hidePet ||
    p.formTimeout !== p.settings.timeout ||
    Math.abs(p.formWindowOpacity - p.settings.windowOpacity) > 0.005 ||
    p.formPetSize !== p.settings.petSize ||
    p.formLanguage !== p.settings.language
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

function opacityLabel(value: number, t: (key: string, vars?: Record<string, string | number>) => string) {
  const percentage = Math.round(value * 100);
  if (percentage <= 50) return t("settings:pet.opacity.veryTranslucent", { percentage });
  if (percentage <= 80) return t("settings:pet.opacity.translucent", { percentage });
  if (percentage < 100) return t("settings:pet.opacity.slightlyTranslucent", { percentage });
  return t("settings:pet.opacity.solid", { percentage });
}

function petSizeLabel(value: number, t: (key: string, vars?: Record<string, string | number>) => string) {
  if (value <= 54) return t("settings:pet.size.compact", { size: value });
  if (value <= 72) return t("settings:pet.size.standard", { size: value });
  return t("settings:pet.size.large", { size: value });
}

export function SettingsPanel(p: SettingsPanelProps) {
  const { t } = useTranslation(["settings", "common"]);
  const pinstripesModels = usePinstripesModels();
  const [activeSection, setActiveSection] = useState<SettingsSection>(p.initialSection ?? "general");
  const isDirty = useDirtyCheck(p);
  const justSaved = useInlineSaveFeedback(p.savingSettings);
  const needsApiKey = p.formProvider !== "mock" && !p.formApiKey.trim();
  const timeoutOutOfRange = p.formTimeout < 5 || p.formTimeout > 600;
  const sections = useSections(t);
  const currentSection = sections.all.find((section) => section.id === activeSection) ?? sections.general;

  const submitSettings = (event: React.FormEvent) => {
    event.preventDefault();
    void p.handleSaveSettings(event);
  };

  const handleProviderChange = (next: string) => {
    p.setFormProvider(next);
    if (next === "mock") p.setFormModel("mock-model");
    else if (next === "pinstripes") {
      const currentModelIsValid = pinstripesModels.some((model) => model.id === p.formModel);
      p.setFormModel(currentModelIsValid ? p.formModel : "ps/warp");
    }
  };

  const compact = p.variant !== "expanded";

  return (
    <div
      className={`flex select-none bg-ink/96 backdrop-blur-xl ${compact ? "absolute inset-0 z-30" : "relative h-full w-full z-10"}`}
    >
      <form
        onSubmit={submitSettings}
        className={`grid h-full w-full ${
          compact
            ? "grid-rows-[auto_minmax(0,1fr)_auto]"
            : "grid-cols-[216px_minmax(0,1fr)] grid-rows-[minmax(0,1fr)_auto]"
        }`}
      >
        <aside
          className={`min-w-0 border-line bg-white/[0.012] ${
            compact ? "border-b px-4 py-3" : "row-span-2 flex min-h-0 flex-col border-r p-3.5"
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-bold text-fg flex items-center gap-2">
                {t("settings:title")}
                {isDirty && !p.savingSettings && (
                  <span className="w-1.5 h-1.5 rounded-full bg-warn" title={t("common:unsaved")} />
                )}
              </div>
              {!compact && <div className="mt-1 text-xs text-faint">{t("settings:subtitle")}</div>}
            </div>
            <IconButton title={t("settings:closeSettings")} onClick={p.onClose}>
              <X className="w-4 h-4" />
            </IconButton>
          </div>

          {compact ? (
            <label className="relative mt-3 block">
              <span className="sr-only">{t("settings:sectionLabel")}</span>
              <select
                value={activeSection}
                onChange={(event) => setActiveSection(event.target.value as SettingsSection)}
                className="h-10 w-full appearance-none rounded-lg border border-line bg-ink px-3 pr-9 text-xs text-fg"
              >
                {sections.all.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-3 w-4 h-4 text-faint" />
            </label>
          ) : (
            <nav
              className="mt-5 grid min-h-0 flex-1 content-start gap-0.5 overflow-y-auto pr-1"
              aria-label={t("settings:navLabel")}
            >
              {sections.all.map((section) => {
                const Icon = section.icon;
                const active = section.id === activeSection;
                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => setActiveSection(section.id)}
                    className={`relative rounded-lg border px-3 py-2 text-left transition-colors ${
                      active
                        ? "border-line-strong bg-white/[0.055] text-fg before:absolute before:bottom-2 before:left-0 before:top-2 before:w-px before:bg-signal"
                        : "border-transparent text-mute hover:bg-white/[0.035] hover:text-fg"
                    }`}
                  >
                    <span className="flex items-center gap-2 text-xs font-semibold">
                      <Icon className={`w-3.5 h-3.5 ${active ? "text-signal" : "text-faint"}`} />
                      {section.label}
                    </span>
                  </button>
                );
              })}
            </nav>
          )}

          {!compact && (
            <div className="mt-3 shrink-0 border-t border-line px-2 pt-3 text-[9px] leading-relaxed text-faint">
              {t("settings:localNotice")}
            </div>
          )}
        </aside>

        <main className="flex min-h-0 min-w-0 flex-col overflow-hidden">
          <header className="shrink-0 border-b border-line px-5 py-4">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold tracking-tight text-fg">{currentSection.label}</h2>
              {p.savingSettings && <Badge variant="signal">{t("common:saving")}</Badge>}
              {justSaved && !p.savingSettings && <Badge variant="success">{t("common:saved")}</Badge>}
            </div>
            <p className="mt-1 text-xs text-faint">{currentSection.description}</p>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto p-5 overscroll-contain">
            <div className="mx-auto w-full max-w-4xl">
              {activeSection === "general" && (
                <GeneralSection
                  formLanguage={p.formLanguage}
                  setFormLanguage={p.setFormLanguage}
                  formDefaultWindowMode={p.formDefaultWindowMode}
                  setFormDefaultWindowMode={p.setFormDefaultWindowMode}
                  t={t}
                />
              )}
              {activeSection === "model" && (
                <ModelSection p={p} needsApiKey={needsApiKey} onProviderChange={handleProviderChange} />
              )}
              {activeSection === "pet" && <PetSection p={p} />}
              {activeSection === "shortcuts" && <ShortcutsSection />}
              {activeSection === "privacy" && <PrivacySection />}
              {activeSection === "profiles" && p.sections?.profiles && (
                <ProfilesSection props={p.sections.profiles} />
              )}
              {activeSection === "connectors" && <ConnectorsSection />}
              {activeSection === "workflows" &&
                (p.sections?.workflows ? (
                  <WorkflowsSection props={p.sections.workflows} />
                ) : (
                  <WorkflowsPlaceholderSection />
                ))}
              {activeSection === "skills" &&
                (p.sections?.skills ? <SkillsSection props={p.sections.skills} /> : null)}
              {activeSection === "data" && <DataSection />}
              {activeSection === "advanced" && (
                <AdvancedSection p={p} timeoutOutOfRange={timeoutOutOfRange} />
              )}
            </div>
          </div>
        </main>

        {activeSection !== "profiles" && activeSection !== "workflows" && activeSection !== "skills" && (
          <footer className="flex min-w-0 items-center gap-2 border-t border-line bg-[#0d0b12]/96 px-5 py-3">
            <span className="mr-auto text-[10px] text-faint">
              {isDirty ? t("common:unsaved") : t("common:saved")}
            </span>
            <Button type="button" variant="secondary" onClick={p.onClose}>
              {t("common:cancel")}
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={!isDirty || p.savingSettings || needsApiKey || timeoutOutOfRange}
            >
              {p.savingSettings ? `${t("common:saving")}...` : t("common:saveSettings")}
            </Button>
          </footer>
        )}
      </form>
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

function GeneralSection({
  formLanguage,
  setFormLanguage,
  formDefaultWindowMode,
  setFormDefaultWindowMode,
  t,
}: {
  formLanguage: "pt-BR" | "en";
  setFormLanguage: (v: "pt-BR" | "en") => void;
  formDefaultWindowMode: "collapsed" | "normal" | "expanded";
  setFormDefaultWindowMode: (v: "collapsed" | "normal" | "expanded") => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  return (
    <div>
      <div className="grid gap-3 md:grid-cols-2">
        <Card>
          <label className="flex flex-col gap-2">
            <span className="flex items-center gap-2 text-xs font-semibold text-fg">
              <Layers className="w-4 h-4 text-good" /> {t("settings:general.languageLabel")}
            </span>
            <select
              value={formLanguage}
              onChange={(event) => setFormLanguage(event.target.value as "pt-BR" | "en")}
              className="h-10 rounded-lg border border-line bg-ink px-3 text-xs text-fg"
            >
              <option value="pt-BR">{t("common:portuguese")}</option>
              <option value="en">{t("common:english")}</option>
            </select>
            <span className="text-[10px] font-normal text-faint">{t("settings:general.languageHint")}</span>
          </label>
        </Card>
        <Card>
          <label className="flex flex-col gap-2">
            <span className="flex items-center gap-2 text-xs font-semibold text-fg">
              <AppWindow className="w-4 h-4 text-signal" /> {t("settings:general.defaultWindowMode")}
            </span>
            <select
              value={formDefaultWindowMode}
              onChange={(event) =>
                setFormDefaultWindowMode(event.target.value as "collapsed" | "normal" | "expanded")
              }
              className="h-10 rounded-lg border border-line bg-ink px-3 text-xs text-fg"
            >
              <option value="collapsed">{t("settings:general.windowModePet")}</option>
              <option value="normal">{t("settings:general.windowModeNormal")}</option>
              <option value="expanded">{t("settings:general.windowModeExpanded")}</option>
            </select>
            <span className="text-[10px] font-normal text-faint">
              {t("settings:general.defaultWindowModeHint")}
            </span>
          </label>
        </Card>
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
  const { t } = useTranslation(["settings", "common"]);
  const pinstripesModels = usePinstripesModels();
  const apiKeyId = useId();
  return (
    <div>
      <Card className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-mute">{t("common:provider")}</span>
          <select
            value={p.formProvider}
            onChange={(event) => onProviderChange(event.target.value)}
            className="h-10 rounded-lg border border-line bg-ink px-3 text-xs text-fg"
          >
            <option value="pinstripes">{t("helix:providerModelSelect.pinstripesApi")}</option>
            <option value="mock">{t("helix:providerModelSelect.mockLocal")}</option>
            <option value="openai">{t("helix:providerModelSelect.openaiCompatible")}</option>
            <option value="gemini">{t("helix:providerModelSelect.geminiCompatible")} (experimental)</option>
          </select>
        </label>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-mute">{t("common:model_default")}</span>
          {p.formProvider === "pinstripes" ? (
            <select
              aria-label={t("common:model_default")}
              value={p.formModel || "ps/warp"}
              onChange={(event) => p.setFormModel(event.target.value)}
              className="h-10 rounded-lg border border-line bg-ink px-3 text-xs text-fg"
            >
              {pinstripesModels.map((model) => (
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
              aria-label={t("common:model_default")}
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
              aria-label={t("common:model_default")}
              value={p.formModel}
              onChange={(event) => p.setFormModel(event.target.value)}
              placeholder={p.loadingModels ? t("common:fetchingModels") : t("common:customModel")}
              required
            />
          )}
        </div>

        {p.formProvider !== "mock" && (
          <label htmlFor={apiKeyId} className="md:col-span-2 flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-mute flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5" /> {t("common:apiKey")}
            </span>
            <div className="relative">
              <Input
                id={apiKeyId}
                type={p.showKey ? "text" : "password"}
                value={p.formApiKey}
                onChange={(event) => p.setFormApiKey(event.target.value)}
                placeholder={t("settings:model.apiKeyPlaceholder")}
                invalid={needsApiKey}
                required
              />
              <IconButton
                title={p.showKey ? t("settings:model.hideKey") : t("settings:model.showKey")}
                onClick={() => p.setShowKey(!p.showKey)}
                className="absolute right-2 top-1.5"
              >
                {p.showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </IconButton>
            </div>
            {needsApiKey && <span className="text-[10px] text-bad">{t("common:required")}</span>}
          </label>
        )}
      </Card>

    </div>
  );
}

function PetSection({ p }: { p: SettingsPanelProps }) {
  const { t } = useTranslation(["settings", "common"]);
  return (
    <div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <label className="flex flex-col gap-2 text-xs font-semibold text-fg">
            <span className="flex items-center gap-2">
              <Monitor className="w-4 h-4 text-signal" /> {t("settings:pet.windowOpacity")}
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
            <span className="text-[10px] font-normal text-faint">{opacityLabel(p.formWindowOpacity, t)}</span>
          </label>
        </Card>
        <Card>
          <label className="flex flex-col gap-2 text-xs font-semibold text-fg">
            <span className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-signal" /> {t("settings:pet.petSize")}
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
            <span className="text-[10px] font-normal text-faint">{petSizeLabel(p.formPetSize, t)}</span>
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
          <span className="block text-xs font-semibold text-fg">{t("settings:pet.hidePet")}</span>
          <span className="mt-1 block text-[11px] leading-relaxed text-faint">
            {t("settings:pet.hidePetHint", { shortcut: GLOBAL_SHORTCUT_LABEL })}
          </span>
        </span>
      </label>

    </div>
  );
}

function ShortcutsSection() {
  const { t } = useTranslation(["settings", "common"]);
  const shortcuts = [
    [t("settings:shortcuts.openRadial"), GLOBAL_SHORTCUT_LABEL, t("common:active")],
    [t("settings:shortcuts.openComposer"), "Enter", t("common:active")],
    [t("settings:shortcuts.toggleMode"), "Esc", t("common:active")],
  ];
  return (
    <div>
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
            <Badge variant={status === t("common:active") ? "success" : "default"}>{status}</Badge>
          </div>
        ))}
      </div>
    </div>
  );
}

function PrivacySection() {
  const { t } = useTranslation(["settings", "common"]);
  const settings = useAgentStore((state) => state.settings);
  const setSettings = useAgentStore((state) => state.setSettings);

  const updateNotifications = async (patch: Partial<typeof settings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    try {
      const api = await getAgent();
      await api.saveSettings(next);
    } catch {
      setSettings(settings);
    }
  };

  return (
    <div>
      <div className="rounded-xl border border-line p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold text-fg">Notificações nativas</div>
            <div className="mt-1 text-[11px] text-faint">
              Desligadas por padrão; o conteúdo permanece genérico.
            </div>
          </div>
          <button
            type="button"
            onClick={() => void updateNotifications({ notificationsEnabled: !settings.notificationsEnabled })}
            className={`rounded-full px-3 py-1 text-[10px] font-medium ${
              settings.notificationsEnabled ? "bg-good/20 text-good" : "bg-white/[0.06] text-mute"
            }`}
          >
            {settings.notificationsEnabled ? "Ativadas" : "Desativadas"}
          </button>
        </div>
        <label className="mt-3 flex items-center justify-between gap-3 text-[11px] text-faint">
          Conteúdo
          <select
            value={settings.notificationContentMode}
            onChange={(event) =>
              void updateNotifications({
                notificationContentMode: event.target.value as "generic" | "preview",
              })
            }
            className="rounded border border-line bg-bg px-2 py-1 text-[10px] text-fg"
          >
            <option value="generic">Genérico</option>
            <option value="preview">Preview sanitizado</option>
          </select>
        </label>
      </div>
    </div>
  );
}

function ProfilesSection({ props }: { props: ProfilesSectionProps }) {
  return <PromptsPanel {...props} />;
}

function ConnectorsSection() {
  const { t } = useTranslation(["settings", "common"]);
  return (
    <div>
      <div className="grid gap-3 md:grid-cols-2">
        {["Brave Search", "Filesystem escopado", "Firecrawl", "GitHub", "Jina Reader/Search"].map(
          (connector, index) => (
            <Card key={connector}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-fg">{connector}</span>
                <Badge variant={index === 4 ? "success" : "default"}>
                  {index === 4 ? t("common:available") : t("common:configure")}
                </Badge>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-faint">
                {t("settings:connectors.permissionsHint")}
              </p>
            </Card>
          ),
        )}
      </div>
    </div>
  );
}

function WorkflowsSection({ props }: { props: WorkflowsSectionProps }) {
  return <WorkflowsPanel {...props} />;
}

function SkillsSection({ props }: { props: SkillsSectionProps }) {
  return <SkillsPanel {...props} />;
}

function WorkflowsPlaceholderSection() {
  const { t } = useTranslation(["settings"]);
  return (
    <div>
      <StatusRow
        title={t("settings:workflows.pinRadial")}
        description={t("settings:workflows.pinRadialHint")}
      />
      <div className="mt-2">
        <StatusRow
          title={t("settings:workflows.defaultApproval")}
          description={t("settings:workflows.defaultApprovalHint")}
        />
      </div>
    </div>
  );
}

function DataSection() {
  const { t } = useTranslation(["settings", "common"]);
  return (
    <div>
      <div className="grid gap-2">
        <StatusRow title={t("settings:data.retention")} description={t("settings:data.retentionHint")} />
        <StatusRow title={t("settings:data.export")} description={t("settings:data.exportHint")} />
        <StatusRow title={t("settings:data.clearCache")} description={t("settings:data.clearCacheHint")} />
        <StatusRow
          title={t("settings:data.reset")}
          description={t("settings:data.resetHint")}
          status={t("common:blocked")}
        />
      </div>
    </div>
  );
}

function AdvancedSection({
  p,
  timeoutOutOfRange,
}: {
  p: SettingsPanelProps;
  timeoutOutOfRange: boolean;
}) {
  const { t } = useTranslation(["settings", "common"]);
  const timeoutId = useId();
  const baseUrlId = useId();
  return (
    <div>
      <Card className="grid gap-4 md:grid-cols-2">
        <label htmlFor={timeoutId} className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-mute flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" /> {t("common:timeout")}
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
            {timeoutOutOfRange ? t("settings:advanced.timeoutError") : t("settings:advanced.timeoutHint")}
          </span>
        </label>

        <label htmlFor={baseUrlId} className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-mute flex items-center gap-1.5">
            <Link className="w-3.5 h-3.5" /> {t("common:baseUrl")}
          </span>
          <Input
            id={baseUrlId}
            value={p.formBaseUrl}
            onChange={(event) => p.setFormBaseUrl(event.target.value)}
            placeholder={t("settings:advanced.baseUrlHint")}
            disabled={p.formProvider === "pinstripes" || p.formProvider === "mock"}
          />
          <span className="text-[10px] text-faint">{t("settings:advanced.baseUrlHint")}</span>
        </label>
      </Card>

    </div>
  );
}
