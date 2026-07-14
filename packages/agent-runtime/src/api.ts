import { execSync, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { isParseable, parseDocument } from "@desktop-agent/lite-parse";
import type { LlmProvider } from "@desktop-agent/provider-gateway";
import { createProvider } from "@desktop-agent/provider-gateway";
import type {
  AgentApi,
  AgentEvent,
  AgentProfile,
  AppSettings,
  CompletionInput,
  ContextAttachment,
  FileContextInput,
  HostBridgeApi,
  MarkdownSource,
  ParsedDocument,
  PromptTemplate,
  SaveProfileInput,
  SavePromptInput,
  Skill,
  WorkflowRun,
} from "@desktop-agent/shared";
import {
  addMemoryFact as addStoredMemoryFact,
  archiveWorkspace as archiveStoredWorkspace,
  attachDocument as attachStoredDocument,
  createAgentProfile,
  createConversation,
  createPromptTemplate,
  createSkill,
  createMcpServer as createStoredMcpServer,
  createWorkspace as createStoredWorkspace,
  createWorkflowRun,
  deleteAgentProfile,
  deleteAllMarkdownSources as deleteAllStoredMarkdownSources,
  deleteAllParsedDocuments as deleteAllStoredParsedDocuments,
  deletePromptTemplate,
  deleteSkill,
  deleteMcpServer as deleteStoredMcpServer,
  deleteMemoryFact as deleteStoredMemoryFact,
  deleteParsedDocument as deleteStoredParsedDocument,
  deleteWorkspace as deleteStoredWorkspace,
  deleteWorkflowTemplate,
  detachDocument as detachStoredDocument,
  ensureDefaultMcpPresets,
  getAgentProfile,
  getConversation,
  getDb,
  getParsedDocument,
  getRecentInteractions,
  getSetting,
  getSkill,
  getMcpServer as getStoredMcpServer,
  getWorkspace as getStoredWorkspace,
  getWorkflowRun,
  getWorkflowTemplate,
  linkConversation as linkStoredConversation,
  listAgentProfiles,
  listConversations,
  listPromptTemplates,
  listSkills,
  listConversationsByWorkspace as listStoredConversationsByWorkspace,
  listMarkdownSources as listStoredMarkdownSources,
  listMcpServers as listStoredMcpServers,
  listMemoryFacts as listStoredMemoryFacts,
  listParsedDocuments as listStoredParsedDocuments,
  listWorkspaceDocumentIds as listStoredWorkspaceDocumentIds,
  listWorkspaces as listStoredWorkspaces,
  listTurns,
  listWorkflowRuns,
  listWorkflowTemplates,
  saveWorkflowTemplate,
  setSetting,
  updateAgentProfile,
  updateConversationTitle,
  updateMcpServerStatus,
  updatePromptTemplate,
  updateSkill,
  updateMemoryFact as updateStoredMemoryFact,
  updateParsedDocument as updateStoredParsedDocument,
  updateWorkspace as updateStoredWorkspace,
  updateWorkflowRun,
  upsertMarkdownSource,
  upsertMcpServer,
  upsertParsedDocument,
  upsertTurn,
} from "@desktop-agent/storage";
import { registry } from "@desktop-agent/tool-registry";

function toParsedDocument(doc: import("@desktop-agent/storage").StoredParsedDocument): ParsedDocument {
  return {
    id: doc.id,
    path: doc.path,
    displayName: doc.displayName,
    size: doc.size,
    mimeType: doc.mimeType,
    encoding: doc.encoding as ParsedDocument["encoding"],
    content: doc.content,
    preview: doc.preview,
    parsedFormat: doc.parsedFormat as ParsedDocument["parsedFormat"],
    parsedMetadata: doc.parsedMetadata,
    status: doc.status,
    error: doc.error,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

import {
  createClipboardTool,
  createDesktopAppTool,
  createDesktopNotifyTool,
  createDesktopSystemTool,
  createDirectoryListTool,
  createFilePatchTool,
  createFileReadTool,
  createFileWriteTool,
  createGitDiffTool,
  createGitLogTool,
  createGitStatusTool,
  createShellExecTool,
} from "@desktop-agent/tools-desktop";
import {
  createOcrImageTool,
  createScreenshotOcrTool,
  createVisionBarcodeTool,
  createVisionClassificationTool,
  createVisionSaliencyTool,
  createVisionTextTool,
} from "@desktop-agent/tools-ocr";
import {
  createMermaidGenerateTool,
  createRewriteTool,
  createSummarizeTool,
  createTranslateTool,
} from "@desktop-agent/tools-text";
import { createWebCrawlTool, createWebExtractTool, createWebSearchTool } from "@desktop-agent/tools-web";
import { conversationTitleFromTurns, sanitizeConversationTitle } from "./conversation-title";
import { t } from "./i18n";
import {
  expandMcpArgs,
  registerEnabledMcpTools,
  registerMcpToolsForServer,
  unregisterMcpToolsForServer,
} from "./mcp-tools";
import { createFileParseTool, ParserAgent } from "./parser";
import { hasMaterialDocumentChange, normalizeImprovedDocument } from "./parser/improvedDocument";
import { getPersistedDocumentRoot } from "./parser/persistedAuthorization";
import { ToolExecutor } from "./workflow/ToolExecutor";
import { WorkflowRunner } from "./workflow/WorkflowRunner";

type ClientApi = HostBridgeApi;

// Client API reference for streaming events
let clientApi: ClientApi | null = null;
export function setClientApi(api: unknown) {
  clientApi = api as ClientApi;
}

const runningRequests = new Map<string, AbortController>();
const runningRuns = new Map<string, AbortController>();
const authorizedFileRoots = new Set<string>();
const workspaceFolderRoots = new Set<string>();

function syncWorkspaceFolderRoots() {
  const db = getDb();
  const workspaces = listStoredWorkspaces(db);
  workspaceFolderRoots.clear();
  for (const ws of workspaces) {
    if (ws.status === "active" && ws.folderPath) {
      workspaceFolderRoots.add(ws.folderPath);
    }
  }
}

const parserAgent = new ParserAgent({
  getAuthorizedRoots: () => Array.from(authorizedFileRoots),
});

async function isAuthorizedFilePath(targetPath: string): Promise<boolean> {
  const { promises: fs } = await import("node:fs");
  const path = await import("node:path");
  const allRoots = new Set<string>([...authorizedFileRoots]);
  for (const folder of workspaceFolderRoots) {
    allRoots.add(folder);
  }
  let canonicalParent: string;
  try {
    canonicalParent = await fs.realpath(path.dirname(path.resolve(targetPath)));
  } catch {
    const resolvedTarget = path.resolve(targetPath);
    return [...allRoots].some((root) => resolvedTarget.startsWith(`${root}${path.sep}`));
  }
  const canonicalRoots = await Promise.all(
    [...allRoots].map(async (root) => {
      try {
        return await fs.realpath(root);
      } catch {
        return root;
      }
    }),
  );
  return canonicalRoots.some(
    (root) => canonicalParent === root || canonicalParent.startsWith(`${root}${path.sep}`),
  );
}

async function isAuthorizedImagePath(targetPath: string): Promise<boolean> {
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  try {
    const canonicalTarget = await fs.realpath(path.resolve(targetPath));
    const stat = await fs.stat(canonicalTarget);
    if (!stat.isFile()) return false;
    return [...authorizedFileRoots].some(
      (root) => canonicalTarget === root || canonicalTarget.startsWith(`${root}${path.sep}`),
    );
  } catch {
    return false;
  }
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
  const model = getSetting(db, "model") || (activeProvider === "pinstripes" ? "ps/warp" : "");
  const hidePet = getSetting(db, "hidePet") === "true";
  const alwaysOnTop = getSetting(db, "alwaysOnTop") === "true";
  const rawLastWindowMode = getSetting(db, "lastWindowMode") || "normal";
  const lastWindowMode = rawLastWindowMode === "mini" ? "normal" : rawLastWindowMode;
  const timeoutVal = getSetting(db, "timeout");
  const timeout = timeoutVal ? Number.parseInt(timeoutVal, 10) : 120;
  const windowOpacityVal = getSetting(db, "windowOpacity");
  const windowOpacity = windowOpacityVal ? Number.parseFloat(windowOpacityVal) : 0.72;
  const petSizeVal = getSetting(db, "petSize");
  const petSize = petSizeVal ? Number.parseInt(petSizeVal, 10) : 58;
  const languageVal = getSetting(db, "language");
  const language: AppSettings["language"] =
    languageVal === "en" || languageVal === "pt-BR" ? languageVal : "pt-BR";
  const notificationsEnabled = getSetting(db, "notificationsEnabled") === "true";
  const notificationContentMode: AppSettings["notificationContentMode"] =
    getSetting(db, "notificationContentMode") === "preview" ? "preview" : "generic";

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
    language,
    notificationsEnabled,
    notificationContentMode,
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

function nativeBridge(): HostBridgeApi {
  if (!clientApi) throw new Error("BRIDGE_UNAVAILABLE: native host bridge is not connected");
  return clientApi;
}

const nativeCtx = {
  get bridge(): HostBridgeApi {
    return nativeBridge();
  },
  isPathAuthorized: isAuthorizedImagePath,
};

// Register all tools
registry.register(createRewriteTool(ctx));
registry.register(
  createMermaidGenerateTool({
    provider: proxyProvider,
    model: ctx.model,
    validate: async (code) => {
      if (!clientApi?.validateMermaid) return { valid: false, error: "MERMAID_BRIDGE_UNAVAILABLE" };
      return clientApi.validateMermaid({ code });
    },
  }),
);
registry.register(createSummarizeTool(ctx));
registry.register(createTranslateTool(ctx));
registry.register(createClipboardTool(clipboardCtx));
registry.register(createDesktopAppTool(nativeCtx));
registry.register(createDesktopSystemTool(nativeCtx));
registry.register(createDesktopNotifyTool(nativeCtx));
registry.register(createFileWriteTool({ isPathAuthorized: isAuthorizedFilePath }));
registry.register(createFileReadTool({ isPathAuthorized: isAuthorizedFilePath }));
registry.register(createDirectoryListTool({ isPathAuthorized: isAuthorizedFilePath }));
registry.register(createGitStatusTool({ isPathAuthorized: isAuthorizedFilePath }));
registry.register(createGitDiffTool({ isPathAuthorized: isAuthorizedFilePath }));
registry.register(createGitLogTool({ isPathAuthorized: isAuthorizedFilePath }));
registry.register(createShellExecTool({ isPathAuthorized: isAuthorizedFilePath }));
registry.register(createFilePatchTool({ isPathAuthorized: isAuthorizedFilePath }));
registry.register(createWebSearchTool());
registry.register(createWebExtractTool());
registry.register(createWebCrawlTool());
registry.register(createVisionTextTool(nativeCtx));
registry.register(createVisionClassificationTool(nativeCtx));
registry.register(createVisionBarcodeTool(nativeCtx));
registry.register(createVisionSaliencyTool(nativeCtx));
registry.register(createOcrImageTool(nativeCtx));
registry.register(createScreenshotOcrTool(nativeCtx));
registry.register(createFileParseTool(parserAgent));

ensureMcpReady();

export type { AgentApi };

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
    executionPolicy: t.executionPolicy,
  }));
}

function createQueuedRun(input: {
  prompt: string;
  mode: "simple" | "workflow";
  sourceMode?: "free" | "clipboard";
  clipboardText?: string;
  maxSteps?: number;
  workflowTemplateId?: string;
  history?: { role: "user" | "assistant" | "system"; content: string }[];
  profileId?: string;
  contexts?: ContextAttachment[];
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
    workflowTemplateId: input.workflowTemplateId,
    metadata: {
      createdBy: "helix",
      timeoutSeconds: config.timeout,
      profileId: input.profileId,
      contexts: input.contexts?.map(({ content, ...context }) => ({ ...context, content })) ?? [],
    },
  });

  return getWorkflowRun(db, runId) as WorkflowRun;
}

function ensureMcpReady() {
  ensureDefaultMcpPresets(getDb());
}

const MIME_MAP: Record<string, string> = {
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".markdown": "text/markdown",
  ".json": "application/json",
  ".yaml": "text/yaml",
  ".yml": "text/yaml",
  ".toml": "text/plain",
  ".csv": "text/csv",
  ".tsv": "text/tab-separated-values",
  ".xml": "text/xml",
  ".html": "text/html",
  ".htm": "text/html",
  ".css": "text/css",
  ".scss": "text/x-scss",
  ".js": "text/javascript",
  ".ts": "text/typescript",
  ".tsx": "text/tsx",
  ".jsx": "text/jsx",
  ".py": "text/x-python",
  ".rb": "text/x-ruby",
  ".go": "text/x-go",
  ".rs": "text/x-rust",
  ".java": "text/x-java",
  ".c": "text/x-c",
  ".cpp": "text/x-c++",
  ".h": "text/x-c",
  ".hpp": "text/x-c++",
  ".swift": "text/x-swift",
  ".kt": "text/x-kotlin",
  ".sh": "text/x-shellscript",
  ".bash": "text/x-shellscript",
  ".zsh": "text/x-shellscript",
  ".fish": "text/x-fish",
  ".ps1": "text/x-powershell",
  ".sql": "text/x-sql",
  ".graphql": "text/x-graphql",
  ".gql": "text/x-graphql",
  ".env": "text/plain",
  ".gitignore": "text/plain",
  ".dockerignore": "text/plain",
  ".ini": "text/plain",
  ".cfg": "text/plain",
  ".conf": "text/plain",
  ".properties": "text/plain",
  ".log": "text/plain",
  ".diff": "text/x-diff",
  ".patch": "text/x-diff",
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".bmp": "image/bmp",
  ".webp": "image/webp",
  ".tiff": "image/tiff",
  ".ico": "image/x-icon",
  ".zip": "application/zip",
  ".tar": "application/x-tar",
  ".gz": "application/gzip",
  ".rar": "application/vnd.rar",
  ".7z": "application/x-7z-compressed",
  ".exe": "application/x-executable",
  ".dll": "application/x-dll",
  ".so": "application/x-sharedlib",
  ".dylib": "application/x-dylib",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".avi": "video/x-msvideo",
  ".mov": "video/quicktime",
  ".wav": "audio/wav",
  ".flac": "audio/flac",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
};

function getMimeType(ext: string): string {
  return MIME_MAP[ext] ?? "application/octet-stream";
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export const agentApi: AgentApi = {
  async ping() {
    return { status: "ok" };
  },

  async getVersion() {
    return "1.0.0";
  },

  async execute({ requestId, toolName, input }) {
    const events: AgentEvent[] = [{ type: "agent.started", requestId }];
    const toolExecutor = new ToolExecutor(
      (event) => {
        events.push(event);
        emitToClient(event);
      },
      () => getLlmProvider().name,
    );
    const result = await toolExecutor.execute(requestId, toolName, input);
    events.push({ type: "agent.completed", requestId });
    return { result, events };
  },

  async listTools() {
    return registry.list().map((t) => ({
      name: t.name,
      description: t.description,
      category: t.category,
      executionPolicy: t.executionPolicy,
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
    syncWorkspaceFolderRoots();
    let mode: "simple" | "workflow" = input.mode ?? "workflow";
    let maxSteps = input.maxSteps;
    const workflowTemplateId = input.workflowId;
    const skillId = input.skillId;

    if (workflowTemplateId) {
      const template = getWorkflowTemplate(getDb(), workflowTemplateId);
      if (template) {
        mode = template.mode;
        maxSteps = maxSteps ?? template.maxSteps;
      }
    }

    let skill: Skill | null = null;
    if (skillId) {
      skill = getSkill(getDb(), skillId);
      if (skill) {
        mode = mode === "workflow" ? "workflow" : "simple";
        maxSteps = maxSteps ?? skill.maxSteps;
      }
    }

    if (mode === "simple" && !maxSteps) {
      maxSteps = 1;
    }

    const run = createQueuedRun({
      prompt: input.prompt,
      mode,
      sourceMode: input.sourceMode,
      clipboardText: input.clipboardText,
      maxSteps,
      workflowTemplateId,
      history: input.history,
      profileId: input.profileId,
      contexts: input.contexts,
    });

    const controller = new AbortController();
    runningRuns.set(run.id, controller);
    runningRequests.set(input.requestId, controller);

    const events: AgentEvent[] = [];
    const runner = new WorkflowRunner({
      getLlmProvider,
      getActiveModel: () => getActiveProviderConfig().model,
      getLanguage: () => getActiveProviderConfig().language,
      parserAgent,
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
        contextText: input.contextText,
        fileContext: input.fileContext,
        contexts: input.contexts,
        history: input.history ?? [],
        skillId: input.skillId,
        profileId: input.profileId,
        workspaceId: input.workspaceId,
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
      getLlmProvider,
      getActiveModel: () => getActiveProviderConfig().model,
      getLanguage: () => getActiveProviderConfig().language,
      parserAgent,
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
        contexts: Array.isArray(existingRun.metadata.contexts)
          ? (existingRun.metadata.contexts as ContextAttachment[])
          : undefined,
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
    await registerEnabledMcpTools();
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

    const saved = getStoredMcpServer(db, id) as NonNullable<ReturnType<typeof getStoredMcpServer>>;
    unregisterMcpToolsForServer(saved.id);
    if (saved.enabled) {
      await registerMcpToolsForServer(saved.id);
    } else {
      unregisterMcpToolsForServer(saved.id);
    }
    return saved;
  },

  async deleteMcpServer({ id }) {
    unregisterMcpToolsForServer(id);
    deleteStoredMcpServer(getDb(), id);
  },

  async testMcpServer({ id }) {
    const db = getDb();
    const lang = getActiveProviderConfig().language;
    const startTime = Date.now();
    const server = getStoredMcpServer(db, id, true);
    if (!server) {
      const error = t("errors:mcp.notFound", lang, { id });
      updateMcpServerStatus(db, id, { lastCheckedAt: new Date().toISOString(), lastError: error });
      return { ok: false, error };
    }

    if (server.command === "direct") {
      const tools = registry
        .listByCategory("web")
        .map((tool) => ({ name: tool.name, description: tool.description }));
      updateMcpServerStatus(db, id, { lastCheckedAt: new Date().toISOString(), lastError: null });
      return { ok: true, tools, durationMs: Date.now() - startTime };
    }

    const missingEnv = Object.entries(server.env ?? {})
      .filter(([, value]) => !value)
      .map(([key]) => key);
    if (missingEnv.length > 0) {
      const error = t("errors:mcp.configureEnv", lang, { env: missingEnv.join(", ") });
      updateMcpServerStatus(db, id, { lastCheckedAt: new Date().toISOString(), lastError: error });
      return { ok: false, error };
    }

    if (!server.command) {
      const error = t("errors:mcp.commandMissing", lang);
      updateMcpServerStatus(db, id, { lastCheckedAt: new Date().toISOString(), lastError: error });
      return { ok: false, error };
    }

    const childEnv = { ...process.env, ...server.env };
    let child: import("node:child_process").ChildProcessWithoutNullStreams | null = null;

    try {
      child = spawn(server.command, expandMcpArgs(server.args, childEnv), {
        env: childEnv,
        stdio: ["pipe", "pipe", "pipe"],
      });
      const activeChild = child;

      let stderrBuf = "";
      activeChild.stderr.on("data", (chunk: Buffer) => {
        stderrBuf += chunk.toString();
        if (stderrBuf.length > 2000) stderrBuf = stderrBuf.slice(-2000);
      });

      const sendRpc = (method: string, params: Record<string, unknown> = {}) => {
        const msg = JSON.stringify({ jsonrpc: "2.0", id: Math.floor(Math.random() * 1e9), method, params });
        activeChild.stdin.write(`${msg}\n`);
      };

      const waitForResponse = (timeoutMs: number) =>
        new Promise<{ result?: unknown; error?: { message: string } } | null>((resolve) => {
          let buf = "";
          const timer = setTimeout(() => {
            activeChild.stdout.removeAllListeners("data");
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
                  activeChild.stdout.removeListener("data", onData);
                  resolve({ result: parsed.result, error: parsed.error });
                  return;
                }
              } catch {
                // ignore non-JSON lines
              }
            }
          };

          activeChild.stdout.on("data", onData);
        });

      // Step 1: initialize handshake
      sendRpc("initialize", {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "helix-desktop", version: "1.0.0" },
      });

      const initResult = await waitForResponse(10000);
      if (!initResult) {
        const error = t("errors:mcp.noResponseInitialize", lang);
        updateMcpServerStatus(db, id, { lastCheckedAt: new Date().toISOString(), lastError: error });
        return { ok: false, error, durationMs: Date.now() - startTime };
      }
      if (initResult.error) {
        const error = initResult.error.message || t("errors:mcp.handshakeError", lang);
        updateMcpServerStatus(db, id, { lastCheckedAt: new Date().toISOString(), lastError: error });
        return { ok: false, error, durationMs: Date.now() - startTime };
      }

      // Send initialized notification
      activeChild.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })}\n`);

      // Step 2: list tools
      sendRpc("tools/list", {});
      const toolsResult = await waitForResponse(10000);
      if (!toolsResult) {
        const error = t("errors:mcp.noResponseToolsList", lang);
        updateMcpServerStatus(db, id, { lastCheckedAt: new Date().toISOString(), lastError: error });
        return { ok: false, error, durationMs: Date.now() - startTime };
      }
      if (toolsResult.error) {
        const error = toolsResult.error.message || t("errors:mcp.toolsListError", lang);
        updateMcpServerStatus(db, id, { lastCheckedAt: new Date().toISOString(), lastError: error });
        return { ok: false, error, durationMs: Date.now() - startTime };
      }

      const toolsRaw =
        (toolsResult.result as { tools?: { name: string; description?: string }[] })?.tools ?? [];
      const tools = toolsRaw.map((t) => ({ name: t.name, description: t.description ?? "" }));

      void registerMcpToolsForServer(id).catch((err) => {
        console.error(`Failed to register MCP tools for ${id}:`, err);
      });

      updateMcpServerStatus(db, id, { lastCheckedAt: new Date().toISOString(), lastError: null });
      return { ok: true, tools, durationMs: Date.now() - startTime };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      const error = errorMessage.includes("ENOENT")
        ? t("errors:mcp.commandNotFound", lang, { command: server.command })
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
      language: config.language,
      notificationsEnabled: config.notificationsEnabled,
      notificationContentMode: config.notificationContentMode,
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
    setSetting(db, "language", settings.language);
    setSetting(db, "notificationsEnabled", settings.notificationsEnabled ? "true" : "false");
    setSetting(db, "notificationContentMode", settings.notificationContentMode);
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

  async listSkills() {
    return listSkills(getDb());
  },

  async getSkill({ id }) {
    return getSkill(getDb(), id);
  },

  async saveSkill(input) {
    const db = getDb();
    if (input.id) {
      updateSkill(db, input.id, input);
      const skill = getSkill(db, input.id);
      if (!skill) throw new Error("Skill not found after update");
      return skill;
    }
    const id = createSkill(db, {
      name: input.name,
      description: input.description,
      prompt: input.prompt,
      systemPrompt: input.systemPrompt,
      provider: input.provider,
      model: input.model,
      temperature: input.temperature,
      maxTokens: input.maxTokens,
      toolAllowlist: input.toolAllowlist,
      mcpAllowlist: input.mcpAllowlist,
      maxSteps: input.maxSteps,
      metadata: input.metadata,
      compatibility: input.compatibility,
      enabled: input.enabled,
    });
    const skill = getSkill(db, id);
    if (!skill) throw new Error("Skill not found after creation");
    return skill;
  },

  async deleteSkill({ id }) {
    deleteSkill(getDb(), id);
  },

  async listWorkflowTemplates() {
    return listWorkflowTemplates(getDb());
  },

  async getWorkflowTemplate({ id }) {
    return getWorkflowTemplate(getDb(), id);
  },

  async saveWorkflowTemplate(input) {
    return saveWorkflowTemplate(getDb(), input);
  },

  async deleteWorkflowTemplate({ id }) {
    deleteWorkflowTemplate(getDb(), id);
  },

  async listConversations({ limit } = { limit: 20 }) {
    const db = getDb();
    return listConversations(db, limit).map((conversation) => {
      const title = sanitizeConversationTitle(conversation.title);
      if (title !== conversation.title) updateConversationTitle(db, conversation.id, title);
      return { ...conversation, title };
    });
  },

  async listTurns({ conversationId }) {
    return listTurns(getDb(), conversationId);
  },

  async saveConversation({ conversationId, turns }): Promise<void> {
    const db = getDb();
    const existing = getConversation(db, conversationId);
    const title = conversationTitleFromTurns(turns);
    const profileId = existing?.profileId ?? turns.find((t) => t.profileId)?.profileId;

    if (!existing) {
      createConversation(db, { id: conversationId, title, profileId });
    } else {
      if (title !== existing.title) {
        updateConversationTitle(db, conversationId, title);
      }
      if (profileId && !existing.profileId) {
        db.run(`UPDATE conversations SET profile_id = ? WHERE id = ?`, [profileId, conversationId]);
      }
    }

    for (const turn of turns) {
      if (turn.status === "streaming") continue;
      upsertTurn(db, {
        id: turn.id,
        conversationId,
        role: turn.role,
        blocks: turn.blocks,
        status: turn.status,
        timestamp: new Date(turn.timestamp).toISOString(),
        sourceMode: turn.sourceMode,
        executionMode: turn.executionMode,
        profileId: turn.profileId,
      });
    }
  },

  async listWorkspaces() {
    const db = getDb();
    return listStoredWorkspaces(db);
  },

  async createWorkspace(input) {
    const db = getDb();
    const id = createStoredWorkspace(db, {
      name: input.name,
      folderPath: input.folderPath,
      icon: input.icon,
      color: input.color,
      purpose: input.purpose,
      instructions: input.instructions,
      profileId: input.profileId,
      preferredLayout: input.preferredLayout,
    });
    syncWorkspaceFolderRoots();
    return { id };
  },

  async getWorkspace(input) {
    const db = getDb();
    return getStoredWorkspace(db, input.id);
  },

  async updateWorkspace(input) {
    const db = getDb();
    updateStoredWorkspace(db, input.id, {
      name: input.name,
      purpose: input.purpose,
      instructions: input.instructions,
      folderPath: input.folderPath,
      icon: input.icon,
      profileId: input.profileId,
      preferredLayout: input.preferredLayout,
      memoryEnabled: input.memoryEnabled,
      color: input.color,
    });
    syncWorkspaceFolderRoots();
  },

  async archiveWorkspace(input) {
    const db = getDb();
    archiveStoredWorkspace(db, input.id);
    syncWorkspaceFolderRoots();
  },

  async deleteWorkspace(input) {
    deleteStoredWorkspace(getDb(), input.id);
    syncWorkspaceFolderRoots();
  },

  async listWorkspaceDocuments(input) {
    const db = getDb();
    return listStoredWorkspaceDocumentIds(db, input.workspaceId)
      .map((id) => getParsedDocument(db, id))
      .filter((document): document is NonNullable<typeof document> => Boolean(document))
      .map(toParsedDocument);
  },

  async attachDocumentToWorkspace(input) {
    attachStoredDocument(getDb(), input.workspaceId, input.documentId);
  },

  async detachDocumentFromWorkspace(input) {
    detachStoredDocument(getDb(), input.workspaceId, input.documentId);
  },

  async listMemoryFacts(input) {
    const db = getDb();
    return listStoredMemoryFacts(db, input.workspaceId);
  },

  async addMemoryFact(input) {
    const db = getDb();
    const id = addStoredMemoryFact(db, input.workspaceId, {
      content: input.content,
      origin: input.origin,
      sourceTurnId: input.sourceTurnId,
    });
    return { id };
  },

  async updateMemoryFact(input) {
    const db = getDb();
    updateStoredMemoryFact(db, input.id, {
      content: input.content,
      status: input.status,
    });
  },

  async deleteMemoryFact(input) {
    const db = getDb();
    deleteStoredMemoryFact(db, input.id);
  },

  async linkConversationToWorkspace(input) {
    const db = getDb();
    linkStoredConversation(db, input.workspaceId, input.conversationId);
  },

  async listConversationsByWorkspace(input) {
    const db = getDb();
    return listStoredConversationsByWorkspace(db, input.workspaceId);
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

  async readFileContext(input: {
    paths: string[];
  }): Promise<{ files: FileContextInput[]; errors: string[] }> {
    const { promises: fs } = await import("node:fs");
    const path = await import("node:path");
    const files: FileContextInput[] = [];
    const errors: string[] = [];

    const BLOCKED_PATTERNS = [
      /\/etc\/(?:passwd|shadow)(?:$|\/)/,
      /\/(?:\.ssh|\.aws|\.gnupg)(?:$|\/)/,
      /\/Library\/Keychains(?:$|\/)/,
    ];
    const SECRET_PATTERN =
      /(?:api[_-]?key|access[_-]?token|client[_-]?secret|private[_-]?key|password)\s*[:=]/i;

    const TEXT_EXTENSIONS = new Set([
      ".txt",
      ".md",
      ".markdown",
      ".json",
      ".yaml",
      ".yml",
      ".toml",
      ".csv",
      ".tsv",
      ".xml",
      ".html",
      ".htm",
      ".css",
      ".scss",
      ".js",
      ".ts",
      ".tsx",
      ".jsx",
      ".py",
      ".rb",
      ".go",
      ".rs",
      ".java",
      ".c",
      ".cpp",
      ".h",
      ".hpp",
      ".swift",
      ".kt",
      ".sh",
      ".bash",
      ".zsh",
      ".fish",
      ".ps1",
      ".sql",
      ".graphql",
      ".gql",
      ".env",
      ".gitignore",
      ".dockerignore",
      ".ini",
      ".cfg",
      ".conf",
      ".properties",
      ".log",
      ".diff",
      ".patch",
    ]);

    const BINARY_EXTENSIONS = new Set([
      ".pdf",
      ".doc",
      ".docx",
      ".xls",
      ".xlsx",
      ".ppt",
      ".pptx",
      ".png",
      ".jpg",
      ".jpeg",
      ".gif",
      ".bmp",
      ".webp",
      ".tiff",
      ".ico",
      ".zip",
      ".tar",
      ".gz",
      ".rar",
      ".7z",
      ".exe",
      ".dll",
      ".so",
      ".dylib",
      ".bin",
      ".mp3",
      ".mp4",
      ".avi",
      ".mov",
      ".wav",
      ".flac",
      ".woff",
      ".woff2",
      ".ttf",
      ".otf",
    ]);

    const MAX_TEXT_SIZE = 2 * 1024 * 1024; // 2MB
    const MAX_TOTAL_SIZE = 10 * 1024 * 1024; // 10MB
    const MAX_FILES = 25;
    const MAX_DIRECTORY_DEPTH = 5;
    const SKIPPED_DIRECTORIES = new Set([".git", "node_modules", "dist", "target"]);
    let totalSize = 0;

    const candidatePaths: string[] = [];
    const collectPaths = async (rawPath: string, depth = 0): Promise<void> => {
      if (candidatePaths.length >= MAX_FILES) return;
      const requestedPath = path.resolve(rawPath);
      const stat = await fs.lstat(requestedPath);
      if (stat.isSymbolicLink()) {
        errors.push(`Skipped symlink: ${rawPath}`);
        return;
      }
      if (stat.isFile()) {
        authorizedFileRoots.add(await fs.realpath(path.dirname(requestedPath)));
        candidatePaths.push(requestedPath);
        return;
      }
      if (!stat.isDirectory()) {
        errors.push(`Unsupported path type: ${rawPath}`);
        return;
      }
      authorizedFileRoots.add(await fs.realpath(requestedPath));
      if (depth >= MAX_DIRECTORY_DEPTH || requestedPath.endsWith(".app")) {
        errors.push(`Skipped directory outside traversal limits: ${rawPath}`);
        return;
      }
      const entries = await fs.readdir(requestedPath, { withFileTypes: true });
      for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
        if (candidatePaths.length >= MAX_FILES) break;
        if (entry.isDirectory() && SKIPPED_DIRECTORIES.has(entry.name)) continue;
        await collectPaths(path.join(requestedPath, entry.name), depth + 1);
      }
    };

    for (const rawPath of input.paths) {
      try {
        await collectPaths(rawPath);
      } catch (err) {
        errors.push(`Failed to inspect ${rawPath}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    for (const rawPath of candidatePaths) {
      try {
        const requestedPath = path.resolve(rawPath);
        const requestedStat = await fs.lstat(requestedPath);
        const resolvedPath = await fs.realpath(requestedPath);

        // Security: reject blocked paths
        if (BLOCKED_PATTERNS.some((p) => p.test(resolvedPath))) {
          errors.push(`Blocked path: ${rawPath}`);
          continue;
        }

        // Resolve symlinks before all authorization and type checks.
        const stat = requestedStat.isSymbolicLink() ? await fs.stat(resolvedPath) : requestedStat;
        if (!stat.isFile()) {
          errors.push(`Not a file: ${rawPath}`);
          continue;
        }

        const size = stat.size;
        if (totalSize + size > MAX_TOTAL_SIZE) {
          errors.push(`Total size limit exceeded (10MB): ${rawPath}`);
          continue;
        }
        totalSize += size;

        const ext = path.extname(resolvedPath).toLowerCase();
        const displayName = path.basename(resolvedPath);

        // Determine MIME type and encoding
        let mimeType: string;
        let encoding: "text" | "binary" | "unsupported" | "parsed";

        if (TEXT_EXTENSIONS.has(ext)) {
          mimeType = getMimeType(ext);
          encoding = size > MAX_TEXT_SIZE ? "unsupported" : "text";
        } else if (BINARY_EXTENSIONS.has(ext)) {
          mimeType = getMimeType(ext);
          encoding = "binary";
        } else {
          // Unknown extension: sniff first bytes for binary detection
          const fd = await fs.open(resolvedPath, "r");
          const buf = Buffer.alloc(512);
          const { bytesRead } = await fd.read(buf, 0, 512, 0);
          await fd.close();
          const sample = buf.subarray(0, bytesRead);
          const hasNull = sample.includes(0);
          if (hasNull) {
            mimeType = "application/octet-stream";
            encoding = "binary";
          } else if (size > MAX_TEXT_SIZE) {
            mimeType = "text/plain";
            encoding = "unsupported";
          } else {
            mimeType = "text/plain";
            encoding = "text";
          }
        }

        let content: string | undefined;
        let preview: string;
        let parsedFormat: FileContextInput["parsedFormat"];
        let parsedMetadata: FileContextInput["parsedMetadata"];

        // Try structured parsing for supported document formats
        if (isParseable(resolvedPath) && encoding !== "unsupported") {
          const parseResult = await parseDocument(resolvedPath);
          if (parseResult.ok) {
            content = parseResult.document.content;
            preview = parseResult.document.preview;
            parsedFormat = parseResult.document.format;
            parsedMetadata = parseResult.document.metadata;
            encoding = "parsed";
          } else {
            errors.push(`Failed to parse ${displayName}: ${parseResult.error}`);
            // Fall back to raw text/binary handling
            if (encoding === "text") {
              content = await fs.readFile(resolvedPath, "utf-8");
              preview = content.slice(0, 500);
            } else if (encoding === "binary") {
              preview = `[Binary file: ${displayName} (${formatSize(size)})]`;
            } else {
              preview = `[File too large: ${displayName} (${formatSize(size)})]`;
            }
          }
        } else if (encoding === "text") {
          content = await fs.readFile(resolvedPath, "utf-8");
          preview = content.slice(0, 500);
        } else if (encoding === "binary") {
          preview = `[Binary file: ${displayName} (${formatSize(size)})]`;
        } else {
          preview = `[File too large: ${displayName} (${formatSize(size)})]`;
        }

        if (content && SECRET_PATTERN.test(content.slice(0, 100_000))) {
          errors.push(`Warning: ${displayName} may contain secrets. Review it before sending.`);
        }

        files.push({
          path: resolvedPath,
          displayName,
          size,
          mimeType,
          encoding,
          content,
          preview,
          parsedFormat,
          parsedMetadata,
        });
      } catch (err) {
        errors.push(`Failed to read ${rawPath}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    if (candidatePaths.length >= MAX_FILES) {
      errors.push(`File count limit reached: at most ${MAX_FILES} files are attached at once.`);
    }

    return { files, errors };
  },

  async saveParsedDocument(input: {
    document: Omit<ParsedDocument, "id" | "createdAt" | "updatedAt"> & { id?: string };
  }): Promise<ParsedDocument> {
    const db = getDb();
    const id = upsertParsedDocument(db, {
      ...input.document,
      error: input.document.error ?? undefined,
      id: input.document.id,
      parsedMetadata: input.document.parsedMetadata ?? {},
    });
    const saved = getParsedDocument(db, id);
    if (!saved) throw new Error("Failed to save parsed document");
    return toParsedDocument(saved);
  },

  async listParsedDocuments(input?: { limit?: number }): Promise<ParsedDocument[]> {
    const documents = listStoredParsedDocuments(getDb(), input?.limit ?? 100);
    for (const document of documents) {
      const root = await getPersistedDocumentRoot(document.path);
      if (root) authorizedFileRoots.add(root);
    }
    return documents.map(toParsedDocument);
  },

  async updateParsedDocument(input: { id: string; displayName: string }): Promise<ParsedDocument> {
    const displayName = input.displayName.trim();
    if (!displayName) throw new Error("Document name cannot be empty");
    const db = getDb();
    updateStoredParsedDocument(db, input.id, { displayName });
    const saved = getParsedDocument(db, input.id);
    if (!saved) throw new Error("Parsed document not found");
    return toParsedDocument(saved);
  },

  async deleteParsedDocument(input: { id: string }): Promise<void> {
    deleteStoredParsedDocument(getDb(), input.id);
  },

  async deleteAllParsedDocuments(): Promise<void> {
    const db = getDb();
    deleteAllStoredParsedDocuments(db);
    deleteAllStoredMarkdownSources(db);
  },

  async indexMarkdownFolder(input: {
    path: string;
  }): Promise<{ source: MarkdownSource; documents: ParsedDocument[] }> {
    const { promises: fs } = await import("node:fs");
    const path = await import("node:path");
    const root = await fs.realpath(path.resolve(input.path));
    const stat = await fs.lstat(root);
    if (!stat.isDirectory()) throw new Error("Markdown source must be a directory");
    authorizedFileRoots.add(root);
    const markdownPaths: string[] = [];
    const collect = async (directory: string, depth: number): Promise<void> => {
      if (depth > 5 || markdownPaths.length >= 100) return;
      const entries = await fs.readdir(directory, { withFileTypes: true });
      for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
        if (markdownPaths.length >= 100) break;
        if (entry.isSymbolicLink() || [".git", "node_modules", "dist", "target"].includes(entry.name))
          continue;
        const target = path.join(directory, entry.name);
        if (entry.isDirectory()) await collect(target, depth + 1);
        else if (entry.isFile() && /\.(md|markdown)$/i.test(entry.name)) markdownPaths.push(target);
      }
    };
    await collect(root, 0);

    const documents: ParsedDocument[] = [];
    for (const filePath of markdownPaths) {
      const parsed = await parseDocument(filePath);
      if (!parsed.ok) throw new Error(`${path.basename(filePath)}: ${parsed.error}`);
      const fileStat = await fs.stat(filePath);
      const id = upsertParsedDocument(getDb(), {
        path: filePath,
        displayName: path.relative(root, filePath),
        size: fileStat.size,
        mimeType: "text/markdown",
        encoding: "parsed",
        content: parsed.document.content,
        preview: parsed.document.preview,
        parsedFormat: "markdown",
        parsedMetadata: { ...parsed.document.metadata, sourceRoot: root },
        status: "done",
      });
      const saved = getParsedDocument(getDb(), id);
      if (saved) documents.push(toParsedDocument(saved));
    }
    const indexedPaths = new Set(markdownPaths);
    for (const stored of listStoredParsedDocuments(getDb(), 10_000)) {
      if (stored.parsedMetadata.sourceRoot === root && !indexedPaths.has(stored.path)) {
        deleteStoredParsedDocument(getDb(), stored.id);
      }
    }
    const source = upsertMarkdownSource(getDb(), {
      path: root,
      displayName: path.basename(root),
      fileCount: documents.length,
    });
    return { source, documents };
  },

  async listMarkdownSources(): Promise<MarkdownSource[]> {
    const sources = listStoredMarkdownSources(getDb());
    const { promises: fs } = await import("node:fs");
    for (const source of sources) {
      try {
        authorizedFileRoots.add(await fs.realpath(source.path));
      } catch {
        // Keep the source visible so the user can repair or remove an unavailable folder.
      }
    }
    return sources;
  },

  async improveParsedDocument(input: {
    id: string;
    instruction?: string;
  }): Promise<{ document: ParsedDocument; outputPath: string }> {
    const { promises: fs } = await import("node:fs");
    const path = await import("node:path");
    const db = getDb();
    const document = getParsedDocument(db, input.id);
    if (!document?.content) throw new Error("Parsed document has no editable content");
    if (document.content.length > 80_000) {
      throw new Error("Document is too large for safe direct AI editing (80,000 character limit)");
    }
    if (!(await isAuthorizedFilePath(document.path)))
      throw new Error("Document path is no longer authorized");
    const sourceFormat = document.parsedFormat === "csv" ? "CSV válido" : "Markdown";
    const instruction =
      input.instruction?.trim() ||
      "Melhore hierarquia, legibilidade, nomes de seções e organização dos dados sem remover, inventar ou alterar nenhum fato.";
    const providerConfig = getActiveProviderConfig();
    const controller = new AbortController();
    const timeoutMs = Math.min(Math.max(providerConfig.timeout, 10), 90) * 1_000;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeout = setTimeout(() => {
        controller.abort();
        reject(new Error("AI_IMPROVEMENT_TIMEOUT"));
      }, timeoutMs);
    });
    let result: Awaited<ReturnType<LlmProvider["complete"]>>;
    try {
      result = await Promise.race([
        getLlmProvider().complete({
          model: providerConfig.model,
          messages: [
            {
              role: "system",
              content: `Você é um editor estrutural de documentos. Reorganize ativamente o conteúdo com título, seções, listas ou tabelas quando isso melhorar a leitura. Preserve literalmente todos os fatos, nomes, datas e valores. O resultado deve ser materialmente mais organizado que a entrada. Retorne somente o arquivo final em ${sourceFormat}, sem cercas de código, comentários ou explicações.`,
            },
            {
              role: "user",
              content: `${instruction}\n\nNome: ${document.displayName}\n\nConteúdo:\n${document.content}`,
            },
          ],
          temperature: 0.2,
          maxTokens: 8_000,
          signal: controller.signal,
        }),
        timeoutPromise,
      ]);
    } catch (err) {
      if (controller.signal.aborted) {
        throw new Error(`AI improvement timed out after ${Math.round(timeoutMs / 1_000)} seconds`);
      }
      throw err;
    } finally {
      if (timeout) clearTimeout(timeout);
    }
    const improved = normalizeImprovedDocument(result.content);
    if (!improved) throw new Error("The AI returned empty content");
    if (!hasMaterialDocumentChange(document.content, improved)) {
      throw new Error("The AI returned the document without changes; the original file was preserved");
    }

    const canReplaceSource = document.parsedFormat === "markdown" || document.parsedFormat === "csv";
    const extension = document.parsedFormat === "csv" ? ".csv" : ".md";
    const outputPath = canReplaceSource
      ? document.path
      : path.join(
          path.dirname(document.path),
          `${path.basename(document.path, path.extname(document.path))}.organized${extension}`,
        );
    if (!(await isAuthorizedFilePath(outputPath)))
      throw new Error("Output path is outside the authorized directory");
    const outputExtension = path.extname(outputPath);
    const temporaryPath = path.join(
      path.dirname(outputPath),
      `${path.basename(outputPath, outputExtension)}.helix-tmp-${randomUUID()}${outputExtension}`,
    );
    const backupPath = `${outputPath}.helix-backup-${randomUUID()}`;
    let backupCreated = false;
    try {
      await fs.writeFile(temporaryPath, improved, "utf-8");
      if (document.parsedFormat === "csv") {
        const validation = await parseDocument(temporaryPath);
        if (!validation.ok) throw new Error(`AI returned invalid CSV: ${validation.error}`);
        if (
          validation.document.metadata.rows !== document.parsedMetadata.rows ||
          validation.document.metadata.columns !== document.parsedMetadata.columns
        ) {
          throw new Error("AI changed the CSV row or column count; original file was preserved");
        }
      }
      try {
        await fs.rename(outputPath, backupPath);
        backupCreated = true;
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
      }
      await fs.rename(temporaryPath, outputPath);
      if (backupCreated) await fs.unlink(backupPath);
    } catch (err) {
      await fs.rm(temporaryPath, { force: true });
      if (backupCreated) await fs.rename(backupPath, outputPath);
      throw err;
    }

    const update = {
      content: improved,
      preview: improved.slice(0, 500),
      size: Buffer.byteLength(improved),
      mimeType: canReplaceSource
        ? document.parsedFormat === "csv"
          ? "text/csv"
          : "text/markdown"
        : document.mimeType,
      parsedFormat: document.parsedFormat,
      parsedMetadata: {
        ...document.parsedMetadata,
        improvedByAi: true,
        originalPath: document.path,
        organizedOutputPath: outputPath,
      },
      status: "done" as const,
      encoding: "parsed",
      error: undefined,
    };
    updateStoredParsedDocument(db, document.id, update);
    const saved = getParsedDocument(db, document.id);
    if (!saved) throw new Error("Failed to persist improved document");
    return { document: toParsedDocument(saved), outputPath };
  },
};
