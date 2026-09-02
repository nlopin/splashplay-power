import { describe, it, expect } from "vitest";
import { COUPLES_PRICE } from "./couplesPricing";

describe("COUPLES_PRICE", () => {
  it("1 standard canvas → €75", () => expect(COUPLES_PRICE.one_small).toBe(7500));
  it("1 big canvas → €90", () => expect(COUPLES_PRICE.one_big).toBe(9000));
  it("2 big canvases → €124", () => expect(COUPLES_PRICE.two_big).toBe(12400));
  it("2 standard canvases → €90", () =>
    expect(COUPLES_PRICE.individual).toBe(9000));
});
