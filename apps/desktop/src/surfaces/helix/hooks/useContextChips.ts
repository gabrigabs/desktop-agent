import { Bot, EyeOff, Globe, Languages, Lightbulb, ListChecks, Search, Sparkles } from "lucide-react";
import type { ComponentType } from "react";
import { useMemo } from "react";

export interface ContextChipItem {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  accent: string;
  prompt: string;
  usesClipboard: boolean;
  action?: "ignore-clipboard";
}

const CLIPBOARD_CHIPS: ContextChipItem[] = [
  {
    id: "resumir",
    label: "Resumir texto",
    icon: ListChecks,
    accent: "text-warn",
    prompt: "Resuma o texto em tópicos concisos.",
    usesClipboard: true,
  },
  {
    id: "explicar",
    label: "Explicar",
    icon: Lightbulb,
    accent: "text-signal",
    prompt: "Explique este conteúdo de forma simples, com contexto e exemplos curtos.",
    usesClipboard: true,
  },
  {
    id: "traduzir",
    label: "Traduzir",
    icon: Languages,
    accent: "text-good",
    prompt: "Traduza este texto mantendo o tom original.",
    usesClipboard: true,
  },
  {
    id: "melhorar",
    label: "Melhorar texto",
    icon: Sparkles,
    accent: "text-sky-400",
    prompt: "Melhore a clareza, tom e legibilidade deste texto.",
    usesClipboard: true,
  },
];

const STARTER_CHIPS: ContextChipItem[] = [
  {
    id: "pergunta",
    label: "Pergunta livre",
    icon: Search,
    accent: "text-signal",
    prompt: "",
    usesClipboard: false,
  },
  {
    id: "pesquisar-web",
    label: "Pesquisar web",
    icon: Globe,
    accent: "text-cyan-400",
    prompt: "Pesquise na web com fontes e próximos passos sobre: ",
    usesClipboard: false,
  },
  {
    id: "montar-plano",
    label: "Montar plano",
    icon: ListChecks,
    accent: "text-good",
    prompt: "Monte um plano prático para: ",
    usesClipboard: false,
  },
  {
    id: "explorar-ideias",
    label: "Explorar ideias",
    icon: Lightbulb,
    accent: "text-warn",
    prompt: "Liste ideias práticas e diferentes para: ",
    usesClipboard: false,
  },
  {
    id: "rascunho",
    label: "Rascunhar texto",
    icon: Bot,
    accent: "text-sky-400",
    prompt: "Rascunhe um texto curto sobre: ",
    usesClipboard: false,
  },
];

export function useContextChips(hasClipboard: boolean, ignoreClipboard: boolean = true) {
  const result = useMemo(() => {
    const starterChips = [...STARTER_CHIPS];
    const clipboardChips = hasClipboard ? [...CLIPBOARD_CHIPS] : [];
    const ignoreChip: ContextChipItem | null = hasClipboard
      ? {
          id: "ignore-clipboard",
          label: ignoreClipboard ? "Usar clipboard" : "Ignorar clipboard",
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
  }, [hasClipboard, ignoreClipboard]);

  return result;
}
