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
    <aside className="flex h-full w-[52px] shrink-0 flex-col items-center border-r border-line bg-ink/30 px-1.5 py-2">
      <button
        type="button"
        onClick={() => {
          onNewTask();
          onChangeMode("command");
        }}
        className="flex h-9 w-9 items-center justify-center rounded-xl border border-signal/25 bg-signal/[0.08] text-signal transition-colors hover:bg-signal/[0.14] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/50"
        title={t("helix:sidebar.newConversation")}
        aria-label={t("helix:sidebar.newConversation")}
      >
        <NewTaskIcon className="h-4 w-4 shrink-0 text-signal" />
      </button>

      <nav className="mt-3 grid gap-1" aria-label={t("helix:sidebar.mainNavigation")}>
        {HELIX_NAV_GROUPS.map((group) => (
          <section key={group.labelKey}>
            <div className="grid gap-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = mode === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onChangeMode(item.id)}
                    className={`group flex h-9 w-9 items-center justify-center rounded-lg border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/50 ${
                      active
                        ? "border-signal/25 bg-signal/[0.1] text-signal"
                        : "border-transparent text-faint hover:bg-white/[0.045] hover:text-fg"
                    }`}
                    title={t(`helix:navigation.${item.id}Description` as const)}
                    aria-label={t(`helix:navigation.${item.id}` as const)}
                  >
                    <Icon
                      className={`h-4 w-4 shrink-0 ${active ? "text-signal" : "text-faint group-hover:text-mute"}`}
                    />
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </nav>

      <div className="mt-auto grid gap-1 border-t border-line pt-2">
        <button
          type="button"
          onClick={() => onChangeMode("settings")}
          className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/50 ${mode === "settings" ? "bg-signal/[0.1] text-signal" : "text-faint hover:bg-white/[0.045] hover:text-fg"}`}
          title={t("helix:navigation.settings")}
          aria-label={t("helix:navigation.settings")}
        >
          <SettingsIcon className="h-4 w-4 shrink-0 text-faint" />
        </button>
      </div>
    </aside>
  );
}
