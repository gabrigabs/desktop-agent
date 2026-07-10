import type {
  Skill,
  WorkflowStepKind,
  WorkflowTemplate,
  WorkflowTemplateSettings,
} from "@desktop-agent/shared";
import { z } from "@desktop-agent/shared";
import { ArrowDown, ArrowUp, ChevronDown, Plus, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../../components/ui/button";
import { IconButton } from "../../components/ui/icon-button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Separator } from "../../components/ui/separator";
import { TagInput } from "../../components/ui/tag-input";
import { Textarea } from "../../components/ui/textarea";
import { useAgentStore } from "../../stores/agent";
import { SELECT_CLASS } from "./constants";
import { ProviderModelSelect } from "./ProviderModelSelect";

const KINDS: WorkflowStepKind[] = ["llm", "tool", "mcp", "skill"];

function useKindLabels(): Partial<Record<WorkflowStepKind, string>> {
  const { t } = useTranslation("helix");
  return {
    llm: t("helix:workflowsPanel.kindLlm"),
    tool: t("helix:workflowsPanel.kindTool"),
    mcp: t("helix:workflowsPanel.kindMcp"),
    skill: t("helix:workflowsPanel.kindSkill"),
  };
}

function useKindDescriptions(): Partial<Record<WorkflowStepKind, string>> {
  const { t } = useTranslation("helix");
  return {
    llm: t("helix:workflowsPanel.kindLlmDescription"),
    tool: t("helix:workflowsPanel.kindToolDescription"),
    mcp: t("helix:workflowsPanel.kindMcpDescription"),
    skill: t("helix:workflowsPanel.kindSkillDescription"),
  };
}

function useApprovalOptions() {
  const { t } = useTranslation("helix");
  return [
    {
      value: "all" as const,
      label: t("helix:workflowsPanel.approvalAll"),
      description: t("helix:workflowsPanel.approvalAllDescription"),
    },
    {
      value: "none" as const,
      label: t("helix:workflowsPanel.approvalNone"),
      description: t("helix:workflowsPanel.approvalNoneDescription"),
    },
    {
      value: "local.read" as const,
      label: t("helix:workflowsPanel.approvalLocalRead"),
      description: t("helix:workflowsPanel.approvalLocalReadDescription"),
    },
    {
      value: "local.write" as const,
      label: t("helix:workflowsPanel.approvalLocalWrite"),
      description: t("helix:workflowsPanel.approvalLocalWriteDescription"),
    },
    {
      value: "network" as const,
      label: t("helix:workflowsPanel.approvalNetwork"),
      description: t("helix:workflowsPanel.approvalNetworkDescription"),
    },
    {
      value: "browser.control" as const,
      label: t("helix:workflowsPanel.approvalBrowserControl"),
      description: t("helix:workflowsPanel.approvalBrowserControlDescription"),
    },
    {
      value: "screen.read" as const,
      label: t("helix:workflowsPanel.approvalScreenRead"),
      description: t("helix:workflowsPanel.approvalScreenReadDescription"),
    },
    {
      value: "external" as const,
      label: t("helix:workflowsPanel.approvalExternal"),
      description: t("helix:workflowsPanel.approvalExternalDescription"),
    },
  ];
}

const approvalSchema = z.enum([
  "all",
  "none",
  "local.read",
  "local.write",
  "network",
  "browser.control",
  "screen.read",
  "external",
]);

function parseStepConfig(
  value: string,
  t: (key: string) => string,
): { config: Record<string, unknown>; error?: string } {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { config: {}, error: t("helix:workflowsPanel.jsonObjectRequired") };
    }
    return { config: parsed as Record<string, unknown> };
  } catch {
    return { config: {}, error: t("helix:workflowsPanel.jsonInvalid") };
  }
}

function validateStepConfig(
  kind: WorkflowStepKind,
  value: string,
  t: (key: string) => string,
): { config: Record<string, unknown>; error?: string } {
  const parsed = parseStepConfig(value, t);
  if (parsed.error) return parsed;
  const config = parsed.config;

  if (kind === "tool" || kind === "mcp") {
    const args = config.args;
    if (args !== undefined) {
      if (typeof args === "string") {
        try {
          const parsedArgs = JSON.parse(args);
          if (parsedArgs === null || typeof parsedArgs !== "object" || Array.isArray(parsedArgs)) {
            return { config: {}, error: t("helix:workflowsPanel.argsJsonObjectRequired") };
          }
          config.args = parsedArgs;
        } catch {
          return { config: {}, error: t("helix:workflowsPanel.argsJsonInvalid") };
        }
      } else if (typeof args !== "object" || Array.isArray(args)) {
        return { config: {}, error: t("helix:workflowsPanel.argsJsonObjectRequired") };
      }
    }
  }

  return { config };
}

type StepDraft = {
  id: string;
  name: string;
  kind: WorkflowStepKind;
  config: string;
};

function newStepId(): string {
  return crypto.randomUUID();
}

function defaultStep(kind: WorkflowStepKind, t: (key: string) => string): StepDraft {
  const base = { id: newStepId(), kind };
  if (kind === "llm") {
    return {
      ...base,
      name: t("helix:workflowsPanel.stepResponse"),
      config: JSON.stringify({ prompt: "{{$prompt}}", model: "", temperature: 0.3 }, null, 2),
    };
  }
  if (kind === "tool") {
    return {
      ...base,
      name: t("helix:workflowsPanel.stepTool"),
      config: JSON.stringify({ toolName: "", args: {} }, null, 2),
    };
  }
  if (kind === "mcp") {
    return {
      ...base,
      name: t("helix:workflowsPanel.stepMcp"),
      config: JSON.stringify({ serverId: "", toolName: "", args: {} }, null, 2),
    };
  }
  return {
    ...base,
    name: t("helix:workflowsPanel.stepSkill"),
    config: JSON.stringify({ skillId: "", prompt: "{{$prompt}}", args: {} }, null, 2),
  };
}

type Props = {
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

export function WorkflowsPanel(p: Props) {
  const { t } = useTranslation("helix");
  const kindLabels = useKindLabels();
  const kindDescriptions = useKindDescriptions();
  const approvalOptions = useApprovalOptions();
  const tools = useAgentStore((s) => s.tools);
  const connectors = useAgentStore((s) => s.connectors);
  const toolNames = useMemo(() => tools.map((tool) => tool.name), [tools]);
  const connectorNames = useMemo(() => connectors.map((c) => c.name), [connectors]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState<"simple" | "workflow">("workflow");
  const [maxSteps, setMaxSteps] = useState(8);
  const [approvalThreshold, setApprovalThreshold] = useState<string>("all");
  const [toolAllowlist, setToolAllowlist] = useState<string[]>([]);
  const [mcpAllowlist, setMcpAllowlist] = useState<string[]>([]);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [steps, setSteps] = useState<StepDraft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  function resetForm() {
    setEditingId(null);
    setName("");
    setDescription("");
    setPrompt("");
    setMode("workflow");
    setMaxSteps(8);
    setApprovalThreshold("all");
    setToolAllowlist([]);
    setMcpAllowlist([]);
    setSystemPrompt("");
    setEnabled(true);
    setSteps([]);
    setError(null);
    setShowForm(false);
  }

  function handleNew() {
    resetForm();
    setShowForm(true);
  }

  function startEdit(t: WorkflowTemplate) {
    setEditingId(t.id);
    setName(t.name);
    setDescription(t.description);
    setPrompt(t.prompt);
    setMode(t.mode);
    setMaxSteps(t.maxSteps);
    setApprovalThreshold(t.settings?.approvalThreshold ?? "all");
    setToolAllowlist(t.settings?.toolAllowlist ?? []);
    setMcpAllowlist(t.settings?.mcpAllowlist ?? []);
    setSystemPrompt(t.settings?.systemPrompt ?? "");
    setEnabled(t.enabled);
    setSteps(
      t.steps.map((s) => ({
        id: s.id,
        name: s.name,
        kind: s.kind,
        config: JSON.stringify(s.config, null, 2),
      })),
    );
    setShowForm(true);
  }

  async function handleSave() {
    if (!name.trim()) {
      setError(t("helix:workflowsPanel.nameRequired"));
      return;
    }

    const parsedApproval = approvalSchema.safeParse(approvalThreshold);
    if (!parsedApproval.success) {
      setError(t("helix:workflowsPanel.approvalInvalid"));
      return;
    }

    const stepErrors: string[] = [];
    const parsedSteps = steps.map((s, index) => {
      const validated = validateStepConfig(s.kind, s.config, t);
      if (validated.error) {
        stepErrors.push(t("helix:workflowsPanel.stepError", { index: index + 1, message: validated.error }));
      }
      return { name: s.name, kind: s.kind, config: validated.config };
    });

    if (stepErrors.length > 0) {
      setError(stepErrors.join("; "));
      return;
    }

    const settings: WorkflowTemplateSettings = {
      mode,
      maxSteps,
      approvalThreshold: parsedApproval.data,
      toolAllowlist,
      mcpAllowlist,
      systemPrompt,
    };

    setSaving(true);
    setError(null);
    try {
      await p.onSave({
        id: editingId ?? undefined,
        name: name.trim(),
        description: description.trim(),
        prompt: prompt.trim(),
        settings,
        steps: parsedSteps,
        enabled,
      });
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("helix:workflowsPanel.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  function addStep() {
    setSteps([...steps, defaultStep("llm", t)]);
  }

  function removeStep(index: number) {
    setSteps(steps.filter((_, i) => i !== index));
  }

  function moveStep(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= steps.length) return;
    const next = [...steps];
    const a = next[index];
    const b = next[nextIndex];
    if (a && b) {
      next[index] = b;
      next[nextIndex] = a;
      setSteps(next);
    }
  }

  function updateStep(index: number, update: Partial<StepDraft>) {
    setSteps(steps.map((s, i) => (i === index ? { ...s, ...update } : s)));
  }

  function updateStepConfig(index: number, patch: Record<string, unknown>) {
    const step = steps[index];
    if (!step) return;
    const validated = validateStepConfig(step.kind, step.config, t);
    if (validated.error) return;
    const next = { ...validated.config, ...patch };
    updateStep(index, { config: JSON.stringify(next, null, 2) });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-fg">{t("helix:workflowsPanel.title")}</h2>
          <p className="text-[11px] text-faint">{t("helix:workflowsPanel.description")}</p>
        </div>
        <Button size="sm" onClick={handleNew}>
          <Plus className="w-3.5 h-3.5 mr-1" />
          {t("helix:workflowsPanel.new")}
        </Button>
      </div>

      {showForm || editingId !== null ? (
        <div className="rounded-xl border border-line/60 bg-white/[0.02] p-4 space-y-4 shadow-sm">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="wf-name">{t("helix:workflowsPanel.name")}</Label>
              <Input
                id="wf-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("helix:workflowsPanel.namePlaceholder")}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="wf-description">{t("helix:workflowsPanel.descriptionLabel")}</Label>
              <Input
                id="wf-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("helix:workflowsPanel.descriptionPlaceholder")}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="wf-prompt">{t("helix:workflowsPanel.templatePrompt")}</Label>
            <Textarea
              id="wf-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={t("helix:workflowsPanel.templatePromptPlaceholder")}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label htmlFor="wf-mode">{t("helix:workflowsPanel.mode")}</Label>
              <select
                id="wf-mode"
                className={SELECT_CLASS}
                value={mode}
                onChange={(e) => setMode(e.target.value as "simple" | "workflow")}
              >
                <option value="simple">{t("helix:workflowsPanel.modeSimple")}</option>
                <option value="workflow">{t("helix:workflowsPanel.modeWorkflow")}</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="wf-max">{t("helix:workflowsPanel.maxSteps")}</Label>
              <Input
                id="wf-max"
                type="number"
                min={1}
                value={maxSteps}
                onChange={(e) => setMaxSteps(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="wf-approval">{t("helix:workflowsPanel.approval")}</Label>
              <select
                id="wf-approval"
                className={SELECT_CLASS}
                value={approvalThreshold}
                onChange={(e) => setApprovalThreshold(e.target.value)}
              >
                {approvalOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <p className="text-[9px] text-faint">
                {approvalOptions.find((o) => o.value === approvalThreshold)?.description}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="wf-tools">{t("helix:workflowsPanel.allowedTools")}</Label>
              <TagInput
                id="wf-tools"
                value={toolAllowlist}
                onChange={setToolAllowlist}
                suggestions={toolNames}
                placeholder={t("helix:workflowsPanel.allowedToolsPlaceholder")}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="wf-mcp">{t("helix:workflowsPanel.allowedMcps")}</Label>
              <TagInput
                id="wf-mcp"
                value={mcpAllowlist}
                onChange={setMcpAllowlist}
                suggestions={connectorNames}
                placeholder={t("helix:workflowsPanel.allowedMcpsPlaceholder")}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="wf-system">{t("helix:workflowsPanel.systemPrompt")}</Label>
            <Textarea
              id="wf-system"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder={t("helix:workflowsPanel.systemPromptPlaceholder")}
            />
          </div>

          <label
            htmlFor="wf-enabled"
            className="flex items-center gap-2 text-xs text-fg cursor-pointer select-none"
          >
            <input
              id="wf-enabled"
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="w-3.5 h-3.5 rounded accent-signal cursor-pointer"
            />
            {t("helix:workflowsPanel.enabled")}
          </label>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-fg">{t("helix:workflowsPanel.steps")}</span>
                <p className="text-[10px] text-faint">{t("helix:workflowsPanel.stepsDescription")}</p>
              </div>
              <Button size="sm" variant="secondary" onClick={addStep}>
                <Plus className="w-3.5 h-3.5 mr-1" />
                {t("helix:workflowsPanel.addStep")}
              </Button>
            </div>
            {steps.map((step, index) => {
              const validated = validateStepConfig(step.kind, step.config, t);
              const cfg = validated.config;
              const llmProvider = (cfg.provider as string) ?? "";
              const llmModel = (cfg.model as string) ?? "";

              return (
                <div key={step.id} className="rounded-xl border border-line/60 bg-bg p-3.5 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-faint shrink-0 w-5">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <Input
                      placeholder={t("helix:workflowsPanel.stepNamePlaceholder")}
                      value={step.name}
                      onChange={(e) => updateStep(index, { name: e.target.value })}
                      className="flex-1"
                    />
                    <select
                      className={SELECT_CLASS}
                      value={step.kind}
                      onChange={(e) =>
                        updateStep(index, {
                          kind: e.target.value as WorkflowStepKind,
                          config: defaultStep(e.target.value as WorkflowStepKind, t).config,
                        })
                      }
                    >
                      {KINDS.map((k) => (
                        <option key={k} value={k}>
                          {kindLabels[k] ?? k}
                        </option>
                      ))}
                    </select>
                    <div className="flex items-center gap-0.5">
                      <IconButton
                        title={t("helix:workflowsPanel.moveUp")}
                        onClick={() => moveStep(index, -1)}
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </IconButton>
                      <IconButton
                        title={t("helix:workflowsPanel.moveDown")}
                        onClick={() => moveStep(index, 1)}
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </IconButton>
                      <IconButton
                        title={t("helix:workflowsPanel.removeStep")}
                        onClick={() => removeStep(index)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </IconButton>
                    </div>
                  </div>

                  <p className="text-[10px] text-faint -mt-1 pl-7">{kindDescriptions[step.kind] ?? ""}</p>

                  {step.kind === "llm" && (
                    <div className="pl-7 space-y-3">
                      <ProviderModelSelect
                        provider={llmProvider}
                        model={llmModel}
                        onProviderChange={(v) => updateStepConfig(index, { provider: v || undefined })}
                        onModelChange={(v) => updateStepConfig(index, { model: v || undefined })}
                        providerId={`step-${step.id}-provider`}
                        modelId={`step-${step.id}-model`}
                      />
                      <div className="space-y-1">
                        <Label htmlFor={`step-${step.id}-prompt`}>{t("helix:workflowsPanel.prompt")}</Label>
                        <Input
                          id={`step-${step.id}-prompt`}
                          value={(cfg.prompt as string) ?? ""}
                          onChange={(e) => updateStepConfig(index, { prompt: e.target.value })}
                          placeholder="{{$prompt}}"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`step-${step.id}-temperature`}>
                          {t("helix:workflowsPanel.temperature")}
                        </Label>
                        <Input
                          id={`step-${step.id}-temperature`}
                          type="number"
                          step={0.1}
                          min={0}
                          max={2}
                          value={(cfg.temperature as number) ?? 0.3}
                          onChange={(e) => updateStepConfig(index, { temperature: Number(e.target.value) })}
                        />
                      </div>
                    </div>
                  )}

                  {step.kind === "tool" && (
                    <div className="pl-7 space-y-3">
                      <div className="space-y-1">
                        <Label htmlFor={`step-${step.id}-tool`}>{t("helix:workflowsPanel.tool")}</Label>
                        <Input
                          id={`step-${step.id}-tool`}
                          list={`step-${step.id}-tool-list`}
                          value={(cfg.toolName as string) ?? ""}
                          onChange={(e) => updateStepConfig(index, { toolName: e.target.value })}
                          placeholder="web.search"
                        />
                        <datalist id={`step-${step.id}-tool-list`}>
                          {toolNames.map((toolName) => (
                            <option key={toolName} value={toolName} />
                          ))}
                        </datalist>
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`step-${step.id}-args`}>{t("helix:workflowsPanel.args")}</Label>
                        <Textarea
                          id={`step-${step.id}-args`}
                          value={
                            typeof cfg.args === "string" ? cfg.args : JSON.stringify(cfg.args ?? {}, null, 2)
                          }
                          onChange={(e) => updateStepConfig(index, { args: e.target.value })}
                          className="font-mono text-xs"
                          placeholder="{}"
                        />
                      </div>
                    </div>
                  )}

                  {step.kind === "mcp" && (
                    <div className="pl-7 space-y-3">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <Label htmlFor={`step-${step.id}-server`}>
                            {t("helix:workflowsPanel.serverId")}
                          </Label>
                          <Input
                            id={`step-${step.id}-server`}
                            list={`step-${step.id}-server-list`}
                            value={(cfg.serverId as string) ?? ""}
                            onChange={(e) => updateStepConfig(index, { serverId: e.target.value })}
                            placeholder="playwright"
                          />
                          <datalist id={`step-${step.id}-server-list`}>
                            {connectorNames.map((connectorName) => (
                              <option key={connectorName} value={connectorName} />
                            ))}
                          </datalist>
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor={`step-${step.id}-mcp-tool`}>
                            {t("helix:workflowsPanel.toolName")}
                          </Label>
                          <Input
                            id={`step-${step.id}-mcp-tool`}
                            value={(cfg.toolName as string) ?? ""}
                            onChange={(e) => updateStepConfig(index, { toolName: e.target.value })}
                            placeholder="browse"
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`step-${step.id}-mcp-args`}>{t("helix:workflowsPanel.args")}</Label>
                        <Textarea
                          id={`step-${step.id}-mcp-args`}
                          value={
                            typeof cfg.args === "string" ? cfg.args : JSON.stringify(cfg.args ?? {}, null, 2)
                          }
                          onChange={(e) => updateStepConfig(index, { args: e.target.value })}
                          className="font-mono text-xs"
                          placeholder="{}"
                        />
                      </div>
                    </div>
                  )}

                  {step.kind === "skill" && (
                    <div className="pl-7 space-y-3">
                      <div className="space-y-1">
                        <Label htmlFor={`step-${step.id}-skill`}>{t("helix:workflowsPanel.kindSkill")}</Label>
                        <select
                          id={`step-${step.id}-skill`}
                          className={SELECT_CLASS}
                          value={(cfg.skillId as string) ?? ""}
                          onChange={(e) => updateStepConfig(index, { skillId: e.target.value })}
                        >
                          <option value="">{t("helix:workflowsPanel.selectSkill")}</option>
                          {p.skills.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`step-${step.id}-skill-prompt`}>
                          {t("helix:workflowsPanel.prompt")}
                        </Label>
                        <Input
                          id={`step-${step.id}-skill-prompt`}
                          value={(cfg.prompt as string) ?? ""}
                          onChange={(e) => updateStepConfig(index, { prompt: e.target.value })}
                          placeholder="{{$prompt}}"
                        />
                      </div>
                    </div>
                  )}

                  <details className="group pl-7">
                    <summary className="flex items-center gap-1.5 text-[10px] text-faint cursor-pointer list-none hover:text-mute transition-colors">
                      <ChevronDown className="w-3 h-3 transition-transform group-open:rotate-180" />
                      {t("helix:workflowsPanel.advancedConfig")}
                    </summary>
                    <Textarea
                      placeholder={t("helix:workflowsPanel.advancedConfigPlaceholder")}
                      value={step.config}
                      onChange={(e) => updateStep(index, { config: e.target.value })}
                      className="font-mono text-xs mt-2"
                    />
                    {validated.error ? <p className="text-[11px] text-bad mt-1">{validated.error}</p> : null}
                  </details>
                </div>
              );
            })}
          </div>

          {error ? <p className="rounded-md bg-bad/10 text-bad text-xs px-3 py-2">{error}</p> : null}

          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={resetForm}>
              <X className="w-3.5 h-3.5 mr-1" />
              {t("helix:workflowsPanel.cancel")}
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? t("helix:workflowsPanel.saving") : t("helix:workflowsPanel.save")}
            </Button>
          </div>
        </div>
      ) : null}

      <div className="space-y-2">
        {p.templates.map((template) => (
          <div
            key={template.id}
            className="rounded-xl border border-line/60 bg-white/[0.02] p-3.5 flex items-center justify-between hover:border-line hover:bg-white/[0.04] transition-colors"
          >
            <div className="space-y-1 min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-fg truncate">{template.name}</span>
                <span
                  className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${
                    template.enabled
                      ? "bg-good/10 text-good border border-good/20"
                      : "bg-faint/10 text-faint border border-faint/20"
                  }`}
                >
                  {template.enabled ? t("helix:workflowsPanel.active") : t("helix:workflowsPanel.inactive")}
                </span>
              </div>
              {template.description ? (
                <p className="text-[10px] text-faint truncate">{template.description}</p>
              ) : null}
              <div className="flex items-center gap-2 text-[9px] text-faint">
                <span className="rounded bg-white/[0.03] px-1.5 py-0.5 font-mono">{template.mode}</span>
                <span>
                  {template.maxSteps} {t("helix:workflowsPanel.maxStepsLabel")}
                </span>
                <span className="w-0.5 h-0.5 rounded-full bg-faint" />
                <span>
                  {template.steps.length} {t("helix:workflowsPanel.stepsLabel")}
                </span>
                {template.settings?.approvalThreshold && template.settings.approvalThreshold !== "all" ? (
                  <>
                    <span className="w-0.5 h-0.5 rounded-full bg-faint" />
                    <span>
                      {t("helix:workflowsPanel.approvalLabel")}: {template.settings.approvalThreshold}
                    </span>
                  </>
                ) : null}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0 ml-2">
              <Button size="sm" variant="secondary" onClick={() => startEdit(template)}>
                {t("helix:workflowsPanel.edit")}
              </Button>
              <IconButton
                title={t("helix:workflowsPanel.delete")}
                onClick={() => {
                  if (confirm(t("helix:workflowsPanel.confirmDelete", { name: template.name }))) {
                    p.onDelete(template.id);
                  }
                }}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </IconButton>
            </div>
          </div>
        ))}
        {p.templates.length === 0 ? (
          <div className="text-center py-8 rounded-xl border border-dashed border-line/60 bg-white/[0.01]">
            <p className="text-xs text-faint">{t("helix:workflowsPanel.noWorkflows")}</p>
            <p className="text-[10px] text-faint/60 mt-1">{t("helix:workflowsPanel.noWorkflowsHint")}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
