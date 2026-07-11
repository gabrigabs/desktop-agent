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
      <ul className="grid grid-cols-6 gap-1 rounded-2xl border border-line bg-white/[0.018] p-1.5">
        {HELIX_ACTIONS.map((action) => {
          const Icon = HELIX_ACTION_ICONS[action.icon];
          if (!Icon) return null;

          return (
            <li key={action.id} className="min-w-0">
              <button
                type="button"
                onClick={() => onAction(action)}
                className="group flex w-full min-w-0 flex-col items-center gap-1.5 rounded-xl px-1 py-2 transition-colors hover:bg-white/[0.045]"
                title={t(`helix:radialActions.${action.id}.description`)}
              >
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-xl border transition-transform duration-150 group-hover:-translate-y-0.5"
                  style={{
                    color: action.color,
                    borderColor: `${action.color}2e`,
                    backgroundColor: `${action.color}0d`,
                  }}
                >
                  <Icon className="h-4 w-4" />
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
