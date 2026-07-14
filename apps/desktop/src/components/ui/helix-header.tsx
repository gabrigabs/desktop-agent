import { Menu, Orbit, PanelsTopLeft, Pin, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { HelixMark } from "./helix-mark";
import { IconButton } from "./icon-button";

interface HelixHeaderProps {
  expanded: boolean;
  alwaysOnTop: boolean;
  onToggleAlwaysOnTop: () => void;
  onToggleExpand: () => void;
  onMinimize: () => void;
  onClose: () => void;
  onOpenMenu?: () => void;
  menuOpen?: boolean;
}

export function HelixHeader({
  expanded,
  alwaysOnTop,
  onToggleAlwaysOnTop,
  onToggleExpand,
  onMinimize,
  onClose,
  onOpenMenu,
  menuOpen = false,
}: HelixHeaderProps) {
  const { t } = useTranslation("helix");
  return (
    <header
      className="relative z-20 flex h-11 shrink-0 items-center justify-between border-b border-line bg-ink/30 px-2.5"
      data-tauri-drag-region
    >
      <div className="flex min-w-0 items-center gap-2" data-tauri-drag-region>
        {onOpenMenu && (
          <IconButton
            title={menuOpen ? t("helix:header.closeNavigation") : t("helix:header.openNavigation")}
            active={menuOpen}
            onClick={onOpenMenu}
            className="h-7 w-7 rounded-md"
          >
            <Menu className="h-3.5 w-3.5" />
          </IconButton>
        )}
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-signal/15 bg-signal/[0.055]">
          <HelixMark size={20} />
        </span>
        <span className="truncate text-[11px] font-bold tracking-[0.2em] text-fg" data-tauri-drag-region>
          HELIX
        </span>
        {expanded && (
          <span className="ml-1 rounded border border-line bg-white/[0.025] px-1.5 py-0.5 text-[8px] font-mono uppercase tracking-wider text-faint">
            space
          </span>
        )}
      </div>

      <div className="flex items-center gap-0.5">
        <IconButton
          title={alwaysOnTop ? t("helix:header.unpin") : t("helix:header.pin")}
          active={alwaysOnTop}
          onClick={onToggleAlwaysOnTop}
          className="h-7 w-7 rounded-md"
        >
          <Pin className="h-3.5 w-3.5" strokeWidth={1.8} />
        </IconButton>
        <span className="mx-1 h-4 w-px bg-line" aria-hidden="true" />
        <IconButton
          title={expanded ? t("helix:header.backToQuickPanel") : t("helix:header.openSpace")}
          active={expanded}
          onClick={onToggleExpand}
          className="h-7 w-7 rounded-md"
        >
          <PanelsTopLeft className="h-3.5 w-3.5" strokeWidth={1.8} />
        </IconButton>
        <IconButton
          title={t("helix:header.minimizeToPet")}
          onClick={onMinimize}
          className="h-7 w-7 rounded-md"
        >
          <Orbit className="h-3.5 w-3.5" strokeWidth={1.8} />
        </IconButton>
        <IconButton
          title={t("helix:header.quitHelix")}
          onClick={onClose}
          className="h-7 w-7 rounded-md hover:text-bad"
        >
          <X className="h-3.5 w-3.5" strokeWidth={1.8} />
        </IconButton>
      </div>
    </header>
  );
}
