import { CornerDownRight } from "lucide-react";
import type { ContextChipItem } from "./hooks/useContextChips";

interface ContextChipBarProps {
  chips: ContextChipItem[];
  disabled?: boolean;
  onChipClick: (chip: ContextChipItem) => void;
}

export function ContextChipBar({ chips, disabled, onChipClick }: ContextChipBarProps) {
  if (chips.length === 0) return null;

  return (
    <div className="w-full flex justify-center">
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        {chips.map((chip) => {
          const Icon = chip.icon;
          return (
            <button
              key={chip.id}
              type="button"
              onClick={() => onChipClick(chip)}
              disabled={disabled}
              className="group flex items-center gap-1 px-2 py-1 rounded-full border border-line bg-white/[0.03] text-[10px] text-mute hover:text-fg hover:border-signal/40 hover:bg-white/[0.08] hover:shadow-[0_0_0_1px_rgba(196,153,244,0.12)] transition-all disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
              title={chip.prompt}
            >
              <Icon className={`w-3 h-3 ${chip.accent}`} />
              {chip.label}
              <CornerDownRight className="w-2.5 h-2.5 text-faint opacity-0 group-hover:opacity-100 group-hover:text-signal transition-all" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
