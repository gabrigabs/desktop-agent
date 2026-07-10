import { Bot, Clock3, Layers3, MessageSquarePlus, Orbit, Settings2, Sparkles, Workflow } from "lucide-react";
import type { ComponentType } from "react";
import type { HelixMode } from "../../surfaces/helix/types";

export type HelixNavMode = HelixMode | "settings";

export type HelixNavItem = {
  id: HelixNavMode;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
};

export const HELIX_NAV_GROUPS: { label: string; items: HelixNavItem[] }[] = [
  {
    label: "Trabalho",
    items: [
      { id: "history", label: "Histórico", description: "Conversas e resultados", icon: Clock3 },
      { id: "artifacts", label: "Artefatos", description: "Assistentes especializados", icon: Orbit },
    ],
  },
  {
    label: "Construir",
    items: [
      { id: "prompts", label: "Perfis", description: "Estilos de resposta", icon: Sparkles },
      { id: "workflows", label: "Workflows", description: "Sequências de ações", icon: Workflow },
      { id: "skills", label: "Skills", description: "Capacidades isoladas", icon: Bot },
    ],
  },
  {
    label: "Fontes",
    items: [{ id: "connectors", label: "Conectores", description: "Serviços e permissões", icon: Layers3 }],
  },
];

export const NEW_TASK_ITEM: HelixNavItem = {
  id: "command",
  label: "Nova conversa",
  description: "Começar sem contexto anterior",
  icon: MessageSquarePlus,
};

export const SETTINGS_ITEM: HelixNavItem = {
  id: "settings",
  label: "Configurações",
  description: "Modelo, pet e privacidade",
  icon: Settings2,
};
