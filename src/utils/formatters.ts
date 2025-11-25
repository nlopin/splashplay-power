import { DEFAULT_LOCALE } from "@/constants";
import type { ISODatetime } from "@/types";

export function formatWeek(start: Date, end: Date, locale?: string): string {
  const dateTimeFormat = Intl.DateTimeFormat(locale ?? DEFAULT_LOCALE, {
    month: "long",
    day: "numeric",
  });
  return dateTimeFormat.formatRange(start, end);
}

export function formatWeekday(date: Date, locale?: string): [string, string] {
  const dateTimeFormat = Intl.DateTimeFormat(locale ?? DEFAULT_LOCALE, {
    weekday: "long",
    month: "long",
    day: "numeric",
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
  locale?: string,
): string {
  const date = new Date(isoDatetime);
  const dateTimeFormat = Intl.DateTimeFormat(locale ?? DEFAULT_LOCALE, {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
  });

  return dateTimeFormat.format(date);
}
