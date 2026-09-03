import { EVENT_TYPE, type EventType } from "@/components/booking/types";
import { COUPLES_PRICE, type CouplesPicture } from "./couplesPricing";
import { INDIVIDUAL_PRICE } from "./individualPricing";
import { calculateFamilyPrice } from "./familyPricing";
import { calculateFriendsPrice } from "./friendsPricing";

export type CanvasType = "standard" | "big";
export type { CouplesPicture };

export type BookingPricingOptions = {
  guests: number;
  canvases?: number;
  canvasType?: CanvasType;
  picture?: CouplesPicture;
};

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
  }
}

// Real charge amount for a specific booking configuration — never trust a
// client/agent-supplied price, always compute it here.
export function getPriceCents(
  eventType: EventType,
  options: BookingPricingOptions,
): number {
  const {
    guests,
    canvasType = "standard",
    picture = "one_small",
  } = options;
  // Big canvas defaults to one shared canvas; do not fall back to guest count
  // or a 4-person booking would be charged as two big canvases.
  const canvases = options.canvases ?? (canvasType === "big" ? 1 : guests);

  switch (eventType) {
    case EVENT_TYPE.COUPLES:
      return COUPLES_PRICE[picture];
    case EVENT_TYPE.FAMILY:
      return calculateFamilyPrice(canvases, guests, canvasType);
    case EVENT_TYPE.FRIENDS:
      return calculateFriendsPrice(canvases, guests, canvasType);
    case EVENT_TYPE.INDIVIDUAL:
      return INDIVIDUAL_PRICE;
  }
}
