import type { Config } from "@netlify/functions";
import { refreshAllAvailability } from "../../src/services/availability";
import type { ISODatetime } from "@/types";
import { EVENT_TYPE, type EventType } from "@/components/booking/types";

type BaseLogEvent = {
  event: "scheduled_availability_refresh";
  timestamp: ISODatetime;
  durationMs: number;
  eventTypesRefreshed: string[];
  eventTypesFailed: string[];
};

type LogEventSuccess = {
  status: "success";
  error: undefined;
} & BaseLogEvent;

type LogEventError = {
  status: "error";
  error: { message: string; stack?: string };
} & BaseLogEvent;

export default async () => {
  const startTime = Date.now();

  const event: BaseLogEvent = {
    timestamp: new Date().toISOString(),
    event: "scheduled_availability_refresh",
    durationMs: 0,
    eventTypesRefreshed: [],
    eventTypesFailed: [],
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

    const successEvent: LogEventSuccess = {
      ...event,
      status: "success",
      error: undefined,
    };
    console.log(JSON.stringify(successEvent));

    return new Response(
      JSON.stringify({
        message: "Availability cache refreshed",
        refreshed: successEvent.eventTypesRefreshed,
        failed: successEvent.eventTypesFailed,
        timestamp: successEvent.timestamp,
      }),
      {
        status: successEvent.eventTypesFailed.length > 0 ? 500 : 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    const errorEvent: LogEventError = {
      ...event,
      status: "error",
      error: {
        message: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      },
    };
    console.log(JSON.stringify(errorEvent));

    return new Response(
      JSON.stringify({
        message: "Failed to refresh availability cache",
        error: errorEvent.error.message,
        timestamp: errorEvent.timestamp,
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
