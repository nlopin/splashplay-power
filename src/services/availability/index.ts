import { EVENT_TYPE, type EventType } from "@/components/booking/types";
import { fetchAvailability } from "@/services/calendly";
import { createAndLogEvent } from "@/services/logger";
import { getCachedAvailability, setCachedAvailability } from "./cache";
import type { AvailableTime } from "./types";

export { clearCache } from "./cache";

const BOOK_IN_ADVANCE = 30;

/**
 * Get availability from cache (fast) or Calendly API (fallback)
 */
export async function getAvailability(
  eventType: EventType,
  days = BOOK_IN_ADVANCE,
): Promise<AvailableTime[]> {
  const cached = await getCachedAvailability(eventType);

  if (cached) {
    return cached;
  }

  return await refreshAvailability(eventType, days);
}

/**
 * Fetch fresh data from Calendly and store in cache
 */
export async function refreshAvailability(
  eventType: EventType,
  days = BOOK_IN_ADVANCE,
): Promise<AvailableTime[]> {
  const startTime = Date.now();
  const availableTimes = await fetchAvailability(eventType, days);

  await setCachedAvailability(eventType, availableTimes);

  createAndLogEvent("availability_fetch", {
    eventType,
    source: "calendly_api",
    status: "success",
    slotsCount: availableTimes.length,
    daysRequested: days,
    durationMs: Date.now() - startTime,
  });

  return availableTimes;
}

/**
 * Refresh availability for all event types
 */
export async function refreshAllAvailability(): Promise<
  PromiseSettledResult<AvailableTime[]>[]
> {
  console.log("Refresh all availability started", new Date().toISOString());
  const eventTypes: EventType[] = Object.values(EVENT_TYPE);
  const results = await Promise.allSettled(
    eventTypes.map((type) => refreshAvailability(type)),
  );

  console.log("Refresh all availability completed", new Date().toISOString());

  return results;
}
