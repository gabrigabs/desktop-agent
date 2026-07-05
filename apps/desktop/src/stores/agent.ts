import type {
  AgentEvent,
  AppSettings,
  ApprovalRequest,
  ConnectorConfig,
  ExecutionMode,
  RunStatus,
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

type State = {
  connected: boolean;
  tools: ToolDef[];
  query: string;
  clipboardText: string;
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
  uiMode: "collapsed" | "expanded" | "workspace";
  settings: AppSettings;
  agentLogs: AgentLogEntry[];

  setConnected: (v: boolean) => void;
  setTools: (tools: ToolDef[]) => void;
  setQuery: (q: string) => void;
  setClipboardText: (t: string) => void;
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
  setUiMode: (m: "collapsed" | "expanded" | "workspace") => void;
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
  timeout: 120,
};

export const useAgentStore = create<State>((set) => ({
  connected: false,
  tools: [],
  query: "",
  clipboardText: "",
  result: null,
  streaming: false,
  events: [],
  error: null,
  executionMode: "simple",
  workflowRun: null,
  connectors: [],
  history: [],
  uiMode: "expanded",
  settings: defaultSettings,
  agentLogs: [],

  setConnected: (connected) => set({ connected }),
  setTools: (tools) => set({ tools }),
  setQuery: (query) => set({ query }),
  setClipboardText: (clipboardText) => set({ clipboardText }),
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
      result: null,
      streaming: false,
      events: [],
      error: null,
      workflowRun: null,
      agentLogs: [],
    }),
}));
