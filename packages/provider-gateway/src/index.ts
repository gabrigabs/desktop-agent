import type { CompletionChunk, CompletionInput, CompletionOutput } from "@desktop-agent/shared";
import { MockProvider } from "./providers/mock";
import { OpenAICompatibleProvider } from "./providers/openai-compatible";
import type { LlmProvider } from "./types";

export type ProviderFactoryConfig =
  | { kind: "mock" }
  | {
      kind: "pinstripes";
      apiKey: string;
      timeout?: number;
    }
  | {
      kind: "openai-compatible";
      apiKey: string;
      baseUrl?: string;
      name?: string;
      timeout?: number;
    };

export function createProvider(config: ProviderFactoryConfig): LlmProvider {
  switch (config.kind) {
    case "mock":
      return new MockProvider();
    case "pinstripes":
      return new OpenAICompatibleProvider({
        name: "pinstripes",
        kind: "pinstripes",
        apiKey: config.apiKey,
        baseUrl: "https://api.pinstripes.io/v1",
        timeout: config.timeout,
      });
    case "openai-compatible":
      return new OpenAICompatibleProvider(config);
  }
}

export type { CompletionChunk, CompletionInput, CompletionOutput, LlmProvider };
export { MockProvider, OpenAICompatibleProvider };
