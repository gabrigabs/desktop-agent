import type { AgentProfile, PromptTemplate, SaveProfileInput } from "@desktop-agent/shared";
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
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { IconButton } from "../../components/ui/icon-button";
import { Input } from "../../components/ui/input";
import { Separator } from "../../components/ui/separator";
import { Textarea } from "../../components/ui/textarea";

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
  onSaveProfile: (input: SaveProfileInput) => void;
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
  const [profileIcon, setProfileIcon] = useState("Bot");
  const [profileTone, setProfileTone] = useState("");
  const [profileResponseStyle, setProfileResponseStyle] = useState("");
  const [profileConstraints, setProfileConstraints] = useState("");

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
    setProfileIcon("Bot");
    setProfileTone("");
    setProfileResponseStyle("");
    setProfileConstraints("");
    setShowAddProfile(false);
  }

  function handleSaveProfile() {
    if (!profileName.trim()) return;
    p.onSaveProfile({
      id: editingProfileId ?? undefined,
      name: profileName.trim(),
      systemPrompt: profilePrompt,
      description: profileDesc,
      icon: profileIcon,
      tone: profileTone,
      responseStyle: profileResponseStyle,
      constraints: profileConstraints,
    });
    resetProfileForm();
  }

  function startEditProfile(profile: AgentProfile) {
    setEditingProfileId(profile.id);
    setProfileName(profile.name);
    setProfilePrompt(profile.systemPrompt);
    setProfileDesc(profile.description);
    setProfileIcon(profile.icon || "Bot");
    setProfileTone(profile.tone);
    setProfileResponseStyle(profile.responseStyle);
    setProfileConstraints(profile.constraints);
    setShowAddProfile(true);
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-faint font-mono uppercase font-bold select-none">
            Perfis de agente
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              resetProfileForm();
              setShowAddProfile(!showAddProfile);
            }}
          >
            {showAddProfile ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
            {showAddProfile ? "Cancelar" : "Novo"}
          </Button>
        </div>

        {showAddProfile && (
          <div className="rounded-lg border border-signal/30 bg-signal/5 p-3 flex flex-col gap-2">
            <Input
              placeholder="Nome do perfil"
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
            />
            <Input
              placeholder="Descrição curta"
              value={profileDesc}
              onChange={(e) => setProfileDesc(e.target.value)}
            />
            <Textarea
              placeholder="System prompt (instruções de comportamento)"
              value={profilePrompt}
              onChange={(e) => setProfilePrompt(e.target.value)}
              rows={3}
            />
            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder="Tom (ex: técnico, amigável)"
                value={profileTone}
                onChange={(e) => setProfileTone(e.target.value)}
              />
              <Input
                placeholder="Estilo de resposta (ex: conciso, detalhado)"
                value={profileResponseStyle}
                onChange={(e) => setProfileResponseStyle(e.target.value)}
              />
            </div>
            <Textarea
              placeholder="Restrições (ex: máximo 3 parágrafos, sem jargão)"
              value={profileConstraints}
              onChange={(e) => setProfileConstraints(e.target.value)}
              rows={2}
            />
            <div className="flex items-center gap-1">
              {Object.keys(ICON_MAP).map((name) => {
                const Icon = ICON_MAP[name] ?? Bot;
                return (
                  <IconButton
                    key={name}
                    title={name}
                    active={profileIcon === name}
                    onClick={() => setProfileIcon(name)}
                    className="w-7 h-7"
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </IconButton>
                );
              })}
            </div>
            <Button variant="primary" size="sm" onClick={handleSaveProfile} disabled={!profileName.trim()}>
              <Check className="w-3.5 h-3.5" />
              {editingProfileId ? "Atualizar" : "Criar"}
            </Button>
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
                  <div className="flex items-center gap-2">
                    <div className="text-xs font-semibold text-fg">{profile.name}</div>
                    {isActive && <Badge variant="signal">Ativo</Badge>}
                  </div>
                  {profile.description && (
                    <div className="text-[10px] text-faint leading-relaxed mt-0.5">{profile.description}</div>
                  )}
                  {profile.systemPrompt && (
                    <div className="text-[10px] text-mute leading-relaxed mt-1 line-clamp-2 font-mono">
                      {profile.systemPrompt}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {profile.tone && <Badge variant="default">{profile.tone}</Badge>}
                    {profile.responseStyle && <Badge variant="default">{profile.responseStyle}</Badge>}
                    {profile.constraints && (
                      <Badge variant="default" className="max-w-[200px] truncate">
                        {profile.constraints}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant={isActive ? "primary" : "secondary"}
                    size="sm"
                    onClick={() => p.onSetActiveProfile(isActive ? null : profile.id)}
                  >
                    {isActive ? "Ativo" : "Usar"}
                  </Button>
                  <IconButton title="Editar perfil" onClick={() => startEditProfile(profile)}>
                    <PenLine className="w-3 h-3" />
                  </IconButton>
                  {profile.id !== "profile-default" && (
                    <IconButton
                      title="Excluir perfil"
                      onClick={() => p.onDeleteProfile(profile.id)}
                      className="hover:text-bad"
                    >
                      <Trash2 className="w-3 h-3" />
                    </IconButton>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <Separator />

      <section className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-faint font-mono uppercase font-bold select-none">
            Biblioteca de prompts
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              resetPromptForm();
              setShowAddPrompt(!showAddPrompt);
            }}
          >
            {showAddPrompt ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
            {showAddPrompt ? "Cancelar" : "Novo"}
          </Button>
        </div>

        {showAddPrompt && (
          <div className="rounded-lg border border-signal/30 bg-signal/5 p-3 flex flex-col gap-2">
            <Input
              placeholder="Título"
              value={promptTitle}
              onChange={(e) => setPromptTitle(e.target.value)}
            />
            <Textarea
              placeholder="Prompt (texto que será enviado ao agente)"
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              rows={3}
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
              <Button
                variant="primary"
                size="sm"
                onClick={handleSavePrompt}
                disabled={!promptTitle.trim() || !promptText.trim()}
                className="ml-auto"
              >
                <Check className="w-3.5 h-3.5" />
                {editingPromptId ? "Atualizar" : "Criar"}
              </Button>
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
                        <Badge variant={pr.executionMode === "workflow" ? "signal" : "default"}>
                          {pr.executionMode}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => p.onUsePrompt(pr.prompt, pr.executionMode)}
                      >
                        Usar
                      </Button>
                      <IconButton title="Editar prompt" onClick={() => startEditPrompt(pr)}>
                        <PenLine className="w-3 h-3" />
                      </IconButton>
                      <IconButton
                        title="Excluir prompt"
                        onClick={() => p.onDeletePrompt(pr.id)}
                        className="hover:text-bad"
                      >
                        <Trash2 className="w-3 h-3" />
                      </IconButton>
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
