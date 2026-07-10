import en from "./locales/en/errors.json";
import ptBR from "./locales/pt-BR/errors.json";

export type SupportedLanguage = "pt-BR" | "en";

const resources = {
  "pt-BR": ptBR,
  en,
} as const;

function interpolate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const value = vars[key];
    return value === undefined || value === null ? "" : String(value);
  });
}

export function t(
  key: string,
  language: SupportedLanguage = "pt-BR",
  vars: Record<string, string | number> = {},
): string {
  const parts = key.split(".");
  let current: unknown = resources[language] ?? resources["pt-BR"];

  for (const part of parts) {
    if (current && typeof current === "object" && part in current) {
      current = (current as Record<string, unknown>)[part];
    } else {
      current = undefined;
      break;
    }
  }

  if (current === undefined && language !== "pt-BR") {
    return t(key, "pt-BR", vars);
  }

  if (typeof current === "string") {
    return interpolate(current, vars);
  }

  if (Array.isArray(current)) {
    return current.join(", ");
  }

  return key;
}
