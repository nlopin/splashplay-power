export type Language = "es" | "en" | "ca";

export const defaultLanguage: Language = "es";

export const languages: Language[] = ["es", "en", "ca"];

export const languageNames: Record<Language, string> = {
  es: "Español",
  en: "English",
  ca: "Català",
};

export const languagePrefixes: Record<Language, string> = {
  es: "", // Default language has no prefix
  en: "/en",
  ca: "/ca",
};

// Import translation files
import esTranslations from "../locales/es.json";
import enTranslations from "../locales/en.json";
import caTranslations from "../locales/ca.json";

type Translations = Record<Language, typeof esTranslations>;

const translations: Translations = {
  es: esTranslations,
  en: enTranslations,
  ca: caTranslations,
};

const languagesSet = new Set<string>(languages);
export const isSupportedLanguage = (
  maybeLanguage: string,
): maybeLanguage is Language => languagesSet.has(maybeLanguage);

export function getPageTranslations(
  locale: string | undefined,
  page: keyof typeof esTranslations,
): (typeof esTranslations)[keyof typeof esTranslations] {
  const language = getCurrentLanguage(locale);
  return translations[language]?.[page];
}

export function getTranslation(
  language: Language,
  page: keyof typeof esTranslations,
  key: string,
): string {
  const pageTranslations = translations[language]?.[page];
  if (!pageTranslations) {
    if (import.meta.env.DEV) {
      console.error(`Missing translation page: ${language}.${page}`);
    }
    return key;
  }

  // todo: arbitrary depth of keys, now only one
  const translation = pageTranslations[key as keyof typeof pageTranslations];

  if (!translation) {
    if (import.meta.env.DEV) {
      console.error(`Missing translation: ${language}.${page}.${key}`);
    }
    return key;
  }

  return translation;
}

// Create a translation function using Astro's currentLocale
export function createAstroTranslator(
  currentLocale: string | undefined,
  page: keyof typeof esTranslations,
) {
  const language = getCurrentLanguage(currentLocale);
  return (key: string): string => getTranslation(language, page, key);
}

// Get current language from Astro.currentLocale with fallback
export function getCurrentLanguage(
  currentLocale: string | undefined,
): Language {
  return currentLocale && isSupportedLanguage(currentLocale)
    ? (currentLocale as Language)
    : defaultLanguage;
}

// Get the base path without language prefix
export function getPathWithoutLanguage(pathname: string): string {
  for (const lang of languages) {
    const prefix = languagePrefixes[lang];
    if (prefix && pathname.startsWith(prefix)) {
      return pathname.slice(prefix.length) || "/";
    }
  }
  return pathname;
}

// Generate URL for a specific language
export function getLocalizedPath(path: string, language: Language): string {
  const prefix = languagePrefixes[language];
  const cleanPath = getPathWithoutLanguage(path);

  if (cleanPath === "/") {
    return prefix || "/";
  }
  return prefix + cleanPath;
}

// Get alternate language links for current page
export function getAlternateLanguageLinks(
  currentPath: string,
  currentLanguage: Language,
) {
  const basePath = getPathWithoutLanguage(currentPath);

  return languages.map((lang) => ({
    language: lang,
    name: languageNames[lang],
    url: getLocalizedPath(basePath, lang),
    current: lang === currentLanguage,
  }));
}
