import type { AgentEvent } from "@desktop-agent/shared";
import { create } from "zustand";

type ToolDef = {
  name: string;
  description: string;
  category: string;
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
  history: Array<{
    id: string;
    timestamp: string;
    tool_name: string;
    input_preview: string;
    output_preview: string;
  }>;
  uiMode: "collapsed" | "expanded";

  setConnected: (v: boolean) => void;
  setTools: (tools: ToolDef[]) => void;
  setQuery: (q: string) => void;
  setClipboardText: (t: string) => void;
  setResult: (r: string | null) => void;
  setStreaming: (v: boolean) => void;
  addEvent: (e: AgentEvent) => void;
  setError: (e: string | null) => void;
  setHistory: (h: State["history"]) => void;
  setUiMode: (m: "collapsed" | "expanded") => void;
  reset: () => void;
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
  history: [],
  uiMode: "expanded",

  setConnected: (connected) => set({ connected }),
  setTools: (tools) => set({ tools }),
  setQuery: (query) => set({ query }),
  setClipboardText: (clipboardText) => set({ clipboardText }),
  setResult: (result) => set({ result }),
  setStreaming: (streaming) => set({ streaming }),
  addEvent: (event) => set((s) => ({ events: [...s.events, event] })),
  setError: (error) => set({ error }),
  setHistory: (history) => set({ history }),
  setUiMode: (uiMode) => set({ uiMode }),
  reset: () =>
    set({
      query: "",
      result: null,
      streaming: false,
      events: [],
      error: null,
    }),
}));
