import { EVENT_TYPE, type EventType } from "@/components/booking/types";
import { fetchAvailability } from "@/services/calendly";
import { createAndLogEvent } from "@/services/logger";
import type { ISODatetime } from "@/types";
import { getCachedAvailability, setCachedAvailability } from "./cache";
import { filterToSchedule, generateBookedSlots } from "./schedule";
import type { AvailableTime } from "./types";

const BOOK_IN_ADVANCE = 45;

/**
 * Get availability from cache (fast) or Calendly API (fallback)
 */
export async function getAvailability(
  eventType: EventType,
  days = BOOK_IN_ADVANCE,
): Promise<AvailableTime[]> {
  const cached = await getCachedAvailability(eventType);

  if (cached) {
    const available = filterToSchedule(cached);
    return [...available, ...generateBookedSlots(cached, days)].sort((a, b) =>
      a.time.localeCompare(b.time),
    );
  }

  const result = await refreshAvailability(eventType, { days });

  if (!result.success) return [];
  const available = filterToSchedule(result.availableTimes);
  return [...available, ...generateBookedSlots(result.availableTimes, days)].sort(
    (a, b) => a.time.localeCompare(b.time),
  );
}

/**
 * Fetch fresh data from Calendly and store in cache
 */
export async function refreshAvailability(
  eventType: EventType,
  {
    days = BOOK_IN_ADVANCE,
    skipIfWrittenAfter,
  }: { days?: number; skipIfWrittenAfter?: number } = {},
): Promise<
  { success: true; availableTimes: ISODatetime[] } | { success: false }
> {
  const startTime = Date.now();
  const result = await fetchAvailability(eventType, days);

  if (result.success) {
    await setCachedAvailability(eventType, result.availableTimes, {
      skipIfWrittenAfter,
    });
  }

  createAndLogEvent("availability_fetch", {
    eventType,
    source: "calendly_api",
    status: result.success ? "success" : "error",
    slotsCount: result.success ? result.availableTimes.length : undefined,
    daysRequested: days,
    durationMs: Date.now() - startTime,
  });

  return result;
}

/**
 * Refresh availability for all event types
 */
export async function refreshAllAvailability(
  skipIfWrittenAfter?: number,
): Promise<PromiseSettledResult<ISODatetime[]>[]> {
  const startTime = Date.now();
  createAndLogEvent("availability_refresh_all", { status: "started" });
  const eventTypes: EventType[] = Object.values(EVENT_TYPE);
  const results = await Promise.allSettled(
    eventTypes.map(async (type) => {
      const result = await refreshAvailability(type, { skipIfWrittenAfter });
      if (!result.success) throw new Error(`Failed to refresh ${type}`);
      return result.availableTimes;
    }),
  );

  createAndLogEvent("availability_refresh_all", {
    status: "completed",
    durationMs: Date.now() - startTime,
  });

  return results;
}

/**
 * Trigger availability refresh via background function.
 * This is fire-and-forget - we don't await the result.
 * The background function runs independently and can take up to 15 minutes.
 */
export async function triggerAvailabilityRefresh() {
  const siteUrl = import.meta.env.SITE;

  if (!siteUrl) {
    console.error(
      "Cannot trigger availability refresh: URL environment variable not set",
    );
    return;
  }

  const functionUrl = `${siteUrl}/.netlify/functions/refresh-availability-background`;

  console.log(`Triggering availability refresh at ${functionUrl}`);

  await fetch(functionUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  }).catch((error) => {
    console.error("Failed to trigiger availability refresh:", error);
  });

  console.log("Availability refresh triggered");
}

export { clearCache } from "./cache";
