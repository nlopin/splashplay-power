import { getPageTranslations, type Language } from "@/utils/i18n";

export type FaqEntry = { question: string; answer: string };

export type LocationInfo = {
  address: string | undefined;
  metro: string | undefined;
  whatsapp: string | undefined;
};

// Pairs every faq_q_x/faq_a_x found in the "main" locale namespace — no
// hardcoded list, so new FAQ entries there show up automatically.
export function getFaq(lang: Language): FaqEntry[] {
  const main = getPageTranslations(lang, "main") as Record<string, unknown>;
  const entries: FaqEntry[] = [];

  for (const key of Object.keys(main)) {
    const match = key.match(/^faq_q_(.+)$/);
    if (!match) continue;

    const question = main[key];
    const answer = main[`faq_a_${match[1]}`];
    if (typeof question === "string" && typeof answer === "string") {
      entries.push({ question, answer });
    }
  }

  return entries;
}

export function getLocationInfo(lang: Language): LocationInfo {
  const main = getPageTranslations(lang, "main") as Record<string, unknown>;
  return {
    address: typeof main.address === "string" ? main.address : undefined,
    metro: typeof main.address_metro === "string" ? main.address_metro : undefined,
    whatsapp: typeof main.whatsapp === "string" ? main.whatsapp : undefined,
  };
}
