import { describe, expect, it } from "bun:test";
import { detectContext, detectContextType, getContextSuggestions } from "../context-detector";

describe("detectContextType", () => {
  it("detects a URL", () => {
    expect(detectContextType("https://example.com/article")).toBe("url");
    expect(detectContextType("http://localhost:3000/docs")).toBe("url");
  });

  it("detects code", () => {
    const code = `function add(a: number, b: number) {
      return a + b;
    }`;
    expect(detectContextType(code)).toBe("code");
  });

  it("detects stack traces as errors", () => {
    const error = `TypeError: Cannot read properties of undefined
    at Object.readFile (file.js:12:5)
    at processTicksAndRejections (internal.js:97:5)`;
    expect(detectContextType(error)).toBe("error");
  });

  it("detects long text", () => {
    const long = "word ".repeat(200);
    expect(detectContextType(long)).toBe("long_text");
  });

  it("detects messages", () => {
    const message = `> Hey, can we reschedule?
>
> On Monday, Ana wrote:`;
    expect(detectContextType(message)).toBe("message");
  });

  it("falls back to plain_text", () => {
    expect(detectContextType("Just a short sentence.")).toBe("plain_text");
  });

  it("falls back to plain_text for empty input", () => {
    expect(detectContextType("")).toBe("plain_text");
  });
});

describe("detectContext", () => {
  it("returns empty array for empty clipboard", () => {
    expect(detectContext("", "clipboard")).toEqual([]);
  });

  it("returns high-confidence context for URL", () => {
    expect(detectContext("https://example.com", "clipboard")).toEqual([
      { source: "clipboard", type: "url", confidence: "high" },
    ]);
  });
});

describe("getContextSuggestions", () => {
  it("returns suggestions for every known type", () => {
    const types = ["url", "code", "error", "long_text", "message", "plain_text"] as const;
    for (const type of types) {
      const suggestions = getContextSuggestions(type);
      expect(suggestions.length).toBeGreaterThan(0);
      for (const suggestion of suggestions) {
        expect(suggestion.type).toBe(type);
        expect(suggestion.label).toBeTruthy();
        expect(suggestion.prompt).toBeTruthy();
      }
    }
  });

  it("falls back to plain_text suggestions for unknown type", () => {
    const suggestions = getContextSuggestions("unknown" as never);
    expect(suggestions[0]?.type).toBe("plain_text");
  });
});
