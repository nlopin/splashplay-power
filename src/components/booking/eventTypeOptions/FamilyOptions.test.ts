import { describe, it, expect } from "vitest";
import {
  calculateFamilyPrice,
  getDefaultCanvasCount,
  validatePeopleCount,
  calculateNewCanvasCount,
} from "./FamilyOptions";

describe("calculateFamilyPrice", () => {
  it("should return price for one canvas for invalid canvas count", () => {
    expect(calculateFamilyPrice(0)).toBe(6000);
    expect(calculateFamilyPrice(-1)).toBe(6000);
  });

  it("should calculate correct prices for 1-6 canvases", () => {
    expect(calculateFamilyPrice(1)).toBe(6000); // €60
    expect(calculateFamilyPrice(2)).toBe(9000); // €90
    expect(calculateFamilyPrice(3)).toBe(12000); // €120
    expect(calculateFamilyPrice(4)).toBe(14000); // €140
    expect(calculateFamilyPrice(5)).toBe(16000); // €160
    expect(calculateFamilyPrice(6)).toBe(18000); // €180
  });

  it("should calculate correct prices for more than 6 canvases", () => {
    expect(calculateFamilyPrice(7)).toBe(21000); // €180 + €30
    expect(calculateFamilyPrice(8)).toBe(24000); // €180 + €60
    expect(calculateFamilyPrice(10)).toBe(30000); // €180 + €120
  });
});

describe("getDefaultCanvasCount", () => {
  it("should return kids count when kids >= 1", () => {
    expect(getDefaultCanvasCount(1)).toBe(1);
    expect(getDefaultCanvasCount(3)).toBe(3);
    expect(getDefaultCanvasCount(5)).toBe(5);
  });

  it("should return 1 for invalid kids count", () => {
    expect(getDefaultCanvasCount(0)).toBe(1);
    expect(getDefaultCanvasCount(-1)).toBe(1);
  });
});

describe("validatePeopleCount", () => {
  it("should validate correct people counts", () => {
    expect(validatePeopleCount(2, 1)).toBe(true);
    expect(validatePeopleCount(3, 4)).toBe(true);
    expect(validatePeopleCount(1, 6)).toBe(true);
    expect(validatePeopleCount(4, 3)).toBe(true);
  });

  it("should reject invalid adult counts", () => {
    expect(validatePeopleCount(0, 1)).toBe(false);
    expect(validatePeopleCount(-1, 1)).toBe(false);
  });

  it("should reject invalid kids counts", () => {
    expect(validatePeopleCount(2, 0)).toBe(false);
    expect(validatePeopleCount(2, -1)).toBe(false);
  });

  it("should reject total people > 7", () => {
    expect(validatePeopleCount(4, 4)).toBe(false);
    expect(validatePeopleCount(6, 2)).toBe(false);
    expect(validatePeopleCount(1, 7)).toBe(false);
  });
});

describe("calculateNewCanvasCount", () => {
  it("should update canvases when they match kids count", () => {
    // When canvases equal kids, always update to match new kids count
    expect(calculateNewCanvasCount(3, 3, 5)).toBe(5); // increase
    expect(calculateNewCanvasCount(4, 4, 2)).toBe(2); // decrease
    expect(calculateNewCanvasCount(1, 1, 1)).toBe(1); // no change
  });

  it("should update canvases when less than kids and kids increase", () => {
    // When canvases < kids and kids increase, update canvases to match
    expect(calculateNewCanvasCount(2, 4, 5)).toBe(5);
    expect(calculateNewCanvasCount(1, 3, 6)).toBe(6);
  });

  it("should not update canvases when user has set more than kids", () => {
    // When canvases > kids, don't change canvases (user preference)
    expect(calculateNewCanvasCount(5, 3, 2)).toBe(5); // kids decreased
    expect(calculateNewCanvasCount(6, 4, 5)).toBe(6); // kids increased but still less than canvases
    expect(calculateNewCanvasCount(3, 2, 1)).toBe(3); // kids decreased
  });

  it("should not update canvases when less than kids but kids decrease", () => {
    // When canvases < kids but kids decrease, don't change canvases
    expect(calculateNewCanvasCount(2, 5, 3)).toBe(2);
    expect(calculateNewCanvasCount(1, 4, 2)).toBe(1);
  });

  it("should handle minimum canvas count", () => {
    // Should never go below 1 canvas
    expect(calculateNewCanvasCount(1, 1, 0)).toBe(1);
    expect(calculateNewCanvasCount(2, 2, -1)).toBe(1);
  });
});
