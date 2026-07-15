import type { LlmProvider } from "@desktop-agent/provider-gateway";
import type { RegisteredTool } from "@desktop-agent/tool-registry";
import { z } from "zod";

export type TextToolContext = {
  provider: LlmProvider;
  model?: string;
};

const rewriteSchema = z.object({
  text: z.string().min(1, "No text provided"),
  instruction: z.string().optional(),
});

export function createRewriteTool(ctx: TextToolContext): RegisteredTool {
  return {
    name: "text.rewrite",
    description: "Melhora a clareza, estrutura e tom de um texto",
    category: "text",
    permissionLevel: "external",
    inputSchema: rewriteSchema,

    async handler(input) {
      const { text, instruction } = rewriteSchema.parse(input);
      const prompt = instruction
        ? `Reescreva o texto abaixo seguindo estas instruções: "${instruction}"\n\nTexto:\n${text}`
        : `Reescreva o texto abaixo melhorando clareza, estrutura e tom profissional. Retorne apenas o texto revisado, sem explicações.\n\nTexto:\n${text}`;

      const result = await ctx.provider.complete({
        model: ctx.model ?? "gpt-4o",
        messages: [
          {
            role: "system",
            content: "Você é um revisor de texto profissional. Retorne apenas o texto revisado em Markdown.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
      });

      return { rewritten: result.content, usage: result.usage };
    },

    async *streamHandler(input) {
      const { text, instruction } = rewriteSchema.parse(input);
      const prompt = instruction
        ? `Reescreva o texto abaixo seguindo estas instruções: "${instruction}"\n\nTexto:\n${text}`
        : `Reescreva o texto abaixo melhorando clareza, estrutura e tom profissional. Retorne apenas o texto revisado, sem explicações.\n\nTexto:\n${text}`;

      for await (const chunk of ctx.provider.stream({
        model: ctx.model ?? "gpt-4o",
        messages: [
          {
            role: "system",
            content: "Você é um revisor de texto profissional. Retorne apenas o texto revisado em Markdown.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
      })) {
        yield chunk;
      }
    },
  };
}
