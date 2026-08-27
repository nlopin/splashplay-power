import { describe, it, expect } from "vitest";
import { calculateFriendsPrice } from "./friendsPricing";

describe("calculateFriendsPrice — big canvas", () => {
  it("1 guest → €85", () =>
    expect(calculateFriendsPrice(1, 1, "big")).toBe(8500));
  it("2 guests → €90", () =>
    expect(calculateFriendsPrice(1, 2, "big")).toBe(9000));
  it("3 guests → €96", () =>
    expect(calculateFriendsPrice(1, 3, "big")).toBe(9600));
  it("4 guests → €108", () =>
    expect(calculateFriendsPrice(1, 4, "big")).toBe(10800));
  it("5 guests → €120", () =>
    expect(calculateFriendsPrice(1, 5, "big")).toBe(12000));
  it("6 guests → €132", () =>
    expect(calculateFriendsPrice(1, 6, "big")).toBe(13200));
});

describe("calculateFriendsPrice — standard canvas", () => {
  // 1 guest
  it("1 guest, 1 canvas → €65", () =>
    expect(calculateFriendsPrice(1, 1, "standard")).toBe(6500));

  // 2 guests
  it("2 guests, 1 canvas → €75", () =>
    expect(calculateFriendsPrice(1, 2, "standard")).toBe(7500));
  it("2 guests, 2 canvases → €90", () =>
    expect(calculateFriendsPrice(2, 2, "standard")).toBe(9000));

  // 3 guests
  it("3 guests, 1 canvas → €80", () =>
    expect(calculateFriendsPrice(1, 3, "standard")).toBe(8000));
  it("3 guests, 2 canvases → €95", () =>
    expect(calculateFriendsPrice(2, 3, "standard")).toBe(9500));
  it("3 guests, 3 canvases → €126", () =>
    expect(calculateFriendsPrice(3, 3, "standard")).toBe(12600));

  // 4 guests
  it("4 guests, 2 canvases → €105", () =>
    expect(calculateFriendsPrice(2, 4, "standard")).toBe(10500));
  it("4 guests, 3 canvases → €132", () =>
    expect(calculateFriendsPrice(3, 4, "standard")).toBe(13200));
  it("4 guests, 4 canvases → €148", () =>
    expect(calculateFriendsPrice(4, 4, "standard")).toBe(14800));

  // 5 guests
  it("5 guests, 3 canvases → €140", () =>
    expect(calculateFriendsPrice(3, 5, "standard")).toBe(14000));
  it("5 guests, 4 canvases → €155", () =>
    expect(calculateFriendsPrice(4, 5, "standard")).toBe(15500));
  it("5 guests, 5 canvases → €175", () =>
    expect(calculateFriendsPrice(5, 5, "standard")).toBe(17500));

  // 6 guests
  it("6 guests, 3 canvases → €145", () =>
    expect(calculateFriendsPrice(3, 6, "standard")).toBe(14500));
  it("6 guests, 4 canvases → €160", () =>
    expect(calculateFriendsPrice(4, 6, "standard")).toBe(16000));
  it("6 guests, 5 canvases → €180", () =>
    expect(calculateFriendsPrice(5, 6, "standard")).toBe(18000));
  it("6 guests, 6 canvases → €195", () =>
    expect(calculateFriendsPrice(6, 6, "standard")).toBe(19500));
});
