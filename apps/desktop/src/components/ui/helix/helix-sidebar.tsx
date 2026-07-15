import { useTranslation } from "react-i18next";
import { HELIX_NAV_GROUPS, type HelixNavMode, NEW_TASK_ITEM, SETTINGS_ITEM } from "./helix-navigation";

interface HelixSidebarProps {
  mode: HelixNavMode;
  onChangeMode: (mode: HelixNavMode) => void;
  onNewTask: () => void;
}

export function HelixSidebar({ mode, onChangeMode, onNewTask }: HelixSidebarProps) {
  const { t } = useTranslation("helix");
  const NewTaskIcon = NEW_TASK_ITEM.icon;
  const SettingsIcon = SETTINGS_ITEM.icon;

  return (
    <aside className="flex h-full w-[52px] shrink-0 flex-col items-center border-r border-line bg-ink/40 px-2 py-3">
      <button
        type="button"
        onClick={() => {
          onNewTask();
          onChangeMode("command");
        }}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-signal/[0.12] text-signal transition-colors duration-200 hover:bg-signal/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/40"
        title={t("helix:sidebar.newConversation")}
        aria-label={t("helix:sidebar.newConversation")}
      >
        <NewTaskIcon className="h-[18px] w-[18px] shrink-0" />
      </button>

      <nav
        className="mt-4 flex flex-1 flex-col items-center gap-1"
        aria-label={t("helix:sidebar.mainNavigation")}
      >
        {HELIX_NAV_GROUPS.map((group, groupIndex) => (
          <div key={group.labelKey} className="flex flex-col items-center gap-1">
            {groupIndex > 0 && (
              <div className="my-1.5 h-px w-5 bg-gradient-to-r from-transparent via-line to-transparent" />
            )}
            {group.items.map((item) => {
              const Icon = item.icon;
              const active = mode === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onChangeMode(item.id)}
                  className={`group relative flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/40 ${
                    active ? "bg-signal/[0.1]" : "hover:bg-white/[0.05]"
                  }`}
                  title={t(`helix:navigation.${item.id}Description` as const)}
                  aria-label={t(`helix:navigation.${item.id}` as const)}
                >
                  {active && (
                    <span className="absolute left-[-6px] top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-full bg-signal" />
                  )}
                  <Icon
                    className={`h-[15px] w-[15px] shrink-0 transition-colors ${active ? "text-signal" : "text-faint group-hover:text-mute"}`}
                  />
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="mt-auto flex flex-col items-center gap-1">
        <div className="mb-1.5 h-px w-5 bg-gradient-to-r from-transparent via-line to-transparent" />
        <button
          type="button"
          onClick={() => onChangeMode("settings")}
          className={`group relative flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/40 ${
            mode === "settings" ? "bg-signal/[0.1]" : "hover:bg-white/[0.05]"
          }`}
          title={t("helix:navigation.settings")}
          aria-label={t("helix:navigation.settings")}
        >
          {mode === "settings" && (
            <span className="absolute left-[-6px] top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-full bg-signal" />
          )}
          <SettingsIcon
            className={`h-[15px] w-[15px] shrink-0 transition-colors ${mode === "settings" ? "text-signal" : "text-faint group-hover:text-mute"}`}
          />
        </button>
      </div>
    </aside>
  );
}
