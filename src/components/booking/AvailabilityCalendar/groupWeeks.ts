import type { ISODatetime } from "@/types";
import { addDay, addWeek } from "@/utils/datetime";

export type Week = Day[]; //Monday through Sunday

type Day = {
  date: Date;
  times: ISODatetime[];
};

// Helper function to get UTC date string for comparison (YYYY-MM-DD format)
function getUTCDateString(date: Date): string {
  return date.toISOString().split("T")[0];
}

// dates must be ordered from oldest to newest
export function groupWeeks(orderedDates: ISODatetime[]): Week[] {
  const weeks: Week[] = [];

  for (const isoDateString of orderedDates) {
    const date = new Date(isoDateString);
    const weekdayPosition = getWeekdayPosition(date);
    const currentWeek = weeks.at(-1);
    const isInCurrentWeek =
      currentWeek !== undefined &&
      getUTCDateString(currentWeek.at(weekdayPosition)!.date) ===
        getUTCDateString(date);

    if (isInCurrentWeek) {
      currentWeek[weekdayPosition].times.push(isoDateString);
    } else {
      const newWeek = createWeek(date);
      const gapWeeks: Week[] = currentWeek
        ? createGapWeeks(currentWeek[0], newWeek[0])
        : [];

      newWeek[weekdayPosition].times.push(isoDateString);

      weeks.push(...gapWeeks, newWeek);
    }
  }

  return weeks;
}

export function createGapWeeks(mondayEarlier: Day, mondayLater: Day): Week[] {
  const gapWeeks: Week[] = [];

  if (mondayEarlier.date.getTime() > mondayLater.date.getTime()) {
    return createGapWeeks(mondayLater, mondayEarlier);
  }

  for (
    let nextMonday = addWeek(mondayEarlier.date);
    getUTCDateString(nextMonday) !== getUTCDateString(mondayLater.date);
    nextMonday = addWeek(nextMonday)
  ) {
    gapWeeks.push(createWeek(nextMonday));
  }

  return gapWeeks;
}

export function createWeek(date: Date): Week {
  const receivedWeekday = getWeekdayPosition(date);
  const monday = receivedWeekday === 0 ? date : addDay(date, -receivedWeekday);
  const weekdays = new Array<Day>(7);
  for (let i = 0; i < 7; i++) {
    weekdays[i] = { date: addDay(monday, i), times: [] };
  }

  return weekdays;
}

// return weekday position, Monday is 0
export function getWeekdayPosition(date: Date): number {
  const weekday = date.getUTCDay(); // 0 is Sunday
  return weekday === 0 ? 6 : weekday - 1;
}
