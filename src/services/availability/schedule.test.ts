import { afterEach, describe, expect, it, vi } from "vitest";
import {
  OPEN_SESSION_EXTRA_SLOTS,
  OPEN_WEEKLY_SLOTS,
} from "@/constants.server";
import { filterToSchedule, generateBookedSlots } from "./schedule";

const OPTIONS = {
  remapHolidays: false,
  extraSlots: OPEN_SESSION_EXTRA_SLOTS,
};

describe("open session extra slots", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses only 14:00 on 31 Oct 2026, not the usual Saturday 16:00", () => {
    const halloween = "2026-10-31T13:00:00.000Z";
    const usualSaturdayTime = "2026-10-31T15:00:00.000Z";
    const otherSaturday = "2026-10-24T12:00:00.000Z";

    const result = filterToSchedule(
      [halloween, usualSaturdayTime, otherSaturday],
      OPEN_WEEKLY_SLOTS,
      OPTIONS,
    );

    expect(result.map((slot) => slot.time)).toEqual([halloween]);
  });

  it("shows the extra session as booked when Calendly has no such time", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-01T10:00:00.000Z"));

    const result = generateBookedSlots([], 40, OPEN_WEEKLY_SLOTS, OPTIONS);
    const halloween = result.find((slot) =>
      slot.time.startsWith("2026-10-31T13:00:00"),
    );

    const usualSaturday = result.find((slot) =>
      slot.time.startsWith("2026-10-31T15:00:00"),
    );

    expect(halloween).toMatchObject({ booked: true });
    expect(usualSaturday).toBeUndefined();
  });
});
