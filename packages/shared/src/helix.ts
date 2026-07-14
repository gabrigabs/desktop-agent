export type HelixActionCategory = "ask" | "clipboard" | "screen" | "web" | "workflow" | "follow_up";

export type HelixContextSource = "clipboard" | "screen" | "active_app" | "web" | "file" | "conversation";

export type HelixSecondaryAction = {
  id: string;
  title: string;
  description?: string;
  icon?: string;
  prompt: string;
  requiredContext?: HelixContextSource[];
  executionMode?: "simple" | "workflow";
};

export type HelixAction = {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: HelixActionCategory;
  color: string;
  prompt: string;
  requiredContext?: HelixContextSource[];
  executionMode?: "simple" | "workflow";
  secondaryActions?: HelixSecondaryAction[];
};

const CLIPBOARD_SECONDARY_ACTIONS: HelixSecondaryAction[] = [
  {
    id: "clipboard-summarize",
    title: "Resumir",
    icon: "list-checks",
    prompt: "Resuma o texto em tópicos concisos.",
    requiredContext: ["clipboard"],
  },
  {
    id: "clipboard-explain",
    title: "Explicar",
    icon: "lightbulb",
    prompt: "Explique este conteúdo de forma simples, com contexto e exemplos curtos.",
    requiredContext: ["clipboard"],
  },
  {
    id: "clipboard-translate",
    title: "Traduzir",
    icon: "languages",
    prompt: "Traduza este texto mantendo o tom original.",
    requiredContext: ["clipboard"],
  },
  {
    id: "clipboard-improve",
    title: "Melhorar",
    icon: "sparkles",
    prompt: "Melhore a clareza, tom e legibilidade deste texto.",
    requiredContext: ["clipboard"],
  },
];

export const HELIX_ACTIONS: readonly HelixAction[] = [
  {
    id: "ask",
    title: "Perguntar",
    description: "Prompt livre para o Helix",
    icon: "message-circle",
    category: "ask",
    color: "#c499f4",
    prompt: "",
  },
  {
    id: "clipboard",
    title: "Clipboard",
    description: "Agir sobre o texto copiado",
    icon: "clipboard",
    category: "clipboard",
    color: "#f4c542",
    prompt: "Explique ou transforme este conteúdo: [CLIPBOARD]",
    requiredContext: ["clipboard"],
    secondaryActions: CLIPBOARD_SECONDARY_ACTIONS,
  },
  {
    id: "screen",
    title: "Ler tela",
    description: "Capturar a tela com aprovação",
    icon: "scan",
    category: "screen",
    color: "#facc15",
    prompt: "Use OCR para ler a tela e explicar o que é acionável",
    requiredContext: ["screen"],
    executionMode: "workflow",
    secondaryActions: [
      {
        id: "screen-full",
        title: "Tela inteira",
        icon: "maximize",
        prompt: "Capture a tela inteira e descreva o que é acionável",
        requiredContext: ["screen"],
        executionMode: "workflow",
      },
      {
        id: "screen-region",
        title: "Região",
        icon: "scan-line",
        prompt: "Capture uma região da tela e descreva o que é acionável",
        requiredContext: ["screen"],
        executionMode: "workflow",
      },
      {
        id: "screen-window",
        title: "Janela ativa",
        icon: "app-window",
        prompt: "Capture a janela ativa e descreva o que é acionável",
        requiredContext: ["screen"],
        executionMode: "workflow",
      },
    ],
  },
  {
    id: "web",
    title: "Web",
    description: "Pesquisar com fontes",
    icon: "globe",
    category: "web",
    color: "#35d6ff",
    prompt: "Pesquise na web com fontes sobre: ",
    executionMode: "workflow",
    secondaryActions: [
      {
        id: "web-search",
        title: "Pesquisar",
        icon: "search",
        prompt: "Pesquise na web com fontes e próximos passos sobre: ",
        executionMode: "workflow",
      },
      {
        id: "web-read-url",
        title: "Ler URL",
        icon: "link",
        prompt: "Leia e extraia os pontos importantes desta URL: ",
        executionMode: "workflow",
      },
    ],
  },
  {
    id: "workflow",
    title: "Workflow",
    description: "Executar uma sequência guiada",
    icon: "workflow",
    category: "workflow",
    color: "#52e6a7",
    prompt: "Monte e execute um plano prático para: ",
    executionMode: "workflow",
    secondaryActions: [
      {
        id: "workflow-plan",
        title: "Montar plano",
        icon: "list-checks",
        prompt: "Monte um plano prático para: ",
        executionMode: "workflow",
      },
      {
        id: "workflow-checklist",
        title: "Checklist",
        icon: "check-square",
        prompt: "Transforme este objetivo em uma checklist prática: ",
        executionMode: "workflow",
      },
    ],
  },
  {
    id: "follow-up",
    title: "Acompanhamento",
    description: "Acompanhar escrita ou investigação",
    icon: "activity",
    category: "follow_up",
    color: "#22d3ee",
    prompt: "",
  },
] as const;

export function getHelixAction(id: string) {
  return HELIX_ACTIONS.find((action) => action.id === id);
}

