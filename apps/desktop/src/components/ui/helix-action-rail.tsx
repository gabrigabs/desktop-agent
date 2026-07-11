import { HELIX_ACTIONS, type HelixAction } from "@desktop-agent/shared";
import { useTranslation } from "react-i18next";
import { HELIX_ACTION_ICONS } from "./helix-action-icon";

interface HelixActionRailProps {
  onAction: (action: HelixAction) => void;
}

export function HelixActionRail({ onAction }: HelixActionRailProps) {
  const { t } = useTranslation("helix");

  return (
    <nav aria-label={t("helix:normalCommandView.primaryActions")}>
      <ul className="flex items-center justify-center gap-1">
        {HELIX_ACTIONS.map((action) => {
          const Icon = HELIX_ACTION_ICONS[action.icon];
          if (!Icon) return null;

          return (
            <li key={action.id} className="min-w-0">
              <button
                type="button"
                onClick={() => onAction(action)}
                className="group flex w-full min-w-0 flex-col items-center gap-1 rounded-xl px-1.5 py-2 transition-all active:scale-95"
                title={t(`helix:radialActions.${action.id}.description`)}
              >
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] transition-all duration-150 group-hover:-translate-y-0.5 group-hover:shadow-[0_0_18px_-2px_var(--glow)]"
                  style={{
                    color: action.color,
                    borderColor: `${action.color}2e`,
                    backgroundColor: `${action.color}0d`,
                    ["--glow" as string]: action.color,
                  }}
                >
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <span className="block w-full truncate text-center text-[9px] font-medium text-mute transition-colors group-hover:text-fg">
                  {t(`helix:radialActions.${action.id}.title`)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
