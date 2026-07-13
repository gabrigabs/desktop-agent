import { Clock3, FileText, FolderOpen, Layers3, MessageSquarePlus, Settings2 } from "lucide-react";
import type { ComponentType } from "react";
import type { HelixMode } from "../../surfaces/helix/types";

export type HelixNavMode = HelixMode | "settings";

export type HelixNavItem = {
  id: HelixNavMode;
  icon: ComponentType<{ className?: string }>;
};

export type HelixNavGroup = {
  labelKey: "work" | "sources";
  items: HelixNavItem[];
};

export const HELIX_NAV_GROUPS: HelixNavGroup[] = [
  {
    labelKey: "work",
    items: [
      { id: "history", icon: Clock3 },
      { id: "workspace", icon: FolderOpen },
    ],
  },
  {
    labelKey: "sources",
    items: [
      { id: "parser", icon: FileText },
      { id: "connectors", icon: Layers3 },
    ],
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
