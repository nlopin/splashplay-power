/**
 * Netlify Scheduled Function: Availability Refresh
 *
 * This file is the entry point for the scheduled function.
 * It imports from the main source code and the build script
 * transforms astro:env/server imports to Netlify.env.get() calls.
 *
 * Build with: pnpm run build:functions
 */
import type { Config } from "@netlify/functions";
import { EVENT_TYPE, type EventType } from "@/components/booking/types";
import {
  refreshAllAvailability,
  reportAvailabilityFailure,
} from "@/services/availability";

export default async () => {
  const startTime = Date.now();

  const event = {
    timestamp: new Date().toISOString(),
    event: "scheduled_availability_refresh",
    durationMs: 0,
    eventTypesRefreshed: [] as string[],
    eventTypesFailed: [] as { eventType: string; error: string }[],
  };

  try {
    const results = await refreshAllAvailability();
    const eventTypes: EventType[] = Object.values(EVENT_TYPE);

    results.forEach((result, index) => {
      const eventType = eventTypes[index];
      if (result.status === "fulfilled") {
        event.eventTypesRefreshed.push(eventType);
      } else {
        const reason = result.reason;
        const message =
          reason instanceof Error ? reason.message : String(reason);
        event.eventTypesFailed.push({ eventType, error: message });
      }
    });

    event.durationMs = Date.now() - startTime;

    console.log(
      JSON.stringify({
        ...event,
        status: event.eventTypesFailed.length > 0 ? "partial_failure" : "success",
      }),
    );

    if (event.eventTypesFailed.length > 0) {
      await reportAvailabilityFailure({
        source: "scheduled",
        failures: event.eventTypesFailed.map((f) => ({
          eventType: f.eventType as EventType,
          error: f.error,
        })),
      });
    }

    return new Response(
      JSON.stringify({
        message: "Availability cache refreshed",
        refreshed: event.eventTypesRefreshed,
        failed: event.eventTypesFailed,
        timestamp: event.timestamp,
      }),
      {
        status: event.eventTypesFailed.length > 0 ? 500 : 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    event.durationMs = Date.now() - startTime;

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    console.log(
      JSON.stringify({
        ...event,
        status: "error",
        error: {
          message: errorMessage,
          stack: error instanceof Error ? error.stack : undefined,
        },
      }),
    );

    await reportAvailabilityFailure({
      source: "scheduled",
      generalError: errorMessage,
    });

    return new Response(
      JSON.stringify({
        message: "Failed to refresh availability cache",
        error: errorMessage,
        timestamp: event.timestamp,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
};

export const config: Config = {
  schedule: "@hourly",
};
