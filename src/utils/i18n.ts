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

export type TranslationNamespace = keyof typeof esTranslations;

const translations: Translations = {
  es: esTranslations,
  en: enTranslations,
  ca: caTranslations,
};

const languagesSet = new Set<string>(languages);
export const isSupportedLanguage = (
  maybeLanguage: string,
): maybeLanguage is Language => languagesSet.has(maybeLanguage);

export function getPageTranslations<Page extends keyof typeof esTranslations>(
  locale: string | undefined,
  page: Page,
): (typeof esTranslations)[Page] {
  const language = getCurrentLanguage(locale);
  return translations[language]?.[page];
}

// Define recursive type for translation objects
type TranslationValue = string | TranslationObject;
interface TranslationObject {
  [key: string]: TranslationValue;
}

export function getRecursiveValue(
  obj: TranslationObject | string | undefined,
  keys: string[],
): string | undefined {
  if (!obj || keys.length === 0 || typeof obj === "string") return undefined;

  const [currentKey, ...restKeys] = keys;
  const value = obj[currentKey];

  if (restKeys.length === 0) {
    if (typeof value !== "string") {
      console.warn(
        `Translation key "${currentKey}" points to a non-string value. The value type is ${typeof value}`,
      );
      return undefined;
    }

    return value;
  }

  // Recurse if there are more keys and value is an object
  if (typeof value === "object" && value !== null) {
    return getRecursiveValue(value, restKeys);
  }

  return undefined;
}

export function getTranslation(
  language: Language,
  page: keyof typeof esTranslations,
  key: string,
): string {
  const pageTranslations = translations[language]?.[
    page
  ] as unknown as TranslationObject;

  if (!pageTranslations) {
    if (import.meta.env.DEV) {
      console.error(`Missing translation page: ${language}.${page}`);
    }
    return key;
  }

  const value = getRecursiveValue(pageTranslations, key.split("."));

  if (!value) {
    if (import.meta.env.DEV) {
      console.error(`Missing translation: ${language}.${page}.${key}`);
    }
    return key;
  }

  return value;
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
  // 1. Check for configured non-empty prefixes first (e.g. /en, /ca)
  const sortedPrefixes = Object.values(languagePrefixes)
    .filter((p) => p !== "")
    .sort((a, b) => b.length - a.length);

  for (const prefix of sortedPrefixes) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      const remaining = pathname.slice(prefix.length);
      return remaining === "" ? "/" : remaining;
    }
  }

  // 2. Also check if the path starts with /es (the default language)
  // even if its prefix is configured as "" for URL generation.
  // This handles cases where we are internally at /es (e.g. via rewrite or direct access).
  for (const lang of languages) {
    const langPrefix = `/${lang}`;
    if (pathname === langPrefix || pathname.startsWith(`${langPrefix}/`)) {
      const remaining = pathname.slice(langPrefix.length);
      return remaining === "" ? "/" : remaining;
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
