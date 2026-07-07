import type { AgentProfile, PromptTemplate } from "@desktop-agent/shared";
import {
  Bot,
  Bug,
  Check,
  Code,
  FileText,
  Layers,
  MessageSquare,
  PenLine,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useState } from "react";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Bug,
  Code,
  FileText,
  Layers,
  MessageSquare,
  PenLine,
  Search,
  Sparkles,
  Bot,
};

type Props = {
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
  onSaveProfile: (input: {
    id?: string;
    name: string;
    systemPrompt?: string;
    description?: string;
    icon?: string;
  }) => void;
  onDeleteProfile: (id: string) => void;
  onSetActiveProfile: (profileId: string | null) => void;
  onUsePrompt: (prompt: string, executionMode?: "simple" | "workflow") => void;
};

export function PromptsPanel(p: Props) {
  const [showAddPrompt, setShowAddPrompt] = useState(false);
  const [editingPromptId, setEditingPromptId] = useState<string | null>(null);
  const [promptTitle, setPromptTitle] = useState("");
  const [promptText, setPromptText] = useState("");
  const [promptCategory, setPromptCategory] = useState("general");
  const [promptMode, setPromptMode] = useState<"simple" | "workflow">("simple");

  const [showAddProfile, setShowAddProfile] = useState(false);
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [profileName, setProfileName] = useState("");
  const [profilePrompt, setProfilePrompt] = useState("");
  const [profileDesc, setProfileDesc] = useState("");

  const categories = Array.from(new Set(p.prompts.map((pr) => pr.category))).sort();

  function resetPromptForm() {
    setEditingPromptId(null);
    setPromptTitle("");
    setPromptText("");
    setPromptCategory("general");
    setPromptMode("simple");
    setShowAddPrompt(false);
  }

  function handleSavePrompt() {
    if (!promptTitle.trim() || !promptText.trim()) return;
    p.onSavePrompt({
      id: editingPromptId ?? undefined,
      title: promptTitle.trim(),
      prompt: promptText.trim(),
      category: promptCategory,
      executionMode: promptMode,
    });
    resetPromptForm();
  }

  function startEditPrompt(pr: PromptTemplate) {
    setEditingPromptId(pr.id);
    setPromptTitle(pr.title);
    setPromptText(pr.prompt);
    setPromptCategory(pr.category);
    setPromptMode(pr.executionMode);
    setShowAddPrompt(true);
  }

  function resetProfileForm() {
    setEditingProfileId(null);
    setProfileName("");
    setProfilePrompt("");
    setProfileDesc("");
    setShowAddProfile(false);
  }

  function handleSaveProfile() {
    if (!profileName.trim()) return;
    p.onSaveProfile({
      id: editingProfileId ?? undefined,
      name: profileName.trim(),
      systemPrompt: profilePrompt,
      description: profileDesc,
    });
    resetProfileForm();
  }

  function startEditProfile(profile: AgentProfile) {
    setEditingProfileId(profile.id);
    setProfileName(profile.name);
    setProfilePrompt(profile.systemPrompt);
    setProfileDesc(profile.description);
    setShowAddProfile(true);
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-faint font-mono uppercase font-bold select-none">
            Perfis de agente
          </span>
          <button
            type="button"
            onClick={() => {
              resetProfileForm();
              setShowAddProfile(!showAddProfile);
            }}
            className="h-6 px-2 rounded-md border border-line text-[10px] font-semibold text-mute hover:text-fg transition-colors cursor-pointer flex items-center gap-1"
          >
            {showAddProfile ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
            {showAddProfile ? "Cancelar" : "Novo"}
          </button>
        </div>

        {showAddProfile && (
          <div className="rounded-lg border border-signal/30 bg-signal/5 p-3 flex flex-col gap-2">
            <input
              type="text"
              placeholder="Nome do perfil"
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              className="h-8 rounded-md bg-white/[0.04] border border-line px-2.5 text-xs text-fg placeholder:text-faint focus:outline-none focus:border-signal/40"
            />
            <input
              type="text"
              placeholder="Descrição curta"
              value={profileDesc}
              onChange={(e) => setProfileDesc(e.target.value)}
              className="h-8 rounded-md bg-white/[0.04] border border-line px-2.5 text-xs text-fg placeholder:text-faint focus:outline-none focus:border-signal/40"
            />
            <textarea
              placeholder="System prompt (instruções de comportamento)"
              value={profilePrompt}
              onChange={(e) => setProfilePrompt(e.target.value)}
              rows={3}
              className="rounded-md bg-white/[0.04] border border-line px-2.5 py-2 text-xs text-fg placeholder:text-faint focus:outline-none focus:border-signal/40 resize-none"
            />
            <button
              type="button"
              onClick={handleSaveProfile}
              disabled={!profileName.trim()}
              className="h-8 rounded-md bg-signal text-ink text-[11px] font-bold hover:brightness-110 transition-colors cursor-pointer disabled:opacity-40 flex items-center justify-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              {editingProfileId ? "Atualizar" : "Criar"}
            </button>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          {p.profiles.map((profile) => {
            const Icon = ICON_MAP[profile.icon] ?? Bot;
            const isActive = p.activeProfileId === profile.id;
            return (
              <div
                key={profile.id}
                className={`rounded-lg border p-2.5 flex items-start gap-2.5 transition-colors ${
                  isActive ? "border-signal/40 bg-signal/8" : "border-line bg-white/[0.02]"
                }`}
              >
                <Icon className="w-4 h-4 text-mute shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-fg">{profile.name}</div>
                  {profile.description && (
                    <div className="text-[10px] text-faint leading-relaxed mt-0.5">{profile.description}</div>
                  )}
                  {profile.systemPrompt && (
                    <div className="text-[10px] text-mute leading-relaxed mt-1 line-clamp-2 font-mono">
                      {profile.systemPrompt}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => p.onSetActiveProfile(isActive ? null : profile.id)}
                    className={`h-6 px-2 rounded text-[10px] font-semibold transition-colors cursor-pointer ${
                      isActive
                        ? "bg-signal/20 text-signal"
                        : "border border-line text-mute hover:text-fg"
                    }`}
                  >
                    {isActive ? "Ativo" : "Usar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => startEditProfile(profile)}
                    className="h-6 w-6 rounded flex items-center justify-center text-faint hover:text-fg hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    <PenLine className="w-3 h-3" />
                  </button>
                  {profile.id !== "profile-default" && (
                    <button
                      type="button"
                      onClick={() => p.onDeleteProfile(profile.id)}
                      className="h-6 w-6 rounded flex items-center justify-center text-faint hover:text-bad hover:bg-bad/5 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <hr className="border-line" />

      <section className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-faint font-mono uppercase font-bold select-none">
            Biblioteca de prompts
          </span>
          <button
            type="button"
            onClick={() => {
              resetPromptForm();
              setShowAddPrompt(!showAddPrompt);
            }}
            className="h-6 px-2 rounded-md border border-line text-[10px] font-semibold text-mute hover:text-fg transition-colors cursor-pointer flex items-center gap-1"
          >
            {showAddPrompt ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
            {showAddPrompt ? "Cancelar" : "Novo"}
          </button>
        </div>

        {showAddPrompt && (
          <div className="rounded-lg border border-signal/30 bg-signal/5 p-3 flex flex-col gap-2">
            <input
              type="text"
              placeholder="Título"
              value={promptTitle}
              onChange={(e) => setPromptTitle(e.target.value)}
              className="h-8 rounded-md bg-white/[0.04] border border-line px-2.5 text-xs text-fg placeholder:text-faint focus:outline-none focus:border-signal/40"
            />
            <textarea
              placeholder="Prompt (texto que será enviado ao agente)"
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              rows={3}
              className="rounded-md bg-white/[0.04] border border-line px-2.5 py-2 text-xs text-fg placeholder:text-faint focus:outline-none focus:border-signal/40 resize-none"
            />
            <div className="flex items-center gap-2">
              <select
                value={promptCategory}
                onChange={(e) => setPromptCategory(e.target.value)}
                className="h-8 rounded-md bg-white/[0.04] border border-line px-2 text-xs text-fg focus:outline-none focus:border-signal/40 cursor-pointer"
              >
                <option value="general">Geral</option>
                <option value="dev">Dev</option>
                <option value="work">Trabalho</option>
                <option value="learn">Aprender</option>
              </select>
              <select
                value={promptMode}
                onChange={(e) => setPromptMode(e.target.value as "simple" | "workflow")}
                className="h-8 rounded-md bg-white/[0.04] border border-line px-2 text-xs text-fg focus:outline-none focus:border-signal/40 cursor-pointer"
              >
                <option value="simple">Simples</option>
                <option value="workflow">Workflow</option>
              </select>
              <button
                type="button"
                onClick={handleSavePrompt}
                disabled={!promptTitle.trim() || !promptText.trim()}
                className="ml-auto h-8 px-3 rounded-md bg-signal text-ink text-[11px] font-bold hover:brightness-110 transition-colors cursor-pointer disabled:opacity-40 flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                {editingPromptId ? "Atualizar" : "Criar"}
              </button>
            </div>
          </div>
        )}

        {categories.map((cat) => {
          const catPrompts = p.prompts.filter((pr) => pr.category === cat);
          if (catPrompts.length === 0) return null;
          return (
            <div key={cat} className="flex flex-col gap-1.5">
              <div className="text-[9px] text-faint uppercase font-bold tracking-wider">{cat}</div>
              {catPrompts.map((pr) => {
                const Icon = ICON_MAP[pr.icon] ?? Sparkles;
                return (
                  <div
                    key={pr.id}
                    className="rounded-lg border border-line bg-white/[0.02] p-2.5 flex items-start gap-2.5 group hover:border-signal/20 transition-colors"
                  >
                    <Icon className="w-4 h-4 text-mute shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-fg">{pr.title}</div>
                      <div className="text-[10px] text-faint leading-relaxed mt-0.5 line-clamp-2">
                        {pr.prompt}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-[8px] font-mono uppercase text-faint bg-white/[0.04] px-1.5 py-0.5 rounded">
                          {pr.executionMode}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => p.onUsePrompt(pr.prompt, pr.executionMode)}
                        className="h-6 px-2 rounded text-[10px] font-semibold bg-signal/15 text-signal hover:bg-signal/25 transition-colors cursor-pointer"
                      >
                        Usar
                      </button>
                      <button
                        type="button"
                        onClick={() => startEditPrompt(pr)}
                        className="h-6 w-6 rounded flex items-center justify-center text-faint hover:text-fg hover:bg-white/5 transition-colors cursor-pointer"
                      >
                        <PenLine className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => p.onDeletePrompt(pr.id)}
                        className="h-6 w-6 rounded flex items-center justify-center text-faint hover:text-bad hover:bg-bad/5 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </section>
    </div>
  );
}
