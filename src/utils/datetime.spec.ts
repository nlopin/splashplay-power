import { describe, it, expect } from "vitest";
import { HOUR_IN_MILLIS, DAY_IN_MILLIS, addDay, addWeek } from "./datetime";

describe("addDay", () => {
  it("adds one day", () => {
    const date = new Date("2024-01-15T10:30:00Z");
    const result = addDay(date);

    expect(result).toEqual(new Date("2024-01-16T10:30:00Z"));
    expect(result).not.toBe(date); // returns new Date instance
  });

  it("adds multiple days", () => {
    const date = new Date("2024-01-15T10:30:00Z");
    const result = addDay(date, 5);

    expect(result).toEqual(new Date("2024-01-20T10:30:00Z"));
  });

  it("subtract days when n is negative", () => {
    const date = new Date("2024-01-15T10:30:00Z");
    const result = addDay(date, -3);

    expect(result).toEqual(new Date("2024-01-12T10:30:00Z"));
  });

  it("handle zero days", () => {
    const date = new Date("2024-01-15T10:30:00Z");
    const result = addDay(date, 0);

    expect(result).toEqual(date);
    expect(result).not.toBe(date); // still returns new Date instance
  });

  describe("addWeek", () => {
    it("adds one week", () => {
      const date = new Date("2024-01-15T10:30:00Z");
      const result = addWeek(date);

      expect(result).toEqual(new Date("2024-01-22T10:30:00Z"));
      expect(result).not.toBe(date); // returns new Date instance
    });

    it("adds multiple weeks", () => {
      const date = new Date("2024-01-15T10:30:00Z");
      const result = addWeek(date, 5);

      expect(result).toEqual(new Date("2024-02-19T10:30:00Z"));
    });

    it("subtract weeks when n is negative", () => {
      const date = new Date("2024-01-15T10:30:00Z");
      const result = addWeek(date, -3);

      expect(result).toEqual(new Date("2023-12-25T10:30:00Z"));
    });

    it("handle zero weeks", () => {
      const date = new Date("2024-01-15T10:30:00Z");
      const result = addWeek(date, 0);

      expect(result).toEqual(date);
      expect(result).not.toBe(date); // still returns new Date instance
    });
  });
});
