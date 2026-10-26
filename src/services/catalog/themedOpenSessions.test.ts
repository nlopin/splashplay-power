import { afterEach, describe, expect, it, vi } from "vitest";
import { WEEKLY_SLOTS } from "@/constants.server";
import { filterToSchedule, generateBookedSlots } from "@/services/availability/schedule";
import {
  blockedPrivateTimesFromThemedOpenSessions,
  extraSlotsFromThemedOpenSessions,
  findOpenSlotOnDate,
  getUpcomingThemedSessions,
  themeSlugForSlot,
} from "./themedOpenSessions";
import { getBookingTitle } from "./productName";

const HALLOWEEN = "2026-10-29T17:00:00.000Z";
const THURSDAY_1945 = "2026-10-29T18:45:00.000Z";

describe("themed open sessions", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("marks 29 Oct 2026 18:00 as Halloween", () => {
    expect(themeSlugForSlot(HALLOWEEN)).toBe("halloween");
    expect(themeSlugForSlot(THURSDAY_1945)).toBeUndefined();
  });

  it("replaces the usual Thursday 19:45 with 18:00", () => {
    const extras = extraSlotsFromThemedOpenSessions();
    expect(extras["2026-10-29"]).toEqual([{ time: "18:00" }]);

    const result = filterToSchedule(
      [HALLOWEEN, THURSDAY_1945],
      { Thu: [{ time: "19:45" }] },
      { remapHolidays: false, extraSlots: extras },
    );

    expect(result.map((slot) => slot.time)).toEqual([HALLOWEEN]);
  });

  it("keeps Halloween upcoming before 18:00 and hides it after", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-29T15:00:00.000Z"));
    expect(getUpcomingThemedSessions().map((s) => s.slug)).toEqual(["halloween"]);

    vi.setSystemTime(new Date("2026-10-29T17:00:00.000Z"));
    expect(getUpcomingThemedSessions()).toEqual([]);
  });

  it("prefers the themed slot when opening a date", () => {
    const slot = findOpenSlotOnDate(
      [
        { time: THURSDAY_1945, spotsLeft: 6 },
        { time: HALLOWEEN, spotsLeft: 6, themeSlug: "halloween" },
      ],
      "2026-10-29",
    );
    expect(slot?.time).toBe(HALLOWEEN);
  });

  it("blocks private bookings from taking the Halloween hour", () => {
    const options = {
      blockedTimes: blockedPrivateTimesFromThemedOpenSessions(),
    };

    expect(
      filterToSchedule([HALLOWEEN, THURSDAY_1945], WEEKLY_SLOTS, options).map(
        (slot) => slot.time,
      ),
    ).toEqual([THURSDAY_1945]);

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-01T10:00:00.000Z"));
    const booked = generateBookedSlots([], 40, WEEKLY_SLOTS, options);
    expect(
      booked.some((slot) => slot.time.startsWith("2026-10-29T17:00:00")),
    ).toBe(false);
    expect(
      booked.some((slot) => slot.time.startsWith("2026-10-29T18:45:00")),
    ).toBe(true);
  });
});

describe("themed checkout title", () => {
  it("uses the Halloween title when the selected slot is themed", () => {
    expect(getBookingTitle("open_session", "es", "halloween")).toBe(
      "Halloween Splash",
    );
    expect(getBookingTitle("open_session", "es")).toBe(
      "Splash: sesión abierta",
    );
  });
});
