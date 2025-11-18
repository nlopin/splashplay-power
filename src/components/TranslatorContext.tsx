import { createContext, useContext, type ReactNode } from "react";

type TranslatorContext = Record<string, string>;
const translatorContext = createContext<TranslatorContext | null>(null);

export const TranslatorProvider = ({
    children,
    translations,
}: {
    children: ReactNode;
    translations: NonNullable<TranslatorContext>;
}) => {
    if (translations === null) {
        return null;
    }

    return (
        <translatorContext.Provider value={translations}>
            {children}
        </translatorContext.Provider>
    );
};

export const useTranslator = () => {
    const translations = useContext(translatorContext);

    if (translations === null) {
        return () => "";
    }

    return (key: string) => translations[key] ?? key;
};
