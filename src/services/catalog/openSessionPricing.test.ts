import { describe, it, expect } from "vitest";
import {
  cartFromTicketAndGuests,
  clampOpenSessionCart,
  emptyOpenSessionCart,
  isValidOpenSessionCart,
  isValidOpenSessionPurchase,
  maxOpenSessionQuantity,
  OPEN_SESSION_CAPACITY,
  OPEN_SESSION_GUESTS,
  OPEN_SESSION_PRICE,
  openSessionAmountCents,
  openSessionPeople,
} from "./openSessionPricing";

describe("open session tickets", () => {
  it("solo is 32€ for 1 person", () => {
    expect(OPEN_SESSION_PRICE.solo).toBe(3200);
    expect(OPEN_SESSION_GUESTS.solo).toBe(1);
  });

  it("shared couple canvas is 47€ for 2 people", () => {
    expect(OPEN_SESSION_PRICE.pair_shared).toBe(4700);
    expect(OPEN_SESSION_GUESTS.pair_shared).toBe(2);
  });

  it("two canvases is 62€ for 2 people", () => {
    expect(OPEN_SESSION_PRICE.pair_two).toBe(6200);
    expect(OPEN_SESSION_GUESTS.pair_two).toBe(2);
  });

  it("session holds 6 people", () => {
    expect(OPEN_SESSION_CAPACITY).toBe(6);
  });

  it("caps a purchase at session capacity: 6 solo or 3 couple tickets", () => {
    expect(maxOpenSessionQuantity("solo")).toBe(6);
    expect(maxOpenSessionQuantity("pair_shared")).toBe(3);
    expect(maxOpenSessionQuantity("pair_two")).toBe(3);
  });

  it("also caps quantity by remaining spots", () => {
    expect(maxOpenSessionQuantity("solo", { spotsLeft: 3 })).toBe(3);
    expect(maxOpenSessionQuantity("pair_two", { spotsLeft: 3 })).toBe(1);
    expect(maxOpenSessionQuantity("pair_two", { spotsLeft: 1 })).toBe(0);
  });

  it("accepts up to 6 solo people or 3 couple tickets, not odd couple guest counts", () => {
    expect(isValidOpenSessionPurchase("solo", 6)).toBe(true);
    expect(isValidOpenSessionPurchase("pair_two", 6)).toBe(true);
    expect(isValidOpenSessionPurchase("pair_two", 2)).toBe(true);
    expect(isValidOpenSessionPurchase("pair_two", 3)).toBe(false);
    expect(isValidOpenSessionPurchase("solo", 7)).toBe(false);
  });

  it("allows mixing a couple ticket with 1 or 2 solo tickets", () => {
    const oneCoupleTwoSolo = {
      solo: 2,
      pair_shared: 0,
      pair_two: 1,
    };
    expect(openSessionPeople(oneCoupleTwoSolo)).toBe(4);
    expect(openSessionAmountCents(oneCoupleTwoSolo)).toBe(6200 + 6400);
    expect(isValidOpenSessionCart(oneCoupleTwoSolo)).toBe(true);
    expect(
      maxOpenSessionQuantity("solo", { cart: { ...oneCoupleTwoSolo, solo: 0 } }),
    ).toBe(4);

    const oneCoupleOneSolo = {
      solo: 1,
      pair_shared: 0,
      pair_two: 1,
    };
    expect(isValidOpenSessionCart(oneCoupleOneSolo)).toBe(true);

    const tooMany = { solo: 5, pair_shared: 0, pair_two: 1 };
    expect(isValidOpenSessionCart(tooMany)).toBe(false);
  });

  it("allows mixing the two couple formats", () => {
    const mixedCouples = { solo: 0, pair_shared: 1, pair_two: 1 };
    expect(openSessionPeople(mixedCouples)).toBe(4);
    expect(isValidOpenSessionCart(mixedCouples)).toBe(true);
  });

  it("rejects an empty cart", () => {
    expect(isValidOpenSessionCart(emptyOpenSessionCart())).toBe(false);
  });

  it("clamps a cart down to fewer remaining spots, not the 6-person capacity", () => {
    const wantsFour = { solo: 4, pair_shared: 0, pair_two: 0 };
    expect(clampOpenSessionCart(wantsFour, 6)).toEqual(wantsFour);
    expect(clampOpenSessionCart(wantsFour, 2)).toEqual({
      solo: 2,
      pair_shared: 0,
      pair_two: 0,
    });
    expect(clampOpenSessionCart(wantsFour, 0)).toEqual(emptyOpenSessionCart());

    const wantsTwoCouples = { solo: 0, pair_shared: 0, pair_two: 2 };
    expect(clampOpenSessionCart(wantsTwoCouples, 3)).toEqual({
      solo: 0,
      pair_shared: 0,
      pair_two: 1,
    });
  });

  it("rejects a purchase that exceeds spots left, even under session capacity", () => {
    expect(maxOpenSessionQuantity("solo", { spotsLeft: 2 })).toBe(2);
    expect(maxOpenSessionQuantity("pair_two", { spotsLeft: 3 })).toBe(1);
    expect(
      maxOpenSessionQuantity("solo", {
        cart: { solo: 0, pair_shared: 0, pair_two: 1 },
        spotsLeft: 3,
      }),
    ).toBe(1);
  });

  it("builds a single-ticket cart from guests", () => {
    expect(cartFromTicketAndGuests("pair_two", 4)).toEqual({
      solo: 0,
      pair_shared: 0,
      pair_two: 2,
    });
  });
});
