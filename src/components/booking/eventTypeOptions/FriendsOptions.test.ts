import { describe, it, expect } from "vitest";
import { calculateFriendsPrice } from "./FriendsOptions";

describe("calculateFriendsPrice — big canvas", () => {
  it("1 guest → €80", () => expect(calculateFriendsPrice(1, 1, "big")).toBe(8000));
  it("2 guests → €90", () => expect(calculateFriendsPrice(1, 2, "big")).toBe(9000));
  it("3 guests → €95", () => expect(calculateFriendsPrice(1, 3, "big")).toBe(9500));
  it("4 guests → €105", () => expect(calculateFriendsPrice(1, 4, "big")).toBe(10500));
  it("5 guests → €115", () => expect(calculateFriendsPrice(1, 5, "big")).toBe(11500));
  it("6 guests → €125", () => expect(calculateFriendsPrice(1, 6, "big")).toBe(12500));
});

describe("calculateFriendsPrice — standard canvas", () => {
  // 1 guest
  it("1 guest, 1 canvas → €60", () => expect(calculateFriendsPrice(1, 1, "standard")).toBe(6000));

  // 2 guests
  it("2 guests, 1 canvas → €75", () => expect(calculateFriendsPrice(1, 2, "standard")).toBe(7500));
  it("2 guests, 2 canvases → €90", () => expect(calculateFriendsPrice(2, 2, "standard")).toBe(9000));

  // 3 guests
  it("3 guests, 1 canvas → €80", () => expect(calculateFriendsPrice(1, 3, "standard")).toBe(8000));
  it("3 guests, 2 canvases → €95", () => expect(calculateFriendsPrice(2, 3, "standard")).toBe(9500));
  it("3 guests, 3 canvases → €120", () => expect(calculateFriendsPrice(3, 3, "standard")).toBe(12000));

  // 4 guests
  it("4 guests, 2 canvases → €105", () => expect(calculateFriendsPrice(2, 4, "standard")).toBe(10500));
  it("4 guests, 3 canvases → €128", () => expect(calculateFriendsPrice(3, 4, "standard")).toBe(12800));
  it("4 guests, 4 canvases → €140", () => expect(calculateFriendsPrice(4, 4, "standard")).toBe(14000));

  // 5 guests
  it("5 guests, 3 canvases → €135", () => expect(calculateFriendsPrice(3, 5, "standard")).toBe(13500));
  it("5 guests, 4 canvases → €149", () => expect(calculateFriendsPrice(4, 5, "standard")).toBe(14900));
  it("5 guests, 5 canvases → €160", () => expect(calculateFriendsPrice(5, 5, "standard")).toBe(16000));

  // 6 guests
  it("6 guests, 3 canvases → €145", () => expect(calculateFriendsPrice(3, 6, "standard")).toBe(14500));
  it("6 guests, 4 canvases → €155", () => expect(calculateFriendsPrice(4, 6, "standard")).toBe(15500));
  it("6 guests, 5 canvases → €165", () => expect(calculateFriendsPrice(5, 6, "standard")).toBe(16500));
  it("6 guests, 6 canvases → €180", () => expect(calculateFriendsPrice(6, 6, "standard")).toBe(18000));
});
