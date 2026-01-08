/**
 * Netlify Background Function: Availability Refresh
 *
 * This function is triggered via HTTP POST and runs in the background.
 * Background functions can run for up to 15 minutes and return immediately
 * with a 202 Accepted response.
 *
 * Endpoint: POST /.netlify/functions/refresh-availability-background
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
    event: "background_availability_refresh",
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
  }
};

export const config: Config = {};
