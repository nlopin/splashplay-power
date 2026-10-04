import { EVENT_TYPE, type EventType } from "@/components/booking/types";
import { formatVisitDateTime } from "@/utils/formatters";
import { getPageTranslations, type Language } from "@/utils/i18n";

export function getProductTitle(eventType: EventType, lang: Language): string {
  const book = getPageTranslations(lang, "book");
  switch (eventType) {
    case EVENT_TYPE.COUPLES:
      return book.creative_date;
    case EVENT_TYPE.FAMILY:
      return book.family_session;
    case EVENT_TYPE.FRIENDS:
      return book.friends_session;
    case EVENT_TYPE.INDIVIDUAL:
      return book.individual_session;
    case EVENT_TYPE.OPEN_SESSION:
      return book.open_session;
  }
}

export function getThemedProductTitle(
  themeSlug: string,
  lang: Language,
): string | undefined {
  const book = getPageTranslations(lang, "book");
  const key = `theme_${themeSlug}` as keyof typeof book;
  const title = book[key];
  return typeof title === "string" ? title : undefined;
}

export function getBookingTitle(
  eventType: EventType,
  lang: Language,
  themeSlug?: string,
): string {
  if (themeSlug) {
    return getThemedProductTitle(themeSlug, lang) ?? getProductTitle(eventType, lang);
  }
  return getProductTitle(eventType, lang);
}

// e.g. "Sesión de amigos, 02/09/2026, 14:00 (2 guests, 2 canvases, splash)".
export function formatBookingProductName(
  titleTranslation: string,
  bookingDate: string,
  eventOptions: string,
  locale?: string,
): string {
  const formattedDate = formatVisitDateTime(bookingDate, "short", locale);
  return `${titleTranslation}, ${formattedDate} (${eventOptions})`;
}
