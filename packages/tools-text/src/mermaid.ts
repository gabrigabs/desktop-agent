import type { LlmProvider } from "@desktop-agent/provider-gateway";
import type { RegisteredTool } from "@desktop-agent/tool-registry";
import { z } from "zod";

export type MermaidValidation = { valid: true } | { valid: false; error: string };

export type MermaidToolContext = {
  provider: LlmProvider;
  model?: string;
  validate(code: string): Promise<MermaidValidation>;
};

const mermaidSchema = z.object({
  description: z.string().min(1, "A diagram description is required"),
  diagramType: z.string().trim().min(1).optional(),
});

const MAX_ATTEMPTS = 3;

function extractCode(content: string): string {
  const fenced = content.match(/```(?:mermaid)?\s*([\s\S]*?)```/i);
  return (fenced?.[1] ?? content).trim();
}

function generationPrompt(description: string, diagramType?: string, previousError?: string): string {
  const typeHint = diagramType
    ? `Use the Mermaid diagram type "${diagramType}".`
    : "Choose the simplest suitable Mermaid diagram type.";
  const correction = previousError
    ? `\nThe previous result failed validation with this error: ${previousError}\nReturn a corrected diagram only.`
    : "";
  return [
    "Generate a Mermaid diagram for the following description.",
    typeHint,
    "Return only Mermaid source code, without Markdown fences, explanations, HTML, JavaScript, or external links.",
    `Description: ${description}`,
    correction,
  ].join("\n");
}

export function createMermaidGenerateTool(ctx: MermaidToolContext): RegisteredTool {
  return {
    name: "mermaid.generate",
    description: "Gera código Mermaid e confirma que ele é sintaticamente válido antes de retornar",
    category: "text",
    permissionLevel: "external",
    inputSchema: mermaidSchema,
    async handler(input) {
      const { description, diagramType } = mermaidSchema.parse(input);
      let lastError = "";

      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
        const response = await ctx.provider.complete({
          model: ctx.model ?? "gpt-4o",
          messages: [
            {
              role: "system",
              content: "You produce compact, valid Mermaid source for a desktop assistant.",
            },
            { role: "user", content: generationPrompt(description, diagramType, lastError) },
          ],
          temperature: 0.2,
        });
        const code = extractCode(response.content);
        const validation = await ctx.validate(code);
        if (validation.valid) {
          return { code, diagramType: diagramType ?? code.split(/\s+/)[0] ?? "unknown", attempts: attempt };
        }
        lastError = validation.error;
      }

      throw new Error(`MERMAID_PARSE_ERROR: ${lastError || "Mermaid output was invalid"}`);
    },
  };
}
