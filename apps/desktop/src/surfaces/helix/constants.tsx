import {
  Bot,
  Bug,
  CheckSquare,
  Clipboard,
  Code,
  FileText,
  Languages,
  Layers,
  Link,
  ListChecks,
  MessageSquare,
  PenLine,
  Search,
  Sparkles,
  Type,
} from "lucide-react";
import type { ComponentType } from "react";
import { useTranslation } from "react-i18next";
import { getAgent, isMissingRpcMethodError, restartRpc } from "../../lib/rpc";

export const SELECT_CLASS =
  "h-9 w-full rounded-md border border-line bg-bg px-2 text-xs text-fg cursor-pointer hover:border-line-strong transition-colors";

export const GLOBAL_SHORTCUT_LABEL = "Control+Shift+Space";

export function useStaleRuntimeMessage(): string {
  const { t } = useTranslation("helix");
  return t("helix:errors.staleRuntime");
}

export type RuntimeApi = Awaited<ReturnType<typeof getAgent>>;

export type QuickAction = {
  id: string;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  accent: string;
  requiresClipboard: true;
  prompt: string;
};

export type FreeAction = {
  id: string;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  accent: string;
  prompt: string;
  executionMode?: "simple" | "workflow";
};

export function usePinstripesModels() {
  const { t } = useTranslation("helix");
  return [
    {
      id: "ps/warp" as const,
      name: t("helix:pinstripesModels.warp"),
      description: t("helix:pinstripesModels.warpDescription"),
    },
    {
      id: "ps/thinking" as const,
      name: t("helix:pinstripesModels.thinking"),
      description: t("helix:pinstripesModels.thinkingDescription"),
    },
    {
      id: "ps/pro" as const,
      name: t("helix:pinstripesModels.pro"),
      description: t("helix:pinstripesModels.proDescription"),
    },
  ];
}

export function useQuickActions(): QuickAction[] {
  const { t } = useTranslation("helix");
  return [
    {
      id: "melhorar",
      label: t("helix:actions.improveText"),
      description: t("helix:actions.improveTextDescription"),
      icon: Sparkles,
      accent: "text-warn",
      requiresClipboard: true,
      prompt: t("helix:actions.improveTextPrompt"),
    },
    {
      id: "resumir",
      label: t("helix:actions.summarize"),
      description: t("helix:actions.summarizeDescription"),
      icon: FileText,
      accent: "text-sky-400",
      requiresClipboard: true,
      prompt: t("helix:actions.summarizePrompt"),
    },
    {
      id: "traduzir",
      label: t("helix:actions.translate"),
      description: t("helix:actions.translateDescription"),
      icon: Languages,
      accent: "text-good",
      requiresClipboard: true,
      prompt: t("helix:actions.translatePrompt"),
    },
    {
      id: "explicar",
      label: t("helix:actions.explain"),
      description: t("helix:actions.explainDescription"),
      icon: Search,
      accent: "text-signal",
      requiresClipboard: true,
      prompt: t("helix:actions.explainPrompt"),
    },
    {
      id: "tarefas",
      label: t("helix:actions.extractTasks"),
      description: t("helix:actions.extractTasksDescription"),
      icon: ListChecks,
      accent: "text-lime-400",
      requiresClipboard: true,
      prompt: t("helix:actions.extractTasksPrompt"),
    },
    {
      id: "responder",
      label: t("helix:actions.reply"),
      description: t("helix:actions.replyDescription"),
      icon: MessageSquare,
      accent: "text-bad",
      requiresClipboard: true,
      prompt: t("helix:actions.replyPrompt"),
    },
  ];
}

export function useFreeActions(): FreeAction[] {
  const { t } = useTranslation("helix");
  return [
    {
      id: "pesquisar-web",
      label: t("helix:actions.webSearch"),
      description: t("helix:actions.webSearchDescription"),
      icon: Search,
      accent: "text-cyan-400",
      prompt: t("helix:actions.webSearchPrompt"),
      executionMode: "workflow",
    },
    {
      id: "ler-url",
      label: t("helix:actions.readUrl"),
      description: t("helix:actions.readUrlDescription"),
      icon: Link,
      accent: "text-good",
      prompt: t("helix:actions.readUrlPrompt"),
      executionMode: "workflow",
    },
    {
      id: "ocr-tela",
      label: t("helix:actions.readScreen"),
      description: t("helix:actions.readScreenDescription"),
      icon: Clipboard,
      accent: "text-warn",
      prompt: t("helix:actions.readScreenPrompt"),
      executionMode: "workflow",
    },
    {
      id: "pergunta",
      label: t("helix:actions.freeQuestion"),
      description: t("helix:actions.freeQuestionDescription"),
      icon: Bot,
      accent: "text-signal",
      prompt: "",
    },
    {
      id: "plano",
      label: t("helix:actions.makePlan"),
      description: t("helix:actions.makePlanDescription"),
      icon: CheckSquare,
      accent: "text-good",
      prompt: t("helix:actions.makePlanPrompt"),
    },
    {
      id: "rascunho",
      label: t("helix:actions.draftText"),
      description: t("helix:actions.draftTextDescription"),
      icon: PenLine,
      accent: "text-sky-400",
      prompt: t("helix:actions.draftTextPrompt"),
    },
    {
      id: "checklist",
      label: t("helix:actions.checklist"),
      description: t("helix:actions.checklistDescription"),
      icon: ListChecks,
      accent: "text-lime-400",
      prompt: t("helix:actions.checklistPrompt"),
    },
    {
      id: "ideias",
      label: t("helix:actions.exploreIdeas"),
      description: t("helix:actions.exploreIdeasDescription"),
      icon: Sparkles,
      accent: "text-warn",
      prompt: t("helix:actions.exploreIdeasPrompt"),
    },
    {
      id: "decidir",
      label: t("helix:actions.compareOptions"),
      description: t("helix:actions.compareOptionsDescription"),
      icon: Layers,
      accent: "text-fuchsia-400",
      prompt: t("helix:actions.compareOptionsPrompt"),
    },
  ];
}

export function isStaleRuntimeError(err: unknown, message: string) {
  return err instanceof Error && err.message === message;
}

export async function callAgentWithRuntimeRefresh<T>(
  method: string,
  action: (api: RuntimeApi) => Promise<T>,
  staleMessage: string,
) {
  const api = await getAgent();
  try {
    return await action(api);
  } catch (err) {
    if (!isMissingRpcMethodError(err, method)) throw err;
  }
  const refreshedApi = await restartRpc();
  try {
    return await action(refreshedApi);
  } catch (err) {
    if (isMissingRpcMethodError(err, method)) throw new Error(staleMessage);
    throw err;
  }
}

export const CONTEXT_CHIP_META: Record<
  import("@desktop-agent/shared").ContextType,
  { icon: ComponentType<{ className?: string }>; accent: string }
> = {
  url: { icon: Link, accent: "text-good" },
  code: { icon: Code, accent: "text-signal" },
  error: { icon: Bug, accent: "text-bad" },
  long_text: { icon: FileText, accent: "text-warn" },
  message: { icon: MessageSquare, accent: "text-sky-400" },
  plain_text: { icon: Type, accent: "text-faint" },
};

export function useActiveBadgeText(): (provider: string, model: string) => string {
  const { t } = useTranslation("helix");
  const models = usePinstripesModels();
  return (provider: string, model: string): string => {
    if (provider === "mock") return t("helix:providerModelSelect.mockLocal");
    if (provider === "pinstripes") {
      const m = models.find((item) => item.id === model);
      return `Pinstripes · ${m?.name ?? (model || "Warp")}`;
    }
    const name = provider.toUpperCase();
    const modelPart = model ? `: ${model}` : "";
    return `${name}${modelPart}`;
  };
}
