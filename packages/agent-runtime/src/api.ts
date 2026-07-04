import { createProvider } from "@desktop-agent/provider-gateway";
import type {
  AgentEvent,
  ProviderConfig,
  ToolResult,
  AgentApi,
} from "@desktop-agent/shared";
import { getDb, getRecentInteractions } from "@desktop-agent/storage";
import { registry } from "@desktop-agent/tool-registry";
import {
  createRewriteTool,
  createSummarizeTool,
  createTranslateTool,
} from "@desktop-agent/tools-text";
import { Orchestrator } from "./orchestrator";

function getProviderConfig(): {
  kind: "mock" | "openai-compatible";
  apiKey?: string;
  baseUrl?: string;
} {
  const providerEnv = process.env["AGENT_PROVIDER"] ?? "mock";

  if (providerEnv === "openai-compatible") {
    return {
      kind: "openai-compatible",
      apiKey: process.env["AGENT_API_KEY"] ?? "",
      baseUrl: process.env["AGENT_BASE_URL"],
    };
  }

  return { kind: "mock" };
}

const providerConfig = getProviderConfig();
const provider = createProvider(
  providerConfig.kind === "mock"
    ? { kind: "mock" }
    : {
        kind: "openai-compatible",
        apiKey: providerConfig.apiKey!,
        baseUrl: providerConfig.baseUrl,
      },
);

const ctx = { provider, model: process.env["AGENT_MODEL"] };

registry.register(createRewriteTool(ctx));
registry.register(createSummarizeTool(ctx));
registry.register(createTranslateTool(ctx));

const orchestrator = new Orchestrator({ provider });

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
		return [
			{
				id: provider.name,
				name: provider.name,
				kind: provider.kind,
				baseUrl: providerConfig.baseUrl ?? "mock",
				apiKeyEnv: "AGENT_API_KEY",
				models: ["mock-model"],
			},
		];
	},

	async getHistory({ limit } = { limit: 20 }) {
		return getRecentInteractions(getDb(), limit);
	},

	async shutdown() {
		orchestrator.shutdown();
	},
};
