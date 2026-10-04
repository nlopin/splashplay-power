import { getAvailability } from "@/services/availability";
import type { AvailableTime } from "@/services/availability/types";
import {
  priceSelection,
  type BookingSelection,
} from "@/services/catalog/bookingSelection";
import { applySlotDiscount } from "@/services/catalog/pricing";
import {
  formatBookingProductName,
  getBookingTitle,
} from "@/services/catalog/productName";
import type { ISODatetime } from "@/types";
import type { Language } from "@/utils/i18n";

export type BookingQuote = {
  /** What Stripe will charge (before promo codes), in cents. */
  amountCents: number;
  /** List price before the time-slot discount, in cents. */
  listAmountCents: number;
  discountPercent: number | undefined;
  guests: number;
  canvases: number | undefined;
  productName: string;
  /** The slot's start time exactly as Calendly lists it. */
  datetime: ISODatetime;
};

export type QuoteResult =
  | { ok: true; quote: BookingQuote }
  | {
      ok: false;
      reason: "invalid_selection" | "slot_unavailable";
      error: string;
    };

/**
 * The single place a booking's price is decided, shared by the on-site
 * checkout and the MCP checkout tool. Nothing price-related is taken from
 * the caller: the amount comes from the catalog, the discount from our own
 * availability for that slot. Rejects slots that aren't open for booking.
 */
export async function quoteBooking({
  selection,
  datetime,
  lang,
}: {
  selection: BookingSelection;
  datetime: ISODatetime;
  lang: Language;
}): Promise<QuoteResult> {
  const priced = priceSelection(selection, lang);
  if (!priced.ok) {
    return { ok: false, reason: "invalid_selection", error: priced.error };
  }

  const slot = findSlot(await getAvailability(selection.eventType), datetime);
  if (!slot || slot.booked) {
    return {
      ok: false,
      reason: "slot_unavailable",
      error: `No bookable ${selection.eventType} slot at ${datetime}`,
    };
  }

  return {
    ok: true,
    quote: {
      amountCents: applySlotDiscount(priced.amountCents, slot.discount),
      listAmountCents: priced.amountCents,
      discountPercent: slot.discount,
      guests: priced.guests,
      canvases: priced.canvases,
      productName: formatBookingProductName(
        getBookingTitle(selection.eventType, lang, slot.themeSlug),
        slot.time,
        priced.eventOptions,
        lang,
      ),
      datetime: slot.time,
    },
  };
}

function findSlot(
  slots: AvailableTime[],
  datetime: ISODatetime,
): AvailableTime | undefined {
  const requested = Date.parse(datetime);
  if (Number.isNaN(requested)) return undefined;
  return slots.find((slot) => Date.parse(slot.time) === requested);
}
