import { unwrapAgentResponse } from "@desktop-agent/shared";

export function normalizeImprovedDocument(response: string): string {
  return unwrapAgentResponse(response)
    .trim()
    .replace(/^```(?:markdown|md|csv)?\s*\n([\s\S]*?)\n```$/i, "$1")
    .trim();
}

export function hasMaterialDocumentChange(original: string, improved: string): boolean {
  const comparable = (value: string) => value.replace(/\s+/g, " ").trim();
  return comparable(original) !== comparable(improved);
}
