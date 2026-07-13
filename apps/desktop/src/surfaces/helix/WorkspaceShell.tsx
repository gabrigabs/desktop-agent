import type { AgentProfile, Workspace } from "@desktop-agent/shared";
import { convertFileSrc } from "@tauri-apps/api/core";
import {
  Archive,
  ArrowLeft,
  Brain,
  Check,
  ChevronRight,
  Database,
  FileText,
  FolderOpen,
  Image as ImageIcon,
  MessageSquare,
  Plus,
  Settings2,
  SlidersHorizontal,
  Trash2,
  Unlink,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../../components/ui/button";
import type { useWorkspaces } from "./hooks/useWorkspaces";
import { WorkspaceMemoryPanel } from "./WorkspaceMemoryPanel";
import { WORKSPACE_COLORS, WORKSPACE_ICONS, WorkspaceIcon } from "./workspace-visuals";

type Props = {
  ws: ReturnType<typeof useWorkspaces>;
  onBack: () => void;
  onOpenChat: () => void;
  profiles: AgentProfile[];
};

type FormState = {
  name: string;
  folderPath: string;
  purpose: string;
  instructions: string;
  icon: string;
  preferredLayout: "chat" | "dashboard";
  profileId: string;
  color: string;
  memoryEnabled: boolean;
};

type DetailTab = "overview" | "memory" | "sources" | "settings";

const emptyForm: FormState = {
  name: "",
  folderPath: "",
  purpose: "",
  instructions: "",
  icon: "folder",
  preferredLayout: "chat",
  profileId: "",
  color: WORKSPACE_COLORS[0],
  memoryEnabled: true,
};

const inputClass =
  "w-full rounded-lg border border-line bg-ink/35 px-3 py-2.5 text-sm text-fg placeholder:text-faint outline-none transition-colors focus:border-signal/45 focus:bg-ink/55";

function useFolderPicker() {
  return useCallback(async (): Promise<string | null> => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({ directory: true, multiple: false });
      return typeof selected === "string" ? selected : null;
    } catch {
      return null;
    }
  }, []);
}

function FormField({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-faint">{label}</span>
      {children}
      {hint && <span className="text-[10px] leading-relaxed text-faint">{hint}</span>}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 rounded-lg border border-line px-3 py-2.5 text-left transition-colors hover:border-line-strong"
    >
      <span className="min-w-0">
        <span className="block text-xs font-medium text-fg">{label}</span>
        <span className="mt-0.5 block text-[10px] leading-relaxed text-faint">{description}</span>
      </span>
      <span
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${checked ? "bg-signal/70" : "bg-line"}`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-fg transition-transform ${checked ? "translate-x-4" : "translate-x-0.5"}`}
        />
      </span>
    </button>
  );
}

function AppearancePicker({
  form,
  update,
}: {
  form: FormState;
  update: (patch: Partial<FormState>) => void;
}) {
  const { t } = useTranslation("helix");
  return (
    <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_140px]">
      <FormField label={t("helix:workspace.iconLabel")}>
        <div className="grid grid-cols-7 gap-1.5">
          {Object.entries(WORKSPACE_ICONS).map(([icon, Icon]) => (
            <button
              key={icon}
              type="button"
              onClick={() => update({ icon })}
              className={`flex aspect-square items-center justify-center rounded-lg border transition-all ${
                form.icon === icon
                  ? "border-current bg-white/[0.08] shadow-sm"
                  : "border-line text-faint hover:border-line-strong hover:text-fg"
              }`}
              style={form.icon === icon ? { color: form.color, borderColor: `${form.color}80` } : undefined}
              aria-label={icon}
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
        </div>
      </FormField>
      <FormField label={t("helix:workspace.colorLabel")}>
        <div className="grid grid-cols-4 gap-1.5">
          {WORKSPACE_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => update({ color })}
              className={`aspect-square rounded-full border-2 transition-transform hover:scale-105 ${
                form.color === color ? "border-fg/80 ring-2 ring-white/10" : "border-transparent"
              }`}
              style={{ backgroundColor: color }}
              aria-label={color}
            >
              {form.color === color && <Check className="mx-auto h-3 w-3 text-white drop-shadow" />}
            </button>
          ))}
        </div>
        <input
          type="color"
          value={form.color}
          onChange={(event) => update({ color: event.target.value })}
          className="mt-2 h-7 w-full cursor-pointer rounded-lg border border-line bg-transparent p-0.5"
          aria-label={t("helix:workspace.customColor")}
        />
      </FormField>
    </div>
  );
}

function WorkspacePreview({ form }: { form: FormState }) {
  const { t } = useTranslation("helix");
  return (
    <div className="rounded-lg border border-line p-4">
      <div className="flex items-start gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-line"
          style={{ color: form.color }}
        >
          <WorkspaceIcon icon={form.icon} className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-fg">
            {form.name.trim() || t("helix:workspace.previewName")}
          </p>
          <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-mute">
            {form.purpose.trim() || t("helix:workspace.previewPurpose")}
          </p>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2 border-t border-line pt-3 text-[10px] text-faint">
        <Brain className="h-3 w-3" />
        {form.memoryEnabled ? t("helix:workspace.memoryActive") : t("helix:workspace.memoryDisabled")}
        <span className="ml-auto capitalize">{form.preferredLayout}</span>
      </div>
    </div>
  );
}

function WorkspaceEditor({
  form,
  update,
  profiles,
  onBrowse,
}: {
  form: FormState;
  update: (patch: Partial<FormState>) => void;
  profiles: AgentProfile[];
  onBrowse: () => void;
}) {
  const { t } = useTranslation("helix");
  return (
    <div className="grid gap-5">
      <section className="grid gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label={t("helix:workspace.nameLabel")}>
            <input
              className={inputClass}
              value={form.name}
              placeholder={t("helix:workspace.namePlaceholder")}
              onChange={(event) => update({ name: event.target.value })}
            />
          </FormField>
          <FormField label={t("helix:workspace.folderLabel")} hint={t("helix:workspace.folderOptionalHint")}>
            <div className="flex gap-2">
              <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-line bg-ink/35 px-3 focus-within:border-signal/45">
                <FolderOpen className="h-3.5 w-3.5 shrink-0 text-faint" />
                <input
                  className="min-w-0 flex-1 bg-transparent py-2.5 text-sm text-fg outline-none placeholder:text-faint"
                  value={form.folderPath}
                  placeholder={t("helix:workspace.folderPlaceholder")}
                  onChange={(event) => update({ folderPath: event.target.value })}
                />
              </div>
              <Button variant="secondary" size="sm" onClick={onBrowse} className="shrink-0">
                {t("helix:workspace.folderBrowse")}
              </Button>
            </div>
          </FormField>
        </div>
        <FormField label={t("helix:workspace.purposeLabel")}>
          <input
            className={inputClass}
            value={form.purpose}
            placeholder={t("helix:workspace.purposePlaceholder")}
            onChange={(event) => update({ purpose: event.target.value })}
          />
        </FormField>
      </section>

      <section className="grid gap-3 border-t border-line pt-5">
        <FormField
          label={t("helix:workspace.instructionsLabel")}
          hint={t("helix:workspace.instructionsHint")}
        >
          <textarea
            className={`${inputClass} min-h-28 resize-y leading-relaxed`}
            value={form.instructions}
            placeholder={t("helix:workspace.instructionsPlaceholder")}
            onChange={(event) => update({ instructions: event.target.value })}
          />
        </FormField>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label={t("helix:workspace.profileLabel")}>
            <select
              className={inputClass}
              value={form.profileId}
              onChange={(event) => update({ profileId: event.target.value })}
            >
              <option value="">{t("helix:workspace.defaultProfile")}</option>
              {profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label={t("helix:workspace.layoutLabel")}>
            <select
              className={inputClass}
              value={form.preferredLayout}
              onChange={(event) =>
                update({ preferredLayout: event.target.value as FormState["preferredLayout"] })
              }
            >
              <option value="chat">{t("helix:workspace.layoutChat")}</option>
              <option value="dashboard">{t("helix:workspace.layoutDashboard")}</option>
            </select>
          </FormField>
        </div>
        <Toggle
          checked={form.memoryEnabled}
          onChange={(memoryEnabled) => update({ memoryEnabled })}
          label={t("helix:workspace.memoryEnabled")}
          description={t("helix:workspace.memoryToggleHint")}
        />
      </section>

      <section className="grid gap-3 border-t border-line pt-5">
        <FormField label={t("helix:workspace.appearanceSection")}>
          <AppearancePicker form={form} update={update} />
        </FormField>
      </section>
    </div>
  );
}

export function WorkspaceShell({ ws, onBack, onOpenChat, profiles }: Props) {
  const { t } = useTranslation("helix");
  const [showCreate, setShowCreate] = useState(false);
  const [viewingWorkspaceId, setViewingWorkspaceId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [creating, setCreating] = useState(false);
  const pickFolder = useFolderPicker();
  const viewedWorkspace = ws.workspaces.find((workspace) => workspace.id === viewingWorkspaceId) ?? null;

  const updateForm = (patch: Partial<FormState>) => setForm((current) => ({ ...current, ...patch }));
  const closeCreate = () => {
    setShowCreate(false);
    setForm(emptyForm);
  };

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    setCreating(true);
    const id = await ws.createWorkspace({
      name: form.name.trim(),
      folderPath: form.folderPath.trim(),
      purpose: form.purpose.trim(),
      instructions: form.instructions.trim(),
      icon: form.icon,
      preferredLayout: form.preferredLayout,
      profileId: form.profileId || undefined,
      color: form.color,
    });
    setCreating(false);
    if (!id) return;
    await ws.selectWorkspace(id);
    closeCreate();
    setViewingWorkspaceId(id);
  };

  const handleOpenWorkspace = async (id: string) => {
    await ws.selectWorkspace(id);
    setViewingWorkspaceId(id);
  };

  if (viewedWorkspace) {
    return (
      <WorkspaceDetail
        ws={ws}
        workspace={viewedWorkspace}
        profiles={profiles}
        onBack={() => setViewingWorkspaceId(null)}
        onExit={onBack}
        onOpenChat={onOpenChat}
      />
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl helix-view-enter">
      <header className="mb-6 flex items-end justify-between gap-4 border-b border-line pb-5">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[9px] font-medium uppercase tracking-[0.16em] text-faint">
            <Database className="h-3 w-3 text-signal" />
            {t("helix:workspace.libraryEyebrow")}
          </div>
          <h2 className="text-xl font-semibold tracking-tight text-fg">{t("helix:workspace.title")}</h2>
          <p className="mt-1 max-w-xl text-xs leading-relaxed text-mute">{t("helix:workspace.subtitle")}</p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setShowCreate(true)} className="shrink-0 gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          {t("helix:workspace.new")}
        </Button>
      </header>

      {showCreate && (
        <div className="mb-6 overflow-hidden rounded-lg border border-line helix-view-enter">
          <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
            <div>
              <h3 className="text-sm font-semibold text-fg">{t("helix:workspace.createTitle")}</h3>
              <p className="mt-0.5 text-[10px] text-faint">{t("helix:workspace.createSubtitle")}</p>
            </div>
            <button
              type="button"
              onClick={closeCreate}
              className="rounded-lg p-1.5 text-faint transition-colors hover:bg-white/[0.05] hover:text-fg"
              aria-label={t("helix:workspace.cancel")}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_230px]">
            <WorkspaceEditor
              form={form}
              update={updateForm}
              profiles={profiles}
              onBrowse={async () => {
                const path = await pickFolder();
                if (path) updateForm({ folderPath: path });
              }}
            />
            <aside className="lg:sticky lg:top-0 lg:self-start">
              <span className="mb-2 block text-[9px] font-medium uppercase tracking-[0.12em] text-faint">
                {t("helix:workspace.livePreview")}
              </span>
              <WorkspacePreview form={form} />
              <div className="mt-4 grid gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleCreate}
                  disabled={!form.name.trim() || creating}
                >
                  {creating ? t("helix:workspace.creating") : t("helix:workspace.create")}
                </Button>
                <Button variant="ghost" size="sm" onClick={closeCreate}>
                  {t("helix:workspace.cancel")}
                </Button>
              </div>
            </aside>
          </div>
        </div>
      )}

      {ws.workspaces.length === 0 && !showCreate ? (
        <div className="flex flex-col items-center justify-center border border-dashed border-line py-24 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg border border-line">
            <FolderOpen className="h-5 w-5 text-signal" />
          </div>
          <p className="text-sm font-medium text-fg">{t("helix:workspace.empty")}</p>
          <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-faint">
            {t("helix:workspace.emptyHint")}
          </p>
          <Button variant="secondary" size="sm" onClick={() => setShowCreate(true)} className="mt-4 gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            {t("helix:workspace.new")}
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-line">
          {ws.workspaces.map((workspace, index) => {
            const active = workspace.id === ws.activeWorkspaceId;
            return (
              <button
                key={workspace.id}
                type="button"
                onClick={() => void handleOpenWorkspace(workspace.id)}
                className="group relative grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-line px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-white/[0.02] md:grid-cols-[minmax(0,1fr)_minmax(140px,0.6fr)_auto] helix-view-enter"
                style={{ animationDelay: `${index * 35}ms` }}
              >
                {active && (
                  <span
                    className="absolute inset-y-0 left-0 w-0.5"
                    style={{ backgroundColor: workspace.color }}
                  />
                )}
                <div className="flex items-start gap-3">
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line"
                    style={{ color: workspace.color }}
                  >
                    <WorkspaceIcon icon={workspace.icon} className="h-4.5 w-4.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-sm font-semibold text-fg">{workspace.name}</h3>
                      {active && (
                        <span
                          className="rounded-full px-1.5 py-0.5 text-[8px] font-medium uppercase tracking-wider"
                          style={{ color: workspace.color, backgroundColor: `${workspace.color}18` }}
                        >
                          {t("helix:workspace.activeBadge")}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-[11px] text-mute">
                      {workspace.purpose || t("helix:workspace.noPurpose")}
                    </p>
                  </div>
                </div>
                <div className="hidden min-w-0 gap-1 text-[10px] text-faint md:grid">
                  <span className="flex items-center gap-1.5 truncate">
                    <FolderOpen className="h-3 w-3" />
                    {workspace.folderPath || t("helix:workspace.noFolder")}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Brain className="h-3 w-3" />
                    {workspace.memoryEnabled
                      ? t("helix:workspace.memoryEnabled")
                      : t("helix:workspace.memoryDisabled")}
                  </span>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-mute" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function WorkspaceDetail({
  ws,
  workspace,
  profiles,
  onBack,
  onExit,
  onOpenChat,
}: {
  ws: Props["ws"];
  workspace: Workspace;
  profiles: AgentProfile[];
  onBack: () => void;
  onExit: () => void;
  onOpenChat: () => void;
}) {
  const { t } = useTranslation("helix");
  const [tab, setTab] = useState<DetailTab>("overview");
  const [form, setForm] = useState<FormState>({
    name: workspace.name,
    folderPath: workspace.folderPath,
    purpose: workspace.purpose,
    instructions: workspace.instructions,
    icon: workspace.icon,
    preferredLayout: workspace.preferredLayout,
    profileId: workspace.profileId ?? "",
    color: workspace.color,
    memoryEnabled: workspace.memoryEnabled,
  });
  const [saving, setSaving] = useState(false);
  const pickFolder = useFolderPicker();
  const profile = profiles.find((item) => item.id === workspace.profileId);
  const activeFacts = ws.memoryFacts.filter((fact) => fact.status === "active");
  const tabs: Array<{ id: DetailTab; label: string; icon: typeof Brain; count?: number }> = [
    { id: "overview", label: t("helix:workspace.overviewTab"), icon: SlidersHorizontal },
    { id: "memory", label: t("helix:workspace.memory"), icon: Brain, count: activeFacts.length },
    { id: "sources", label: t("helix:workspace.sources"), icon: FileText, count: ws.documents.length },
    { id: "settings", label: t("helix:workspace.settingsTab"), icon: Settings2 },
  ];

  const update = (patch: Partial<FormState>) => setForm((current) => ({ ...current, ...patch }));
  const handleSave = async () => {
    setSaving(true);
    await ws.updateWorkspace(workspace.id, {
      name: form.name.trim() || workspace.name,
      purpose: form.purpose.trim(),
      instructions: form.instructions.trim(),
      icon: form.icon,
      folderPath: form.folderPath.trim(),
      preferredLayout: form.preferredLayout,
      profileId: form.profileId || null,
      memoryEnabled: form.memoryEnabled,
      color: form.color,
    });
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!confirm(t("helix:workspace.deleteConfirm", { name: workspace.name }))) return;
    await ws.deleteWorkspace(workspace.id);
    onExit();
  };
  const handleArchive = async () => {
    if (!confirm(t("helix:workspace.archiveConfirm"))) return;
    await ws.archiveWorkspace(workspace.id);
    onExit();
  };

  return (
    <div className="mx-auto w-full max-w-5xl helix-view-enter">
      <button
        type="button"
        onClick={onBack}
        className="mb-4 flex items-center gap-1.5 text-xs text-faint transition-colors hover:text-fg"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {t("helix:workspace.allSpaces")}
      </button>
      <header className="border-y border-line py-5">
        <div className="flex flex-wrap items-start gap-4">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-line"
            style={{ color: workspace.color }}
          >
            <WorkspaceIcon icon={workspace.icon} className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-xl font-semibold tracking-tight text-fg">{workspace.name}</h2>
              <span
                className="rounded-full px-2 py-0.5 text-[8px] font-medium uppercase tracking-[0.12em]"
                style={{ color: workspace.color, backgroundColor: `${workspace.color}18` }}
              >
                {t("helix:workspace.activeBadge")}
              </span>
            </div>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-mute">
              {workspace.purpose || t("helix:workspace.noPurpose")}
            </p>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-faint">
              <span className="flex items-center gap-1.5">
                <FolderOpen className="h-3 w-3" />
                {workspace.folderPath || t("helix:workspace.noFolder")}
              </span>
              <span className="flex items-center gap-1.5">
                <Brain className="h-3 w-3" />
                {t("helix:workspace.factsCount", { count: activeFacts.length })}
              </span>
              <span className="flex items-center gap-1.5">
                <FileText className="h-3 w-3" />
                {t("helix:workspace.sourcesCount", { count: ws.documents.length })}
              </span>
            </div>
          </div>
          <Button variant="primary" size="sm" onClick={onOpenChat} className="gap-1.5">
            <MessageSquare className="h-3.5 w-3.5" />
            {t("helix:workspace.openChat")}
          </Button>
        </div>
      </header>

      <nav className="mt-4 flex gap-5 overflow-x-auto border-b border-line">
        {tabs.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`flex min-w-max items-center gap-1.5 border-b-2 px-0.5 py-2 text-[11px] font-medium transition-colors ${tab === item.id ? "border-signal text-fg" : "border-transparent text-faint hover:text-mute"}`}
            >
              <Icon className="h-3.5 w-3.5" />
              {item.label}
              {item.count !== undefined && (
                <span className="rounded-full bg-white/[0.05] px-1.5 py-0.5 text-[9px]">{item.count}</span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="mt-4">
        {tab === "overview" && (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(260px,0.65fr)]">
            <section className="border-b border-line pb-5 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-5">
              <h3 className="text-sm font-semibold text-fg">{t("helix:workspace.instructionsLabel")}</h3>
              <p className="mt-3 whitespace-pre-wrap text-xs leading-6 text-mute">
                {workspace.instructions || t("helix:workspace.noInstructions")}
              </p>
            </section>
            <div className="grid gap-4">
              <section className="border-b border-line pb-4">
                <span className="text-[9px] uppercase tracking-[0.12em] text-faint">
                  {t("helix:workspace.profileLabel")}
                </span>
                <p className="mt-2 text-sm font-medium text-fg">
                  {profile?.name ?? t("helix:workspace.defaultProfile")}
                </p>
              </section>
              <section className="pt-1">
                <span className="text-[9px] uppercase tracking-[0.12em] text-faint">
                  {t("helix:workspace.contextSummary")}
                </span>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Metric value={activeFacts.length} label={t("helix:workspace.memory")} />
                  <Metric value={ws.documents.length} label={t("helix:workspace.sources")} />
                </div>
              </section>
            </div>
          </div>
        )}
        {tab === "memory" && (
          <WorkspaceMemoryPanel
            workspaceId={workspace.id}
            memoryEnabled={workspace.memoryEnabled}
            facts={ws.memoryFacts}
            onAdd={ws.addMemoryFact}
            onAddFiles={ws.addFilesAsMemory}
            onUpdate={ws.updateMemoryFact}
            onDelete={ws.deleteMemoryFact}
          />
        )}
        {tab === "sources" && <WorkspaceSources workspace={workspace} ws={ws} />}
        {tab === "settings" && (
          <div className="grid gap-4">
            <section className="border-b border-line pb-5">
              <WorkspaceEditor
                form={form}
                update={update}
                profiles={profiles}
                onBrowse={async () => {
                  const path = await pickFolder();
                  if (path) update({ folderPath: path });
                }}
              />
              <div className="mt-5 flex justify-end">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSave}
                  disabled={saving || !form.name.trim()}
                >
                  {saving ? t("helix:workspace.saving") : t("helix:workspace.saveChanges")}
                </Button>
              </div>
            </section>
            <section className="border-l-2 border-bad/35 py-2 pl-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-fg">{t("helix:workspace.dangerZone")}</h3>
                  <p className="mt-1 text-xs text-faint">{t("helix:workspace.deleteHint")}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={handleArchive} className="gap-1.5">
                    <Archive className="h-3.5 w-3.5" />
                    {t("helix:workspace.archive")}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDelete}
                    className="gap-1.5 text-bad hover:text-bad"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {t("helix:workspace.delete")}
                  </Button>
                </div>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

function Metric({ value, label }: { value: number; label: string }) {
  return (
    <div className="border-l border-line pl-3">
      <strong className="block text-lg font-semibold text-fg">{value}</strong>
      <span className="text-[9px] uppercase tracking-[0.1em] text-faint">{label}</span>
    </div>
  );
}

function WorkspaceSources({ workspace, ws }: { workspace: Workspace; ws: Props["ws"] }) {
  const { t } = useTranslation("helix");
  const available = useMemo(
    () =>
      ws.availableDocuments.filter(
        (document) => document.status === "done" && !ws.documents.some((item) => item.id === document.id),
      ),
    [ws.availableDocuments, ws.documents],
  );
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showDropdown) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showDropdown]);

  return (
    <section className="pb-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-fg">{t("helix:workspace.sources")}</h3>
          <p className="mt-1 text-xs leading-relaxed text-faint">{t("helix:workspace.sourcesHint")}</p>
        </div>
        {available.length > 0 && (
          <div className="relative" ref={dropdownRef}>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowDropdown((v) => !v)}
              className="gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              {t("helix:workspace.attachSource")}
              <ChevronRight className={`h-3 w-3 transition-transform ${showDropdown ? "rotate-90" : ""}`} />
            </Button>
            {showDropdown && (
              <div className="absolute right-0 top-full z-20 mt-1.5 max-h-64 w-64 overflow-y-auto rounded-lg border border-line bg-ink/95 p-1 shadow-xl backdrop-blur-md helix-view-enter">
                {available.map((document) => (
                  <button
                    key={document.id}
                    type="button"
                    onClick={() => {
                      void ws.attachDocument(workspace.id, document.id);
                      setShowDropdown(false);
                    }}
                    className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-white/[0.05]"
                  >
                    {document.parsedFormat === "image" ? (
                      <img
                        src={convertFileSrc(document.path)}
                        alt=""
                        className="h-8 w-8 shrink-0 rounded-md border border-line object-cover"
                      />
                    ) : (
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-line text-faint">
                        {document.mimeType.startsWith("image/") ? (
                          <ImageIcon className="h-3.5 w-3.5" />
                        ) : (
                          <FileText className="h-3.5 w-3.5" />
                        )}
                      </div>
                    )}
                    <span className="min-w-0 flex-1 truncate text-xs text-fg">{document.displayName}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      {ws.documents.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-line py-14 text-center">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg border border-line">
            <FileText className="h-4 w-4 text-faint" />
          </div>
          <p className="text-xs font-medium text-mute">{t("helix:workspace.noSources")}</p>
          {available.length > 0 && (
            <p className="mt-1 text-[10px] text-faint">{t("helix:workspace.sourcesHint")}</p>
          )}
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {ws.documents.map((document) => (
            <article
              key={document.id}
              className="group flex min-w-0 items-center gap-3 rounded-lg border border-line p-3 transition-colors hover:border-line-strong"
            >
              {document.parsedFormat === "image" ? (
                <img
                  src={convertFileSrc(document.path)}
                  alt=""
                  className="h-10 w-10 shrink-0 rounded-lg border border-line object-cover"
                />
              ) : (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-line text-faint">
                  {document.mimeType.startsWith("image/") ? (
                    <ImageIcon className="h-4 w-4" />
                  ) : (
                    <FileText className="h-4 w-4" />
                  )}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-fg">{document.displayName}</p>
                <p className="mt-0.5 truncate text-[9px] uppercase tracking-wider text-faint">
                  {document.parsedFormat ?? document.mimeType}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void ws.detachDocument(workspace.id, document.id)}
                className="rounded-lg p-1.5 text-faint opacity-0 transition-all hover:bg-white/[0.05] hover:text-bad group-hover:opacity-100"
                title={t("helix:workspace.detachSource")}
              >
                <Unlink className="h-3.5 w-3.5" />
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
