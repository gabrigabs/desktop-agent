import type {
  AgentEvent,
  ApprovalRequest,
  AppSettings,
  ConnectorConfig,
  ExecutionMode,
  FileContextInput,
  RunStatus,
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
  reset: () => void;
};

const defaultSettings: AppSettings = {
  activeProvider: "mock",
  apiKey: "",
  baseUrl: "",
  model: "",
  hidePet: false,
  alwaysOnTop: false,
  lastWindowMode: "normal",
  timeout: 120,
  windowOpacity: 0.72,
  petSize: 56,
  language: "pt-BR",
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
      const blocks = parseAssistantContent(assistantDraft, last.status === "streaming");

      messages[messages.length - 1] = { ...last, blocks };

      const textContent = blocks
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
      const completedBlocks = s.assistantDraft ? parseAssistantContent(s.assistantDraft, false) : last.blocks;
      const blocks =
        status === "error" && errorMessage
          ? [...completedBlocks, { type: "error" as const, message: errorMessage }]
          : completedBlocks;
      const result = completedBlocks
        .filter((block) => block.type === "text")
        .map((block) => (block.type === "text" ? block.content : ""))
        .join("");
      messages[messages.length - 1] = { ...last, status, blocks };
      return { messages, assistantDraft: "", result: result || s.result, streaming: false };
    }),
  setResult: (result) => set({ result }),
  setStreaming: (streaming) => set({ streaming }),
  addEvent: (event) => set((s) => ({ events: [...s.events, event] })),
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
    }),
}));
