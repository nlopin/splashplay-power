import { getWhatWeOfferConfig } from "@/config/whatWeOffer";
import { CONTACT_EMAIL, WHATSAPP_PHONE } from "@/constants";
import {
  getBookingPath,
  getExperiences,
  getGuestBounds,
} from "@/services/catalog/experiences";
import { getFaq, getLocationInfo, type FaqEntry } from "@/services/catalog/faq";
import type { GuestBounds } from "@/services/catalog/limits";
import {
  getLocalizedPath,
  getPageTranslations,
  type Language,
} from "@/utils/i18n";
import { formatPrice } from "@/utils/price";
import type esLocale from "@/locales/es.json";

import {
  WEBMCP_EVENT_TYPES,
  isWebMcpEventType,
  type WebMcpEventType,
} from "./eventTypes";

export type WebMcpMessages = (typeof esLocale)["webmcp"];

export type WebMcpExperience = {
  experience: string;
  name: string;
  fromPrice: string;
  durationMinutes: number;
  people: string;
  bookOnline: boolean;
};

export type WebMcpActivity = {
  activity: string;
  name: string;
  description: string;
  techniques: { name: string; how: string }[];
  included: string;
  session: string[];
};

/**
 * Everything the in-browser WebMCP tools need that lives in the catalog or
 * the locale files. Served prerendered as /webmcp/{lang}.json and fetched only
 * by browsers that support WebMCP, so other visitors pay nothing for it.
 */
export type WebMcpData = {
  lang: Language;
  experiences: WebMcpExperience[];
  activities: WebMcpActivity[];
  contact: { whatsapp: string; email: string };
  faq: FaqEntry[];
  location: { address?: string; metro?: string };
  bookingPaths: Record<WebMcpEventType, string>;
  guestBounds: Record<WebMcpEventType, GuestBounds>;
  messages: WebMcpMessages;
};

function formatPeople({ min, max }: GuestBounds): string {
  return min === max ? String(min) : `${min}–${max}`;
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Steps of the home page's "step by step" section that say what happens in
// the studio. The rest (booking, welcome drink, "have fun") repeat what the
// other fields already say, and the output has to stay under 1.5K characters.
const SESSION_STEP_KEYS = [
  "step3_description",
  "step4_description",
  "step6_description",
] as const;

type TechniqueCopy = Record<string, { title: string; description: string }>;

// What a Splash or Pouring session consists of, from the same config and
// copy as the home page's "What we offer" section, so the two stay in sync.
function buildActivities(lang: Language): WebMcpActivity[] {
  const home = getPageTranslations(lang, "home") as Record<string, unknown>;
  const main = getPageTranslations(lang, "main") as Record<string, unknown>;
  const techniques = main.techniques as TechniqueCopy;
  const text = (copy: Record<string, unknown>, key: string) =>
    stripHtml(String(copy[key] ?? ""));
  const session = SESSION_STEP_KEYS.map((key) => text(main, key));

  return getWhatWeOfferConfig("home", lang).activities.map((activity) => ({
    activity: activity.id,
    name: text(home, activity.titleKey),
    description: text(home, activity.descriptionKey),
    techniques: (activity.techniqueIds ?? []).map((id) => ({
      name: techniques[id].title,
      how: techniques[id].description,
    })),
    included: activity.includedKey ? text(home, activity.includedKey) : "",
    session,
  }));
}

export function buildWebMcpData(lang: Language): WebMcpData {
  const location = getLocationInfo(lang);

  const experiences = getExperiences(lang)
    .filter(
      (experience) =>
        experience.booking.method === "contact" ||
        isWebMcpEventType(experience.eventType),
    )
    .map((experience) => ({
      experience: experience.eventType,
      name: experience.name,
      fromPrice: formatPrice(experience.fromPriceCents),
      durationMinutes: experience.durationMinutes,
      people: formatPeople({
        min: experience.guestMin,
        max: experience.guestMax,
      }),
      bookOnline: experience.booking.method === "checkout",
    }));

  return {
    lang,
    experiences,
    activities: buildActivities(lang),
    contact: {
      whatsapp: location.whatsapp ?? WHATSAPP_PHONE,
      email: CONTACT_EMAIL,
    },
    faq: getFaq(lang),
    location: { address: location.address, metro: location.metro },
    bookingPaths: Object.fromEntries(
      WEBMCP_EVENT_TYPES.map((eventType) => [
        eventType,
        getLocalizedPath(`/${getBookingPath(eventType)}`, lang),
      ]),
    ) as Record<WebMcpEventType, string>,
    guestBounds: Object.fromEntries(
      WEBMCP_EVENT_TYPES.map((eventType) => [
        eventType,
        getGuestBounds(eventType),
      ]),
    ) as Record<WebMcpEventType, GuestBounds>,
    messages: getPageTranslations(lang, "webmcp"),
  };
}
