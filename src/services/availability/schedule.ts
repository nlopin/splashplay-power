import { BUSINESS_TIMEZONE } from "@/constants";
import { HOLIDAYS, WEEKLY_SLOTS } from "@/constants.server";
import type { ISODatetime } from "@/types";
import { addDay } from "@/utils/datetime";
import { formatTime } from "@/utils/formatters";
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

const ymdFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: BUSINESS_TIMEZONE,
  year: "numeric",
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

function toMadridISODatetime(utcDay: Date, timeHHMM: string): ISODatetime {
  const [h, m] = timeHHMM.split(":").map(Number);
  const ymd = ymdFormatter.format(utcDay);
  const hh = String(h).padStart(2, "0");
  const mm = String(m).padStart(2, "0");

  for (const offsetStr of ["+02:00", "+01:00"]) {
    const candidate = new Date(`${ymd}T${hh}:${mm}:00${offsetStr}`);
    const [candH, candM] = formatTime(candidate.toISOString()).split(":").map(Number);
    if (candH === h && candM === m) {
      return candidate.toISOString();
    }
  }

  return new Date(`${ymd}T${hh}:${mm}:00+01:00`).toISOString();
}

export function generateBookedSlots(
  availableISOs: string[],
  days: number,
): AvailableTime[] {
  const availableMs = new Set(availableISOs.map((s) => new Date(s).getTime()));
  const now = new Date();
  const result: AvailableTime[] = [];

  for (let i = 0; i < days; i++) {
    const utcDay = addDay(now, i);
    const iso = utcDay.toISOString();
    const holiday = isHoliday(iso);
    let dayAbbr = "";
    for (const part of formatter.formatToParts(utcDay)) {
      if (part.type === "weekday") dayAbbr = part.value;
    }
    const scheduleDay = holiday ? "Sun" : dayAbbr;
    const slots = WEEKLY_SLOTS[scheduleDay] ?? [];

    for (const slot of slots) {
      const slotISO = toMadridISODatetime(utcDay, slot.time);
      if (!availableMs.has(new Date(slotISO).getTime()) && new Date(slotISO) > now) {
        result.push({ time: slotISO, booked: true });
      }
    }
  }

  return result;
}
