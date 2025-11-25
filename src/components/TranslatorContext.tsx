import { createContext, useContext, type ReactNode } from "react";

type TranslatorContext = {
  language: string;
  translations: Record<string, string>;
};
const translatorContext = createContext<TranslatorContext | null>(null);

export const TranslatorProvider = ({
  children,
  translations,
  language,
}: {
  children: ReactNode;
  translations: TranslatorContext["translations"];
  language: TranslatorContext["language"];
}) => {
  if (translations === null) {
    return null;
  }

  return (
    <translatorContext.Provider value={{ translations, language }}>
      {children}
    </translatorContext.Provider>
  );
};

export const useTranslator = () => {
  const context = useContext(translatorContext);

  if (context === null) {
    return () => "";
  }

  return (key: string) => context.translations[key] ?? key;
};

export const usePageLanguage = () => {
  const context = useContext(translatorContext);

  if (context === null) {
    return "";
  }

  return context.language;
};
