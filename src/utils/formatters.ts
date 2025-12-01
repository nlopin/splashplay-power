import { DEFAULT_LOCALE } from "@/constants";
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

export function formatTime(isoDatetime: ISODatetime): string {
  const [, isoTime] = isoDatetime.split("T");
  const [hour, minute] = isoTime.split(":");
  return `${hour}:${minute}`;
}

export function formatVisitDateTime(
  isoDatetime: ISODatetime,
  // long - Friday 5 December at 15:00
  // short - 05/12/2025, 15:00
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
          timeZone: "UTC",
        }
      : {
          month: "2-digit",
          day: "2-digit",
          year: "numeric",
          hour: "numeric",
          minute: "numeric",
          hour12: false,
          timeZone: "UTC",
        };
  const dateTimeFormat = Intl.DateTimeFormat(
    // use en-GB to enforce dd/mm/yyyy format for english locale
    locale === "en" ? "en-GB" : (locale ?? DEFAULT_LOCALE),
    options,
  );

  return dateTimeFormat.format(date);
}
