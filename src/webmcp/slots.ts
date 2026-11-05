import type { Availability } from "@/components/booking/types";
import type { AvailableTime } from "@/services/availability/types";
import { madridDateTime } from "@/services/catalog/themedOpenSessions";
import {
  formatVisitDateTime,
  getHourInBusinessTimezone,
} from "@/utils/formatters";

// Pure helpers over the availability the booking page already rendered with.

export const TIMES_OF_DAY = ["morning", "afternoon", "evening"] as const;
export type TimeOfDay = (typeof TIMES_OF_DAY)[number];

// Barcelona time: morning before 14:00, afternoon 14:00–17:59, evening 18:00+.
export function timeOfDay(iso: string): TimeOfDay {
  const hour = getHourInBusinessTimezone(iso);
  if (hour < 14) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

export type SlotFilter = {
  from?: string;
  to?: string;
  timeOfDay?: TimeOfDay;
};

export function openSlots(
  availability: Availability,
  now: Date,
): AvailableTime[] {
  return availability.filter(
    (slot) => !slot.booked && new Date(slot.time).getTime() > now.getTime(),
  );
}

export function filterSlots(
  slots: AvailableTime[],
  { from, to, timeOfDay: wanted }: SlotFilter,
): AvailableTime[] {
  return slots.filter((slot) => {
    const { date } = madridDateTime(slot.time);
    if (from && date < from) return false;
    if (to && date > to) return false;
    if (wanted && timeOfDay(slot.time) !== wanted) return false;
    return true;
  });
}

// Matches by instant, so "2026-11-01T11:00:00+01:00" finds "…T10:00:00.000Z".
export function findSlot(
  slots: AvailableTime[],
  datetime: string,
): AvailableTime | undefined {
  const wanted = new Date(datetime).getTime();
  if (Number.isNaN(wanted)) return undefined;
  return slots.find((slot) => new Date(slot.time).getTime() === wanted);
}

export function nearestSlots(
  slots: AvailableTime[],
  datetime: string,
  count = 3,
): AvailableTime[] {
  const target = new Date(datetime).getTime();
  const reference = Number.isNaN(target) ? Date.now() : target;
  return [...slots]
    .sort(
      (a, b) =>
        Math.abs(new Date(a.time).getTime() - reference) -
        Math.abs(new Date(b.time).getTime() - reference),
    )
    .slice(0, count)
    .sort((a, b) => a.time.localeCompare(b.time));
}

export type SlotSummary = {
  datetime: string;
  label: string;
  discountPercent?: number;
  spotsLeft?: number;
  theme?: string;
};

export function summarizeSlot(
  slot: AvailableTime,
  lang: string,
  themeName: (slug: string) => string | undefined,
): SlotSummary {
  const theme = slot.themeSlug ? themeName(slot.themeSlug) : undefined;
  return {
    datetime: slot.time,
    label: formatVisitDateTime(slot.time, "long", lang),
    ...(slot.discount ? { discountPercent: slot.discount } : {}),
    ...(slot.spotsLeft != null ? { spotsLeft: slot.spotsLeft } : {}),
    ...(theme ? { theme } : {}),
  };
}
