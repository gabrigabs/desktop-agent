import { Clipboard } from "lucide-react";
import type { ContextChipItem } from "./hooks/useContextChips";

interface ContextChipBarProps {
  chips: ContextChipItem[];
  disabled?: boolean;
  onChipClick: (chip: ContextChipItem) => void;
}

export function ContextChipBar({ chips, disabled, onChipClick }: ContextChipBarProps) {
  if (chips.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <Clipboard className="w-3 h-3 text-good" />
        <span className="text-[10px] font-medium text-mute">Contexto detectado</span>
        <span className="px-1 py-0.5 rounded bg-good/15 text-good text-[9px] font-mono font-medium">
          {chips.length}
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {chips.map((chip) => {
          const Icon = chip.icon;
          return (
            <button
              key={chip.id}
              type="button"
              onClick={() => onChipClick(chip)}
              disabled={disabled}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/[0.05] text-[11px] text-fg hover:bg-white/[0.10] transition-colors disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
            >
              <Icon className={`w-3.5 h-3.5 ${chip.accent}`} />
              {chip.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
