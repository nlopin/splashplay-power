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

/**
 * Everything the in-browser WebMCP tools need that lives in the catalog or
 * the locale files. Served prerendered as /webmcp/{lang}.json and fetched only
 * by browsers that support WebMCP, so other visitors pay nothing for it.
 */
export type WebMcpData = {
  lang: Language;
  experiences: WebMcpExperience[];
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
