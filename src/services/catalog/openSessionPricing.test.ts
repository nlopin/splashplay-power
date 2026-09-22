import { describe, it, expect } from "vitest";
import {
  cartFromTicketAndGuests,
  emptyOpenSessionCart,
  isValidOpenSessionCart,
  isValidOpenSessionPurchase,
  maxOpenSessionQuantity,
  OPEN_SESSION_CAPACITY,
  OPEN_SESSION_GUESTS,
  OPEN_SESSION_MAX_PEOPLE_PER_PURCHASE,
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

  it("caps a purchase at 4 people: 4 solo or 2 couple tickets", () => {
    expect(OPEN_SESSION_MAX_PEOPLE_PER_PURCHASE).toBe(4);
    expect(maxOpenSessionQuantity("solo")).toBe(4);
    expect(maxOpenSessionQuantity("pair_shared")).toBe(2);
    expect(maxOpenSessionQuantity("pair_two")).toBe(2);
  });

  it("also caps quantity by remaining spots", () => {
    expect(maxOpenSessionQuantity("solo", { spotsLeft: 3 })).toBe(3);
    expect(maxOpenSessionQuantity("pair_two", { spotsLeft: 3 })).toBe(1);
    expect(maxOpenSessionQuantity("pair_two", { spotsLeft: 1 })).toBe(0);
  });

  it("accepts 4 solo people or 2 couple tickets, not 3 couple people", () => {
    expect(isValidOpenSessionPurchase("solo", 4)).toBe(true);
    expect(isValidOpenSessionPurchase("pair_two", 4)).toBe(true);
    expect(isValidOpenSessionPurchase("pair_two", 2)).toBe(true);
    expect(isValidOpenSessionPurchase("pair_two", 3)).toBe(false);
    expect(isValidOpenSessionPurchase("solo", 5)).toBe(false);
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
    ).toBe(2);

    const oneCoupleOneSolo = {
      solo: 1,
      pair_shared: 0,
      pair_two: 1,
    };
    expect(isValidOpenSessionCart(oneCoupleOneSolo)).toBe(true);

    const tooMany = { solo: 3, pair_shared: 0, pair_two: 1 };
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

  it("builds a single-ticket cart from guests", () => {
    expect(cartFromTicketAndGuests("pair_two", 4)).toEqual({
      solo: 0,
      pair_shared: 0,
      pair_two: 2,
    });
  });
});
