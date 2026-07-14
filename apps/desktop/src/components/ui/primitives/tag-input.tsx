import { X } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

function normalizeTag(value: string): string {
  return value.trim().replace(/,$/, "");
}

type Props = {
  value?: string[];
  onChange: (value: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
  id?: string;
};

export function TagInput({ value = [], onChange, suggestions = [], placeholder, id }: Props) {
  const [input, setInput] = useState("");
  const [active, setActive] = useState(false);

  const addTag = useCallback(
    (raw: string) => {
      const tag = normalizeTag(raw);
      if (!tag) return;
      if (value.includes(tag)) {
        setInput("");
        return;
      }
      onChange([...value, tag]);
      setInput("");
    },
    [value, onChange],
  );

  const removeTag = useCallback(
    (tag: string) => {
      onChange(value.filter((t) => t !== tag));
    },
    [value, onChange],
  );

  const availableSuggestions = useMemo(() => {
    const term = input.toLowerCase();
    return suggestions.filter((s) => !value.includes(s) && s.toLowerCase().includes(term)).slice(0, 8);
  }, [input, suggestions, value]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(input);
    } else if (e.key === "Backspace" && input === "" && value.length > 0) {
      removeTag(value[value.length - 1] as string);
    }
  }

  function handleBlur() {
    setActive(false);
    if (input.trim()) {
      addTag(input);
    }
  }

  return (
    <div className="space-y-1.5">
      <div
        className={`flex flex-wrap items-center gap-1.5 min-h-[36px] rounded-md border px-2 py-1.5 transition-colors ${
          active ? "border-signal/40" : "border-line hover:border-line-strong"
        } bg-bg`}
      >
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-md bg-white/[0.06] text-fg border border-line/60"
          >
            {tag}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeTag(tag);
              }}
              className="text-faint hover:text-fg"
              aria-label={`Remover ${tag}`}
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        <input
          id={id}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setActive(true)}
          onBlur={handleBlur}
          placeholder={value.length === 0 ? placeholder : undefined}
          className="flex-1 min-w-[80px] bg-transparent text-xs text-fg placeholder:text-faint outline-none"
        />
      </div>

      {active && availableSuggestions.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {availableSuggestions.map((s) => (
            <button
              key={s}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => addTag(s)}
              className="text-[10px] px-2 py-0.5 rounded-full border border-line/60 bg-white/[0.03] text-mute hover:text-fg hover:border-line-strong hover:bg-white/[0.06] transition-colors"
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
