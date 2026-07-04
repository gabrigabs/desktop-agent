import type {
	CompletionChunk,
	CompletionInput,
	CompletionOutput,
} from "@desktop-agent/shared";

export interface LlmProvider {
	name: string;
	kind: "mock" | "openai-compatible" | "anthropic-compatible";

	complete(input: CompletionInput): Promise<CompletionOutput>;
	stream(input: CompletionInput): AsyncIterable<CompletionChunk>;
}
