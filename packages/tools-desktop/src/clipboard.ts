import type { RegisteredTool } from "@desktop-agent/tool-registry";
import { z } from "zod";

export type DesktopToolContext = {
  clipboard: {
    read(): Promise<string>;
    write(text: string): Promise<void>;
  };
};

const clipboardSchema = z.object({
  action: z.enum(["read", "write"]),
  text: z.string().optional(),
});

export function createClipboardTool(ctx: DesktopToolContext): RegisteredTool {
  return {
    name: "desktop.clipboard",
    description: "Lê ou escreve no clipboard do sistema",
    category: "desktop",
    permissionLevel: "local.write",
    inputSchema: clipboardSchema,

    async handler(input) {
      const { action, text } = clipboardSchema.parse(input);

      if (action === "read") {
        const content = await ctx.clipboard.read();
        return { content };
      }

      if (action === "write" && text) {
        await ctx.clipboard.write(text);
        return { written: true };
      }

      throw new Error("Invalid clipboard action");
    },
  };
}
