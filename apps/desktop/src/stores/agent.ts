import type {
  AgentEvent,
  ApprovalRequest,
  AppSettings,
  ConnectorConfig,
  ContextAttachment,
  ExecutionMode,
  FileContextInput,
  FollowUpSession,
  MessageBlock,
  NativeBoundingBox,
  NativeCapturePreview,
  RunStatus,
  Space,
  SpaceMemoryFact,
  Turn,
  WorkflowRun,
  WorkflowStep,
} from "@desktop-agent/shared";
import { create } from "zustand";
import { parseAssistantContent } from "../lib/assistant-content";

type ToolDef = {
  name: string;
  description: string;
  category: string;
};

export type ScreenCaptureState = {
  preview: NativeCapturePreview | null;
  busy: boolean;
  error: string | null;
  editorAction: "screen-capture" | "screen-region" | "screen-window" | null;
  failedAction: "screen-read" | "screen-capture" | "screen-region" | "screen-window" | null;
  draft: ContextAttachment | null;
  crop: NativeBoundingBox | null;
};

export type AgentLogEntry = {
  id: string;
  type: "thought" | "tool_start" | "tool_complete" | "tool_fail" | "info";
  text: string;
  timestamp: number;
};

export type UiMode = "collapsed" | "normal" | "expanded";

export type BootState = "booting" | "ready" | "error";

type State = {
  connected: boolean;
  bootState: BootState;
  bootError: string | null;
  tools: ToolDef[];
  query: string;
  clipboardText: string;
  ignoreClipboard: boolean;
  fileContext: FileContextInput[];
  contexts: ContextAttachment[];
  messages: Turn[];
  assistantDraft: string;
  currentConversationId: string | null;
  currentProfileId: string | null;
  result: string | null;
  streaming: boolean;
  events: AgentEvent[];
  error: string | null;
  executionMode: ExecutionMode;
  selectedWorkflowId: string | null;
  selectedSkillId: string | null;
  workflowRun: WorkflowRun | null;
  connectors: ConnectorConfig[];
  history: Array<{
    id: string;
    timestamp: string;
    toolName: string;
    inputPreview: string;
    outputPreview: string;
    success?: boolean;
    errorMessage?: string;
  }>;
  uiMode: UiMode;
  settings: AppSettings;
  agentLogs: AgentLogEntry[];
  screenCapture: ScreenCaptureState;
  pendingScreenAction: "screen-read" | "screen-capture" | "screen-region" | "screen-window" | null;
  activeComposerActionId: string;
  activeSpaceId: string | null;
  spaces: Space[];
  memoryFacts: SpaceMemoryFact[];
  followUpSessions: FollowUpSession[];
  activeFollowUpSession: FollowUpSession | null;

  setActiveSpaceId: (id: string | null) => void;
  setSpaces: (spaces: Space[]) => void;
  setMemoryFacts: (facts: SpaceMemoryFact[]) => void;
  addSpace: (space: Space) => void;
  updateSpaceInList: (id: string, updates: Partial<Space>) => void;
  removeSpaceFromList: (id: string) => void;
  addMemoryFactToStore: (fact: SpaceMemoryFact) => void;
  updateMemoryFactInStore: (id: string, updates: Partial<SpaceMemoryFact>) => void;
  removeMemoryFactFromStore: (id: string) => void;
  setFollowUpSessions: (sessions: FollowUpSession[]) => void;
  setActiveFollowUpSession: (session: FollowUpSession | null) => void;

  setConnected: (v: boolean) => void;
  setBootState: (s: BootState) => void;
  setBootError: (e: string | null) => void;
  setTools: (tools: ToolDef[]) => void;
  setQuery: (q: string) => void;
  setClipboardText: (t: string) => void;
  setIgnoreClipboard: (v: boolean) => void;
  setFileContext: (files: FileContextInput[]) => void;
  addFileContext: (files: FileContextInput[]) => void;
  removeFileContext: (path: string) => void;
  clearFileContext: () => void;
  setContexts: (contexts: ContextAttachment[]) => void;
  addContext: (context: ContextAttachment) => void;
  toggleContext: (id: string) => void;
  removeContext: (id: string) => void;
  clearContexts: () => void;
  setMessages: (messages: Turn[]) => void;
  addTurn: (turn: Turn) => void;
  updateLastTurn: (update: Partial<Turn>) => void;
  clearMessages: () => void;
  setCurrentConversationId: (id: string | null) => void;
  setCurrentProfileId: (id: string | null) => void;
  startUserTurn: (params: {
    prompt: string;
    sourceMode: "free" | "clipboard";
    blocks?: Turn["blocks"];
    profileId?: string;
  }) => void;
  appendAssistantChunk: (chunk: string) => void;
  finalizeAssistantTurn: (status: "complete" | "error" | "cancelled", errorMessage?: string) => void;
  setResult: (r: string | null) => void;
  setStreaming: (v: boolean) => void;
  addEvent: (e: AgentEvent) => void;
  appendAssistantBlock: (block: MessageBlock) => void;
  updateAssistantBlock: (index: number, update: Partial<MessageBlock>) => void;
  setError: (e: string | null) => void;
  setExecutionMode: (mode: ExecutionMode) => void;
  setSelectedWorkflowId: (id: string | null) => void;
  setSelectedSkillId: (id: string | null) => void;
  setWorkflowRun: (run: WorkflowRun | null) => void;
  upsertWorkflowStep: (step: WorkflowStep) => void;
  setWorkflowApproval: (approval: ApprovalRequest | undefined) => void;
  setWorkflowStatus: (status: RunStatus) => void;
  setConnectors: (connectors: ConnectorConfig[]) => void;
  setHistory: (h: State["history"]) => void;
  setUiMode: (m: UiMode) => void;
  setSettings: (s: AppSettings) => void;
  addAgentLog: (entry: Omit<AgentLogEntry, "id" | "timestamp">) => void;
  clearAgentLogs: () => void;
  setScreenCapture: (state: Partial<ScreenCaptureState>) => void;
  clearScreenCapture: () => void;
  setPendingScreenAction: (
    action: "screen-read" | "screen-capture" | "screen-region" | "screen-window" | null,
  ) => void;
  setActiveComposerActionId: (actionId: string) => void;
  reset: () => void;
};

const defaultSettings: AppSettings = {
  activeProvider: "mock",
  apiKey: "",
  baseUrl: "",
  model: "",
  hidePet: false,
  alwaysOnTop: false,
  timeout: 120,
  windowOpacity: 0.72,
  petSize: 56,
  language: "pt-BR",
  notificationsEnabled: false,
  notificationContentMode: "generic",
  defaultWindowMode: "normal",
};

const defaultConnectors: ConnectorConfig[] = [
  {
    id: "playwright",
    name: "Playwright MCP",
    kind: "mcp",
    enabled: false,
    command: "npx",
    args: ["-y", "@playwright/mcp@latest"],
    preset: true,
    permissionPolicy: ["browser.control", "network"],
    createdAt: "",
    updatedAt: "",
  },
  {
    id: "filesystem-scoped",
    name: "Filesystem escopado",
    kind: "mcp",
    enabled: false,
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-filesystem", "$HOME/Desktop"],
    preset: true,
    permissionPolicy: ["local.read", "local.write"],
    createdAt: "",
    updatedAt: "",
  },
  {
    id: "sqlite-readonly",
    name: "SQLite read-only",
    kind: "mcp",
    enabled: false,
    command: "uvx",
    args: ["mcp-server-sqlite", "--db-path", "$HOME/.desktop-agent/data.db"],
    preset: true,
    permissionPolicy: ["local.read"],
    createdAt: "",
    updatedAt: "",
  },
  {
    id: "brave-search",
    name: "Brave Search",
    kind: "mcp",
    enabled: false,
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-brave-search"],
    preset: true,
    permissionPolicy: ["network", "external"],
    createdAt: "",
    updatedAt: "",
  },
  {
    id: "jina-reader",
    name: "Jina Reader/Search",
    kind: "local",
    enabled: true,
    command: "r.jina.ai / s.jina.ai",
    args: [],
    preset: true,
    permissionPolicy: ["network"],
    createdAt: "",
    updatedAt: "",
  },
];

export const useAgentStore = create<State>((set) => ({
  connected: false,
  bootState: "booting",
  bootError: null,
  tools: [],
  query: "",
  clipboardText: "",
  ignoreClipboard: true,
  fileContext: [],
  contexts: [],
  messages: [],
  assistantDraft: "",
  currentConversationId: null,
  currentProfileId: null,
  result: null,
  streaming: false,
  events: [],
  error: null,
  executionMode: "simple",
  selectedWorkflowId: null,
  selectedSkillId: null,
  workflowRun: null,
  connectors: defaultConnectors,
  history: [],
  uiMode: "normal",
  settings: defaultSettings,
  agentLogs: [],
  screenCapture: {
    preview: null,
    busy: false,
    error: null,
    editorAction: null,
    failedAction: null,
    draft: null,
    crop: null,
  },
  pendingScreenAction: null,
  activeComposerActionId: "pergunta-livre",
  activeSpaceId: null,
  spaces: [],
  memoryFacts: [],
  followUpSessions: [],
  activeFollowUpSession: null,

  setActiveSpaceId: (activeSpaceId) => set({ activeSpaceId }),
  setSpaces: (spaces) => set({ spaces }),
  setMemoryFacts: (memoryFacts) => set({ memoryFacts }),
  addSpace: (space) => set((s) => ({ spaces: [...s.spaces, space] })),
  updateSpaceInList: (id, updates) =>
    set((s) => ({
      spaces: s.spaces.map((w) => (w.id === id ? { ...w, ...updates } : w)),
    })),
  removeSpaceFromList: (id) =>
    set((s) => ({
      spaces: s.spaces.filter((w) => w.id !== id),
      activeSpaceId: s.activeSpaceId === id ? null : s.activeSpaceId,
    })),
  addMemoryFactToStore: (fact) => set((s) => ({ memoryFacts: [fact, ...s.memoryFacts] })),
  updateMemoryFactInStore: (id, updates) =>
    set((s) => ({
      memoryFacts: s.memoryFacts.map((f) => (f.id === id ? { ...f, ...updates } : f)),
    })),
  removeMemoryFactFromStore: (id) => set((s) => ({ memoryFacts: s.memoryFacts.filter((f) => f.id !== id) })),
  setFollowUpSessions: (followUpSessions) => set({ followUpSessions }),
  setActiveFollowUpSession: (activeFollowUpSession) => set({ activeFollowUpSession }),

  setConnected: (connected) => set({ connected }),
  setBootState: (bootState) => set({ bootState }),
  setBootError: (bootError) => set({ bootError }),
  setTools: (tools) => set({ tools }),
  setQuery: (query) => set({ query }),
  setClipboardText: (clipboardText) => set({ clipboardText }),
  setIgnoreClipboard: (ignoreClipboard) => set({ ignoreClipboard }),
  setFileContext: (fileContext) => set({ fileContext }),
  addFileContext: (files) =>
    set((s) => {
      const byPath = new Map(s.fileContext.map((file) => [file.path, file]));
      for (const file of files) byPath.set(file.path, file);
      return { fileContext: [...byPath.values()] };
    }),
  removeFileContext: (path) => set((s) => ({ fileContext: s.fileContext.filter((f) => f.path !== path) })),
  clearFileContext: () => set({ fileContext: [] }),
  setContexts: (contexts) => set({ contexts }),
  addContext: (context) =>
    set((s) => ({ contexts: [...s.contexts.filter((item) => item.id !== context.id), context] })),
  toggleContext: (id) =>
    set((s) => ({
      contexts: s.contexts.map((item) => (item.id === id ? { ...item, enabled: !item.enabled } : item)),
    })),
  removeContext: (id) => set((s) => ({ contexts: s.contexts.filter((item) => item.id !== id) })),
  clearContexts: () => set({ contexts: [] }),
  setMessages: (messages) => set({ messages, assistantDraft: "" }),
  addTurn: (turn) => set((s) => ({ messages: [...s.messages, turn] })),
  updateLastTurn: (update) =>
    set((s) => {
      if (s.messages.length === 0) return s;
      const messages = [...s.messages];
      const last = messages[messages.length - 1];
      if (!last) return s;
      messages[messages.length - 1] = { ...last, ...update };
      return { messages };
    }),
  clearMessages: () => set({ messages: [], assistantDraft: "" }),
  setCurrentConversationId: (currentConversationId) => set({ currentConversationId }),
  setCurrentProfileId: (currentProfileId) => set({ currentProfileId }),
  startUserTurn: ({ prompt, sourceMode, blocks, profileId }) =>
    set((s) => {
      const now = Date.now();
      const executionMode = s.executionMode;
      const currentConversationId = s.currentConversationId ?? crypto.randomUUID();
      const currentProfileId = s.currentProfileId ?? profileId ?? null;
      const userTurn: Turn = {
        id: crypto.randomUUID(),
        role: "user",
        blocks: blocks ?? [{ type: "text", content: prompt }],
        status: "complete",
        timestamp: now,
        sourceMode,
        executionMode,
        profileId: currentProfileId ?? undefined,
      };
      const assistantTurn: Turn = {
        id: crypto.randomUUID(),
        role: "assistant",
        blocks: [{ type: "text", content: "" }],
        status: "streaming",
        timestamp: now + 1,
        sourceMode,
        executionMode,
        profileId: currentProfileId ?? undefined,
      };
      return {
        messages: [...s.messages, userTurn, assistantTurn],
        assistantDraft: "",
        currentConversationId,
        currentProfileId,
        result: "",
      };
    }),
  appendAssistantChunk: (chunk) =>
    set((s) => {
      if (s.messages.length === 0) return s;
      const messages = [...s.messages];
      const last = messages[messages.length - 1];
      if (last?.role !== "assistant") return s;

      const assistantDraft = s.assistantDraft + chunk;
      const parsedBlocks = parseAssistantContent(assistantDraft, last.status === "streaming");

      const toolCallBlocks = last.blocks.filter((b) => b.type === "tool_call");
      const blocks = [...toolCallBlocks, ...parsedBlocks];

      messages[messages.length - 1] = { ...last, blocks };

      const textContent = parsedBlocks
        .filter((b): b is { type: "text"; content: string } => b.type === "text")
        .map((b) => b.content)
        .join("");

      return { messages, assistantDraft, result: textContent };
    }),
  finalizeAssistantTurn: (status, errorMessage) =>
    set((s) => {
      if (s.messages.length === 0) return s;
      const messages = [...s.messages];
      const last = messages[messages.length - 1];
      if (last?.role !== "assistant" || last.status !== "streaming") return s;
      const toolCallBlocks = last.blocks.filter((b) => b.type === "tool_call");
      const parsedBlocks = s.assistantDraft
        ? parseAssistantContent(s.assistantDraft, false)
        : last.blocks.filter((b) => b.type !== "tool_call");
      const completedBlocks = [...toolCallBlocks, ...parsedBlocks];
      const blocks =
        status === "error" && errorMessage
          ? [...completedBlocks, { type: "error" as const, message: errorMessage }]
          : completedBlocks;
      const result = parsedBlocks
        .filter((block) => block.type === "text")
        .map((block) => (block.type === "text" ? block.content : ""))
        .join("");
      messages[messages.length - 1] = { ...last, status, blocks };
      return { messages, assistantDraft: "", result: result || s.result, streaming: false };
    }),
  setResult: (result) => set({ result }),
  setStreaming: (streaming) => set({ streaming }),
  addEvent: (event) => set((s) => ({ events: [...s.events, event] })),
  appendAssistantBlock: (block) =>
    set((s) => {
      if (s.messages.length === 0) return s;
      const messages = [...s.messages];
      const last = messages[messages.length - 1];
      if (last?.role !== "assistant") return s;
      if (block.type === "text" && last.blocks.length > 0) {
        const lastBlock = last.blocks[last.blocks.length - 1];
        if (lastBlock?.type === "text") {
          return s;
        }
      }
      messages[messages.length - 1] = { ...last, blocks: [...last.blocks, block] };
      return { messages };
    }),
  updateAssistantBlock: (index, update) =>
    set((s) => {
      if (s.messages.length === 0) return s;
      const messages = [...s.messages];
      const last = messages[messages.length - 1];
      if (last?.role !== "assistant" || !last.blocks[index]) return s;
      messages[messages.length - 1] = {
        ...last,
        blocks: last.blocks.map((block, i) =>
          i === index ? ({ ...block, ...update } as MessageBlock) : block,
        ),
      };
      return { messages };
    }),
  setError: (error) => set({ error }),
  setExecutionMode: (executionMode) => set({ executionMode }),
  setSelectedWorkflowId: (selectedWorkflowId) => set({ selectedWorkflowId }),
  setSelectedSkillId: (selectedSkillId) => set({ selectedSkillId }),
  setWorkflowRun: (workflowRun) => set({ workflowRun }),
  upsertWorkflowStep: (step) =>
    set((s) => {
      if (!step) return s;
      const current = s.workflowRun;
      if (!current || current.id !== step.runId) {
        return s;
      }

      const nextSteps = [...(current.steps ?? []).filter((item) => item.id !== step.id), step].sort(
        (a, b) => a.stepIndex - b.stepIndex,
      );
      return {
        workflowRun: {
          ...current,
          currentStep: Math.max(current.currentStep, step.stepIndex),
          steps: nextSteps,
        },
      };
    }),
  setWorkflowApproval: (approval) =>
    set((s) => ({
      workflowRun: s.workflowRun
        ? {
            ...s.workflowRun,
            approval,
            status: approval ? "waiting_approval" : s.workflowRun.status,
          }
        : s.workflowRun,
    })),
  setWorkflowStatus: (status) =>
    set((s) => ({
      workflowRun: s.workflowRun
        ? {
            ...s.workflowRun,
            status,
          }
        : s.workflowRun,
    })),
  setConnectors: (connectors) => set({ connectors }),
  setHistory: (history) => set({ history }),
  setUiMode: (uiMode) => set({ uiMode }),
  setSettings: (settings) => set({ settings }),
  addAgentLog: (entry) =>
    set((s) => ({
      agentLogs: [
        ...s.agentLogs,
        {
          ...entry,
          id: crypto.randomUUID(),
          timestamp: Date.now(),
        },
      ],
    })),
  clearAgentLogs: () => set({ agentLogs: [] }),
  setScreenCapture: (partial) => set((s) => ({ screenCapture: { ...s.screenCapture, ...partial } })),
  clearScreenCapture: () =>
    set({
      screenCapture: {
        preview: null,
        busy: false,
        error: null,
        editorAction: null,
        failedAction: null,
        draft: null,
        crop: null,
      },
    }),
  setPendingScreenAction: (action) => set({ pendingScreenAction: action }),
  setActiveComposerActionId: (activeComposerActionId) => set({ activeComposerActionId }),
  reset: () =>
    set({
      query: "",
      messages: [],
      assistantDraft: "",
      currentConversationId: null,
      currentProfileId: null,
      result: null,
      streaming: false,
      events: [],
      error: null,
      selectedWorkflowId: null,
      selectedSkillId: null,
      workflowRun: null,
      agentLogs: [],
      contexts: [],
      screenCapture: {
        preview: null,
        busy: false,
        error: null,
        editorAction: null,
        failedAction: null,
        draft: null,
        crop: null,
      },
      pendingScreenAction: null,
      activeComposerActionId: "pergunta-livre",
      // Keep the selected Space when starting a fresh conversation inside it.
    }),
}));
