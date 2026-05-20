import { BUSINESS_TIMEZONE } from "@/constants";
import { WEEKLY_SLOTS } from "@/constants.server";
import type { AvailableTime } from "./types";

const formatter = new Intl.DateTimeFormat("en-US", {
  timeZone: BUSINESS_TIMEZONE,
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

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

    const match = WEEKLY_SLOTS[dayAbbr]?.find((s) => s.time === `${hour}:${minute}`);
    if (match) {
      result.push({ time: iso, discount: match.discount });
    }
  }

  return result;
}
