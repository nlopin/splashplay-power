import { BUSINESS_TIMEZONE } from "@/constants";
import type { ISODatetime } from "@/types";
import type { AvailableTime } from "@/services/availability/types";

export type ThemedOpenSession = {
  slug: string;
  date: string;
  times: readonly string[];
};

/** Special open nights. Same tickets and price as a regular open session. */
export const THEMED_OPEN_SESSIONS: readonly ThemedOpenSession[] = [
  { slug: "halloween", date: "2026-10-29", times: ["18:00"] },
];

const ymdFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: BUSINESS_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const hmFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: BUSINESS_TIMEZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function madridDateTime(value: string | Date): { date: string; time: string } {
  const date = typeof value === "string" ? new Date(value) : value;
  return {
    date: ymdFormatter.format(date),
    time: hmFormatter.format(date),
  };
}

export function extraSlotsFromThemedOpenSessions(): Record<
  string,
  { time: string }[]
> {
  return Object.fromEntries(
    THEMED_OPEN_SESSIONS.map((session) => [
      session.date,
      session.times.map((time) => ({ time })),
    ]),
  );
}

export function blockedPrivateTimesFromThemedOpenSessions(): Record<
  string,
  readonly string[]
> {
  return Object.fromEntries(
    THEMED_OPEN_SESSIONS.map((session) => [session.date, session.times]),
  );
}

export function themeSlugForSlot(iso: string): string | undefined {
  const { date, time } = madridDateTime(iso);
  return THEMED_OPEN_SESSIONS.find(
    (session) => session.date === date && session.times.includes(time),
  )?.slug;
}

export function isThemedSessionUpcoming(
  session: ThemedOpenSession,
  now = new Date(),
): boolean {
  const current = madridDateTime(now);
  const lastTime = session.times[session.times.length - 1];
  if (!lastTime) return false;
  return (
    session.date > current.date ||
    (session.date === current.date && lastTime > current.time)
  );
}

export function getUpcomingThemedSessions(
  now = new Date(),
): ThemedOpenSession[] {
  return THEMED_OPEN_SESSIONS.filter((session) =>
    isThemedSessionUpcoming(session, now),
  );
}

export function findOpenSlotOnDate(
  availability: AvailableTime[],
  ymd: string,
): AvailableTime | undefined {
  const onDate = availability.filter((slot) => {
    if (slot.booked) return false;
    return madridDateTime(slot.time).date === ymd;
  });
  return onDate.find((slot) => slot.themeSlug) ?? onDate[0];
}

export function withThemeSlug<T extends { time: ISODatetime }>(slot: T): T {
  const themeSlug = themeSlugForSlot(slot.time);
  return themeSlug ? { ...slot, themeSlug } : slot;
}
