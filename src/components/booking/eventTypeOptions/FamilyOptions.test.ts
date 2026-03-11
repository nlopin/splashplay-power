import { describe, it, expect } from "vitest";
import { calculateFamilyPrice } from "./FamilyOptions";

describe("calculateFamilyPrice — big canvas", () => {
  it("2 people → €80", () => expect(calculateFamilyPrice(1, 2, "big")).toBe(8000));
  it("3 people → €90", () => expect(calculateFamilyPrice(1, 3, "big")).toBe(9000));
  it("4 people → €100", () => expect(calculateFamilyPrice(1, 4, "big")).toBe(10000));
  it("5 people → €110", () => expect(calculateFamilyPrice(1, 5, "big")).toBe(11000));
  it("6 people → €120", () => expect(calculateFamilyPrice(1, 6, "big")).toBe(12000));
});

describe("calculateFamilyPrice — standard canvas, 1 person", () => {
  it("1 person, 1 canvas → €60", () => expect(calculateFamilyPrice(1, 1)).toBe(6000));
});

describe("calculateFamilyPrice — standard canvas, 2 people", () => {
  it("2 people, 1 canvas → €60", () => expect(calculateFamilyPrice(1, 2)).toBe(6000));
  it("2 people, 2 canvases → €90", () => expect(calculateFamilyPrice(2, 2)).toBe(9000));
});

describe("calculateFamilyPrice — standard canvas, 3 people", () => {
  it("3 people, 1 canvas → €65", () => expect(calculateFamilyPrice(1, 3)).toBe(6500));
  it("3 people, 2 canvases → €95", () => expect(calculateFamilyPrice(2, 3)).toBe(9500));
  it("3 people, 3 canvases → €120", () => expect(calculateFamilyPrice(3, 3)).toBe(12000));
});

describe("calculateFamilyPrice — standard canvas, 4 people", () => {
  it("4 people, 2 canvases → €100", () => expect(calculateFamilyPrice(2, 4)).toBe(10000));
  it("4 people, 3 canvases → €128", () => expect(calculateFamilyPrice(3, 4)).toBe(12800));
  it("4 people, 4 canvases → €140", () => expect(calculateFamilyPrice(4, 4)).toBe(14000));
});

describe("calculateFamilyPrice — standard canvas, 5 people", () => {
  it("5 people, 3 canvases → €135", () => expect(calculateFamilyPrice(3, 5)).toBe(13500));
  it("5 people, 4 canvases → €149", () => expect(calculateFamilyPrice(4, 5)).toBe(14900));
  it("5 people, 5 canvases → €160", () => expect(calculateFamilyPrice(5, 5)).toBe(16000));
});

describe("calculateFamilyPrice — standard canvas, 6 people", () => {
  it("6 people, 3 canvases → €140", () => expect(calculateFamilyPrice(3, 6)).toBe(14000));
  it("6 people, 4 canvases → €152", () => expect(calculateFamilyPrice(4, 6)).toBe(15200));
  it("6 people, 5 canvases → €165", () => expect(calculateFamilyPrice(5, 6)).toBe(16500));
  it("6 people, 6 canvases → €180", () => expect(calculateFamilyPrice(6, 6)).toBe(18000));
});

describe("calculateFamilyPrice — clamping", () => {
  it("clamps canvases below min for 4 people (min=2)", () =>
    expect(calculateFamilyPrice(1, 4)).toBe(10000));
  it("clamps canvases above max for 2 people (max=2)", () =>
    expect(calculateFamilyPrice(5, 2)).toBe(9000));
  it("clamps total guests above 6", () =>
    expect(calculateFamilyPrice(6, 7)).toBe(18000));
});
