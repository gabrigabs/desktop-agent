import type { ContextChipItem } from "./hooks/useContextChips";

interface ContextChipBarProps {
  chips: ContextChipItem[];
  disabled?: boolean;
  onChipClick: (chip: ContextChipItem) => void;
}

export function ContextChipBar({ chips, disabled, onChipClick }: ContextChipBarProps) {
  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {chips.map((chip) => {
        const Icon = chip.icon;
        return (
          <button
            key={chip.id}
            type="button"
            onClick={() => onChipClick(chip)}
            disabled={disabled}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border border-line bg-white/[0.03] text-[11px] text-mute hover:text-fg hover:border-signal/30 hover:bg-white/[0.06] transition-colors disabled:opacity-40 disabled:pointer-events-none"
          >
            <Icon className={`w-3.5 h-3.5 ${chip.accent}`} />
            {chip.label}
          </button>
        );
      })}
    </div>
  );
}
