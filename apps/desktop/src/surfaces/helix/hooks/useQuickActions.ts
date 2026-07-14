import { Bot, Globe, Languages, Lightbulb, ListChecks, Search, Sparkles } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { QuickActionItem } from "../../../components/ui/helix/helix-quick-actions";

export type { QuickActionItem };

export function useQuickActions(hasClipboard: boolean, ignoreClipboard: boolean): QuickActionItem[] {
  const { t } = useTranslation("helix");

  return useMemo<QuickActionItem[]>(() => {
    const clipboardEnabled = hasClipboard && !ignoreClipboard;
    const base: QuickActionItem[] = [
      {
        id: "pergunta-livre",
        label: t("helix:quickActions.freeQuestion"),
        icon: Search,
        accent: "text-signal",
        prompt: "",
        placeholder: t("helix:composer.placeholderDefault"),
        requiredContext: [],
      },
      {
        id: "pesquisar-web",
        label: t("helix:quickActions.webSearch"),
        icon: Globe,
        accent: "text-cyan-400",
        prompt: t("helix:quickActions.webSearchPrompt"),
        placeholder: t("helix:composer.placeholderWebSearch"),
        executionMode: "workflow",
      },
      {
        id: "montar-plano",
        label: t("helix:quickActions.makePlan"),
        icon: ListChecks,
        accent: "text-good",
        prompt: t("helix:quickActions.makePlanPrompt"),
        placeholder: t("helix:composer.placeholderDefault"),
        executionMode: "workflow",
      },
      {
        id: "explorar-ideias",
        label: t("helix:quickActions.exploreIdeas"),
        icon: Lightbulb,
        accent: "text-warn",
        prompt: t("helix:quickActions.exploreIdeasPrompt"),
        placeholder: t("helix:composer.placeholderDefault"),
      },
      {
        id: "rascunhar-texto",
        label: t("helix:quickActions.draftText"),
        icon: Bot,
        accent: "text-sky-400",
        prompt: t("helix:quickActions.draftTextPrompt"),
        placeholder: t("helix:composer.placeholderDefault"),
      },
    ];

    const clipboardActions: QuickActionItem[] = hasClipboard
      ? [
          {
            id: "resumir-texto",
            label: t("helix:quickActions.summarizeText"),
            icon: ListChecks,
            accent: "text-warn",
            prompt: t("helix:quickActions.summarizeTextPrompt"),
            placeholder: t("helix:composer.placeholderSummarize"),
            requiredContext: ["clipboard"],
          },
          {
            id: "explicar",
            label: t("helix:quickActions.explain"),
            icon: Lightbulb,
            accent: "text-signal",
            prompt: t("helix:quickActions.explainPrompt"),
            placeholder: t("helix:composer.placeholderExplain"),
            requiredContext: ["clipboard"],
          },
          {
            id: "traduzir",
            label: t("helix:quickActions.translate"),
            icon: Languages,
            accent: "text-good",
            prompt: t("helix:quickActions.translatePrompt"),
            placeholder: t("helix:composer.placeholderTranslate"),
            requiredContext: ["clipboard"],
          },
          {
            id: "melhorar-texto",
            label: t("helix:quickActions.improveText"),
            icon: Sparkles,
            accent: "text-sky-400",
            prompt: t("helix:quickActions.improveTextPrompt"),
            placeholder: t("helix:composer.placeholderImprove"),
            requiredContext: ["clipboard"],
          },
        ]
      : [];

    const result = [...base];

    if (hasClipboard) {
      result.unshift(...clipboardActions);
    }

    // Move clipboard-dependent actions to the front when clipboard is active
    if (clipboardEnabled) {
      result.sort((a) => (a.requiredContext?.includes("clipboard") ? -1 : 1));
    }

    return result;
  }, [hasClipboard, ignoreClipboard, t]);
}
