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

  it("keeps 14:00 and 16:00 on 31 Oct 2026", () => {
    const at14 = "2026-10-31T13:00:00.000Z";
    const at16 = "2026-10-31T15:00:00.000Z";
    const otherSaturday = "2026-10-24T12:00:00.000Z";

    const result = filterToSchedule(
      [at14, at16, otherSaturday],
      OPEN_WEEKLY_SLOTS,
      OPTIONS,
    );

    expect(result.map((slot) => slot.time)).toEqual([at14, at16]);
  });

  it("shows the extra session as booked when Calendly has no such time", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-01T10:00:00.000Z"));

    const result = generateBookedSlots([], 40, OPEN_WEEKLY_SLOTS, OPTIONS);
    const at14 = result.find((slot) =>
      slot.time.startsWith("2026-10-31T13:00:00"),
    );
    const at16 = result.find((slot) =>
      slot.time.startsWith("2026-10-31T15:00:00"),
    );

    expect(at14).toMatchObject({ booked: true });
    expect(at16).toMatchObject({ booked: true });
  });
});
