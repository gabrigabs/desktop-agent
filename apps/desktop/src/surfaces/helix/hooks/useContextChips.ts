import { type ContextType, detectContext, getContextSuggestions } from "@desktop-agent/shared";
import type { ComponentType } from "react";
import { useMemo } from "react";
import { CONTEXT_CHIP_META } from "../constants";

export interface ContextChipItem {
  id: string;
  type: ContextType;
  label: string;
  icon: ComponentType<{ className?: string }>;
  accent: string;
  prompt: string;
}

export function useContextChips(clipboardText: string) {
  const chips = useMemo<ContextChipItem[]>(() => {
    const detected = detectContext(clipboardText, "clipboard");
    const first = detected[0];
    if (!first) return [];

    const { type } = first;
    const meta = CONTEXT_CHIP_META[type];
    const suggestions = getContextSuggestions(type);

    return suggestions.map((suggestion, index) => ({
      id: `${type}-${index}`,
      type: suggestion.type,
      label: suggestion.label,
      icon: meta.icon,
      accent: meta.accent,
      prompt: suggestion.prompt,
    }));
  }, [clipboardText]);

  return { chips, hasChips: chips.length > 0 };
}
