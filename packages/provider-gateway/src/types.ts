import type { CompletionChunk, CompletionInput, CompletionOutput, ProviderKind } from "@desktop-agent/shared";

export interface LlmProvider {
  name: string;
  kind: ProviderKind;

  complete(input: CompletionInput): Promise<CompletionOutput>;
  stream(input: CompletionInput): AsyncIterable<CompletionChunk>;
}
