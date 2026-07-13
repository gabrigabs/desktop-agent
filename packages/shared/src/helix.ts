export type HelixActionCategory = "ask" | "clipboard" | "screen" | "web" | "workflow" | "artifact";

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

export type ArtifactAction = {
  id: string;
  title: string;
  description?: string;
  icon?: string;
  category?: string;
  prompt: string;
  requiredContext?: HelixContextSource[];
};

export type ArtifactContextPolicy = {
  canReadClipboard: boolean;
  canReadScreen: boolean;
  canUseWeb: boolean;
  canAccessFiles: boolean;
  requiresConfirmationForSensitiveActions: boolean;
};

export type ArtifactMemoryPolicy = {
  scope: "none" | "session" | "artifact" | "global";
  retention: "temporary" | "persistent";
};

export type ArtifactUiConfig = {
  preferredMode: "collapsed" | "normal" | "expanded";
  panel?: "chat" | "dashboard" | "form" | "kanban" | "document";
  resultRenderer?: string;
};

export type HelixArtifact = {
  id: string;
  name: string;
  kind: "assistant" | "workflow" | "document" | "dashboard" | "toolkit";
  icon: string;
  color: string;
  description: string;
  shortDescription: string;
  systemPrompt: string;
  defaultProfile?: string;
  capabilities: string[];
  tools: string[];
  connectors: string[];
  quickActions: ArtifactAction[];
  contextPolicy: ArtifactContextPolicy;
  memory: ArtifactMemoryPolicy;
  ui: ArtifactUiConfig;
  version: string;
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

export const HELIX_ARTIFACTS: readonly HelixArtifact[] = [
  {
    id: "finance",
    name: "Finanças",
    kind: "assistant",
    icon: "landmark",
    color: "#52e6a7",
    shortDescription: "Orçamento, dívidas e decisões de compra",
    description:
      "Ajuda a analisar gastos, dívidas, orçamento, compras grandes e decisões financeiras pessoais.",
    systemPrompt:
      "Atue como um assistente de finanças pessoais prudente. Explicite premissas, riscos e incertezas e nunca trate uma simulação como garantia.",
    capabilities: ["analysis", "planning", "comparison", "summarization"],
    tools: ["text.summarize", "calculator"],
    connectors: ["web"],
    quickActions: [
      {
        id: "finance-purchase",
        title: "Analisar compra",
        description: "Avaliar impacto, custo total e alternativas",
        icon: "shopping-bag",
        prompt: "Analise esta compra, explicite premissas e compare alternativas: ",
      },
      {
        id: "finance-debt",
        title: "Planejar quitação",
        description: "Priorizar dívidas e próximos passos",
        icon: "list-checks",
        prompt: "Crie um plano conservador de quitação para estas dívidas: ",
      },
      {
        id: "finance-budget",
        title: "Organizar orçamento",
        description: "Estruturar entradas, despesas e metas",
        icon: "table",
        prompt: "Organize um orçamento mensal prático a partir destes dados: ",
      },
      {
        id: "finance-scenario",
        title: "Simular cenário",
        description: "Comparar um cenário conservador e um provável",
        icon: "chart-no-axes-combined",
        prompt: "Simule cenários conservador e provável para esta decisão financeira: ",
      },
    ],
    contextPolicy: {
      canReadClipboard: true,
      canReadScreen: false,
      canUseWeb: true,
      canAccessFiles: false,
      requiresConfirmationForSensitiveActions: true,
    },
    memory: { scope: "session", retention: "temporary" },
    ui: { preferredMode: "expanded", panel: "dashboard" },
    version: "0.1.0",
  },
  {
    id: "code",
    name: "Código",
    kind: "assistant",
    icon: "code-2",
    color: "#60a5fa",
    shortDescription: "Debugging, revisão e arquitetura",
    description: "Ajuda a entender erros, revisar código, criar testes e planejar mudanças técnicas.",
    systemPrompt:
      "Atue como engenheiro de software. Separe evidência de hipótese, preserve o escopo pedido e inclua validação proporcional ao risco.",
    capabilities: ["debugging", "code-review", "testing", "technical-planning"],
    tools: ["text.extract", "filesystem.read"],
    connectors: ["github", "filesystem"],
    quickActions: [
      { id: "code-debug", title: "Debugar erro", prompt: "Diagnostique este erro com base nas evidências: " },
      {
        id: "code-review",
        title: "Revisar código",
        prompt: "Revise este código e priorize problemas reais: ",
      },
      { id: "code-test", title: "Criar teste", prompt: "Crie um teste focado para este comportamento: " },
      { id: "code-plan", title: "Gerar plano técnico", prompt: "Gere um plano técnico verificável para: " },
    ],
    contextPolicy: {
      canReadClipboard: true,
      canReadScreen: true,
      canUseWeb: true,
      canAccessFiles: true,
      requiresConfirmationForSensitiveActions: true,
    },
    memory: { scope: "session", retention: "temporary" },
    ui: { preferredMode: "expanded", panel: "chat" },
    version: "0.1.0",
  },
  {
    id: "study",
    name: "Estudos",
    kind: "assistant",
    icon: "graduation-cap",
    color: "#f4c542",
    shortDescription: "Planos, revisão e aprendizagem ativa",
    description: "Transforma conteúdo em planos de estudo, flashcards, resumos e simulados.",
    systemPrompt:
      "Atue como tutor. Adapte profundidade ao conteúdo fornecido, favoreça recuperação ativa e sinalize lacunas de conhecimento.",
    capabilities: ["planning", "summarization", "flashcards", "quiz"],
    tools: ["text.summarize", "text.extract"],
    connectors: ["web"],
    quickActions: [
      { id: "study-plan", title: "Criar plano", prompt: "Crie um plano de estudo realista para: " },
      { id: "study-flashcards", title: "Gerar flashcards", prompt: "Gere flashcards objetivos sobre: " },
      { id: "study-summary", title: "Resumir conteúdo", prompt: "Resuma este conteúdo para revisão: " },
      { id: "study-quiz", title: "Criar simulado", prompt: "Crie um simulado progressivo sobre: " },
    ],
    contextPolicy: {
      canReadClipboard: true,
      canReadScreen: true,
      canUseWeb: true,
      canAccessFiles: false,
      requiresConfirmationForSensitiveActions: true,
    },
    memory: { scope: "session", retention: "temporary" },
    ui: { preferredMode: "normal", panel: "document" },
    version: "0.1.0",
  },
  {
    id: "writing",
    name: "Escrita",
    kind: "assistant",
    icon: "pen-line",
    color: "#c084fc",
    shortDescription: "Clareza, tom e reescrita",
    description: "Ajuda a melhorar clareza, ajustar tom, resumir, traduzir e preparar textos profissionais.",
    systemPrompt:
      "Atue como editor. Preserve intenção e fatos, evite linguagem genérica e explique mudanças relevantes quando solicitado.",
    capabilities: ["editing", "translation", "summarization", "tone-adjustment"],
    tools: ["text.summarize", "text.translate", "text.improve"],
    connectors: [],
    quickActions: [
      { id: "writing-clarity", title: "Melhorar clareza", prompt: "Melhore a clareza sem mudar o sentido: " },
      {
        id: "writing-professional",
        title: "Tom profissional",
        prompt: "Reescreva em tom profissional e natural: ",
      },
      { id: "writing-summary", title: "Resumir", prompt: "Resuma mantendo os pontos essenciais: " },
      { id: "writing-tone", title: "Ajustar tom", prompt: "Ajuste o tom deste texto para: " },
    ],
    contextPolicy: {
      canReadClipboard: true,
      canReadScreen: false,
      canUseWeb: false,
      canAccessFiles: false,
      requiresConfirmationForSensitiveActions: false,
    },
    memory: { scope: "session", retention: "temporary" },
    ui: { preferredMode: "normal", panel: "document" },
    version: "0.1.0",
  },
  {
    id: "product",
    name: "Produto",
    kind: "assistant",
    icon: "boxes",
    color: "#35d6ff",
    shortDescription: "Ideias, PRDs, riscos e roadmaps",
    description:
      "Ajuda a refinar oportunidades, estruturar PRDs, mapear riscos e transformar ideias em entregas.",
    systemPrompt:
      "Atue como parceiro de produto. Comece pelo problema e pela evidência, explicite tradeoffs e transforme recomendações em próximos passos verificáveis.",
    capabilities: ["ideation", "prd", "risk-analysis", "roadmapping"],
    tools: ["text.extract", "web.search"],
    connectors: ["web", "github"],
    quickActions: [
      {
        id: "product-refine",
        title: "Refinar ideia",
        prompt: "Refine esta ideia a partir do problema do usuário: ",
      },
      { id: "product-prd", title: "Criar PRD", prompt: "Crie um PRD enxuto e verificável para: " },
      { id: "product-risks", title: "Mapear riscos", prompt: "Mapeie riscos, hipóteses e mitigação para: " },
      { id: "product-roadmap", title: "Gerar roadmap", prompt: "Gere um roadmap incremental para: " },
    ],
    contextPolicy: {
      canReadClipboard: true,
      canReadScreen: true,
      canUseWeb: true,
      canAccessFiles: true,
      requiresConfirmationForSensitiveActions: true,
    },
    memory: { scope: "session", retention: "temporary" },
    ui: { preferredMode: "expanded", panel: "document" },
    version: "0.1.0",
  },
] as const;

const ARTIFACT_SECONDARY_ACTIONS: HelixSecondaryAction[] = HELIX_ARTIFACTS.flatMap((artifact) =>
  artifact.quickActions.slice(0, 2).map((action) => ({
    id: `${artifact.id}-${action.id}`,
    title: action.title,
    description: action.description,
    icon: action.icon ?? artifact.icon,
    prompt: action.prompt,
    requiredContext: action.requiredContext,
  })),
);

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
    id: "artifacts",
    title: "Artefatos",
    description: "Abrir assistentes especializados",
    icon: "orbit",
    category: "artifact",
    color: "#b982ff",
    prompt: "",
    secondaryActions: ARTIFACT_SECONDARY_ACTIONS,
  },
] as const;

export function getHelixAction(id: string) {
  return HELIX_ACTIONS.find((action) => action.id === id);
}

export function getHelixArtifact(id: string) {
  return HELIX_ARTIFACTS.find((artifact) => artifact.id === id);
}
