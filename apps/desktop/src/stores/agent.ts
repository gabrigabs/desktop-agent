import type {
  AgentEvent,
  ApprovalRequest,
  AppSettings,
  ConnectorConfig,
  ExecutionMode,
  RunStatus,
  Turn,
  WorkflowRun,
  WorkflowStep,
} from "@desktop-agent/shared";
import { create } from "zustand";

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

type State = {
  connected: boolean;
  tools: ToolDef[];
  query: string;
  clipboardText: string;
  messages: Turn[];
  currentConversationId: string | null;
  result: string | null;
  streaming: boolean;
  events: AgentEvent[];
  error: string | null;
  executionMode: ExecutionMode;
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
  setTools: (tools: ToolDef[]) => void;
  setQuery: (q: string) => void;
  setClipboardText: (t: string) => void;
  setMessages: (messages: Turn[]) => void;
  addTurn: (turn: Turn) => void;
  updateLastTurn: (update: Partial<Turn>) => void;
  clearMessages: () => void;
  setCurrentConversationId: (id: string | null) => void;
  startUserTurn: (prompt: string, sourceMode: "free" | "clipboard") => void;
  appendAssistantChunk: (chunk: string) => void;
  finalizeAssistantTurn: (status: "complete" | "error" | "cancelled", errorMessage?: string) => void;
  setResult: (r: string | null) => void;
  setStreaming: (v: boolean) => void;
  addEvent: (e: AgentEvent) => void;
  setError: (e: string | null) => void;
  setExecutionMode: (mode: ExecutionMode) => void;
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
  petSize: 72,
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
  tools: [],
  query: "",
  clipboardText: "",
  messages: [],
  currentConversationId: null,
  result: null,
  streaming: false,
  events: [],
  error: null,
  executionMode: "simple",
  workflowRun: null,
  connectors: defaultConnectors,
  history: [],
  uiMode: "normal",
  settings: defaultSettings,
  agentLogs: [],

  setConnected: (connected) => set({ connected }),
  setTools: (tools) => set({ tools }),
  setQuery: (query) => set({ query }),
  setClipboardText: (clipboardText) => set({ clipboardText }),
  setMessages: (messages) => set({ messages }),
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
  clearMessages: () => set({ messages: [] }),
  setCurrentConversationId: (currentConversationId) => set({ currentConversationId }),
  startUserTurn: (prompt, sourceMode) =>
    set((s) => {
      const now = Date.now();
      const executionMode = s.executionMode;
      const userTurn: Turn = {
        id: crypto.randomUUID(),
        role: "user",
        blocks: [{ type: "text", content: prompt }],
        status: "complete",
        timestamp: now,
        sourceMode,
        executionMode,
      };
      const assistantTurn: Turn = {
        id: crypto.randomUUID(),
        role: "assistant",
        blocks: [{ type: "text", content: "" }],
        status: "streaming",
        timestamp: now + 1,
        sourceMode,
        executionMode,
      };
      const currentConversationId = s.currentConversationId ?? crypto.randomUUID();
      return {
        messages: [...s.messages, userTurn, assistantTurn],
        currentConversationId,
        result: "",
      };
    }),
  appendAssistantChunk: (chunk) =>
    set((s) => {
      if (s.messages.length === 0) return s;
      const messages = [...s.messages];
      const last = messages[messages.length - 1];
      if (last?.role !== "assistant") return s;

      const blocks = [...last.blocks];
      const lastBlock = blocks[blocks.length - 1];
      if (lastBlock && lastBlock.type === "text") {
        blocks[blocks.length - 1] = { type: "text", content: lastBlock.content + chunk };
      } else {
        blocks.push({ type: "text" as const, content: chunk });
      }

      messages[messages.length - 1] = { ...last, blocks };

      const textContent = blocks
        .filter((b): b is { type: "text"; content: string } => b.type === "text")
        .map((b) => b.content)
        .join("");

      return { messages, result: textContent };
    }),
  finalizeAssistantTurn: (status, errorMessage) =>
    set((s) => {
      if (s.messages.length === 0) return s;
      const messages = [...s.messages];
      const last = messages[messages.length - 1];
      if (last?.role !== "assistant" || last.status !== "streaming") return s;
      const blocks =
        status === "error" && errorMessage
          ? [...last.blocks, { type: "error" as const, message: errorMessage }]
          : last.blocks;
      messages[messages.length - 1] = { ...last, status, blocks };
      return { messages, streaming: false };
    }),
  setResult: (result) => set({ result }),
  setStreaming: (streaming) => set({ streaming }),
  addEvent: (event) => set((s) => ({ events: [...s.events, event] })),
  setError: (error) => set({ error }),
  setExecutionMode: (executionMode) => set({ executionMode }),
  setWorkflowRun: (workflowRun) => set({ workflowRun }),
  upsertWorkflowStep: (step) =>
    set((s) => {
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
      currentConversationId: null,
      result: null,
      streaming: false,
      events: [],
      error: null,
      workflowRun: null,
      agentLogs: [],
    }),
}));
