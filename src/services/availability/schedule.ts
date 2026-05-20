import { BUSINESS_TIMEZONE } from "@/constants";
import { HOLIDAYS, WEEKLY_SLOTS } from "@/constants.server";
import type { AvailableTime } from "./types";

const formatter = new Intl.DateTimeFormat("en-US", {
  timeZone: BUSINESS_TIMEZONE,
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: BUSINESS_TIMEZONE,
  month: "2-digit",
  day: "2-digit",
});

function isHoliday(iso: string): boolean {
  const parts = Object.fromEntries(
    dateFormatter.formatToParts(new Date(iso)).map((p) => [p.type, p.value]),
  );
  return HOLIDAYS.has(`${parts.day}-${parts.month}`);
}

export function filterToSchedule(slots: string[]): AvailableTime[] {
  const result: AvailableTime[] = [];

  for (const iso of slots) {
    let dayAbbr = "";
    let hour = "";
    let minute = "";

    for (const part of formatter.formatToParts(new Date(iso))) {
      if (part.type === "weekday") dayAbbr = part.value;
      else if (part.type === "hour") hour = part.value;
      else if (part.type === "minute") minute = part.value;
    }

    const holiday = isHoliday(iso);
    const scheduleDay = holiday ? "Sun" : dayAbbr;
    const match = WEEKLY_SLOTS[scheduleDay]?.find(
      (s) => s.time === `${hour}:${minute}`,
    );
    if (match) {
      result.push({
        time: iso,
        discount: holiday ? undefined : match.discount,
      });
    }
  }

  return result;
}
