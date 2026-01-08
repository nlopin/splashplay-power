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
import { refreshAllAvailability } from "@/services/availability";

export default async () => {
  const startTime = Date.now();

  const event = {
    timestamp: new Date().toISOString(),
    event: "scheduled_availability_refresh",
    durationMs: 0,
    eventTypesRefreshed: [] as string[],
    eventTypesFailed: [] as string[],
  };

  try {
    const results = await refreshAllAvailability();
    const eventTypes: EventType[] = Object.values(EVENT_TYPE);

    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        event.eventTypesRefreshed.push(eventTypes[index]);
      } else {
        event.eventTypesFailed.push(eventTypes[index]);
      }
    });

    event.durationMs = Date.now() - startTime;

    console.log(
      JSON.stringify({
        ...event,
        status: "success",
      }),
    );

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

    console.log(
      JSON.stringify({
        ...event,
        status: "error",
        error: {
          message: error instanceof Error ? error.message : "Unknown error",
          stack: error instanceof Error ? error.stack : undefined,
        },
      }),
    );

    return new Response(
      JSON.stringify({
        message: "Failed to refresh availability cache",
        error: error instanceof Error ? error.message : "Unknown error",
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
