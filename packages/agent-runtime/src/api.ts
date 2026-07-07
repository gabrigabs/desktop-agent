import { execSync, spawn } from "node:child_process";
import { readFile as fsReadFile, stat as fsStat } from "node:fs/promises";
import { basename } from "node:path";
import type { LlmProvider } from "@desktop-agent/provider-gateway";
import { createProvider } from "@desktop-agent/provider-gateway";
import type {
  AgentApi,
  AgentEvent,
  AgentProfile,
  AppSettings,
  CompletionInput,
  PromptTemplate,
  SaveProfileInput,
  SavePromptInput,
  WorkflowRun,
} from "@desktop-agent/shared";
import {
  createAgentProfile,
  createConversation,
  createInteraction,
  createPromptTemplate,
  createMcpServer as createStoredMcpServer,
  createTurn,
  createWorkflowRun,
  deleteAgentProfile,
  deletePromptTemplate,
  deleteMcpServer as deleteStoredMcpServer,
  ensureDefaultMcpPresets,
  getAgentProfile,
  getDb,
  getRecentInteractions,
  getSetting,
  getMcpServer as getStoredMcpServer,
  getWorkflowRun,
  listAgentProfiles,
  listConversations,
  listPromptTemplates,
  listMcpServers as listStoredMcpServers,
  listTurns,
  listWorkflowRuns,
  listWorkflowTemplates,
  setSetting,
  updateAgentProfile,
  updateMcpServerStatus,
  updatePromptTemplate,
  updateWorkflowRun,
  upsertMcpServer,
} from "@desktop-agent/storage";
import { registry } from "@desktop-agent/tool-registry";
import { createClipboardTool } from "@desktop-agent/tools-desktop";
import { createOcrImageTool, createScreenshotOcrTool } from "@desktop-agent/tools-ocr";
import { createRewriteTool, createSummarizeTool, createTranslateTool } from "@desktop-agent/tools-text";
import { createWebCrawlTool, createWebExtractTool, createWebSearchTool } from "@desktop-agent/tools-web";
import { Orchestrator } from "./orchestrator";
import { WorkflowRunner } from "./workflow-runner";

type ClientApi = {
  onEvent(event: AgentEvent): Promise<void>;
};

// Client API reference for streaming events
let clientApi: ClientApi | null = null;
export function setClientApi(api: unknown) {
  clientApi = api as ClientApi;
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
  const alwaysOnTop = getSetting(db, "alwaysOnTop") === "true";
  const lastWindowMode = getSetting(db, "lastWindowMode") || "normal";
  const timeoutVal = getSetting(db, "timeout");
  const timeout = timeoutVal ? Number.parseInt(timeoutVal, 10) : 120;
  const windowOpacityVal = getSetting(db, "windowOpacity");
  const windowOpacity = windowOpacityVal ? Number.parseFloat(windowOpacityVal) : 0.72;
  const petSizeVal = getSetting(db, "petSize");
  const petSize = petSizeVal ? Number.parseInt(petSizeVal, 10) : 58;

  return {
    activeProvider,
    apiKey,
    baseUrl,
    model,
    hidePet,
    alwaysOnTop,
    lastWindowMode,
    timeout,
    windowOpacity,
    petSize,
  };
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
    gemini: "https://generativelanguage.googleapis.com/v1beta/openai",
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
const proxyProvider: LlmProvider = {
  get name() {
    return getLlmProvider().name;
  },
  get kind() {
    return getLlmProvider().kind;
  },
  complete(input: CompletionInput) {
    return getLlmProvider().complete(input);
  },
  stream(input: CompletionInput) {
    return getLlmProvider().stream(input);
  },
};

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
registry.register(createWebSearchTool());
registry.register(createWebExtractTool());
registry.register(createWebCrawlTool());
registry.register(createOcrImageTool());
registry.register(createScreenshotOcrTool());

const orchestrator = new Orchestrator({ provider: proxyProvider });
ensureMcpReady();

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
    clientApi.onEvent(event).catch((err: unknown) => {
      console.error("Failed to emit event to client:", err);
    });
  }
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
      createdBy: "helix",
      timeoutSeconds: config.timeout,
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

    const controller = new AbortController();
    runningRuns.set(run.id, controller);
    runningRequests.set(input.requestId, controller);
    const events: AgentEvent[] = [];
    const runner = new WorkflowRunner({
      orchestrator,
      getLlmProvider,
      getActiveModel: () => getActiveProviderConfig().model,
      emit(event) {
        events.push(event);
        emitToClient(event);
      },
    });

    try {
      const completedRun = await runner.start({
        requestId: input.requestId,
        runId: run.id,
        prompt: input.prompt,
        clipboardText: input.clipboardText ?? "",
        signal: controller.signal,
      });
      return { run: completedRun, events };
    } finally {
      runningRuns.delete(run.id);
      runningRequests.delete(input.requestId);
    }
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
    const existingRun = getWorkflowRun(getDb(), runId);
    if (!existingRun) {
      throw new Error(`Workflow run não encontrado: ${runId}`);
    }

    const controller = new AbortController();
    runningRuns.set(runId, controller);
    runningRequests.set(requestId, controller);
    const events: AgentEvent[] = [];
    const runner = new WorkflowRunner({
      orchestrator,
      getLlmProvider,
      getActiveModel: () => getActiveProviderConfig().model,
      emit(event) {
        events.push(event);
        emitToClient(event);
      },
    });

    try {
      const run = await runner.resume({
        requestId,
        runId,
        prompt: existingRun.prompt,
        clipboardText: existingRun.clipboardPreview,
        approved,
        signal: controller.signal,
      });
      return { run, events };
    } finally {
      runningRuns.delete(runId);
      runningRequests.delete(requestId);
    }
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
    const id =
      server.id ??
      createStoredMcpServer(db, {
        name: server.name,
        command: server.command,
        args: server.args,
        env: server.env,
        enabled: server.enabled,
        preset: server.preset,
        permissionPolicy: server.permissionPolicy,
      });

    if (server.id) {
      const existing = getStoredMcpServer(db, server.id, true);
      upsertMcpServer(db, {
        id: server.id,
        name: server.name,
        command: server.command,
        args: server.args,
        env: server.env ?? existing?.env,
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

    if (!server.command) {
      const error = "Comando não definido para este MCP.";
      updateMcpServerStatus(db, id, { lastCheckedAt: new Date().toISOString(), lastError: error });
      return { ok: false, error };
    }

    const startTime = Date.now();
    const childEnv = { ...process.env, ...server.env };
    let child: import("node:child_process").ChildProcessWithoutNullStreams | null = null;

    try {
      child = spawn(server.command, server.args ?? [], {
        env: childEnv,
        stdio: ["pipe", "pipe", "pipe"],
      });

      let stderrBuf = "";
      child.stderr.on("data", (chunk: Buffer) => {
        stderrBuf += chunk.toString();
        if (stderrBuf.length > 2000) stderrBuf = stderrBuf.slice(-2000);
      });

      const sendRpc = (method: string, params: Record<string, unknown> = {}) => {
        const msg = JSON.stringify({ jsonrpc: "2.0", id: Math.floor(Math.random() * 1e9), method, params });
        child!.stdin.write(msg + "\n");
      };

      const waitForResponse = (timeoutMs: number) =>
        new Promise<{ result?: unknown; error?: { message: string } } | null>((resolve) => {
          let buf = "";
          const timer = setTimeout(() => {
            child!.stdout.removeAllListeners("data");
            resolve(null);
          }, timeoutMs);

          const onData = (chunk: Buffer) => {
            buf += chunk.toString();
            const lines = buf.split("\n");
            buf = lines.pop() ?? "";
            for (const line of lines) {
              if (!line.trim()) continue;
              try {
                const parsed = JSON.parse(line);
                if (parsed.id !== undefined) {
                  clearTimeout(timer);
                  child!.stdout.removeListener("data", onData);
                  resolve({ result: parsed.result, error: parsed.error });
                  return;
                }
              } catch {
                // ignore non-JSON lines
              }
            }
          };

          child!.stdout.on("data", onData);
        });

      // Step 1: initialize handshake
      sendRpc("initialize", {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "helix-desktop", version: "1.0.0" },
      });

      const initResult = await waitForResponse(10000);
      if (!initResult) {
        const error = "MCP não respondeu em 10s.";
        updateMcpServerStatus(db, id, { lastCheckedAt: new Date().toISOString(), lastError: error });
        return { ok: false, error, durationMs: Date.now() - startTime };
      }
      if (initResult.error) {
        const error = initResult.error.message || "Erro no handshake initialize.";
        updateMcpServerStatus(db, id, { lastCheckedAt: new Date().toISOString(), lastError: error });
        return { ok: false, error, durationMs: Date.now() - startTime };
      }

      // Send initialized notification
      child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");

      // Step 2: list tools
      sendRpc("tools/list", {});
      const toolsResult = await waitForResponse(10000);
      if (!toolsResult) {
        const error = "MCP não respondeu ao tools/list em 10s.";
        updateMcpServerStatus(db, id, { lastCheckedAt: new Date().toISOString(), lastError: error });
        return { ok: false, error, durationMs: Date.now() - startTime };
      }
      if (toolsResult.error) {
        const error = toolsResult.error.message || "Erro ao listar tools.";
        updateMcpServerStatus(db, id, { lastCheckedAt: new Date().toISOString(), lastError: error });
        return { ok: false, error, durationMs: Date.now() - startTime };
      }

      const toolsRaw =
        (toolsResult.result as { tools?: { name: string; description?: string }[] })?.tools ?? [];
      const tools = toolsRaw.map((t) => ({ name: t.name, description: t.description ?? "" }));

      updateMcpServerStatus(db, id, { lastCheckedAt: new Date().toISOString(), lastError: null });
      return { ok: true, tools, durationMs: Date.now() - startTime };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      const error = errorMessage.includes("ENOENT")
        ? `Comando não encontrado: ${server.command}`
        : errorMessage;
      updateMcpServerStatus(db, id, { lastCheckedAt: new Date().toISOString(), lastError: error });
      return { ok: false, error, durationMs: Date.now() - startTime };
    } finally {
      if (child) {
        try {
          child.stdin.end();
          child.kill("SIGTERM");
          setTimeout(() => {
            try {
              child?.kill("SIGKILL");
            } catch {
              // already dead
            }
          }, 2000);
        } catch {
          // already dead
        }
      }
    }
  },

  async getSettings(): Promise<AppSettings> {
    const config = getActiveProviderConfig();
    return {
      activeProvider: config.activeProvider,
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      model: config.model,
      hidePet: config.hidePet,
      alwaysOnTop: config.alwaysOnTop,
      lastWindowMode: config.lastWindowMode as AppSettings["lastWindowMode"],
      timeout: config.timeout,
      windowOpacity: config.windowOpacity,
      petSize: config.petSize,
    };
  },

  async saveSettings(settings: AppSettings): Promise<void> {
    const db = getDb();
    setSetting(db, "activeProvider", settings.activeProvider);
    setSetting(db, "apiKey", settings.apiKey);
    setSetting(db, "baseUrl", settings.baseUrl);
    setSetting(db, "model", settings.model);
    setSetting(db, "hidePet", settings.hidePet ? "true" : "false");
    setSetting(db, "alwaysOnTop", settings.alwaysOnTop ? "true" : "false");
    setSetting(db, "lastWindowMode", settings.lastWindowMode);
    setSetting(db, "timeout", String(settings.timeout));
    setSetting(db, "windowOpacity", String(settings.windowOpacity));
    setSetting(db, "petSize", String(settings.petSize));
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
      gemini: "https://generativelanguage.googleapis.com/v1beta/openai",
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
    const events: AgentEvent[] = [];
    const emit = (event: AgentEvent) => {
      events.push(event);
      if (clientApi?.onEvent) {
        clientApi.onEvent(event).catch((err: unknown) => {
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

  async listConversations({ limit } = { limit: 20 }) {
    return listConversations(getDb(), limit);
  },

  async listTurns({ conversationId }) {
    return listTurns(getDb(), conversationId);
  },

  async saveConversation({ conversationId, turns }): Promise<void> {
    const db = getDb();
    const existing = listConversations(db, 1).find((c) => c.id === conversationId);
    if (!existing) {
      const firstUserTurn = turns.find((t) => t.role === "user");
      const titleBlock = firstUserTurn?.blocks.find((b) => b.type === "text");
      const title = titleBlock?.type === "text" ? titleBlock.content.slice(0, 80) : "Nova conversa";
      createConversation(db, { id: conversationId, title });
    }

    for (const turn of turns) {
      if (turn.status === "streaming") continue;
      createTurn(db, {
        id: turn.id,
        conversationId,
        role: turn.role,
        blocks: turn.blocks,
        status: turn.status,
        timestamp: new Date(turn.timestamp).toISOString(),
        sourceMode: turn.sourceMode,
        executionMode: turn.executionMode,
      });
    }
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

  async listPromptTemplates(): Promise<PromptTemplate[]> {
    return listPromptTemplates(getDb());
  },

  async savePromptTemplate(input: SavePromptInput): Promise<PromptTemplate> {
    const db = getDb();
    if (input.id) {
      updatePromptTemplate(db, input.id, {
        title: input.title,
        prompt: input.prompt,
        category: input.category,
        icon: input.icon,
        executionMode: input.executionMode,
      });
      const all = listPromptTemplates(db);
      const updated = all.find((p) => p.id === input.id);
      if (!updated) throw new Error("Prompt não encontrado após atualização");
      return updated;
    }
    const id = createPromptTemplate(db, {
      title: input.title,
      prompt: input.prompt,
      category: input.category,
      icon: input.icon,
      executionMode: input.executionMode,
    });
    const all = listPromptTemplates(db);
    const created = all.find((p) => p.id === id);
    if (!created) throw new Error("Prompt não encontrado após criação");
    return created;
  },

  async deletePromptTemplate(input: { id: string }): Promise<void> {
    deletePromptTemplate(getDb(), input.id);
  },

  async listAgentProfiles(): Promise<AgentProfile[]> {
    return listAgentProfiles(getDb());
  },

  async saveAgentProfile(input: SaveProfileInput): Promise<AgentProfile> {
    const db = getDb();
    const profileFields = {
      name: input.name,
      systemPrompt: input.systemPrompt,
      description: input.description,
      icon: input.icon,
      tone: input.tone,
      responseStyle: input.responseStyle,
      constraints: input.constraints,
    };
    if (input.id) {
      updateAgentProfile(db, input.id, profileFields);
      const updated = getAgentProfile(db, input.id);
      if (!updated) throw new Error("Perfil não encontrado após atualização");
      return updated;
    }
    const id = createAgentProfile(db, profileFields);
    const created = getAgentProfile(db, id);
    if (!created) throw new Error("Perfil não encontrado após criação");
    return created;
  },

  async deleteAgentProfile(input: { id: string }): Promise<void> {
    deleteAgentProfile(getDb(), input.id);
  },

  async setActiveProfile(input: { profileId: string | null }): Promise<void> {
    setSetting(getDb(), "activeProfileId", input.profileId ?? "");
  },

  async getActiveProfile(): Promise<AgentProfile | null> {
    const profileId = getSetting(getDb(), "activeProfileId");
    if (!profileId) return null;
    return getAgentProfile(getDb(), profileId);
  },

  async readFile(input: { path: string }): Promise<{ content: string; fileName: string; size: number }> {
    const stat = await fsStat(input.path);
    const content = await fsReadFile(input.path, "utf-8");
    return {
      content,
      fileName: basename(input.path),
      size: stat.size,
    };
  },
};
