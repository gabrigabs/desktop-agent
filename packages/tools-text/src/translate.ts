import type { LlmProvider } from "@desktop-agent/provider-gateway";
import type { RegisteredTool } from "@desktop-agent/tool-registry";
import { z } from "zod";

export type TextToolContext = {
	provider: LlmProvider;
	model?: string;
};

const translateSchema = z.object({
	text: z.string().min(1, "No text provided"),
	targetLanguage: z.string().min(1, "No target language"),
});

export function createTranslateTool(ctx: TextToolContext): RegisteredTool {
	return {
		name: "text.translate",
		description: "Traduz um texto para o idioma especificado",
		category: "text",
		permissionLevel: "external",
		inputSchema: translateSchema,

		async handler(input) {
			const { text, targetLanguage } = translateSchema.parse(input);

			const result = await ctx.provider.complete({
				model: ctx.model ?? "gpt-4o",
				messages: [
					{
						role: "system",
						content: `Você é um tradutor profissional. Traduza o texto para ${targetLanguage}. Retorne apenas a tradução.`,
					},
					{ role: "user", content: text },
				],
				temperature: 0.3,
			});

			return {
				translation: result.content,
				targetLanguage,
				usage: result.usage,
			};
		},
	};
}
