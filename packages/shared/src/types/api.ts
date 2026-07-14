import type {
  FollowUpContextPolicy,
  FollowUpHypothesisStatus,
  FollowUpMemoryScope,
  FollowUpMode,
  FollowUpObservationSource,
  FollowUpObservationStatus,
  FollowUpSession,
} from "../follow-up";
import type { ContextAttachment } from "../native";
import type {
  ExecutionContextSnapshot,
  Space,
  SpaceCollection,
  SpaceField,
  SpaceLayout,
  SpaceMemoryFact,
  SpaceRecord,
  SpaceRecordValue,
  SpaceView,
  SpaceViewType,
  SuggestSpaceConfigInput,
  SuggestSpaceConfigOutput,
} from "../space";
import type { MarkdownSource, ParsedDocument } from "./parsed-documents";
import type {
  AgentEvent,
  AgentProfile,
  AppSettings,
  ConnectorConfig,
  Conversation,
  ExecutionMode,
  FileContextInput,
  McpTestResult,
  PermissionLevel,
  PromptTemplate,
  ProviderConfig,
  SaveProfileInput,
  SavePromptInput,
  Skill,
  ToolResult,
  Turn,
  WorkflowRun,
  WorkflowStepTemplate,
  WorkflowTemplate,
  WorkflowTemplateSettings,
} from "./rpc";

type SpaceInput = {
  name: string;
  folderPath: string;
  icon?: string;
  color?: string;
  purpose?: string;
  instructions?: string;
  profileId?: string;
  preferredLayout?: SpaceLayout;
  memoryEnabled?: boolean;
};

export type SaveMcpServerInput = {
  id?: string;
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  enabled?: boolean;
  preset?: boolean;
  permissionPolicy?: PermissionLevel[];
};

export type { FileContextInput, SaveProfileInput, SavePromptInput };

export type AgentApi = {
  ping(): Promise<{ status: string }>;
  getVersion(): Promise<string>;
  execute(input: { requestId: string; toolName: string; input: unknown }): Promise<{
    result: ToolResult;
    events: AgentEvent[];
  }>;
  listTools(): Promise<
    {
      name: string;
      description: string;
      category: string;
      executionPolicy?: "standard" | "explicit_approval";
    }[]
  >;
  getProviders(): Promise<ProviderConfig[]>;
  getHistory(input?: { limit?: number }): Promise<unknown[]>;
  getSettings(): Promise<AppSettings>;
  saveSettings(settings: AppSettings): Promise<void>;
  fetchModels(provider: string, apiKey: string, baseUrl?: string): Promise<string[]>;
  startRun(input: {
    requestId: string;
    prompt: string;
    workflowId?: string;
    skillId?: string;
    mode?: ExecutionMode;
    sourceMode?: "free" | "clipboard";
    clipboardText?: string;
    contextText?: string;
    fileContext?: FileContextInput[];
    contexts?: ContextAttachment[];
    maxSteps?: number;
    history?: { role: "user" | "assistant" | "system"; content: string }[];
    profileId?: string;
    spaceId?: string;
    followUpSessionId?: string;
  }): Promise<{
    run: WorkflowRun;
    events: AgentEvent[];
  }>;
  cancelRun(input: { runId: string }): Promise<{ cancelled: boolean }>;
  getRun(input: { runId: string }): Promise<WorkflowRun | null>;
  listRuns(input?: { limit?: number }): Promise<WorkflowRun[]>;
  resumeRun(input: { requestId: string; runId: string; approved: boolean }): Promise<{
    run: WorkflowRun;
    events: AgentEvent[];
  }>;
  listCapabilities(): Promise<{
    tools: {
      name: string;
      description: string;
      category: string;
      permissionLevel: PermissionLevel;
      executionPolicy?: "standard" | "explicit_approval";
    }[];
    connectors: ConnectorConfig[];
    templates: WorkflowTemplate[];
  }>;
  listMcpServers(): Promise<ConnectorConfig[]>;
  saveMcpServer(input: { server: SaveMcpServerInput }): Promise<ConnectorConfig>;
  deleteMcpServer(input: { id: string }): Promise<void>;
  testMcpServer(input: { id: string }): Promise<McpTestResult>;
  listConversations(input?: { limit?: number }): Promise<Conversation[]>;
  listTurns(input: { conversationId: string }): Promise<Turn[]>;
  saveConversation(input: { conversationId: string; turns: Turn[] }): Promise<void>;
  listPromptTemplates(): Promise<PromptTemplate[]>;
  savePromptTemplate(input: SavePromptInput): Promise<PromptTemplate>;
  deletePromptTemplate(input: { id: string }): Promise<void>;
  listAgentProfiles(): Promise<AgentProfile[]>;
  saveAgentProfile(input: SaveProfileInput): Promise<AgentProfile>;
  deleteAgentProfile(input: { id: string }): Promise<void>;
  setActiveProfile(input: { profileId: string | null }): Promise<void>;
  getActiveProfile(): Promise<AgentProfile | null>;
  listSkills(): Promise<Skill[]>;
  getSkill(input: { id: string }): Promise<Skill | null>;
  saveSkill(input: {
    id?: string;
    name: string;
    description?: string;
    prompt: string;
    systemPrompt?: string;
    provider?: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
    toolAllowlist?: string[];
    mcpAllowlist?: string[];
    maxSteps?: number;
    metadata?: Record<string, string>;
    compatibility?: string;
    enabled?: boolean;
  }): Promise<Skill>;
  deleteSkill(input: { id: string }): Promise<void>;
  listWorkflowTemplates(): Promise<WorkflowTemplate[]>;
  getWorkflowTemplate(input: { id: string }): Promise<WorkflowTemplate | null>;
  saveWorkflowTemplate(input: {
    id?: string;
    name: string;
    description?: string;
    prompt: string;
    settings?: WorkflowTemplateSettings;
    steps?: Array<Omit<WorkflowStepTemplate, "id" | "templateId" | "stepIndex" | "createdAt" | "updatedAt">>;
    enabled?: boolean;
  }): Promise<WorkflowTemplate>;
  deleteWorkflowTemplate(input: { id: string }): Promise<void>;
  readFileContext(input: { paths: string[] }): Promise<{ files: FileContextInput[]; errors: string[] }>;
  saveParsedDocument(input: {
    document: Omit<ParsedDocument, "id" | "createdAt" | "updatedAt"> & { id?: string };
  }): Promise<ParsedDocument>;
  listParsedDocuments(input?: { limit?: number }): Promise<ParsedDocument[]>;
  updateParsedDocument(input: { id: string; displayName: string }): Promise<ParsedDocument>;
  deleteParsedDocument(input: { id: string }): Promise<void>;
  deleteAllParsedDocuments(): Promise<void>;
  indexMarkdownFolder(input: {
    path: string;
  }): Promise<{ source: MarkdownSource; documents: ParsedDocument[] }>;
  listMarkdownSources(): Promise<MarkdownSource[]>;
  improveParsedDocument(input: {
    id: string;
    instruction?: string;
  }): Promise<{ document: ParsedDocument; outputPath: string }>;
  listSpaces(): Promise<Space[]>;
  createSpace(input: SpaceInput): Promise<Space>;
  getSpace(input: { id: string }): Promise<Space | null>;
  updateSpace(input: {
    id: string;
    name?: string;
    purpose?: string;
    instructions?: string;
    folderPath?: string;
    icon?: string;
    profileId?: string | null;
    preferredLayout?: SpaceLayout;
    memoryEnabled?: boolean;
    color?: string;
  }): Promise<Space>;
  archiveSpace(input: { id: string }): Promise<Space>;
  deleteSpace(input: { id: string }): Promise<Space>;
  listSpaceDocuments(input: { spaceId: string }): Promise<ParsedDocument[]>;
  attachDocumentToSpace(input: { spaceId: string; documentId: string }): Promise<void>;
  detachDocumentFromSpace(input: { spaceId: string; documentId: string }): Promise<void>;
  listMemoryFacts(input: { spaceId: string }): Promise<SpaceMemoryFact[]>;
  addMemoryFact(input: {
    spaceId: string;
    content: string;
    origin?: "manual" | "assistant";
    sourceTurnId?: string;
  }): Promise<SpaceMemoryFact>;
  updateMemoryFact(input: {
    spaceId: string;
    id: string;
    content?: string;
    status?: "active" | "archived";
  }): Promise<SpaceMemoryFact>;
  deleteMemoryFact(input: { spaceId: string; id: string }): Promise<void>;
  linkConversationToSpace(input: { spaceId: string; conversationId: string }): Promise<void>;
  listConversationsBySpace(input: { spaceId: string }): Promise<string[]>;
  getExecutionContextSnapshot(input: { runId: string }): Promise<ExecutionContextSnapshot | null>;
  suggestSpaceConfig(input: SuggestSpaceConfigInput): Promise<SuggestSpaceConfigOutput>;
  listSpaceCollections(input: { spaceId: string }): Promise<SpaceCollection[]>;
  createSpaceCollection(input: {
    spaceId: string;
    name: string;
    icon?: string;
    fields: SpaceField[];
  }): Promise<SpaceCollection>;
  updateSpaceCollection(input: {
    spaceId: string;
    id: string;
    name?: string;
    icon?: string;
    fields?: SpaceField[];
  }): Promise<SpaceCollection>;
  deleteSpaceCollection(input: { spaceId: string; id: string }): Promise<void>;
  listSpaceRecords(input: { spaceId: string; collectionId: string }): Promise<SpaceRecord[]>;
  createSpaceRecord(input: {
    spaceId: string;
    collectionId: string;
    values: Record<string, SpaceRecordValue>;
  }): Promise<SpaceRecord>;
  updateSpaceRecord(input: {
    spaceId: string;
    collectionId: string;
    id: string;
    values: Record<string, SpaceRecordValue>;
  }): Promise<SpaceRecord>;
  deleteSpaceRecord(input: { spaceId: string; collectionId: string; id: string }): Promise<void>;
  listSpaceViews(input: { spaceId: string; collectionId?: string }): Promise<SpaceView[]>;
  createSpaceView(input: {
    spaceId: string;
    collectionId: string;
    name: string;
    type: SpaceViewType;
    config?: Record<string, unknown>;
  }): Promise<SpaceView>;
  updateSpaceView(input: {
    spaceId: string;
    id: string;
    name?: string;
    type?: SpaceViewType;
    config?: Record<string, unknown>;
  }): Promise<SpaceView>;
  deleteSpaceView(input: { spaceId: string; id: string }): Promise<void>;
  startFollowUpSession(input: {
    mode: FollowUpMode;
    objective: string;
    spaceId?: string | null;
    memoryScope?: FollowUpMemoryScope;
    contextPolicy?: FollowUpContextPolicy;
    workflowRunId?: string;
  }): Promise<FollowUpSession>;
  pauseFollowUpSession(input: { id: string }): Promise<void>;
  resumeFollowUpSession(input: { id: string }): Promise<void>;
  stopFollowUpSession(input: { id: string; reason: string }): Promise<void>;
  completeFollowUpSession(input: { id: string; summary: string }): Promise<void>;
  addFollowUpObservation(input: {
    sessionId: string;
    content: string;
    source: FollowUpObservationSource;
    status?: FollowUpObservationStatus;
    target?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<void>;
  updateFollowUpObservation(input: {
    id: string;
    status?: FollowUpObservationStatus;
    content?: string;
    target?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<void>;
  addFollowUpHypothesis(input: { sessionId: string; text: string }): Promise<void>;
  updateFollowUpHypothesis(input: {
    id: string;
    status?: FollowUpHypothesisStatus;
    evidenceIds?: string[];
  }): Promise<void>;
  listFollowUpSessions(): Promise<FollowUpSession[]>;
  getFollowUpSession(input: { id: string }): Promise<FollowUpSession | null>;
  shutdown(): Promise<void>;
};
