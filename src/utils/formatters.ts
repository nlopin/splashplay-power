import { BUSINESS_TIMEZONE, DEFAULT_LOCALE } from "@/constants";
import type { ISODatetime } from "@/types";

export function formatWeek(start: Date, end: Date, locale?: string): string {
  const dateTimeFormat = Intl.DateTimeFormat(locale ?? DEFAULT_LOCALE, {
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
  return dateTimeFormat.formatRange(start, end);
}

export function formatWeekday(
  date: Date,
  locale?: string,
  weekdayStyle: "long" | "short" | "narrow" = "long",
): [string, string] {
  const dateTimeFormat = Intl.DateTimeFormat(locale ?? DEFAULT_LOCALE, {
    weekday: weekdayStyle,
    month: weekdayStyle,
    day: "numeric",
    timeZone: "UTC",
  });
  const parts = dateTimeFormat.format(date);

  const [weekday, dateString] = parts.split(", ");
  return [weekday, dateString];
}

/**
 * Formats an ISO datetime string to display time in the business timezone.
 * Handles DST (Daylight Saving Time) automatically.
 *
 * @param isoDatetime - ISO 8601 datetime string (UTC)
 * @returns Time string in HH:MM format in business timezone
 */
export function formatTime(isoDatetime: ISODatetime): string {
  const date = new Date(isoDatetime);
  const timeFormat = new Intl.DateTimeFormat(DEFAULT_LOCALE, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: BUSINESS_TIMEZONE,
  });
  return timeFormat.format(date);
}

/**
 * Extracts the hour component from an ISO datetime string in the business timezone.
 * Handles DST (Daylight Saving Time) automatically.
 *
 * @param isoDatetime - ISO 8601 datetime string (UTC)
 * @returns Hour as a number (0-23) in business timezone
 */
export function getHourInBusinessTimezone(isoDatetime: ISODatetime): number {
  const date = new Date(isoDatetime);
  const timeFormat = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    hour12: false,
    timeZone: BUSINESS_TIMEZONE,
  });
  return parseInt(timeFormat.format(date), 10);
}

/**
 * Formats an ISO datetime string for display to users in the business timezone.
 * Handles DST (Daylight Saving Time) automatically.
 *
 * @param isoDatetime - ISO 8601 datetime string (UTC)
 * @param type - Format type: "long" (Friday 5 December at 15:00) or "short" (05/12/2025, 15:00)
 * @param locale - Optional locale override
 * @returns Formatted datetime string in business timezone
 */
export function formatVisitDateTime(
  isoDatetime: ISODatetime,
  type: "long" | "short",
  locale?: string,
): string {
  const date = new Date(isoDatetime);
  const options: Intl.DateTimeFormatOptions =
    type === "long"
      ? {
          weekday: "long",
          month: "long",
          day: "numeric",
          hour: "numeric",
          minute: "numeric",
          hour12: false,
          timeZone: BUSINESS_TIMEZONE,
        }
      : {
          month: "2-digit",
          day: "2-digit",
          year: "numeric",
          hour: "numeric",
          minute: "numeric",
          hour12: false,
          timeZone: BUSINESS_TIMEZONE,
        };
  const dateTimeFormat = Intl.DateTimeFormat(
    // use en-GB to enforce dd/mm/yyyy format for english locale
    locale === "en" ? "en-GB" : (locale ?? DEFAULT_LOCALE),
    options,
  );

  return dateTimeFormat.format(date);
}
