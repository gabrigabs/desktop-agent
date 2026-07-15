import { Command } from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { HELIX_NAV_GROUPS, type HelixNavMode, NEW_TASK_ITEM, SETTINGS_ITEM } from "./helix-navigation";

interface HelixDrawerProps {
  open: boolean;
  mode: HelixNavMode;
  onClose: () => void;
  onChangeMode: (mode: HelixNavMode) => void;
  onNewTask: () => void;
}

export function HelixDrawer({ open, mode, onClose, onChangeMode, onNewTask }: HelixDrawerProps) {
  const { t } = useTranslation("helix");
  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open, onClose]);

  if (!open) return null;
  const NewTaskIcon = NEW_TASK_ITEM.icon;
  const SettingsIcon = SETTINGS_ITEM.icon;

  const selectMode = (nextMode: HelixNavMode) => {
    if (nextMode === "command") onNewTask();
    onChangeMode(nextMode);
    onClose();
  };

  return (
    <div className="absolute inset-x-0 bottom-0 top-11 z-30">
      <button
        type="button"
        className="absolute inset-0 bg-ink/55 backdrop-blur-[2px]"
        onClick={onClose}
        aria-label={t("helix:header.closeNavigation")}
      />
      <aside className="absolute left-2.5 top-2.5 z-40 flex max-h-[calc(100%-20px)] w-[252px] flex-col overflow-hidden rounded-2xl border border-line-strong bg-[#100e18]/96 p-2.5 shadow-[0_24px_70px_rgba(0,0,0,0.55)] backdrop-blur-2xl animate-in slide-in-from-left-2 fade-in duration-150">
        <div className="flex items-center justify-between px-2 pb-2 pt-1">
          <div>
            <div className="text-[9px] font-mono uppercase tracking-[0.18em] text-faint">
              {t("helix:sidebar.mainNavigation")}
            </div>
            <div className="mt-0.5 text-xs font-semibold text-fg">{t("helix:sidebar.whereToWork")}</div>
          </div>
          <kbd className="rounded border border-line bg-white/[0.03] px-1.5 py-0.5 text-[8px] font-mono text-faint">
            ESC
          </kbd>
        </div>

        <button
          type="button"
          onClick={() => selectMode("command")}
          className="flex min-h-11 items-center gap-3 rounded-xl border border-signal/25 bg-signal/[0.09] px-3 text-left transition-colors hover:bg-signal/[0.14]"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-signal/15 text-signal">
            <NewTaskIcon className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className="block text-xs font-semibold text-fg">{t("helix:sidebar.newConversation")}</span>
            <span className="block text-[9px] text-faint">{t("helix:sidebar.newConversationHint")}</span>
          </span>
        </button>

        <nav className="mt-3 overflow-y-auto pr-0.5" aria-label={t("helix:sidebar.mainNavigation")}>
          {HELIX_NAV_GROUPS.map((group) => (
            <section key={group.labelKey} className="mb-3 last:mb-0">
              <h2 className="mb-1 px-2 text-[8px] font-mono uppercase tracking-[0.16em] text-faint">
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
                      onClick={() => selectMode(item.id)}
                      className={`group flex min-h-10 items-center gap-3 rounded-lg border px-2.5 text-left transition-colors ${
                        active
                          ? "border-line-strong bg-white/[0.065]"
                          : "border-transparent hover:bg-white/[0.035]"
                      }`}
                    >
                      <Icon className={`h-4 w-4 shrink-0 ${active ? "text-signal" : "text-faint"}`} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-medium text-fg">
                          {t(`helix:navigation.${item.id}` as const)}
                        </span>
                        <span className="block truncate text-[9px] text-faint">
                          {t(`helix:navigation.${item.id}Description` as const)}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </nav>

        <button
          type="button"
          onClick={() => selectMode("settings")}
          className="mt-2 flex min-h-10 items-center gap-3 border-t border-line px-2.5 pt-2 text-left text-mute transition-colors hover:text-fg"
        >
          <SettingsIcon className="h-4 w-4 text-faint" />
          <span className="flex-1 text-xs font-medium">{t("helix:navigation.settings")}</span>
          <Command className="h-3 w-3 text-faint" />
        </button>
      </aside>
    </div>
  );
}
