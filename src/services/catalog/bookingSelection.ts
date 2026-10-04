import * as z from "zod";

import { EVENT_TYPE } from "@/components/booking/types";
import type { ActivityFormat } from "@/components/booking/eventTypeOptions/ActivityFormatSelector";
import { getPageTranslations, type Language } from "@/utils/i18n";

import {
  COUPLES_PICTURES,
  COUPLES_PRICE,
  formatCouplesProductName,
} from "./couplesPricing";
import {
  calculateFamilyPrice,
  clampFamilyCanvases,
  formatFamilyProductName,
} from "./familyPricing";
import {
  calculateFriendsPrice,
  clampFriendsCanvases,
  formatFriendsProductName,
} from "./friendsPricing";
import { INDIVIDUAL_PRICE } from "./individualPricing";
import { GUEST_BOUNDS } from "./limits";
import {
  formatOpenSessionProductName,
  isValidOpenSessionCart,
  openSessionAmountCents,
  openSessionCanvases,
  openSessionPeople,
} from "./openSessionPricing";

/**
 * What the customer picked in the booking widget (or the MCP agent asked
 * for). This is the only booking input the server accepts: the price and
 * the product name are always derived from it here, never taken from the
 * client.
 */

const ActivityFormatSchema = z.enum([
  "splash",
  "pouring",
] satisfies ActivityFormat[]);
const CanvasTypeSchema = z.enum(["standard", "big"]);
const Count = z.number().int();

export const BookingSelectionSchema = z.discriminatedUnion("eventType", [
  z.object({
    eventType: z.literal(EVENT_TYPE.COUPLES),
    picture: z.enum(COUPLES_PICTURES),
    activityFormat: ActivityFormatSchema,
  }),
  z.object({
    eventType: z.literal(EVENT_TYPE.FAMILY),
    adults: Count.min(1),
    kids: Count.min(0),
    canvases: Count.min(1),
    canvasType: CanvasTypeSchema,
    activityFormat: ActivityFormatSchema,
  }),
  z.object({
    eventType: z.literal(EVENT_TYPE.FRIENDS),
    guests: Count.min(1),
    canvases: Count.min(1),
    canvasType: CanvasTypeSchema,
    activityFormat: ActivityFormatSchema,
  }),
  z.object({
    eventType: z.literal(EVENT_TYPE.INDIVIDUAL),
  }),
  z.object({
    eventType: z.literal(EVENT_TYPE.OPEN_SESSION),
    openCart: z.object({
      solo: Count.min(0),
      pair_shared: Count.min(0),
      pair_two: Count.min(0),
    }),
  }),
]);

export type BookingSelection = z.infer<typeof BookingSelectionSchema>;

export type PricedSelection = {
  /** List price before any time-slot discount, in cents. */
  amountCents: number;
  guests: number;
  /** Only set for open sessions, where the calendar shows it. */
  canvases?: number;
  /** Options fragment of the product name, e.g. "2 guests, 2 canvases, splash". */
  eventOptions: string;
};

export type PriceSelectionResult =
  | ({ ok: true } & PricedSelection)
  | { ok: false; error: string };

function guestsOutOfBounds(
  eventType: BookingSelection["eventType"],
  guests: number,
): string | null {
  const { min, max } = GUEST_BOUNDS[eventType];
  return guests < min || guests > max
    ? `${eventType} bookings take ${min}–${max} guests, got ${guests}`
    : null;
}

/**
 * Price and describe a selection. Canvas counts are clamped to what the
 * guest count allows (the same clamp the price uses), so the product name
 * always describes what is charged. Guest counts outside the event type's
 * bounds are rejected rather than clamped: they'd book more people than paid.
 */
export function priceSelection(
  selection: BookingSelection,
  lang: Language,
): PriceSelectionResult {
  switch (selection.eventType) {
    case EVENT_TYPE.COUPLES:
      return {
        ok: true,
        amountCents: COUPLES_PRICE[selection.picture],
        guests: 2,
        eventOptions: formatCouplesProductName(
          selection.picture,
          selection.activityFormat,
          lang,
        ),
      };

    case EVENT_TYPE.FAMILY: {
      const { adults, kids, canvasType, activityFormat } = selection;
      const guests = adults + kids;
      const error = guestsOutOfBounds(selection.eventType, guests);
      if (error) return { ok: false, error };
      const canvases = clampFamilyCanvases(
        selection.canvases,
        guests,
        canvasType,
      );
      return {
        ok: true,
        amountCents: calculateFamilyPrice(canvases, guests, canvasType),
        guests,
        eventOptions: formatFamilyProductName(
          adults,
          kids,
          canvases,
          canvasType,
          activityFormat,
        ),
      };
    }

    case EVENT_TYPE.FRIENDS: {
      const { guests, canvasType, activityFormat } = selection;
      const error = guestsOutOfBounds(selection.eventType, guests);
      if (error) return { ok: false, error };
      const canvases = clampFriendsCanvases(
        selection.canvases,
        guests,
        canvasType,
      );
      return {
        ok: true,
        amountCents: calculateFriendsPrice(canvases, guests, canvasType),
        guests,
        eventOptions: formatFriendsProductName(
          guests,
          canvases,
          canvasType,
          activityFormat,
        ),
      };
    }

    case EVENT_TYPE.INDIVIDUAL:
      return {
        ok: true,
        amountCents: INDIVIDUAL_PRICE,
        guests: 1,
        eventOptions: getPageTranslations(lang, "book").individual_session,
      };

    case EVENT_TYPE.OPEN_SESSION: {
      const cart = selection.openCart;
      if (!isValidOpenSessionCart(cart)) {
        return { ok: false, error: "open session cart is invalid" };
      }
      return {
        ok: true,
        amountCents: openSessionAmountCents(cart),
        guests: openSessionPeople(cart),
        canvases: openSessionCanvases(cart),
        eventOptions: formatOpenSessionProductName(cart, lang),
      };
    }
  }
}
