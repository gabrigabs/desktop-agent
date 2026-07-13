import type { HostBridgeApi } from "@desktop-agent/shared";
import type { RegisteredTool } from "@desktop-agent/tool-registry";
import { z } from "zod";

export type NativeDesktopToolContext = {
  bridge: HostBridgeApi;
};

const emptySchema = z.object({});
const notifySchema = z.object({
  kind: z.enum(["completed", "failed", "approval"]),
  title: z.string().max(120).optional(),
  body: z.string().max(500).optional(),
  includePreview: z.boolean().optional(),
});

export function createDesktopAppTool(ctx: NativeDesktopToolContext): RegisteredTool {
  return {
    name: "desktop.app",
    description: "Lê o conteúdo visível da janela focada do último app externo autorizado",
    category: "desktop",
    permissionLevel: "accessibility.read",
    executionPolicy: "explicit_approval",
    inputSchema: emptySchema,
    async handler(input) {
      emptySchema.parse(input);
      return ctx.bridge.snapshotActiveWindow();
    },
  };
}

export function createDesktopSystemTool(ctx: NativeDesktopToolContext): RegisteredTool {
  return {
    name: "desktop.system",
    description: "Retorna somente versão, arquitetura, locale, timezone e displays do macOS",
    category: "system",
    permissionLevel: "local.read",
    inputSchema: emptySchema,
    async handler(input) {
      emptySchema.parse(input);
      return ctx.bridge.getNativeSystemContext();
    },
  };
}

export function createDesktopNotifyTool(ctx: NativeDesktopToolContext): RegisteredTool {
  return {
    name: "desktop.notify",
    description: "Envia uma notificação nativa somente após aprovação e quando permitido nas configurações",
    category: "system",
    permissionLevel: "notification.send",
    executionPolicy: "explicit_approval",
    inputSchema: notifySchema,
    async handler(input) {
      const parsed = notifySchema.parse(input);
      await ctx.bridge.sendNativeNotification(parsed);
      return { sent: true, kind: parsed.kind };
    },
  };
}
