import {
  Bot,
  CheckSquare,
  Clipboard,
  FileText,
  Languages,
  Layers,
  Link,
  ListChecks,
  MessageSquare,
  PenLine,
  Search,
  Sparkles,
} from "lucide-react";
import type { ComponentType } from "react";
import { getAgent, isMissingRpcMethodError, restartRpc } from "../../lib/rpc";

export const GLOBAL_SHORTCUT_LABEL = "Control+Shift+Space";

export const STALE_RUNTIME_MESSAGE =
  "Runtime antigo detectado. Reinicie o app para carregar workflows e MCPs atualizados.";

export type InputMode = "free" | "clipboard";
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

export const PINSTRIPES_MODELS = [
  { id: "ps/warp", name: "Warp", description: "Rápido e melhor custo" },
  { id: "ps/thinking", name: "Thinking", description: "Raciocínio mais profundo" },
  { id: "ps/pro", name: "Pro", description: "Respostas mais deliberadas" },
] as const;

export const QUICK_ACTIONS: QuickAction[] = [
  {
    id: "melhorar",
    label: "Melhorar texto",
    description: "Clareza e tom",
    icon: Sparkles,
    accent: "text-warn",
    requiresClipboard: true,
    prompt: "Melhorar a clareza, tom e legibilidade deste texto",
  },
  {
    id: "resumir",
    label: "Resumir",
    description: "Bullets curtos",
    icon: FileText,
    accent: "text-sky-400",
    requiresClipboard: true,
    prompt: "Resumir este texto em tópicos concisos",
  },
  {
    id: "traduzir",
    label: "Traduzir",
    description: "Para inglês",
    icon: Languages,
    accent: "text-good",
    requiresClipboard: true,
    prompt: "Traduzir este texto para o inglês mantendo o tom original",
  },
  {
    id: "explicar",
    label: "Explicar",
    description: "Em linguagem simples",
    icon: Search,
    accent: "text-signal",
    requiresClipboard: true,
    prompt: "Explique este conteúdo em linguagem simples, com contexto e exemplos curtos",
  },
  {
    id: "tarefas",
    label: "Extrair tarefas",
    description: "Ações e donos",
    icon: ListChecks,
    accent: "text-lime-400",
    requiresClipboard: true,
    prompt:
      "Extraia tarefas acionáveis deste conteúdo, separando prioridade, responsável quando existir e próximo passo",
  },
  {
    id: "responder",
    label: "Responder",
    description: "Mensagem pronta",
    icon: MessageSquare,
    accent: "text-bad",
    requiresClipboard: true,
    prompt: "Escreva uma resposta curta, natural e educada para esta mensagem",
  },
];

export const FREE_ACTIONS: FreeAction[] = [
  {
    id: "pesquisar-web",
    label: "Pesquisar web",
    description: "Jina + fontes",
    icon: Search,
    accent: "text-cyan-400",
    prompt: "Pesquise na web com fontes e próximos passos sobre: ",
    executionMode: "workflow",
  },
  {
    id: "ler-url",
    label: "Ler URL",
    description: "r.jina.ai",
    icon: Link,
    accent: "text-good",
    prompt: "Leia e extraia os pontos importantes desta URL: ",
    executionMode: "workflow",
  },
  {
    id: "ocr-tela",
    label: "Ler tela",
    description: "OCR com aprovação",
    icon: Clipboard,
    accent: "text-warn",
    prompt: "Use OCR para ler a tela e extrair tarefas acionáveis",
    executionMode: "workflow",
  },
  {
    id: "pergunta",
    label: "Pergunta livre",
    description: "Sem contexto",
    icon: Bot,
    accent: "text-signal",
    prompt: "",
  },
  {
    id: "plano",
    label: "Montar plano",
    description: "Passos claros",
    icon: CheckSquare,
    accent: "text-good",
    prompt: "Monte um plano prático para: ",
  },
  {
    id: "rascunho",
    label: "Rascunhar texto",
    description: "Primeira versão",
    icon: PenLine,
    accent: "text-sky-400",
    prompt: "Rascunhe um texto curto sobre: ",
  },
  {
    id: "checklist",
    label: "Checklist",
    description: "Itens acionáveis",
    icon: ListChecks,
    accent: "text-lime-400",
    prompt: "Transforme este objetivo em uma checklist prática: ",
  },
  {
    id: "ideias",
    label: "Explorar ideias",
    description: "Opções úteis",
    icon: Sparkles,
    accent: "text-warn",
    prompt: "Liste ideias práticas e diferentes para: ",
  },
  {
    id: "decidir",
    label: "Comparar opções",
    description: "Prós e contras",
    icon: Layers,
    accent: "text-fuchsia-400",
    prompt: "Compare as opções e recomende um caminho para: ",
  },
];

export function isStaleRuntimeError(err: unknown) {
  return err instanceof Error && err.message === STALE_RUNTIME_MESSAGE;
}

export async function callAgentWithRuntimeRefresh<T>(
  method: string,
  action: (api: RuntimeApi) => Promise<T>,
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
    if (isMissingRpcMethodError(err, method)) throw new Error(STALE_RUNTIME_MESSAGE);
    throw err;
  }
}

export function getActiveBadgeText(provider: string, model: string): string {
  if (provider === "mock") return "Provedor Local (Mock)";
  if (provider === "pinstripes") {
    const m = PINSTRIPES_MODELS.find((item) => item.id === model);
    return `Pinstripes · ${m?.name ?? (model || "Warp")}`;
  }
  const name = provider.toUpperCase();
  const modelPart = model ? `: ${model}` : "";
  return `${name}${modelPart}`;
}
