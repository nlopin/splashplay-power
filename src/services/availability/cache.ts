import { getStore } from "@netlify/blobs";
import type { EventType } from "@/components/booking/types";
import type { AvailableTime } from "./types";

type CachedAvailability = {
  availableTimes: AvailableTime[];
  timestamp: number;
  fetchedAt: string;
};

const availabilityStore = getStore("availability");

function isCachedAvailability(value: unknown): value is CachedAvailability {
  return (
    typeof value === "object" &&
    value !== null &&
    "availableTimes" in value &&
    "timestamp" in value &&
    "fetchedAt" in value &&
    Array.isArray((value as CachedAvailability).availableTimes)
  );
}

/**
 * Get availability from blob cache
 */
export async function getCachedAvailability(
  eventType: EventType,
): Promise<AvailableTime[] | null> {
  const startTime = Date.now();

  try {
    const cached = await availabilityStore.get(eventType, { type: "json" });
    if (!cached || !isCachedAvailability(cached)) {
      console.log(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          event: "availability_cache_read",
          eventType,
          status: "miss",
          durationMs: Date.now() - startTime,
        }),
      );
      return null;
    }

    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        event: "availability_cache_read",
        eventType,
        status: "hit",
        cacheAgeMs: Date.now() - cached.timestamp,
        slotsCount: cached.availableTimes.length,
        durationMs: Date.now() - startTime,
      }),
    );
    return cached.availableTimes;
  } catch (error) {
    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        event: "availability_cache_read",
        eventType,
        status: "error",
        error: {
          message: error instanceof Error ? error.message : "Unknown error",
        },
        durationMs: Date.now() - startTime,
      }),
    );
    return null;
  }
}

/**
 * Set availability in blob cache
 */
export async function setCachedAvailability(
  eventType: EventType,
  availableTimes: AvailableTime[],
): Promise<void> {
  const startTime = Date.now();

  try {
    const cacheData: CachedAvailability = {
      availableTimes,
      timestamp: Date.now(),
      fetchedAt: new Date().toISOString(),
    };
    await availabilityStore.setJSON(eventType, cacheData);

    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        event: "availability_cache_write",
        eventType,
        status: "success",
        slotsCount: availableTimes.length,
        durationMs: Date.now() - startTime,
      }),
    );
  } catch (error) {
    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        event: "availability_cache_write",
        eventType,
        status: "error",
        slotsCount: availableTimes.length,
        error: {
          message: error instanceof Error ? error.message : "Unknown error",
        },
        durationMs: Date.now() - startTime,
      }),
    );
    throw error;
  }
}

/**
 * Clear blob cache for specific event type or all types
 */
export async function clearCache(eventType?: EventType): Promise<void> {
  const startTime = Date.now();

  if (eventType) {
    await availabilityStore.delete(eventType);

    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        event: "availability_cache_clear",
        eventType,
        scope: "single",
        durationMs: Date.now() - startTime,
      }),
    );
  } else {
    await availabilityStore.deleteAll();

    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        event: "availability_cache_clear",
        scope: "all",
        durationMs: Date.now() - startTime,
      }),
    );
  }
}
