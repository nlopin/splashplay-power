import { OPEN_SESSION_CAPACITY } from "@/services/catalog/openSessionPricing";
import type { AvailableTime } from "./types";

export function occupancyKey(datetime: string): string {
  return new Date(datetime).toISOString();
}

/**
 * Overlay people-count occupancy onto Calendly-derived slots.
 *
 * Couple tickets are 1 Calendly invitee but 2 people, so remaining seats
 * cannot come from invitees_remaining. If someone already joined the open
 * session (taken > 0) and seats remain, keep selling even when Calendly
 * stopped listing the time (typical after the first invitee occupies the
 * host calendar).
 */
export function applyOccupancyToSlots(
  slots: AvailableTime[],
  occupancy: Record<string, number>,
  capacity = OPEN_SESSION_CAPACITY,
): AvailableTime[] {
  return slots
    .map((slot) => {
      const taken = occupancy[occupancyKey(slot.time)] ?? 0;
      const spotsLeft = Math.max(0, capacity - taken);

      if (taken > 0 && spotsLeft > 0) {
        return { time: slot.time, spotsLeft };
      }
      if (spotsLeft <= 0) {
        return { time: slot.time, booked: true as const, spotsLeft: 0 };
      }
      if (slot.booked) {
        return { ...slot, spotsLeft: 0 };
      }
      return { ...slot, spotsLeft };
    })
    .sort((a, b) => a.time.localeCompare(b.time));
}
