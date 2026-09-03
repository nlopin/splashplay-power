import { describe, it, expect } from "vitest";
import { calculateFamilyPrice } from "./familyPricing";

describe("calculateFamilyPrice — one big canvas", () => {
  it("2 people → €90", () =>
    expect(calculateFamilyPrice(1, 2, "big")).toBe(9000));
  it("3 people → €96", () =>
    expect(calculateFamilyPrice(1, 3, "big")).toBe(9600));
  it("4 people → €108", () =>
    expect(calculateFamilyPrice(1, 4, "big")).toBe(10800));
  it("5 people → €120", () =>
    expect(calculateFamilyPrice(1, 5, "big")).toBe(12000));
  it("6 people → €132", () =>
    expect(calculateFamilyPrice(1, 6, "big")).toBe(13200));
});

describe("calculateFamilyPrice — two big canvases", () => {
  it("1 person, 2 canvases clamps to one → €90", () =>
    expect(calculateFamilyPrice(2, 1, "big")).toBe(9000));
  it("2 people → €124", () =>
    expect(calculateFamilyPrice(2, 2, "big")).toBe(12400));
  it("3 people → €135", () =>
    expect(calculateFamilyPrice(2, 3, "big")).toBe(13500));
  it("4 people → €144", () =>
    expect(calculateFamilyPrice(2, 4, "big")).toBe(14400));
  it("5 people → €155", () =>
    expect(calculateFamilyPrice(2, 5, "big")).toBe(15500));
  it("6 people → €168", () =>
    expect(calculateFamilyPrice(2, 6, "big")).toBe(16800));
  it("3 people, 3 canvases clamps to two → €135", () =>
    expect(calculateFamilyPrice(3, 3, "big")).toBe(13500));
});

describe("calculateFamilyPrice — standard canvas, 1 person", () => {
  it("1 person, 1 canvas → €60", () =>
    expect(calculateFamilyPrice(1, 1)).toBe(6000));
});

describe("calculateFamilyPrice — standard canvas, 2 people", () => {
  it("2 people, 1 canvas → €75", () =>
    expect(calculateFamilyPrice(1, 2)).toBe(7500));
  it("2 people, 2 canvases → €90", () =>
    expect(calculateFamilyPrice(2, 2)).toBe(9000));
});

describe("calculateFamilyPrice — standard canvas, 3 people", () => {
  it("3 people, 1 canvas → €80", () =>
    expect(calculateFamilyPrice(1, 3)).toBe(8000));
  it("3 people, 2 canvases → €95", () =>
    expect(calculateFamilyPrice(2, 3)).toBe(9500));
  it("3 people, 3 canvases → €126", () =>
    expect(calculateFamilyPrice(3, 3)).toBe(12600));
});

describe("calculateFamilyPrice — standard canvas, 4 people", () => {
  it("4 people, 2 canvases → €105", () =>
    expect(calculateFamilyPrice(2, 4)).toBe(10500));
  it("4 people, 3 canvases → €132", () =>
    expect(calculateFamilyPrice(3, 4)).toBe(13200));
  it("4 people, 4 canvases → €148", () =>
    expect(calculateFamilyPrice(4, 4)).toBe(14800));
});

describe("calculateFamilyPrice — standard canvas, 5 people", () => {
  it("5 people, 3 canvases → €140", () =>
    expect(calculateFamilyPrice(3, 5)).toBe(14000));
  it("5 people, 4 canvases → €155", () =>
    expect(calculateFamilyPrice(4, 5)).toBe(15500));
  it("5 people, 5 canvases → €175", () =>
    expect(calculateFamilyPrice(5, 5)).toBe(17500));
});

describe("calculateFamilyPrice — standard canvas, 6 people", () => {
  it("6 people, 3 canvases → €145", () =>
    expect(calculateFamilyPrice(3, 6)).toBe(14500));
  it("6 people, 4 canvases → €160", () =>
    expect(calculateFamilyPrice(4, 6)).toBe(16000));
  it("6 people, 5 canvases → €180", () =>
    expect(calculateFamilyPrice(5, 6)).toBe(18000));
  it("6 people, 6 canvases → €195", () =>
    expect(calculateFamilyPrice(6, 6)).toBe(19500));
});

describe("calculateFamilyPrice — clamping", () => {
  it("clamps canvases below min for 4 people (min=2)", () =>
    expect(calculateFamilyPrice(1, 4)).toBe(10500));
  it("clamps canvases above max for 2 people (max=2)", () =>
    expect(calculateFamilyPrice(5, 2)).toBe(9000));
  it("clamps total guests above 6", () =>
    expect(calculateFamilyPrice(6, 7)).toBe(19500));
});
