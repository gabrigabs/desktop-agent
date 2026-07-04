import type { CompletionChunk, CompletionInput, CompletionOutput, ProviderKind } from "@desktop-agent/shared";
import type { LlmProvider } from "../types";

type FetchFn = typeof globalThis.fetch;

export class OpenAICompatibleProvider implements LlmProvider {
  name: string;
  kind: ProviderKind;
  private apiKey: string;
  private baseUrl: string;
  private fetchFn: FetchFn;

  constructor(config: {
    name?: string;
    kind?: ProviderKind;
    apiKey: string;
    baseUrl?: string;
    fetchFn?: FetchFn;
  }) {
    this.name = config.name ?? "openai-compatible";
    this.kind = config.kind ?? "openai-compatible";
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl ?? "https://api.openai.com/v1";
    this.fetchFn = config.fetchFn ?? globalThis.fetch;
  }

  async complete(input: CompletionInput): Promise<CompletionOutput> {
    const response = await this.fetchFn(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: input.model,
        messages: input.messages,
        max_tokens: input.maxTokens,
        temperature: input.temperature,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Provider error ${response.status}: ${err}`);
    }

    const data = (await response.json()) as {
      choices: { message: { content: string } }[];
      model: string;
      usage?: { prompt_tokens: number; completion_tokens: number };
    };

    return {
      content: data.choices[0]?.message.content ?? "",
      model: data.model,
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
          }
        : undefined,
    };
  }

  async *stream(input: CompletionInput): AsyncIterable<CompletionChunk> {
    const response = await this.fetchFn(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: input.model,
        messages: input.messages,
        max_tokens: input.maxTokens,
        temperature: input.temperature,
        stream: true,
      }),
    });

    if (!response.ok || !response.body) {
      throw new Error(`Provider error ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed?.startsWith("data: ")) continue;
          const json = trimmed.slice(6);
          if (json === "[DONE]") {
            yield { content: "", done: true };
            return;
          }

          const parsed = JSON.parse(json) as {
            choices: {
              delta: { content?: string };
              finish_reason: string | null;
            }[];
          };
          const delta = parsed.choices[0]?.delta.content ?? "";
          const isDone = parsed.choices[0]?.finish_reason != null;

          if (delta) {
            yield { content: delta, done: isDone };
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}
