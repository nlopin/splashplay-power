import { EVENT_TYPE, type EventType } from "@/components/booking/types";
import { fetchAvailability } from "@/services/calendly";
import { createAndLogEvent } from "@/services/logger";
import { escapeMarkdown, sendTelegramMessage } from "@/services/telegram";
import type { ISODatetime } from "@/types";
import { getCachedAvailability, setCachedAvailability } from "./cache";
import { filterToSchedule } from "./schedule";
import type { AvailableTime } from "./types";

const BOOK_IN_ADVANCE = 30;

// Scheduled refresh runs hourly. If the cache is older than this we treat it
// as stale and try to refresh it on the next read. The previous good cache is
// kept as a fallback if the refresh fails (and the failure is reported).
const MAX_CACHE_AGE_MS = 2 * 60 * 60 * 1000;

/**
 * Get availability from cache (fast) or Calendly API (fallback).
 *
 * Behaviour:
 *  - Fresh cache hit → serve it.
 *  - Stale cache hit → try to refresh. If refresh fails, fall back to the
 *    stale cache and alert via Telegram.
 *  - Cache miss → refresh. If refresh fails, alert via Telegram and rethrow.
 */
export async function getAvailability(
  eventType: EventType,
  days = BOOK_IN_ADVANCE,
): Promise<AvailableTime[]> {
  const cached = await getCachedAvailability(eventType);
  const cacheAgeMs = cached ? Date.now() - cached.timestamp : Infinity;
  const isFresh = cached !== null && cacheAgeMs <= MAX_CACHE_AGE_MS;

  if (isFresh) {
    return filterToSchedule(cached!.availableTimes);
  }

  try {
    const slots = await refreshAvailability(eventType, days);
    return filterToSchedule(slots);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    createAndLogEvent("availability_refresh_failure", {
      eventType,
      source: "on_demand",
      hadStaleFallback: cached !== null,
      cacheAgeMs: cached ? cacheAgeMs : null,
      error: { message },
    });

    void reportAvailabilityFailure({
      source: "on_demand",
      failures: [{ eventType, error: message }],
      hadStaleFallback: cached !== null,
      cacheAgeMs: cached ? cacheAgeMs : null,
    });

    if (cached) {
      return filterToSchedule(cached.availableTimes);
    }

    throw error;
  }
}

/**
 * Fetch fresh data from Calendly and store in cache
 */
export async function refreshAvailability(
  eventType: EventType,
  days = BOOK_IN_ADVANCE,
): Promise<ISODatetime[]> {
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
  PromiseSettledResult<ISODatetime[]>[]
> {
  console.log("Refresh all availability started", new Date().toISOString());
  const eventTypes: EventType[] = Object.values(EVENT_TYPE);
  const results = await Promise.allSettled(
    eventTypes.map((type) => refreshAvailability(type)),
  );

  console.log("Refresh all availability completed", new Date().toISOString());

  return results;
}

export type AvailabilityFailureSource =
  | "scheduled"
  | "background"
  | "on_demand";

/**
 * Send a Telegram alert about a failed availability refresh.
 * Best-effort, fire-and-forget – never throws.
 */
export async function reportAvailabilityFailure({
  source,
  failures,
  generalError,
  hadStaleFallback,
  cacheAgeMs,
}: {
  source: AvailabilityFailureSource;
  failures?: { eventType: EventType; error: string }[];
  generalError?: string;
  hadStaleFallback?: boolean;
  cacheAgeMs?: number | null;
}): Promise<void> {
  if ((failures?.length ?? 0) === 0 && !generalError) return;

  try {
    const lines: string[] = [`🚨 *Availability refresh failed*`];
    lines.push(`Source: ${escapeMarkdown(source)}`);

    if (generalError) {
      const truncated =
        generalError.length > 300
          ? `${generalError.slice(0, 300)}…`
          : generalError;
      lines.push(`Error: ${escapeMarkdown(truncated)}`);
    }

    for (const { eventType, error } of failures ?? []) {
      const truncated = error.length > 300 ? `${error.slice(0, 300)}…` : error;
      lines.push(`• *${escapeMarkdown(eventType)}*: ${escapeMarkdown(truncated)}`);
    }

    if (hadStaleFallback !== undefined) {
      lines.push(
        `Stale fallback served: ${hadStaleFallback ? "yes" : "no"}`,
      );
    }

    if (typeof cacheAgeMs === "number" && Number.isFinite(cacheAgeMs)) {
      const minutes = Math.round(cacheAgeMs / 60_000);
      lines.push(`Cache age: ${minutes} min`);
    }

    await sendTelegramMessage(lines.join("\n"));
  } catch (telegramError) {
    console.error(
      "Failed to send availability failure alert to Telegram:",
      telegramError,
    );
  }
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
      process.env,
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
