import type {
	CompletionChunk,
	CompletionInput,
	CompletionOutput,
} from "@desktop-agent/shared";
import { MockProvider } from "./providers/mock";
import { OpenAICompatibleProvider } from "./providers/openai-compatible";
import type { LlmProvider } from "./types";

export type ProviderFactoryConfig =
	| { kind: "mock" }
	| {
			kind: "openai-compatible";
			apiKey: string;
			baseUrl?: string;
			name?: string;
	  };

export function createProvider(config: ProviderFactoryConfig): LlmProvider {
	switch (config.kind) {
		case "mock":
			return new MockProvider();
		case "openai-compatible":
			return new OpenAICompatibleProvider(config);
	}
}

export type { CompletionChunk, CompletionInput, CompletionOutput, LlmProvider };
export { MockProvider, OpenAICompatibleProvider };
