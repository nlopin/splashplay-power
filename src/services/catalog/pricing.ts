import { EVENT_TYPE, type EventType } from "@/components/booking/types";
import { COUPLES_PRICE, type CouplesPicture } from "./couplesPricing";
import { INDIVIDUAL_PRICE } from "./individualPricing";
import { calculateFamilyPrice } from "./familyPricing";
import { calculateFriendsPrice } from "./friendsPricing";
import { OPEN_SESSION_PRICE } from "./openSessionPricing";

export type CanvasType = "standard" | "big";
export type { CouplesPicture };

// Cheapest amount Stripe would ever charge for this event type — the
// "from X€" figure for the catalog.
export function getFromPriceCents(eventType: EventType): number {
  switch (eventType) {
    case EVENT_TYPE.COUPLES:
      return Math.min(...Object.values(COUPLES_PRICE));
    case EVENT_TYPE.FAMILY:
      return calculateFamilyPrice(1, 1, "standard");
    case EVENT_TYPE.FRIENDS:
      return calculateFriendsPrice(1, 1, "standard");
    case EVENT_TYPE.INDIVIDUAL:
      return INDIVIDUAL_PRICE;
    case EVENT_TYPE.OPEN_SESSION:
      return OPEN_SESSION_PRICE.solo;
  }
}

/** Price after a time-slot discount (percent), rounded to whole cents. */
export function applySlotDiscount(
  amountCents: number,
  discountPercent: number | undefined,
): number {
  return discountPercent
    ? Math.round(amountCents * (1 - discountPercent / 100))
    : amountCents;
}
