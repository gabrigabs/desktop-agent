import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";
import commonEn from "./locales/en/common.json";
import helixEn from "./locales/en/helix.json";
import settingsEn from "./locales/en/settings.json";
import commonPt from "./locales/pt-BR/common.json";
import helixPt from "./locales/pt-BR/helix.json";
import settingsPt from "./locales/pt-BR/settings.json";

export const supportedLanguages = ["pt-BR", "en"] as const;
export type SupportedLanguage = (typeof supportedLanguages)[number];

export function isSupportedLanguage(value: string): value is SupportedLanguage {
  return supportedLanguages.includes(value as SupportedLanguage);
}

export function normalizeLanguage(value: string): SupportedLanguage {
  if (value.toLowerCase().startsWith("pt")) return "pt-BR";
  if (value.toLowerCase().startsWith("en")) return "en";
  return "pt-BR";
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      "pt-BR": {
        common: commonPt,
        settings: settingsPt,
        helix: helixPt,
      },
      en: {
        common: commonEn,
        settings: settingsEn,
        helix: helixEn,
      },
    },
    fallbackLng: "pt-BR",
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ["navigator"],
      caches: [],
    },
    defaultNS: "common",
    ns: ["common", "settings", "helix"],
  });

export default i18n;
