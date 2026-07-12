import type { RegisteredTool } from "@desktop-agent/tool-registry";
import { z } from "zod";
import type { ParserAgent } from "./ParserAgent";

const parseFileSchema = z.object({
  paths: z.array(z.string().min(1)).min(1),
});

export function createFileParseTool(parser: ParserAgent): RegisteredTool {
  return {
    name: "agent.file.parse",
    description:
      "Extrai texto de arquivos anexados (PDF, DOCX, imagens com OCR, CSV, Markdown, etc.). Use quando precisar do conteúdo completo de um arquivo referenciado.",
    category: "system",
    permissionLevel: "local.read",
    inputSchema: parseFileSchema,
    async handler(input) {
      const parsed = parseFileSchema.parse(input);
      const results = await parser.parseFiles(parsed.paths);
      return { results };
    },
  };
}
