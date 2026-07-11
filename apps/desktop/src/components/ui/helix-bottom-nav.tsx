import { PanelBottomClose } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { HelixNavMode } from "./helix-navigation";
import { HELIX_NAV_GROUPS, NEW_TASK_ITEM, SETTINGS_ITEM } from "./helix-navigation";

interface HelixBottomNavProps {
  mode: HelixNavMode;
  onChangeMode: (mode: HelixNavMode) => void;
  onNewTask: () => void;
  onToggleExpand: () => void;
}

export function HelixBottomNav({ mode, onChangeMode, onNewTask, onToggleExpand }: HelixBottomNavProps) {
  const { t } = useTranslation("helix");
  const NewTaskIcon = NEW_TASK_ITEM.icon;
  const SettingsIcon = SETTINGS_ITEM.icon;

  const navItems = HELIX_NAV_GROUPS.flatMap((group) => group.items);

  return (
    <nav
      className="flex h-12 shrink-0 items-center gap-1 border-t border-line bg-ink/30 px-3"
      aria-label={t("helix:sidebar.mainNavigation")}
    >
      <button
        type="button"
        onClick={() => {
          onNewTask();
          onChangeMode("command");
        }}
        className={`flex h-8 items-center gap-2 rounded-lg border px-3 text-xs font-semibold transition-colors ${
          mode === "command"
            ? "border-signal/30 bg-signal/[0.1] text-signal"
            : "border-signal/20 bg-signal/[0.06] text-fg hover:border-signal/35 hover:bg-signal/[0.1]"
        }`}
      >
        <NewTaskIcon className="h-3.5 w-3.5" />
        <span>{t("helix:sidebar.newConversation")}</span>
      </button>

      <span className="mx-1 h-5 w-px bg-line" aria-hidden="true" />

      {navItems.map((item) => {
        const Icon = item.icon;
        const active = mode === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChangeMode(item.id)}
            className={`flex h-8 items-center gap-2 rounded-lg px-3 text-xs font-medium transition-colors ${
              active ? "bg-white/[0.08] text-fg" : "text-mute hover:bg-white/[0.04] hover:text-fg"
            }`}
            title={t(`helix:navigation.${item.id}Description` as const)}
          >
            <Icon className={`h-3.5 w-3.5 ${active ? "text-signal" : "text-faint"}`} />
            <span>{t(`helix:navigation.${item.id}` as const)}</span>
          </button>
        );
      })}

      <div className="ml-auto flex items-center gap-1">
        <button
          type="button"
          onClick={() => onChangeMode("settings")}
          className={`flex h-8 items-center gap-2 rounded-lg px-3 text-xs font-medium transition-colors ${
            mode === "settings" ? "bg-white/[0.08] text-fg" : "text-mute hover:bg-white/[0.04] hover:text-fg"
          }`}
        >
          <SettingsIcon className={`h-3.5 w-3.5 ${mode === "settings" ? "text-signal" : "text-faint"}`} />
          <span>{t("helix:navigation.settings")}</span>
        </button>
        <button
          type="button"
          onClick={onToggleExpand}
          className="flex h-8 items-center gap-2 rounded-lg px-3 text-[10px] text-faint transition-colors hover:bg-white/[0.04] hover:text-mute"
          title={t("helix:sidebar.backToQuickPanel")}
        >
          <PanelBottomClose className="h-3.5 w-3.5" />
          <span>{t("helix:sidebar.backToQuickPanel")}</span>
        </button>
      </div>
    </nav>
  );
}
