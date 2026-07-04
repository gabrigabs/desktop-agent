import type { LlmProvider } from "@desktop-agent/provider-gateway";
import type { RegisteredTool } from "@desktop-agent/tool-registry";
import { z } from "zod";

export type TextToolContext = {
	provider: LlmProvider;
	model?: string;
};

const summarizeSchema = z.object({
	text: z.string().min(1, "No text provided"),
	maxLength: z.number().optional(),
});

export function createSummarizeTool(ctx: TextToolContext): RegisteredTool {
	return {
		name: "text.summarize",
		description: "Resume um texto destacando os pontos principais",
		category: "text",
		permissionLevel: "external",
		inputSchema: summarizeSchema,

		async handler(input) {
			const { text, maxLength } = summarizeSchema.parse(input);
			const lengthHint = maxLength ? ` em no máximo ${maxLength} palavras` : "";

			const result = await ctx.provider.complete({
				model: ctx.model ?? "gpt-4o",
				messages: [
					{
						role: "system",
						content:
							"Você é um assistente que resume textos de forma concisa. Retorne apenas o resumo em Markdown.",
					},
					{
						role: "user",
						content: `Resuma o texto abaixo${lengthHint}:\n\n${text}`,
					},
				],
				temperature: 0.3,
			});

			return { summary: result.content, usage: result.usage };
		},
	};
}
