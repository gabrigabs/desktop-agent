import type {
  CompletionChunk,
  CompletionInput,
  CompletionOutput,
  ProviderKind,
  ToolCall,
} from "@desktop-agent/shared";
import type { LlmProvider } from "../types";

type FetchFn = typeof globalThis.fetch;

type OpenAiMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content?: string | null;
  name?: string;
  tool_calls?: {
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }[];
  tool_call_id?: string;
};

function toOpenAiMessages(messages: CompletionInput["messages"]): OpenAiMessage[] {
  return messages.map((message) => {
    if (message.role === "tool") {
      return {
        role: "tool",
        content: message.content,
        tool_call_id: message.tool_call_id,
      };
    }
    return { role: message.role, content: message.content, name: message.name };
  });
}

function parseToolCalls(raw: unknown): ToolCall[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const calls: ToolCall[] = [];
  for (const item of raw) {
    if (
      typeof item === "object" &&
      item !== null &&
      "id" in item &&
      "function" in item &&
      typeof (item as Record<string, unknown>).function === "object" &&
      (item as Record<string, unknown>).function !== null
    ) {
      const fn = (item as Record<string, unknown>).function as Record<string, unknown>;
      calls.push({
        id: String((item as Record<string, unknown>).id),
        type: "function",
        function: {
          name: String(fn.name ?? ""),
          arguments: String(fn.arguments ?? ""),
        },
      });
    }
  }
  return calls.length > 0 ? calls : undefined;
}

function createSignal(signal: CompletionInput["signal"], timeout: number): AbortSignal {
  // Prefer AbortSignal.timeout when available, otherwise fallback to a manual timeout.
  const timeoutSignal =
    typeof AbortSignal !== "undefined" && "timeout" in AbortSignal
      ? (AbortSignal as unknown as { timeout(ms: number): AbortSignal }).timeout(timeout)
      : createFallbackTimeoutSignal(timeout);

  if (!signal) return timeoutSignal;

  if (typeof AbortSignal !== "undefined" && "any" in AbortSignal) {
    return (AbortSignal as unknown as { any(signals: AbortSignal[]): AbortSignal }).any([
      signal as AbortSignal,
      timeoutSignal,
    ]);
  }

  return composeAbortSignals(signal as AbortSignal, timeoutSignal);
}

function createFallbackTimeoutSignal(timeout: number): AbortSignal {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  // Avoid unref when running in environments that don't support it (e.g., some browsers).
  if (typeof (timer as unknown as { unref?: () => void }).unref === "function") {
    (timer as unknown as { unref: () => void }).unref();
  }
  return controller.signal;
}

function composeAbortSignals(...signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController();
  const abort = () => controller.abort();
  for (const signal of signals) {
    if (signal.aborted) {
      abort();
      break;
    }
    signal.addEventListener("abort", abort, { once: true });
  }
  return controller.signal;
}

export class OpenAICompatibleProvider implements LlmProvider {
  name: string;
  kind: ProviderKind;
  private apiKey: string;
  private baseUrl: string;
  private fetchFn: FetchFn;
  private timeout: number;

  constructor(config: {
    name?: string;
    kind?: ProviderKind;
    apiKey: string;
    baseUrl?: string;
    fetchFn?: FetchFn;
    timeout?: number;
  }) {
    this.name = config.name ?? "openai-compatible";
    this.kind = config.kind ?? "openai-compatible";
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl ?? "https://api.openai.com/v1";
    this.fetchFn = config.fetchFn ?? globalThis.fetch;
    this.timeout = config.timeout ?? 120000; // Default 120s
  }

  async complete(input: CompletionInput): Promise<CompletionOutput> {
    const body: Record<string, unknown> = {
      model: input.model,
      messages: toOpenAiMessages(input.messages),
      max_tokens: input.maxTokens,
      temperature: input.temperature,
    };
    if (input.tools && input.tools.length > 0) {
      body.tools = input.tools;
      body.tool_choice = input.toolChoice ?? "auto";
    }

    const response = await this.fetchFn(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      signal: createSignal(input.signal, this.timeout),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Provider error ${response.status}: ${err}`);
    }

    const data = (await response.json()) as {
      choices: {
        message: {
          content?: string | null;
          tool_calls?: unknown;
        };
      }[];
      model: string;
      usage?: { prompt_tokens: number; completion_tokens: number };
    };

    const message = data.choices[0]?.message;
    return {
      content: message?.content ?? "",
      model: data.model,
      toolCalls: parseToolCalls(message?.tool_calls),
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
          }
        : undefined,
    };
  }

  async *stream(input: CompletionInput): AsyncIterable<CompletionChunk> {
    const body: Record<string, unknown> = {
      model: input.model,
      messages: toOpenAiMessages(input.messages),
      max_tokens: input.maxTokens,
      temperature: input.temperature,
      stream: true,
    };
    if (input.tools && input.tools.length > 0) {
      body.tools = input.tools;
      body.tool_choice = input.toolChoice ?? "auto";
    }

    const response = await this.fetchFn(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      signal: createSignal(input.signal, this.timeout),
      body: JSON.stringify(body),
    });

    if (!response.ok || !response.body) {
      throw new Error(`Provider error ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    const accumulatedToolCalls = new Map<number, ToolCall>();

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
            choices?: {
              delta?: {
                content?: string;
                tool_calls?: {
                  index?: number;
                  id?: string;
                  type?: "function";
                  function?: { name?: string; arguments?: string };
                }[];
              };
              finish_reason?: string | null;
            }[];
          };
          const choice = parsed.choices?.[0];
          const delta = choice?.delta;
          const isDone = choice?.finish_reason != null;

          if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
              const index = tc.index ?? 0;
              const existing = accumulatedToolCalls.get(index);
              if (existing) {
                existing.function.arguments += tc.function?.arguments ?? "";
              } else {
                accumulatedToolCalls.set(index, {
                  id: tc.id ?? `${index}`,
                  type: tc.type ?? "function",
                  function: {
                    name: tc.function?.name ?? "",
                    arguments: tc.function?.arguments ?? "",
                  },
                });
              }
            }
          }

          const content = delta?.content ?? "";
          if (content || isDone) {
            yield {
              content,
              done: isDone,
              toolCalls:
                accumulatedToolCalls.size > 0 ? Array.from(accumulatedToolCalls.values()) : undefined,
            };
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    if (accumulatedToolCalls.size > 0) {
      yield {
        content: "",
        done: true,
        toolCalls: Array.from(accumulatedToolCalls.values()),
      };
    }
  }
}
