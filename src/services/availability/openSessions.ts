import {
  OPEN_SESSION_EXTRA_SLOTS,
  OPEN_WEEKLY_SLOTS,
} from "@/constants.server";
import {
  extraSlotsFromThemedOpenSessions,
  withThemeSlug,
} from "@/services/catalog/themedOpenSessions";
import type { ISODatetime } from "@/types";
import { getOccupancyCounts } from "./occupancy";
import { applyOccupancyToSlots } from "./occupancyLogic";
import { filterToSchedule, generateBookedSlots } from "./schedule";
import type { AvailableTime } from "./types";

const OPEN_SCHEDULE_OPTIONS = {
  remapHolidays: false,
  extraSlots: {
    ...OPEN_SESSION_EXTRA_SLOTS,
    ...extraSlotsFromThemedOpenSessions(),
  },
};

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
  return applyOccupancyToSlots(
    [...available, ...booked].map(withThemeSlug),
    occupancy,
  );
}
