import { EVENT_TYPE, type EventType } from "@/components/booking/types";
import { languages, getPageTranslations, type Language } from "@/utils/i18n";
import { getFromPriceCents } from "./pricing";
import { getLocationInfo } from "./faq";
import { GUEST_BOUNDS, DURATION_MINUTES } from "./limits";
import { CONTACT_EMAIL, WHATSAPP_PHONE } from "@/constants";

export type BookingMethod =
  // Self-serve: create_booking_checkout/check_availability accept this eventType directly.
  | { method: "checkout"; path: string }
  // No online booking exists — the agent should hand the user off to a human
  | { method: "contact"; whatsapp: string; email: string };

export type Experience = {
  eventType: EventType | "teambuilding";
  name: string;
  description: string;
  fromPriceCents: number;
  currency: "EUR";
  durationMinutes: number;
  guestMin: number;
  guestMax: number;
  booking: BookingMethod;
};

const BOOKING_PATH: Record<EventType, string> = {
  couples: "book/couples",
  family: "book/family",
  friends: "book/friends",
  individual: "book/individual",
};

// "book" holds the generic booking-flow copy shared across event types that
// have no dedicated marketing page (individual), plus the bare event-type names.
function getName(eventType: EventType, lang: Language): string {
  const book = getPageTranslations(lang, "book");
  switch (eventType) {
    case EVENT_TYPE.COUPLES:
      return book.event_type_couples;
    case EVENT_TYPE.FAMILY:
      return book.event_type_family;
    case EVENT_TYPE.FRIENDS:
      return book.event_type_friends;
    case EVENT_TYPE.INDIVIDUAL:
      return book.individual_session;
  }
}

function getDescription(eventType: EventType, lang: Language): string {
  switch (eventType) {
    case EVENT_TYPE.COUPLES:
      return getPageTranslations(lang, "couples").meta_description;
    case EVENT_TYPE.FAMILY:
      return getPageTranslations(lang, "family").meta_description;
    case EVENT_TYPE.FRIENDS:
      return getPageTranslations(lang, "friends").meta_description;
    case EVENT_TYPE.INDIVIDUAL:
      return getPageTranslations(lang, "book").event_type_individual_desc;
  }
}

export function getBookingPath(eventType: EventType): string {
  return BOOKING_PATH[eventType];
}

export function getGuestBounds(eventType: EventType): { min: number; max: number } {
  return GUEST_BOUNDS[eventType];
}

function buildExperience(eventType: EventType, lang: Language): Experience {
  const bounds = GUEST_BOUNDS[eventType];
  return {
    eventType,
    name: getName(eventType, lang),
    description: getDescription(eventType, lang),
    fromPriceCents: getFromPriceCents(eventType),
    currency: "EUR",
    durationMinutes: DURATION_MINUTES[eventType],
    guestMin: bounds.min,
    guestMax: bounds.max,
    booking: { method: "checkout", path: BOOKING_PATH[eventType] },
  };
}

// Corporate/team building has no Calendly event type or Stripe checkout — it's
// negotiated by hand (group size, format, invoicing) over WhatsApp/email, per
// corporate.faq_q_corp_book. Not part of EVENT_TYPE, so it can never reach
// check_availability/create_booking_checkout (their eventType schema rejects it).
function buildTeambuildingExperience(lang: Language): Experience {
  const corporate = getPageTranslations(lang, "corporate");
  const location = getLocationInfo(lang);

  return {
    eventType: "teambuilding",
    name: corporate.activity_teambuilding_title,
    description: corporate.meta_description,
    // "From 40€ per person + VAT" (corporate.meta_description/pricing_intro) — a
    // negotiated, human-quoted price, not a Stripe-charged amount like the rest.
    fromPriceCents: 4000,
    currency: "EUR",
    // Splash/Pouring (4–6 people) runs 1.5h; Team Building Special (6–10) runs
    // 2–2.5h — using the shorter end since timing is settled over contact anyway.
    durationMinutes: 90,
    guestMin: 4,
    guestMax: 10,
    booking: {
      method: "contact",
      whatsapp: location.whatsapp ?? WHATSAPP_PHONE,
      email: CONTACT_EMAIL,
    },
  };
}

function buildExperiencesForLang(lang: Language): Record<Experience["eventType"], Experience> {
  const byEventType = {} as Record<Experience["eventType"], Experience>;
  for (const eventType of Object.values(EVENT_TYPE)) {
    byEventType[eventType] = buildExperience(eventType, lang);
  }
  byEventType.teambuilding = buildTeambuildingExperience(lang);
  return byEventType;
}

// Deterministic — locale strings + pure pricing functions, no I/O — so the
// full table is built once at module load instead of per-request.
const EXPERIENCES = Object.fromEntries(
  languages.map((lang) => [lang, buildExperiencesForLang(lang)]),
) as Record<Language, Record<Experience["eventType"], Experience>>;

export function getExperience(eventType: EventType, lang: Language): Experience {
  return EXPERIENCES[lang][eventType];
}

export function getExperiences(lang: Language): Experience[] {
  return Object.values(EXPERIENCES[lang]);
}
