import { PanelLeftClose } from "lucide-react";
import { useTranslation } from "react-i18next";
import { HELIX_NAV_GROUPS, type HelixNavMode, NEW_TASK_ITEM, SETTINGS_ITEM } from "./helix-navigation";

interface HelixSidebarProps {
  mode: HelixNavMode;
  onChangeMode: (mode: HelixNavMode) => void;
  onNewTask: () => void;
  onToggleExpand: () => void;
}

export function HelixSidebar({ mode, onChangeMode, onNewTask, onToggleExpand }: HelixSidebarProps) {
  const { t } = useTranslation("helix");
  const NewTaskIcon = NEW_TASK_ITEM.icon;
  const SettingsIcon = SETTINGS_ITEM.icon;

  return (
    <aside className="flex h-full w-[184px] shrink-0 flex-col border-r border-line bg-ink/20 px-3 py-3">
      <button
        type="button"
        onClick={() => {
          onNewTask();
          onChangeMode("command");
        }}
        className="flex min-h-10 w-full items-center gap-2.5 rounded-xl border border-signal/20 bg-signal/[0.08] px-3 text-left text-xs font-semibold text-fg transition-all duration-200 hover:border-signal/35 hover:bg-signal/[0.12] active:scale-[0.98]"
      >
        <NewTaskIcon className="h-4 w-4 shrink-0 text-signal" />
        <span className="truncate">{t("helix:sidebar.newConversation")}</span>
      </button>

      <nav className="mt-4 grid gap-4" aria-label={t("helix:sidebar.mainNavigation")}>
        {HELIX_NAV_GROUPS.map((group) => (
          <section key={group.labelKey}>
            <h2 className="mb-1.5 px-2 text-[8px] font-mono uppercase tracking-[0.16em] text-faint">
              {t(`helix:navigation.${group.labelKey}` as const)}
            </h2>
            <div className="grid gap-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = mode === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onChangeMode(item.id)}
                    className={`group flex h-9 w-full items-center gap-2.5 rounded-lg border px-2.5 text-left text-xs font-medium transition-all duration-200 overflow-hidden ${
                      active
                        ? "border-line-strong bg-white/[0.065] text-fg translate-x-0.5"
                        : "border-transparent text-mute hover:bg-white/[0.035] hover:text-fg active:scale-[0.98]"
                    }`}
                    title={t(`helix:navigation.${item.id}Description` as const)}
                  >
                    <Icon
                      className={`h-4 w-4 shrink-0 ${active ? "text-signal" : "text-faint group-hover:text-mute"}`}
                    />
                    <span className="min-w-0 truncate">{t(`helix:navigation.${item.id}` as const)}</span>
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
          className="flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-xs font-medium text-mute transition-all duration-200 hover:bg-white/[0.035] hover:text-fg active:scale-[0.98]"
        >
          <SettingsIcon className="h-4 w-4 shrink-0 text-faint" />
          <span className="min-w-0 truncate">{t("helix:navigation.settings")}</span>
        </button>
        <button
          type="button"
          onClick={onToggleExpand}
          className="flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-[10px] text-faint transition-all duration-200 hover:bg-white/[0.03] hover:text-mute active:scale-[0.98]"
        >
          <PanelLeftClose className="h-3.5 w-3.5 shrink-0" />
          <span className="min-w-0 truncate">{t("helix:sidebar.backToQuickPanel")}</span>
        </button>
      </div>
    </aside>
  );
}
