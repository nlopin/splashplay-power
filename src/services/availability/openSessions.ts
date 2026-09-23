import { OPEN_WEEKLY_SLOTS } from "@/constants.server";
import type { ISODatetime } from "@/types";
import { getOccupancyCounts } from "./occupancy";
import { applyOccupancyToSlots } from "./occupancyLogic";
import { filterToSchedule, generateBookedSlots } from "./schedule";
import type { AvailableTime } from "./types";

const OPEN_SCHEDULE_OPTIONS = { remapHolidays: false };

export async function getOpenSessionAvailability(
  calendlyTimes: ISODatetime[],
  days: number,
): Promise<AvailableTime[]> {
  const available = filterToSchedule(
    calendlyTimes,
    OPEN_WEEKLY_SLOTS,
    OPEN_SCHEDULE_OPTIONS,
  );
  const booked = generateBookedSlots(
    calendlyTimes,
    days,
    OPEN_WEEKLY_SLOTS,
    OPEN_SCHEDULE_OPTIONS,
  );
  const occupancy = await getOccupancyCounts();
  return applyOccupancyToSlots([...available, ...booked], occupancy);
}
