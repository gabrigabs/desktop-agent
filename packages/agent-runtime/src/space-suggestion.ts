import type {
  SpaceFieldSuggestion,
  SuggestSpaceConfigInput,
  SuggestSpaceConfigOutput,
} from "@desktop-agent/shared";
import { z } from "zod";

const fieldTypeSchema = z.enum(["text", "number", "currency", "date", "boolean", "select"]);
const suggestionSchema = z.object({
  instructions: z.string().trim().min(1).max(2_000),
  preferredLayout: z.enum(["chat", "collections"]),
  profileId: z.string().trim().optional(),
  memoryEnabled: z.boolean(),
  collections: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(80),
        fields: z
          .array(
            z.object({
              name: z.string().trim().min(1).max(80),
              type: fieldTypeSchema,
              required: z.boolean().default(false),
              options: z.array(z.string().trim().min(1).max(60)).max(12).optional(),
            }),
          )
          .min(1)
          .max(8),
      }),
    )
    .max(3)
    .default([]),
});

function extractJson(value: string): unknown {
  const trimmed = value
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start === -1 || end <= start) return null;
    try {
      return JSON.parse(trimmed.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

function normalizeFields(fields: SpaceFieldSuggestion[]): SpaceFieldSuggestion[] {
  return fields.map((field) => ({
    ...field,
    options: field.type === "select" ? (field.options ?? []).filter(Boolean) : undefined,
  }));
}

export function normalizeSpaceSuggestion(
  raw: string,
  input: SuggestSpaceConfigInput,
): SuggestSpaceConfigOutput {
  const parsed = suggestionSchema.safeParse(extractJson(raw));
  const profileIds = new Set(input.profiles.map((profile) => profile.id));
  if (parsed.success) {
    return {
      ...parsed.data,
      profileId:
        parsed.data.profileId && profileIds.has(parsed.data.profileId) ? parsed.data.profileId : undefined,
      collections: parsed.data.collections.map((collection) => ({
        ...collection,
        fields: normalizeFields(collection.fields),
      })),
    };
  }

  const purpose = input.purpose.trim();
  return {
    instructions: purpose
      ? `Ajude a conduzir este Espaço com foco em: ${purpose}. Mantenha decisões, próximos passos e contexto relevante claros e atualizados.`
      : `Ajude a organizar o trabalho de ${input.name.trim()}, registrando decisões, próximos passos e contexto relevante.`,
    preferredLayout: "chat",
    profileId: input.profiles[0]?.id,
    memoryEnabled: true,
    collections: [],
  };
}

export const SPACE_SUGGESTION_TOOL = {
  type: "function" as const,
  function: {
    name: "suggest_space_config",
    description: "Suggest a focused Helix Space configuration.",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["instructions", "preferredLayout", "memoryEnabled", "collections"],
      properties: {
        instructions: { type: "string" },
        preferredLayout: { type: "string", enum: ["chat", "collections"] },
        profileId: { type: "string" },
        memoryEnabled: { type: "boolean" },
        collections: {
          type: "array",
          maxItems: 3,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["name", "fields"],
            properties: {
              name: { type: "string" },
              fields: {
                type: "array",
                minItems: 1,
                maxItems: 8,
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["name", "type", "required"],
                  properties: {
                    name: { type: "string" },
                    type: {
                      type: "string",
                      enum: ["text", "number", "currency", "date", "boolean", "select"],
                    },
                    required: { type: "boolean" },
                    options: { type: "array", items: { type: "string" }, maxItems: 12 },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};
