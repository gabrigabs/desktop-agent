import { Bot, EyeOff, Globe, Languages, Lightbulb, ListChecks, Search, Sparkles } from "lucide-react";
import type { ComponentType } from "react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

export interface ContextChipItem {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  accent: string;
  prompt: string;
  usesClipboard: boolean;
  action?: "ignore-clipboard";
}

function useClipboardChips(): ContextChipItem[] {
  const { t } = useTranslation("helix");
  return [
    {
      id: "resumir",
      label: t("helix:contextChips.summarizeText"),
      icon: ListChecks,
      accent: "text-warn",
      prompt: t("helix:contextChips.summarizeTextPrompt"),
      usesClipboard: true,
    },
    {
      id: "explicar",
      label: t("helix:contextChips.explain"),
      icon: Lightbulb,
      accent: "text-signal",
      prompt: t("helix:contextChips.explainPrompt"),
      usesClipboard: true,
    },
    {
      id: "traduzir",
      label: t("helix:contextChips.translate"),
      icon: Languages,
      accent: "text-good",
      prompt: t("helix:contextChips.translatePrompt"),
      usesClipboard: true,
    },
    {
      id: "melhorar",
      label: t("helix:contextChips.improveText"),
      icon: Sparkles,
      accent: "text-sky-400",
      prompt: t("helix:contextChips.improveTextPrompt"),
      usesClipboard: true,
    },
  ];
}

function useStarterChips(): ContextChipItem[] {
  const { t } = useTranslation("helix");
  return [
    {
      id: "pergunta",
      label: t("helix:contextChips.freeQuestion"),
      icon: Search,
      accent: "text-signal",
      prompt: "",
      usesClipboard: false,
    },
    {
      id: "pesquisar-web",
      label: t("helix:contextChips.webSearch"),
      icon: Globe,
      accent: "text-cyan-400",
      prompt: t("helix:contextChips.webSearchPrompt"),
      usesClipboard: false,
    },
    {
      id: "montar-plano",
      label: t("helix:contextChips.makePlan"),
      icon: ListChecks,
      accent: "text-good",
      prompt: t("helix:contextChips.makePlanPrompt"),
      usesClipboard: false,
    },
    {
      id: "explorar-ideias",
      label: t("helix:contextChips.exploreIdeas"),
      icon: Lightbulb,
      accent: "text-warn",
      prompt: t("helix:contextChips.exploreIdeasPrompt"),
      usesClipboard: false,
    },
    {
      id: "rascunho",
      label: t("helix:contextChips.draftText"),
      icon: Bot,
      accent: "text-sky-400",
      prompt: t("helix:contextChips.draftTextPrompt"),
      usesClipboard: false,
    },
  ];
}

export function useContextChips(hasClipboard: boolean, ignoreClipboard: boolean = true) {
  const { t } = useTranslation("helix");
  const clipboardChipsTemplate = useClipboardChips();
  const starterChipsTemplate = useStarterChips();
  const result = useMemo(() => {
    const starterChips = [...starterChipsTemplate];
    const clipboardChips = hasClipboard ? [...clipboardChipsTemplate] : [];
    const ignoreChip: ContextChipItem | null = hasClipboard
      ? {
          id: "ignore-clipboard",
          label: ignoreClipboard
            ? t("helix:contextChips.useClipboard")
            : t("helix:contextChips.ignoreClipboard"),
          icon: EyeOff,
          accent: ignoreClipboard ? "text-good" : "text-bad",
          prompt: "",
          usesClipboard: false,
          action: "ignore-clipboard",
        }
      : null;

    const chips: ContextChipItem[] = [...starterChips];
    if (hasClipboard) {
      chips.unshift(...clipboardChips);
      if (ignoreChip) {
        chips.push(ignoreChip);
      }
    }

    return {
      chips,
      starterChips,
      clipboardChips,
      hasChips: chips.length > 0,
    };
  }, [hasClipboard, ignoreClipboard, t, clipboardChipsTemplate, starterChipsTemplate]);

  return result;
}
