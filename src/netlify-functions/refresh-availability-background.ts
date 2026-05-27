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
import {
  refreshAllAvailability,
  reportAvailabilityFailure,
} from "@/services/availability";

export default async () => {
  const startTime = Date.now();

  const event = {
    timestamp: new Date().toISOString(),
    event: "background_availability_refresh",
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
        status:
          event.eventTypesFailed.length > 0 ? "partial_failure" : "success",
      }),
    );

    if (event.eventTypesFailed.length > 0) {
      await reportAvailabilityFailure({
        source: "background",
        failures: event.eventTypesFailed.map((f) => ({
          eventType: f.eventType as EventType,
          error: f.error,
        })),
      });
    }
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
      source: "background",
      generalError: errorMessage,
    });
  }
};

export const config: Config = {};
