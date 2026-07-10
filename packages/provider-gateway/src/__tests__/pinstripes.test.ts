import { describe, expect, test } from "bun:test";
import { createProvider, OpenAICompatibleProvider } from "../index";

describe("Pinstripes Provider Factory Tests", () => {
  test("Should create Pinstripes provider with correct baseUrl and kind", () => {
    const provider = createProvider({
      kind: "pinstripes",
      apiKey: "test-api-key",
    });

    expect(provider).toBeInstanceOf(OpenAICompatibleProvider);
    expect(provider.name).toBe("pinstripes");
    expect(provider.kind).toBe("pinstripes");

    // Access the private/internal properties of OpenAICompatibleProvider for verification
    const castProvider = provider as unknown as { baseUrl: string; apiKey: string };
    expect(castProvider.baseUrl).toBe("https://api.pinstripes.io/v1");
    expect(castProvider.apiKey).toBe("test-api-key");
  });
});
