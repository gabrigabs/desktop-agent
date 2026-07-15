import { describe, expect, test } from "bun:test";
import { formatRelativeDate } from "../../apps/desktop/src/components/ui/identity/recent-conversations";

describe("RecentConversations helpers", () => {
  test("formatRelativeDate returns time for today", () => {
    const now = new Date();
    const result = formatRelativeDate(now, "pt-BR");
    expect(result).toMatch(/\d{2}:\d{2}/);
  });

  test("formatRelativeDate returns 'Ontem' for yesterday", () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    // Ensure it is after midnight yesterday
    yesterday.setHours(12, 0, 0, 0);
    const result = formatRelativeDate(yesterday, "pt-BR");
    expect(result).toBe("Ontem");
  });

  test("formatRelativeDate returns day/month for older dates", () => {
    const oldDate = new Date("2024-01-15T10:00:00");
    const result = formatRelativeDate(oldDate, "pt-BR");
    expect(result).toMatch(/^\d{2}/);
  });
});
