import { execSync, spawn } from "node:child_process";
import { createProvider } from "@desktop-agent/provider-gateway";
import type { AgentApi, AppSettings } from "@desktop-agent/shared";
import { getDb, getRecentInteractions, getSetting, setSetting } from "@desktop-agent/storage";
import { registry } from "@desktop-agent/tool-registry";
import { createClipboardTool } from "@desktop-agent/tools-desktop";
import { createRewriteTool, createSummarizeTool, createTranslateTool } from "@desktop-agent/tools-text";
import { Orchestrator } from "./orchestrator";

// Client API reference for streaming events
let clientApi: any = null;
export function setClientApi(api: any) {
  clientApi = api;
}

// Clipboard context wrapper for Bun environment (macOS native pbcopy/pbpaste)
const clipboardCtx = {
  clipboard: {
    async read(): Promise<string> {
      try {
        return execSync("pbpaste", { encoding: "utf-8" });
      } catch {
        return "";
      }
    },
    async write(text: string): Promise<void> {
      try {
        const child = spawn("pbcopy");
        child.stdin.write(text);
        child.stdin.end();
      } catch (err) {
        console.error("Failed to write to clipboard:", err);
      }
    },
  },
};

// Retrieve active provider configuration from the settings table
function getActiveProviderConfig() {
  const db = getDb();
  const activeProvider = getSetting(db, "activeProvider") || "mock";
  const apiKey = getSetting(db, "apiKey") || "";
  const baseUrl = getSetting(db, "baseUrl") || "";
  const model = getSetting(db, "model") || "";
  const hidePet = getSetting(db, "hidePet") === "true";
  const timeoutVal = getSetting(db, "timeout");
  const timeout = timeoutVal ? Number.parseInt(timeoutVal, 10) : 120;

  return { activeProvider, apiKey, baseUrl, model, hidePet, timeout };
}

// Dynamically create the LLM provider based on current database settings
function getLlmProvider() {
  const config = getActiveProviderConfig();
  const timeoutMs = config.timeout * 1000;

  if (config.activeProvider === "mock") {
    return createProvider({ kind: "mock" });
  }

  if (config.activeProvider === "pinstripes") {
    return createProvider({
      kind: "pinstripes",
      apiKey: config.apiKey,
      timeout: timeoutMs,
    });
  }

  // OpenAI or Gemini or Custom (OpenAI Compatible)
  const defaultBaseUrls: Record<string, string> = {
    openai: "https://api.openai.com/v1",
    gemini: "https://generativetooling.googleapis.com/v1",
  };

  const finalBaseUrl =
    config.baseUrl || defaultBaseUrls[config.activeProvider] || "https://api.openai.com/v1";

  return createProvider({
    kind: "openai-compatible",
    apiKey: config.apiKey,
    baseUrl: finalBaseUrl,
    name: config.activeProvider,
    timeout: timeoutMs,
  });
}

// Proxy provider that dynamically resolves to the active provider on every call
const proxyProvider = {
  get name() {
    return getLlmProvider().name;
  },
  get kind() {
    return getLlmProvider().kind;
  },
  complete(input: any) {
    return getLlmProvider().complete(input);
  },
  stream(input: any) {
    return getLlmProvider().stream(input);
  },
} as any;

// Get dynamic context for text tools
const ctx = {
  get provider() {
    return proxyProvider;
  },
  get model() {
    return getActiveProviderConfig().model || "gpt-4o";
  },
};

// Register all tools
registry.register(createRewriteTool(ctx));
registry.register(createSummarizeTool(ctx));
registry.register(createTranslateTool(ctx));
registry.register(createClipboardTool(clipboardCtx));

const orchestrator = new Orchestrator({ provider: proxyProvider });

export type { AgentApi };

export const agentApi: AgentApi = {
  async ping() {
    return { status: "ok" };
  },

  async execute({ requestId, toolName, input }) {
    const execution = await orchestrator.execute(requestId, toolName, input);
    return execution;
  },

  async listTools() {
    return registry.list().map((t) => ({
      name: t.name,
      description: t.description,
      category: t.category,
    }));
  },

  async getProviders() {
    const active = getLlmProvider();
    const config = getActiveProviderConfig();
    return [
      {
        id: config.activeProvider,
        name: config.activeProvider,
        kind: active.kind,
        baseUrl: config.baseUrl,
        apiKeyEnv: "AGENT_API_KEY",
        models: [config.model],
      },
    ];
  },

  async getHistory({ limit } = { limit: 20 }) {
    return getRecentInteractions(getDb(), limit);
  },

  async getSettings(): Promise<AppSettings> {
    const config = getActiveProviderConfig();
    return {
      activeProvider: config.activeProvider,
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      model: config.model,
      hidePet: config.hidePet,
      timeout: config.timeout,
    };
  },

  async saveSettings(settings: AppSettings): Promise<void> {
    const db = getDb();
    setSetting(db, "activeProvider", settings.activeProvider);
    setSetting(db, "apiKey", settings.apiKey);
    setSetting(db, "baseUrl", settings.baseUrl);
    setSetting(db, "model", settings.model);
    setSetting(db, "hidePet", settings.hidePet ? "true" : "false");
    setSetting(db, "timeout", String(settings.timeout));
  },

  async fetchModels(provider: string, apiKey: string, baseUrl?: string): Promise<string[]> {
    if (provider === "mock") {
      return ["mock-model"];
    }
    if (provider === "pinstripes") {
      return ["ps/warp", "ps/thinking", "ps/pro"];
    }

    const defaultBaseUrls: Record<string, string> = {
      openai: "https://api.openai.com/v1",
      gemini: "https://generativetooling.googleapis.com/v1",
    };

    const finalBaseUrl = baseUrl || defaultBaseUrls[provider] || "https://api.openai.com/v1";

    try {
      const res = await fetch(`${finalBaseUrl}/models`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });

      if (!res.ok) {
        throw new Error(`Error: ${res.status}`);
      }

      const data = (await res.json()) as { data: Array<{ id: string }> };
      return data.data.map((m) => m.id);
    } catch (err) {
      console.error("Failed to fetch models from API:", err);
      if (provider === "openai") return ["gpt-4o", "gpt-4o-mini", "o1-mini", "o1-preview"];
      if (provider === "gemini")
        return ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-1.5-flash", "gemini-1.5-pro"];
      return ["gpt-4o", "gpt-4o-mini", "gemini-2.5-flash"];
    }
  },

  async runAgent({ requestId, query, clipboardText }) {
    const events: any[] = [];
    const emit = (event: any) => {
      events.push(event);
      if (clientApi?.onEvent) {
        clientApi.onEvent(event).catch((err: any) => {
          console.error("Failed to emit event to client:", err);
        });
      }
    };

    const result = await orchestrator.runAgent(
      requestId,
      query,
      clipboardText,
      emit,
      getLlmProvider,
      () => getActiveProviderConfig().model,
    );

    return { result, events };
  },

  async shutdown() {
    orchestrator.shutdown();
  },
};
