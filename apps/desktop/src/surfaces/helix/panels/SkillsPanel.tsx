import type { Skill } from "@desktop-agent/shared";
import { ChevronDown, Plus, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../../../components/ui/primitives/button";
import { IconButton } from "../../../components/ui/primitives/icon-button";
import { Input } from "../../../components/ui/primitives/input";
import { Label } from "../../../components/ui/primitives/label";
import { TagInput } from "../../../components/ui/primitives/tag-input";
import { Textarea } from "../../../components/ui/primitives/textarea";
import { useAgentStore } from "../../../stores/agent";
import { ProviderModelSelect } from "../composer/ProviderModelSelect";

type Props = {
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

function toMetadataEntries(metadata?: Record<string, string>): { id: string; key: string; value: string }[] {
  return Object.entries(metadata ?? {})
    .filter(([k, v]) => k.trim() || v.trim())
    .map(([key, value]) => ({ id: crypto.randomUUID(), key, value }));
}

function toMetadata(entries: { id: string; key: string; value: string }[]): Record<string, string> {
  const metadata: Record<string, string> = {};
  for (const { key, value } of entries) {
    const k = key.trim();
    if (!k) continue;
    metadata[k] = value.trim();
  }
  return metadata;
}

export function SkillsPanel(p: Props) {
  const { t } = useTranslation("helix");
  const tools = useAgentStore((s) => s.tools);
  const connectors = useAgentStore((s) => s.connectors);
  const toolNames = useMemo(() => tools.map((tool) => tool.name), [tools]);
  const connectorNames = useMemo(() => connectors.map((c) => c.name), [connectors]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [compatibility, setCompatibility] = useState("");
  const [prompt, setPrompt] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [provider, setProvider] = useState("");
  const [model, setModel] = useState("");
  const [temperature, setTemperature] = useState(0.3);
  const [maxTokens, setMaxTokens] = useState(0);
  const [toolAllowlist, setToolAllowlist] = useState<string[]>([]);
  const [mcpAllowlist, setMcpAllowlist] = useState<string[]>([]);
  const [maxSteps, setMaxSteps] = useState(5);
  const [enabled, setEnabled] = useState(true);
  const [metadataEntries, setMetadataEntries] = useState<{ id: string; key: string; value: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  function resetForm() {
    setEditingId(null);
    setName("");
    setDescription("");
    setCompatibility("");
    setPrompt("");
    setSystemPrompt("");
    setProvider("");
    setModel("");
    setTemperature(0.3);
    setMaxTokens(0);
    setToolAllowlist([]);
    setMcpAllowlist([]);
    setMaxSteps(5);
    setEnabled(true);
    setMetadataEntries([]);
    setError(null);
    setShowForm(false);
  }

  function handleNew() {
    resetForm();
    setShowForm(true);
  }

  function startEdit(skill: Skill) {
    setEditingId(skill.id);
    setName(skill.name);
    setDescription(skill.description ?? "");
    setCompatibility(skill.compatibility ?? "");
    setPrompt(skill.prompt);
    setSystemPrompt(skill.systemPrompt ?? "");
    setProvider(skill.provider ?? "");
    setModel(skill.model ?? "");
    setTemperature(skill.temperature ?? 0.3);
    setMaxTokens(skill.maxTokens ?? 0);
    setToolAllowlist(skill.toolAllowlist ?? []);
    setMcpAllowlist(skill.mcpAllowlist ?? []);
    setMaxSteps(skill.maxSteps ?? 5);
    setEnabled(skill.enabled ?? true);
    setMetadataEntries(toMetadataEntries(skill.metadata));
    setError(null);
    setShowForm(true);
  }

  async function handleSave() {
    if (!name.trim()) {
      setError(t("helix:skillsPanel.nameRequired"));
      return;
    }
    if (!prompt.trim()) {
      setError(t("helix:skillsPanel.promptRequired"));
      return;
    }
    if (temperature < 0 || temperature > 2) {
      setError(t("helix:skillsPanel.temperatureRange"));
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await p.onSave({
        id: editingId ?? undefined,
        name: name.trim(),
        description: description.trim(),
        prompt: prompt.trim(),
        systemPrompt: systemPrompt.trim() || undefined,
        provider: provider.trim() || undefined,
        model: model.trim() || undefined,
        temperature,
        maxTokens: maxTokens || undefined,
        toolAllowlist,
        mcpAllowlist,
        maxSteps,
        metadata: toMetadata(metadataEntries),
        compatibility: compatibility.trim() || undefined,
        enabled,
      });
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("helix:skillsPanel.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  function addMetadataEntry() {
    setMetadataEntries([...metadataEntries, { id: crypto.randomUUID(), key: "", value: "" }]);
  }

  function updateMetadataEntry(index: number, field: "key" | "value", value: string) {
    const next = [...metadataEntries];
    const entry = next[index];
    if (entry) {
      entry[field] = value;
      setMetadataEntries(next);
    }
  }

  function removeMetadataEntry(index: number) {
    setMetadataEntries(metadataEntries.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-fg">{t("helix:skillsPanel.title")}</h2>
          <p className="text-[11px] text-faint">{t("helix:skillsPanel.description")}</p>
        </div>
        <Button size="sm" onClick={handleNew}>
          <Plus className="w-3.5 h-3.5 mr-1" />
          {t("helix:skillsPanel.new")}
        </Button>
      </div>

      {showForm || editingId !== null ? (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <span className="text-xs font-semibold text-fg">{t("helix:skillsPanel.identity")}</span>
              <label className="flex items-center gap-2 text-xs text-fg cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                  className="w-3.5 h-3.5 rounded accent-signal cursor-pointer"
                />
                {t("helix:skillsPanel.enabled")}
              </label>
            </CardHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="skill-name">{t("helix:skillsPanel.name")}</Label>
                <Input
                  id="skill-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="tradutor-tecnico"
                />
                <p className="text-[10px] text-faint">{t("helix:skillsPanel.nameHint")}</p>
              </div>
              <div className="space-y-1">
                <Label htmlFor="skill-description">{t("helix:skillsPanel.descriptionLabel")}</Label>
                <Textarea
                  id="skill-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t("helix:skillsPanel.descriptionPlaceholder")}
                  className="min-h-[80px]"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="skill-compatibility">{t("helix:skillsPanel.compatibilityLabel")}</Label>
                <Input
                  id="skill-compatibility"
                  value={compatibility}
                  onChange={(e) => setCompatibility(e.target.value)}
                  placeholder={t("helix:skillsPanel.compatibilityPlaceholder")}
                />
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader>
              <span className="text-xs font-semibold text-fg">{t("helix:skillsPanel.instructions")}</span>
            </CardHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="skill-prompt">{t("helix:skillsPanel.prompt")}</Label>
                <Textarea
                  id="skill-prompt"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={t("helix:skillsPanel.promptPlaceholder")}
                  className="min-h-[180px]"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="skill-system">{t("helix:skillsPanel.systemPrompt")}</Label>
                <Textarea
                  id="skill-system"
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  placeholder={t("helix:skillsPanel.systemPromptPlaceholder")}
                />
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader>
              <span className="text-xs font-semibold text-fg">{t("helix:skillsPanel.model")}</span>
            </CardHeader>
            <div className="space-y-3">
              <ProviderModelSelect
                provider={provider}
                model={model}
                onProviderChange={setProvider}
                onModelChange={setModel}
                providerId="skill-provider"
                modelId="skill-model"
              />
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="skill-temperature">{t("helix:skillsPanel.temperature")}</Label>
                  <Input
                    id="skill-temperature"
                    type="number"
                    step={0.1}
                    min={0}
                    max={2}
                    value={temperature}
                    onChange={(e) => setTemperature(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="skill-max-tokens">{t("helix:skillsPanel.maxTokens")}</Label>
                  <Input
                    id="skill-max-tokens"
                    type="number"
                    min={0}
                    value={maxTokens}
                    onChange={(e) => setMaxTokens(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="skill-max-steps">{t("helix:skillsPanel.maxSteps")}</Label>
                  <Input
                    id="skill-max-steps"
                    type="number"
                    min={1}
                    value={maxSteps}
                    onChange={(e) => setMaxSteps(Number(e.target.value))}
                  />
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader>
              <span className="text-xs font-semibold text-fg">{t("helix:skillsPanel.permissions")}</span>
            </CardHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="skill-tools">{t("helix:skillsPanel.allowedTools")}</Label>
                <TagInput
                  id="skill-tools"
                  value={toolAllowlist}
                  onChange={setToolAllowlist}
                  suggestions={toolNames}
                  placeholder={t("helix:skillsPanel.allowedToolsPlaceholder")}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="skill-mcp">{t("helix:skillsPanel.allowedMcps")}</Label>
                <TagInput
                  id="skill-mcp"
                  value={mcpAllowlist}
                  onChange={setMcpAllowlist}
                  suggestions={connectorNames}
                  placeholder={t("helix:skillsPanel.allowedMcpsPlaceholder")}
                />
              </div>
            </div>
          </Card>

          <Card>
            <details className="group">
              <summary className="flex items-center justify-between cursor-pointer list-none">
                <span className="text-xs font-semibold text-fg">
                  {t("helix:skillsPanel.metadataOptional")}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-faint transition-transform group-open:rotate-180" />
              </summary>
              <div className="space-y-3 mt-3">
                {metadataEntries.map((entry, index) => (
                  <div key={entry.id} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-start">
                    <Input
                      value={entry.key}
                      onChange={(e) => updateMetadataEntry(index, "key", e.target.value)}
                      placeholder={t("helix:skillsPanel.key")}
                    />
                    <Input
                      value={entry.value}
                      onChange={(e) => updateMetadataEntry(index, "value", e.target.value)}
                      placeholder={t("helix:skillsPanel.value")}
                    />
                    <IconButton
                      title={t("helix:skillsPanel.removePair")}
                      onClick={() => removeMetadataEntry(index)}
                    >
                      <X className="w-3.5 h-3.5" />
                    </IconButton>
                  </div>
                ))}
                <Button size="sm" variant="secondary" onClick={addMetadataEntry}>
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  {t("helix:skillsPanel.addPair")}
                </Button>
              </div>
            </details>
          </Card>

          {error ? <p className="rounded-md bg-bad/10 text-bad text-xs px-3 py-2">{error}</p> : null}

          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={resetForm}>
              <X className="w-3.5 h-3.5 mr-1" />
              {t("helix:skillsPanel.cancel")}
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? t("helix:skillsPanel.saving") : t("helix:skillsPanel.save")}
            </Button>
          </div>
        </div>
      ) : null}

      <div className="space-y-2">
        {p.skills.map((skill) => (
          <div
            key={skill.id}
            className="rounded-xl border border-line/60 bg-white/[0.02] p-3.5 hover:border-line hover:bg-white/[0.04] transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1.5 min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-fg truncate">{skill.name}</span>
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${
                      skill.enabled
                        ? "bg-good/10 text-good border border-good/20"
                        : "bg-faint/10 text-faint border border-faint/20"
                    }`}
                  >
                    {skill.enabled ? t("helix:skillsPanel.active") : t("helix:skillsPanel.inactive")}
                  </span>
                </div>
                {skill.description ? (
                  <p className="text-[11px] text-fg leading-relaxed">{skill.description}</p>
                ) : null}
                <div className="flex items-center flex-wrap gap-2 text-[9px] text-faint">
                  <span className="rounded bg-white/[0.03] px-1.5 py-0.5 font-mono">
                    {skill.provider || t("helix:skillsPanel.defaultProvider")}:
                    {skill.model || t("helix:skillsPanel.autoModel")}
                  </span>
                  <span>
                    {skill.maxSteps ?? 1} {t("helix:skillsPanel.steps")}
                  </span>
                  {skill.toolAllowlist && skill.toolAllowlist.length > 0 ? (
                    <>
                      <span className="w-0.5 h-0.5 rounded-full bg-faint" />
                      <span>
                        {skill.toolAllowlist.length} {t("helix:skillsPanel.tools")}
                      </span>
                    </>
                  ) : null}
                  {skill.compatibility ? (
                    <>
                      <span className="w-0.5 h-0.5 rounded-full bg-faint" />
                      <span>{skill.compatibility}</span>
                    </>
                  ) : null}
                  {skill.metadata
                    ? Object.entries(skill.metadata).map(([key, value]) => (
                        <span key={key} className="rounded bg-white/[0.03] px-1.5 py-0.5 font-mono">
                          {key}: {value}
                        </span>
                      ))
                    : null}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button size="sm" variant="secondary" onClick={() => startEdit(skill)}>
                  {t("helix:skillsPanel.edit")}
                </Button>
                <IconButton
                  title={t("helix:skillsPanel.delete")}
                  onClick={() => {
                    if (confirm(t("helix:skillsPanel.confirmDelete", { name: skill.name }))) {
                      p.onDelete(skill.id);
                    }
                  }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </IconButton>
              </div>
            </div>
          </div>
        ))}
        {p.skills.length === 0 ? (
          <div className="text-center py-8 rounded-xl border border-dashed border-line/60 bg-white/[0.01]">
            <p className="text-xs text-faint">{t("helix:skillsPanel.noSkills")}</p>
            <p className="text-[10px] text-faint/60 mt-1">{t("helix:skillsPanel.noSkillsHint")}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-line/60 bg-white/[0.02] p-4 space-y-4 shadow-sm">{children}</div>
  );
}

function CardHeader({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center justify-between gap-2">{children}</div>;
}
