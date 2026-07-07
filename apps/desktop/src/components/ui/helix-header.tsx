import { Maximize2, Menu, Minimize2, Pin, X } from "lucide-react";
import { IconButton } from "./icon-button";
import { Pet } from "./pet";

interface HelixHeaderProps {
  expanded: boolean;
  alwaysOnTop: boolean;
  onToggleAlwaysOnTop: () => void;
  onToggleExpand: () => void;
  onMinimize: () => void;
  onClose: () => void;
  onOpenMenu?: () => void;
}

export function HelixHeader({
  expanded,
  alwaysOnTop,
  onToggleAlwaysOnTop,
  onToggleExpand,
  onMinimize,
  onClose,
  onOpenMenu,
}: HelixHeaderProps) {
  return (
    <header
      className="h-11 flex items-center justify-between px-3 border-b border-line bg-white/[0.02] relative z-20 shrink-0"
      data-tauri-drag-region
    >
      <div className="flex items-center gap-2.5" data-tauri-drag-region>
        {onOpenMenu && (
          <IconButton title="Abrir menu" onClick={onOpenMenu} className="md:hidden">
            <Menu className="w-3.5 h-3.5" />
          </IconButton>
        )}
        <Pet size={16} variant="dot" className="shrink-0" />
        <span
          className="text-[15px] font-semibold tracking-tight text-fg leading-none"
          data-tauri-drag-region
        >
          Helix
        </span>
      </div>

      <div className="flex items-center gap-0.5">
        <IconButton
          title={alwaysOnTop ? "Fixado no topo" : "Fixar no topo"}
          active={alwaysOnTop}
          onClick={onToggleAlwaysOnTop}
        >
          <Pin className="w-3.5 h-3.5" />
        </IconButton>
        <IconButton
          title={expanded ? "Voltar ao modo normal" : "Abrir modo expandido"}
          active={expanded}
          onClick={onToggleExpand}
        >
          {expanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
        </IconButton>
        <IconButton title="Minimizar janela" onClick={onMinimize}>
          <Minimize2 className="w-3.5 h-3.5" />
        </IconButton>
        <IconButton title="Fechar janela" onClick={onClose} className="hover:text-bad">
          <X className="w-3.5 h-3.5" />
        </IconButton>
      </div>
    </header>
  );
}
