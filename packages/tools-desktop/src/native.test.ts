import { describe, expect, test } from "bun:test";
import type { HostBridgeApi } from "@desktop-agent/shared";
import { createDesktopAppTool, createDesktopNotifyTool, createDesktopSystemTool } from "./native";

const bridge = {
  snapshotActiveWindow: async () => ({
    appName: "TextEdit",
    bundleId: "com.apple.TextEdit",
    pid: 42,
    windowTitle: "Notes",
    content: "hello",
    elements: [],
    nodeCount: 1,
    truncated: false,
    redactedCount: 0,
    capturedAt: new Date().toISOString(),
  }),
  getNativeSystemContext: async () => ({
    osVersion: "macOS 13",
    architecture: "arm64",
    locale: "pt_BR",
    timezone: "America/Fortaleza",
    displays: [],
  }),
  sendNativeNotification: async () => undefined,
} as unknown as HostBridgeApi;

describe("native desktop tools", () => {
  test("marks app and notification tools for explicit approval", () => {
    expect(createDesktopAppTool({ bridge }).executionPolicy).toBe("explicit_approval");
    expect(createDesktopNotifyTool({ bridge }).executionPolicy).toBe("explicit_approval");
    expect(createDesktopSystemTool({ bridge }).executionPolicy).toBeUndefined();
  });

  test("delegates native context and notification payloads", async () => {
    let notificationKind = "";
    const context = {
      ...bridge,
      sendNativeNotification: async (input: { kind: string }) => {
        notificationKind = input.kind;
      },
    } as unknown as HostBridgeApi;
    const app = await createDesktopAppTool({ bridge: context }).handler({});
    expect((app as { appName: string }).appName).toBe("TextEdit");
    await createDesktopNotifyTool({ bridge: context }).handler({ kind: "completed" });
    expect(notificationKind).toBe("completed");
  });
});
