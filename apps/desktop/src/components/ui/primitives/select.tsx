import { ChevronDown } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
}

const MARGIN = 8;

export function Select({
  value,
  options,
  onChange,
  placeholder,
  disabled,
  ariaLabel,
  className = "",
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  const selected = options.find((o) => o.value === value);
  const display = selected?.label ?? placeholder ?? "";

  useLayoutEffect(() => {
    if (!open || !triggerRef.current || !popupRef.current) return;

    const anchor = triggerRef.current;
    const popup = popupRef.current;
    const rect = anchor.getBoundingClientRect();
    const popupRect = popup.getBoundingClientRect();

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const spaceAbove = rect.top - MARGIN;
    const spaceBelow = viewportHeight - rect.bottom - MARGIN;
    const popupHeight = popupRect.height;

    const openBelow = popupHeight <= spaceBelow || spaceBelow >= spaceAbove;
    let top = openBelow ? rect.bottom + MARGIN : rect.top - MARGIN - popupHeight;
    top = Math.max(MARGIN, Math.min(top, viewportHeight - popupHeight - MARGIN));

    let left = rect.left;
    left = Math.max(MARGIN, Math.min(left, viewportWidth - popupRect.width - MARGIN));

    setPosition({ top, left });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        popupRef.current &&
        !popupRef.current.contains(e.target as Node) &&
        !triggerRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (!open) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        setOpen(true);
        setFocusedIndex(0);
      }
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const option = options[focusedIndex];
      if (option) {
        onChange(option.value);
        setOpen(false);
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedIndex((i) => (i + 1) % options.length);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedIndex((i) => (i - 1 + options.length) % options.length);
      return;
    }
  };

  const handleSelect = (next: string) => {
    onChange(next);
    setOpen(false);
  };

  return (
    <div className={`relative inline-flex ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => !disabled && setOpen((v) => !v)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex h-6 w-full max-w-[180px] items-center justify-between gap-2 rounded-md border border-line bg-ink/40 px-2 text-[10px] text-fg transition-colors hover:border-line-strong disabled:opacity-50"
      >
        <span className="truncate">{display}</span>
        <ChevronDown
          className={`h-3 w-3 shrink-0 text-mute transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          ref={popupRef}
          className="fixed z-50 min-w-[160px] rounded-xl border border-line bg-white/[0.04] p-1.5 shadow-lg shadow-black/20 backdrop-blur-xl"
          style={{ top: position.top, left: position.left, minWidth: triggerRef.current?.offsetWidth }}
          role="listbox"
          aria-label={ariaLabel}
        >
          {options.map((opt, index) => {
            const isSelected = opt.value === value;
            const isFocused = index === focusedIndex;
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => handleSelect(opt.value)}
                onMouseEnter={() => setFocusedIndex(index)}
                className={`flex w-full items-center rounded-lg px-2.5 py-1.5 text-left text-[10px] transition-colors ${
                  isSelected ? "bg-signal/10 text-signal" : "text-fg hover:bg-white/[0.06]"
                } ${isFocused ? "bg-white/[0.06]" : ""}`}
              >
                <span className="truncate">{opt.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
