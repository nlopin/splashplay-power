import { BUSINESS_TIMEZONE } from "@/constants";
import { WEEKLY_SLOTS } from "@/constants.server";

const formatter = new Intl.DateTimeFormat("en-US", {
  timeZone: BUSINESS_TIMEZONE,
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function filterToSchedule(slots: string[]): string[] {
  return slots.filter((iso) => {
    let dayAbbr = "";
    let hour = "";
    let minute = "";

    for (const part of formatter.formatToParts(new Date(iso))) {
      if (part.type === "weekday") dayAbbr = part.value;
      else if (part.type === "hour") hour = part.value;
      else if (part.type === "minute") minute = part.value;
    }

    return WEEKLY_SLOTS[dayAbbr]?.includes(`${hour}:${minute}`) ?? false;
  });
}
