import { Clipboard, Globe, MessageCircle, Orbit, Scan, Workflow } from "lucide-react";
import type { ComponentType } from "react";

export const HELIX_ACTION_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  "message-circle": MessageCircle,
  clipboard: Clipboard,
  scan: Scan,
  globe: Globe,
  workflow: Workflow,
  orbit: Orbit,
};
