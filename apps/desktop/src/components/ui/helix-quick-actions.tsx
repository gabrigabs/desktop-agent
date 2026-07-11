import type { HelixContextSource } from "@desktop-agent/shared";
import { ChevronDown, Clipboard } from "lucide-react";
import type { ComponentType } from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

export interface QuickActionItem {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  accent: string;
  prompt: string;
  placeholder?: string;
  requiredContext?: HelixContextSource[];
  executionMode?: "simple" | "workflow";
}

interface HelixQuickActionsProps {
  actions: QuickActionItem[];
  disabled?: boolean;
  mode?: "normal" | "expanded";
  onAction: (action: QuickActionItem) => void;
}

const MAX_INLINE: Record<"normal" | "expanded", number> = {
  normal: 3,
  expanded: 4,
};

export function HelixQuickActions({ actions, disabled, mode = "normal", onAction }: HelixQuickActionsProps) {
  const { t } = useTranslation("helix");
  const [expanded, setExpanded] = useState(false);

  if (actions.length === 0) return null;

  const maxInline = MAX_INLINE[mode];
  const visible = expanded ? actions : actions.slice(0, maxInline);
  const hasOverflow = actions.length > maxInline;

  return (
    <div className="w-full flex flex-wrap items-center justify-center gap-1.5">
      {visible.map((action) => {
        const Icon = action.icon;
        return (
          <button
            key={action.id}
            type="button"
            onClick={() => onAction(action)}
            disabled={disabled}
            className="group flex h-7 items-center gap-1.5 rounded-full border border-white/[0.06] bg-white/[0.025] px-2.5 text-[11px] font-medium text-mute transition-all hover:border-signal/25 hover:bg-white/[0.06] hover:text-fg disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
            title={action.prompt}
          >
            <Icon className={`w-3 h-3 ${action.accent}`} />
            <span>{action.label}</span>
            {action.requiredContext?.includes("clipboard") && (
              <span className="flex items-center rounded-full bg-signal/10 px-1 py-0 text-[8px] font-semibold text-signal">
                <Clipboard className="w-2 h-2" />
              </span>
            )}
          </button>
        );
      })}
      {hasOverflow && (
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="flex h-7 items-center gap-1 rounded-full border border-white/[0.06] bg-white/[0.02] px-2.5 text-[10px] text-faint transition-colors hover:bg-white/[0.05] hover:text-mute"
        >
          <span>{expanded ? t("helix:quickActions.less") : t("helix:quickActions.more")}</span>
          <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </button>
      )}
    </div>
  );
}
