import { describe, it, expect } from "vitest";
import { calculateFriendsPrice } from "./FriendsOptions";

describe("calculateFriendsPrice", () => {
  it("returns correct price for 1 guests", () => {
    expect(calculateFriendsPrice(1)).toBe(6000);
  });

  it("returns correct price for 2 guests", () => {
    expect(calculateFriendsPrice(2)).toBe(9000);
  });

  it("returns correct price for 3 guests", () => {
    expect(calculateFriendsPrice(3)).toBe(12000);
  });

  it("returns correct price for 4 guests", () => {
    expect(calculateFriendsPrice(4)).toBe(14000);
  });

  it("returns correct price for 5 guests", () => {
    expect(calculateFriendsPrice(5)).toBe(16000);
  });

  it("returns correct price for 6 guests", () => {
    expect(calculateFriendsPrice(6)).toBe(18000);
  });

  it("less than 1 guests defaults to 1 guest price", () => {
    expect(calculateFriendsPrice(1)).toBe(6000);
    expect(calculateFriendsPrice(0)).toBe(6000);
    expect(calculateFriendsPrice(-1)).toBe(6000);
  });

  it("more than 6 guests defaults to 6 guest price", () => {
    expect(calculateFriendsPrice(7)).toBe(18000);
    expect(calculateFriendsPrice(10)).toBe(18000);
    expect(calculateFriendsPrice(100)).toBe(18000);
  });
});
