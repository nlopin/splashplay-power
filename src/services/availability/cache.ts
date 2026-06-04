import { NETLIFY_SITE_ID, NETLIFY_TOKEN } from "astro:env/server";
import { getStore } from "@netlify/blobs";
import type { EventType } from "@/components/booking/types";
import { createAndLogEvent } from "@/services/logger";
import type { ISODatetime } from "@/types";

type CachedAvailability = {
  availableTimes: ISODatetime[];
  timestamp: number;
  fetchedAt: string;
};

const availabilityStore = getStore("availability", {
  siteID: NETLIFY_SITE_ID,
  token: NETLIFY_TOKEN,
});

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
): Promise<ISODatetime[] | null> {
  const startTime = Date.now();

  try {
    const cached = await availabilityStore.get(eventType, { type: "json" });
    if (!cached || !isCachedAvailability(cached)) {
      createAndLogEvent("availability_cache_read", {
        eventType,
        status: "miss",
        durationMs: Date.now() - startTime,
      });
      return null;
    }

    createAndLogEvent("availability_cache_read", {
      eventType,
      status: "hit",
      cacheAgeMs: Date.now() - cached.timestamp,
      slotsCount: cached.availableTimes.length,
      durationMs: Date.now() - startTime,
    });
    return cached.availableTimes;
  } catch (error) {
    createAndLogEvent("availability_cache_read", {
      eventType,
      status: "error",
      error: {
        message: error instanceof Error ? error.message : "Unknown error",
      },
      durationMs: Date.now() - startTime,
    });
    return null;
  }
}

/**
 * Set availability in blob cache
 */
export async function setCachedAvailability(
  eventType: EventType,
  availableTimes: ISODatetime[],
  { skipIfWrittenAfter }: { skipIfWrittenAfter?: number },
): Promise<void> {
  const startTime = Date.now();

  try {
    if (skipIfWrittenAfter !== undefined) {
      const existing = await availabilityStore.get(eventType, { type: "json" });
      if (
        existing &&
        isCachedAvailability(existing) &&
        existing.timestamp >= skipIfWrittenAfter
      ) {
        createAndLogEvent("availability_cache_write", {
          eventType,
          status: "skipped",
          reason: "newer_data_exists",
          durationMs: Date.now() - startTime,
        });
        return;
      }
    }

    const cacheData: CachedAvailability = {
      availableTimes,
      timestamp: Date.now(),
      fetchedAt: new Date().toISOString(),
    };
    await availabilityStore.setJSON(eventType, cacheData);

    createAndLogEvent("availability_cache_write", {
      eventType,
      status: "success",
      slotsCount: availableTimes.length,
      durationMs: Date.now() - startTime,
    });
  } catch (error) {
    createAndLogEvent("availability_cache_write", {
      eventType,
      status: "error",
      slotsCount: availableTimes.length,
      error: {
        message: error instanceof Error ? error.message : "Unknown error",
      },
      durationMs: Date.now() - startTime,
    });
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

    createAndLogEvent("availability_cache_clear", {
      eventType,
      scope: "single",
      durationMs: Date.now() - startTime,
    });
  } else {
    await availabilityStore.deleteAll();

    createAndLogEvent("availability_cache_clear", {
      scope: "all",
      durationMs: Date.now() - startTime,
    });
  }
}
