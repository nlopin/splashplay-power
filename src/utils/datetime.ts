export const HOUR_IN_MILLIS = 60 * 60 * 1000;
export const DAY_IN_MILLIS = 24 * HOUR_IN_MILLIS;

export function addDay(date: Date, n: number = 1): Date {
  return new Date(date.getTime() + n * DAY_IN_MILLIS);
}

export function addWeek(date: Date, n: number = 1): Date {
  return addDay(date, 7 * n);
}

// return weekday position, Monday is 0
export function getWeekdayPosition(date: Date): number {
  const weekday = date.getUTCDay(); // 0 is Sunday
  return weekday === 0 ? 6 : weekday - 1;
}

export function getSunday(date: Date): Date {
  const sunday = addDay(date, 6 - getWeekdayPosition(date));
  sunday.setUTCHours(23, 59, 59);
  return sunday;
}

export function getMonday(date: Date): Date {
  return addDay(date, -getWeekdayPosition(date));
}
