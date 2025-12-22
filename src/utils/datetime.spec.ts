import { describe, it, expect, test } from "vitest";
import {
  addDay,
  addWeek,
  getWeekdayPosition,
  getSunday,
  getMonday,
} from "./datetime";

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

describe("getWeekdayPosition", () => {
  test.for([
    ["Monday", "2025-11-24", 0],
    ["Tuesday", "2025-11-25", 1],
    ["Wednesday", "2025-11-26", 2],
    ["Thursday", "2025-11-27", 3],
    ["Friday", "2025-11-28", 4],
    ["Saturday", "2025-11-29", 5],
    ["Sunday", "2025-11-30", 6],
  ])("%s (%s) has position %i", ([_, isodate, position]) => {
    expect(getWeekdayPosition(new Date(isodate))).toBe(position);
  });
});

describe("getSunday", () => {
  test.for([
    ["Monday", "2025-11-24", 0],
    ["Tuesday", "2025-11-25", 1],
    ["Wednesday", "2025-11-26", 2],
    ["Thursday", "2025-11-27", 3],
    ["Friday", "2025-11-28", 4],
    ["Saturday", "2025-11-29", 5],
    ["Sunday", "2025-11-30", 6],
  ])("For %s (%s), the Sunday is 2025-11-30T23:59:59", ([_, isodate]) => {
    const sunday = getSunday(new Date(isodate));
    expect(sunday.toISOString()).toBe("2025-11-30T23:59:59.000Z");
  });
});

describe("getMonday", () => {
  test.for([
    ["Monday", "2025-11-24", 0],
    ["Tuesday", "2025-11-25", 1],
    ["Wednesday", "2025-11-26", 2],
    ["Thursday", "2025-11-27", 3],
    ["Friday", "2025-11-28", 4],
    ["Saturday", "2025-11-29", 5],
    ["Sunday", "2025-11-30", 6],
  ])("For %s (%s), the Monday is 2025-11-24", ([_, isodate]) => {
    const monday = getMonday(new Date(isodate));
    expect(monday.toISOString()).toBe("2025-11-24T00:00:00.000Z");
  });
});
