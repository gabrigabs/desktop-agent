import { execSync, spawn } from "node:child_process";
import { createProvider } from "@desktop-agent/provider-gateway";
import type { AgentApi, AgentEvent, AppSettings, WorkflowRun } from "@desktop-agent/shared";
import {
  createInteraction,
  createMcpServer as createStoredMcpServer,
  createWorkflowRun,
  createWorkflowStep,
  deleteMcpServer as deleteStoredMcpServer,
  ensureDefaultMcpPresets,
  getDb,
  getRecentInteractions,
  getSetting,
  getMcpServer as getStoredMcpServer,
  getWorkflowRun,
  listMcpServers as listStoredMcpServers,
  listWorkflowRuns,
  listWorkflowTemplates,
  setSetting,
  updateMcpServerStatus,
  updateWorkflowRun,
  upsertMcpServer,
} from "@desktop-agent/storage";
import { registry } from "@desktop-agent/tool-registry";
import { createClipboardTool } from "@desktop-agent/tools-desktop";
import { createRewriteTool, createSummarizeTool, createTranslateTool } from "@desktop-agent/tools-text";
import { Orchestrator } from "./orchestrator";

// Client API reference for streaming events
let clientApi: any = null;
export function setClientApi(api: any) {
  clientApi = api;
}

const runningRequests = new Map<string, AbortController>();
const runningRuns = new Map<string, AbortController>();

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
  const model = getSetting(db, "model") || (activeProvider === "pinstripes" ? "ps/warp" : "");
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

function previewText(value: string, limit = 500) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= limit) return normalized;
  return `${normalized.slice(0, limit - 3)}...`;
}

function formatAgentInputPreview(query: string, clipboardText?: string) {
  if (clipboardText?.trim()) {
    return previewText(`Pedido: ${query} | Clipboard: ${clipboardText}`);
  }
  return previewText(query);
}

function emitToClient(event: AgentEvent) {
  if (clientApi?.onEvent) {
    clientApi.onEvent(event).catch((err: any) => {
      console.error("Failed to emit event to client:", err);
    });
  }
}

function workflowEventsForRun(requestId: string, run: WorkflowRun): AgentEvent[] {
  const events: AgentEvent[] = [{ type: "workflow.started", requestId, runId: run.id, mode: run.mode }];
  for (const step of run.steps ?? []) {
    events.push({ type: "workflow.step", requestId, runId: run.id, step });
  }
  if (run.approval) {
    events.push({ type: "workflow.approval_required", requestId, runId: run.id, approval: run.approval });
  }
  events.push({ type: "workflow.completed", requestId, runId: run.id, status: run.status });
  return events;
}

function listToolCapabilities() {
  return registry.list().map((t) => ({
    name: t.name,
    description: t.description,
    category: t.category,
    permissionLevel: t.permissionLevel,
  }));
}

function createQueuedRun(input: {
  prompt: string;
  mode: "simple" | "workflow";
  sourceMode?: "free" | "clipboard";
  clipboardText?: string;
  maxSteps?: number;
}) {
  const db = getDb();
  const config = getActiveProviderConfig();
  const provider = getLlmProvider();
  const runId = createWorkflowRun(db, {
    mode: input.mode,
    status: "queued",
    prompt: input.prompt,
    sourceMode: input.sourceMode ?? (input.clipboardText?.trim() ? "clipboard" : "free"),
    clipboardText: input.clipboardText,
    providerId: provider.name,
    model: config.model,
    maxSteps: input.maxSteps ?? 8,
    metadata: {
      createdBy: "desktop-agent",
      timeoutSeconds: config.timeout,
    },
  });

  createWorkflowStep(db, {
    runId,
    stepIndex: 1,
    kind: "plan",
    status: "pending",
    title: input.mode === "workflow" ? "Preparar workflow" : "Preparar resposta simples",
    detail:
      input.mode === "workflow"
        ? "Aguardando a engine de workflow iniciar o plano."
        : "Aguardando execução direta do agente.",
    output: {
      maxSteps: input.maxSteps ?? 8,
      sourceMode: input.sourceMode ?? (input.clipboardText?.trim() ? "clipboard" : "free"),
    },
  });

  return getWorkflowRun(db, runId) as WorkflowRun;
}

function ensureMcpReady() {
  ensureDefaultMcpPresets(getDb());
}

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

  async startRun(input) {
    const run = createQueuedRun({
      prompt: input.prompt,
      mode: input.mode,
      sourceMode: input.sourceMode,
      clipboardText: input.clipboardText,
      maxSteps: input.maxSteps,
    });
    const events = workflowEventsForRun(input.requestId, run);
    for (const event of events) {
      emitToClient(event);
    }
    return { run, events };
  },

  async cancelRun({ runId }) {
    const controller = runningRuns.get(runId);
    if (controller) {
      controller.abort();
      runningRuns.delete(runId);
    }

    const run = getWorkflowRun(getDb(), runId);
    if (!run || ["completed", "failed", "cancelled"].includes(run.status)) {
      return { cancelled: Boolean(controller) };
    }

    updateWorkflowRun(getDb(), runId, {
      status: "cancelled",
      completedAt: new Date().toISOString(),
      errorMessage: "Workflow abortado pelo usuário.",
    });
    return { cancelled: true };
  },

  async getRun({ runId }) {
    return getWorkflowRun(getDb(), runId);
  },

  async listRuns({ limit } = { limit: 20 }) {
    return listWorkflowRuns(getDb(), limit);
  },

  async resumeRun({ requestId, runId, approved }) {
    const run = getWorkflowRun(getDb(), runId);
    if (!run) {
      throw new Error(`Workflow run não encontrado: ${runId}`);
    }

    updateWorkflowRun(getDb(), runId, {
      status: approved ? "queued" : "cancelled",
      approval: null,
      completedAt: approved ? null : new Date().toISOString(),
      errorMessage: approved ? null : "Aprovação negada pelo usuário.",
    });

    const updated = getWorkflowRun(getDb(), runId) as WorkflowRun;
    const events = workflowEventsForRun(requestId, updated);
    for (const event of events) {
      emitToClient(event);
    }
    return { run: updated, events };
  },

  async listCapabilities() {
    ensureMcpReady();
    return {
      tools: listToolCapabilities(),
      connectors: listStoredMcpServers(getDb()),
      templates: listWorkflowTemplates(getDb()),
    };
  },

  async listMcpServers() {
    ensureMcpReady();
    return listStoredMcpServers(getDb());
  },

  async saveMcpServer({ server }) {
    const db = getDb();
    const id = server.id ?? createStoredMcpServer(db, {
      name: server.name,
      command: server.command,
      args: server.args,
      env: server.env,
      enabled: server.enabled,
      preset: server.preset,
      permissionPolicy: server.permissionPolicy,
    });

    if (server.id) {
      upsertMcpServer(db, {
        id: server.id,
        name: server.name,
        command: server.command,
        args: server.args,
        env: server.env,
        enabled: server.enabled,
        preset: server.preset,
        permissionPolicy: server.permissionPolicy,
      });
    }

    return getStoredMcpServer(db, id) as NonNullable<ReturnType<typeof getStoredMcpServer>>;
  },

  async deleteMcpServer({ id }) {
    deleteStoredMcpServer(getDb(), id);
  },

  async testMcpServer({ id }) {
    const db = getDb();
    const server = getStoredMcpServer(db, id, true);
    if (!server) {
      const error = `MCP não encontrado: ${id}`;
      updateMcpServerStatus(db, id, { lastCheckedAt: new Date().toISOString(), lastError: error });
      return { ok: false, error };
    }

    const missingEnv = Object.entries(server.env ?? {})
      .filter(([, value]) => !value)
      .map(([key]) => key);
    if (missingEnv.length > 0) {
      const error = `Configure ${missingEnv.join(", ")} antes de habilitar este MCP.`;
      updateMcpServerStatus(db, id, { lastCheckedAt: new Date().toISOString(), lastError: error });
      return { ok: false, error };
    }

    updateMcpServerStatus(db, id, { lastCheckedAt: new Date().toISOString(), lastError: null });
    return { ok: true };
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
    const startedAt = Date.now();
    const providerId = getLlmProvider().name;
    const inputPreview = formatAgentInputPreview(query, clipboardText);
    const toolName = clipboardText?.trim() ? "agent.clipboard" : "agent.chat";
    const controller = new AbortController();
    runningRequests.set(requestId, controller);
    const events: any[] = [];
    const emit = (event: any) => {
      events.push(event);
      if (clientApi?.onEvent) {
        clientApi.onEvent(event).catch((err: any) => {
          console.error("Failed to emit event to client:", err);
        });
      }
    };

    try {
      const result = await orchestrator.runAgent(
        requestId,
        query,
        clipboardText,
        emit,
        getLlmProvider,
        () => getActiveProviderConfig().model,
        controller.signal,
      );

      createInteraction(getDb(), {
        toolName,
        providerId,
        permissionLevel: "external",
        inputPreview,
        outputPreview: previewText(result),
        durationMs: Date.now() - startedAt,
        success: true,
      });

      return { result, events };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      if (controller.signal.aborted) {
        emit({ type: "agent.cancelled", requestId });
      }

      createInteraction(getDb(), {
        toolName,
        providerId,
        permissionLevel: "external",
        inputPreview,
        outputPreview: "",
        durationMs: Date.now() - startedAt,
        success: false,
        errorMessage: previewText(errorMessage, 240),
      });
      throw err;
    } finally {
      runningRequests.delete(requestId);
    }
  },

  async cancelAgent({ requestId }) {
    const controller = runningRequests.get(requestId);
    if (!controller) {
      return { cancelled: false };
    }

    controller.abort();
    return { cancelled: true };
  },

  async shutdown() {
    for (const controller of runningRequests.values()) {
      controller.abort();
    }
    runningRequests.clear();
    for (const controller of runningRuns.values()) {
      controller.abort();
    }
    runningRuns.clear();
    orchestrator.shutdown();
  },
};
