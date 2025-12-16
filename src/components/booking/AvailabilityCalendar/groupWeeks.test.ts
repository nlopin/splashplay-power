import { describe, expect, it, test } from "vitest";
import {
  getWeekdayPosition,
  groupWeeks,
  createWeek,
  createGapWeeks,
} from "./groupWeeks";
import type { ISODatetime } from "@/types";

const makeISODateTime = (date: string, time: string): ISODatetime => {
  return `${date}T${time}:00.000000Z`;
};

describe("groupWeeks", () => {
  it("returns an empty array if empty array is passed", () => {
    expect(groupWeeks([])).toEqual([]);
  });

  it("group one full week", () => {
    const dates = [
      ["2025-11-24", "11:00"],
      ["2025-11-25", "11:00"],
      ["2025-11-26", "11:00"],
      ["2025-11-27", "11:00"],
      ["2025-11-28", "11:00"],
      ["2025-11-29", "11:00"],
      ["2025-11-30", "11:00"],
    ].map(([date, time]) => makeISODateTime(date, time));

    const weeks = groupWeeks(dates);

    expect(Array.isArray(weeks)).toBe(true);
    expect(weeks).toHaveLength(1);

    expect(weeks[0][0].date.toUTCString()).toBe(
      "Mon, 24 Nov 2025 11:00:00 GMT",
    );
    expect(weeks[0][6].date.toUTCString()).toBe(
      "Sun, 30 Nov 2025 11:00:00 GMT",
    );

    expect(weeks[0].every((day) => day.times.length === 1)).toBe(true);
  });

  it("group one partial week", () => {
    const dates = [
      ["2025-11-25", "11:00"],
      ["2025-11-26", "11:00"],
      ["2025-11-28", "11:00"],
      ["2025-11-29", "11:00"],
    ].map(([date, time]) => makeISODateTime(date, time));
    const timeCount: Record<string, number> = {
      "Tue Nov 25 2025": 1,
      "Wed Nov 26 2025": 1,
      "Fri Nov 28 2025": 1,
      "Sat Nov 29 2025": 1,
    };

    const weeks = groupWeeks(dates);

    expect(Array.isArray(weeks)).toBe(true);
    expect(weeks).toHaveLength(1);

    expect(weeks[0][0].date.toUTCString()).toBe(
      "Mon, 24 Nov 2025 11:00:00 GMT",
    );
    expect(weeks[0][6].date.toUTCString()).toBe(
      "Sun, 30 Nov 2025 11:00:00 GMT",
    );

    expect(
      weeks[0].every(
        (day) => day.times.length === (timeCount[day.date.toDateString()] ?? 0),
      ),
    ).toBe(true);
  });

  it("groups multiple weeks", () => {
    const dates = [
      ["2025-11-24", "11:00"],
      ["2025-11-25", "11:00"],
      ["2025-11-26", "11:00"],
      ["2025-11-27", "11:00"],
      ["2025-11-28", "11:00"],
      ["2025-11-29", "11:00"],
      ["2025-11-30", "11:00"],
      ["2025-12-01", "11:00"],
      ["2025-12-02", "11:00"],
      ["2025-12-03", "11:00"],
    ].map(([date, time]) => makeISODateTime(date, time));

    const weeks = groupWeeks(dates);

    expect(Array.isArray(weeks)).toBe(true);
    expect(weeks).toHaveLength(2);

    expect(weeks[0][0].date.toUTCString()).toBe(
      "Mon, 24 Nov 2025 11:00:00 GMT",
    );
    expect(weeks[0][6].date.toUTCString()).toBe(
      "Sun, 30 Nov 2025 11:00:00 GMT",
    );
    expect(weeks[1][0].date.toUTCString()).toBe(
      "Mon, 01 Dec 2025 11:00:00 GMT",
    );
    expect(weeks[1][6].date.toUTCString()).toBe(
      "Sun, 07 Dec 2025 11:00:00 GMT",
    );
  });

  it("fill week gaps", () => {
    const dates = [
      ["2025-11-24", "11:00"],
      ["2025-11-25", "11:00"],
      ["2025-11-26", "11:00"],
      ["2025-11-27", "11:00"],
      ["2025-11-28", "11:00"],
      ["2025-11-29", "11:00"],
      ["2025-11-30", "11:00"],
      ["2025-12-08", "11:00"],
      ["2025-12-09", "11:00"],
      ["2025-12-10", "11:00"],
    ].map(([date, time]) => makeISODateTime(date, time));

    const weeks = groupWeeks(dates);

    expect(Array.isArray(weeks)).toBe(true);
    expect(weeks).toHaveLength(3);

    // three weeks correctly generated
    expect(weeks[0][0].date.toUTCString()).toBe(
      "Mon, 24 Nov 2025 11:00:00 GMT",
    );
    expect(weeks[0][6].date.toUTCString()).toBe(
      "Sun, 30 Nov 2025 11:00:00 GMT",
    );
    expect(weeks[1][0].date.toUTCString()).toBe(
      "Mon, 01 Dec 2025 11:00:00 GMT",
    );
    expect(weeks[1][6].date.toUTCString()).toBe(
      "Sun, 07 Dec 2025 11:00:00 GMT",
    );
    expect(weeks[2][0].date.toUTCString()).toBe(
      "Mon, 08 Dec 2025 11:00:00 GMT",
    );
    expect(weeks[2][6].date.toUTCString()).toBe(
      "Sun, 14 Dec 2025 11:00:00 GMT",
    );

    // first week has time slots
    expect(weeks[0].every((day) => day.times.length === 1)).toBe(true);
    // second week is empty, no time slots
    expect(weeks[1].every((day) => day.times.length === 0)).toBe(true);
    // third week 3 slots
    expect(weeks[2].reduce((acc, day) => acc + day.times.length, 0)).toBe(3);
  });

  it("groups day times", () => {
    const dates = [
      ["2025-11-24", "11:00"],
      ["2025-11-24", "21:00"],
      ["2025-11-25", "11:00"],
      ["2025-11-26", "11:00"],
      ["2025-11-27", "11:00"],
      ["2025-11-27", "12:00"],
      ["2025-11-28", "11:00"],
      ["2025-11-29", "09:00"],
      ["2025-11-29", "10:00"],
      ["2025-11-29", "11:00"],
    ].map(([date, time]) => makeISODateTime(date, time));
    const timeCount: Record<string, number> = {
      "Mon Nov 24 2025": 2,
      "Tue Nov 25 2025": 1,
      "Wed Nov 26 2025": 1,
      "Thu Nov 27 2025": 2,
      "Fri Nov 28 2025": 1,
      "Sat Nov 29 2025": 3,
      "Sun Nov 30 2025": 0,
    };

    const weeks = groupWeeks(dates);

    expect(
      weeks[0].every(
        (day) => day.times.length === timeCount[day.date.toDateString()],
      ),
    ).toBe(true);
  });
});

describe("createGapWeeks", () => {
  it("returns empty array if there is no gap weeks between mondays", () => {
    const mondayEarlier = {
      date: new Date("2025-11-24"),
      times: [],
    };

    const mondayLater = {
      date: new Date("2025-12-01"),
      times: [],
    };

    expect(createGapWeeks(mondayEarlier, mondayLater)).toEqual([]);
  });

  it("returns one gap week", () => {
    const mondayEarlier = {
      date: new Date("2025-11-24"),
      times: [],
    };

    const mondayLater = {
      date: new Date("2025-12-08"),
      times: [],
    };

    const gapWeeks = createGapWeeks(mondayEarlier, mondayLater);
    expect(gapWeeks).toHaveLength(1);
    expect(gapWeeks[0][0].date.toUTCString()).toBe(
      "Mon, 01 Dec 2025 00:00:00 GMT",
    );
  });

  it("returns multiple gap weeks", () => {
    const mondayEarlier = {
      date: new Date("2025-11-24"),
      times: [],
    };

    const mondayLater = {
      date: new Date("2025-12-22"),
      times: [],
    };

    const gapWeeks = createGapWeeks(mondayEarlier, mondayLater);
    expect(gapWeeks).toHaveLength(3);
    expect(gapWeeks[0][0].date.toUTCString()).toBe(
      "Mon, 01 Dec 2025 00:00:00 GMT",
    );
    expect(gapWeeks[1][0].date.toUTCString()).toBe(
      "Mon, 08 Dec 2025 00:00:00 GMT",
    );
    expect(gapWeeks[2][0].date.toUTCString()).toBe(
      "Mon, 15 Dec 2025 00:00:00 GMT",
    );
  });

  it("returns swaps parameters order if first monday is later than second", () => {
    const mondayEarlier = {
      date: new Date("2025-11-24"),
      times: [],
    };

    const mondayLater = {
      date: new Date("2025-12-08"),
      times: [],
    };

    const gapWeeks = createGapWeeks(mondayLater, mondayEarlier);

    // behaves the same is "returns one gap week"
    expect(gapWeeks).toHaveLength(1);
    expect(gapWeeks[0][0].date.toUTCString()).toBe(
      "Mon, 01 Dec 2025 00:00:00 GMT",
    );
  });
});

describe("createWeek", () => {
  describe("creates a week array of 7 elements that starts on Monday and finishes on Sunday", () => {
    test.for([
      ["Monday", "2025-11-24"],
      ["Tuesday", "2025-11-25"],
      ["Wednesday", "2025-11-26"],
      ["Thursday", "2025-11-27"],
      ["Friday", "2025-11-28"],
      ["Saturday", "2025-11-29"],
      ["Sunday", "2025-11-30"],
    ])(
      "when %s is passed (%s) the week is from 24th till 30th of November 2025",
      ([_, isodate]) => {
        const week = createWeek(new Date(isodate));

        expect(week).toHaveLength(7);
        expect(week[0].date.toUTCString()).toBe(
          "Mon, 24 Nov 2025 00:00:00 GMT",
        );
        expect(week[6].date.toUTCString()).toBe(
          "Sun, 30 Nov 2025 00:00:00 GMT",
        );
      },
    );
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
