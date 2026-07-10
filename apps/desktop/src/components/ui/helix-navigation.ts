import { Bot, Clock3, Layers3, MessageSquarePlus, Orbit, Settings2, Sparkles, Workflow } from "lucide-react";
import type { ComponentType } from "react";
import type { HelixMode } from "../../surfaces/helix/types";

export type HelixNavMode = HelixMode | "settings";

export type HelixNavItem = {
  id: HelixNavMode;
  icon: ComponentType<{ className?: string }>;
};

export type HelixNavGroup = {
  labelKey: "work" | "build" | "sources";
  items: HelixNavItem[];
};

export const HELIX_NAV_GROUPS: HelixNavGroup[] = [
  {
    labelKey: "work",
    items: [
      { id: "history", icon: Clock3 },
      { id: "artifacts", icon: Orbit },
    ],
  },
  {
    labelKey: "build",
    items: [
      { id: "prompts", icon: Sparkles },
      { id: "workflows", icon: Workflow },
      { id: "skills", icon: Bot },
    ],
  },
  {
    labelKey: "sources",
    items: [{ id: "connectors", icon: Layers3 }],
  },
];

export const NEW_TASK_ITEM: HelixNavItem = {
  id: "command",
  icon: MessageSquarePlus,
};

export const SETTINGS_ITEM: HelixNavItem = {
  id: "settings",
  icon: Settings2,
};
