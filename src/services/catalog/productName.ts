import { EVENT_TYPE, type EventType } from "@/components/booking/types";
import { formatVisitDateTime } from "@/utils/formatters";
import { getPageTranslations, type Language } from "@/utils/i18n";

// BookingForm.tsx indexes its loosely-typed `translations` prop with this;
// getProductTitle below is the typed equivalent (indexing getPageTranslations()
// with a computed key needs a cast, so it's a switch there instead).
export const ProductNameKeyByEventType: Record<EventType, string> = {
  couples: "creative_date",
  family: "family_session",
  friends: "friends_session",
  individual: "individual_session",
};

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
  }
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
