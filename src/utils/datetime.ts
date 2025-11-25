export const HOUR_IN_MILLIS = 60 * 60 * 1000;
export const DAY_IN_MILLIS = 24 * HOUR_IN_MILLIS;

export function addDay(date: Date, n: number = 1): Date {
  return new Date(date.getTime() + n * DAY_IN_MILLIS);
}

export function addWeek(date: Date, n: number = 1): Date {
  return addDay(date, 7 * n);
}
