import { describe, expect, it } from "vitest";
import { getPageTranslations } from "@/utils/i18n";
import {
  BookingSelectionSchema,
  priceSelection,
  type BookingSelection,
} from "./bookingSelection";
import { COUPLES_PRICE } from "./couplesPricing";
import { calculateFamilyPrice } from "./familyPricing";
import { calculateFriendsPrice } from "./friendsPricing";
import { INDIVIDUAL_PRICE } from "./individualPricing";

function priced(selection: BookingSelection) {
  const result = priceSelection(selection, "en");
  if (!result.ok) throw new Error(result.error);
  return result;
}

describe("priceSelection", () => {
  it("prices couples from the catalog by picture", () => {
    const result = priced({
      eventType: "couples",
      picture: "two_big",
      activityFormat: "splash",
    });
    expect(result.amountCents).toBe(COUPLES_PRICE.two_big);
    expect(result.guests).toBe(2);
    expect(result.eventOptions).toContain(
      getPageTranslations("en", "book").couples_two_big,
    );
  });

  it("prices family by total guests and canvases", () => {
    const result = priced({
      eventType: "family",
      adults: 2,
      kids: 1,
      canvases: 3,
      canvasType: "standard",
      activityFormat: "splash",
    });
    expect(result.amountCents).toBe(calculateFamilyPrice(3, 3, "standard"));
    expect(result.guests).toBe(3);
    expect(result.eventOptions).toBe("2 adults, 1 kid, 3 canvases, splash");
  });

  it("clamps canvases so the name matches the charged amount", () => {
    const result = priced({
      eventType: "friends",
      guests: 2,
      canvases: 5,
      canvasType: "standard",
      activityFormat: "pouring",
    });
    expect(result.amountCents).toBe(calculateFriendsPrice(2, 2, "standard"));
    expect(result.eventOptions).toBe("2 guests, 2 canvases, pouring");
  });

  it("rejects guest counts outside the event type's bounds", () => {
    expect(
      priceSelection(
        {
          eventType: "friends",
          guests: 50,
          canvases: 6,
          canvasType: "standard",
          activityFormat: "splash",
        },
        "en",
      ).ok,
    ).toBe(false);
    expect(
      priceSelection(
        {
          eventType: "family",
          adults: 5,
          kids: 3,
          canvases: 6,
          canvasType: "standard",
          activityFormat: "splash",
        },
        "en",
      ).ok,
    ).toBe(false);
  });

  it("prices an individual session at the fixed price", () => {
    const result = priced({ eventType: "individual" });
    expect(result.amountCents).toBe(INDIVIDUAL_PRICE);
    expect(result.guests).toBe(1);
  });

  it("prices an open-session cart and counts people and canvases", () => {
    const result = priced({
      eventType: "open_session",
      openCart: { solo: 1, pair_shared: 0, pair_two: 1 },
    });
    expect(result.amountCents).toBe(3200 + 6200);
    expect(result.guests).toBe(3);
    expect(result.canvases).toBe(3);
  });

  it("rejects an open-session cart over capacity", () => {
    const result = priceSelection(
      {
        eventType: "open_session",
        openCart: { solo: 7, pair_shared: 0, pair_two: 0 },
      },
      "en",
    );
    expect(result.ok).toBe(false);
  });
});

describe("BookingSelectionSchema", () => {
  it("has no way to pass a price", () => {
    const parsed = BookingSelectionSchema.parse({
      eventType: "couples",
      picture: "one_small",
      activityFormat: "splash",
      amount: 50,
    });
    expect(parsed).not.toHaveProperty("amount");
  });

  it("rejects unknown pictures and fractional counts", () => {
    expect(
      BookingSelectionSchema.safeParse({
        eventType: "couples",
        picture: "free",
        activityFormat: "splash",
      }).success,
    ).toBe(false);
    expect(
      BookingSelectionSchema.safeParse({
        eventType: "friends",
        guests: 2.5,
        canvases: 2,
        canvasType: "standard",
        activityFormat: "splash",
      }).success,
    ).toBe(false);
  });
});
