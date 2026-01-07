import type { Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import * as z from "zod";

// Types
type ISODatetime = string;
type AvailableTime = ISODatetime;

const EVENT_TYPE = {
  COUPLES: "couples",
  FAMILY: "family",
  FRIENDS: "friends",
  INDIVIDUAL: "individual",
} as const;

type EventType = (typeof EVENT_TYPE)[keyof typeof EVENT_TYPE];

type CachedAvailability = {
  availableTimes: AvailableTime[];
  timestamp: number;
  fetchedAt: string;
};

type BaseLogEvent = {
  event: string;
  timestamp: ISODatetime;
  durationMs: number;
};

// Environment variables (via Netlify.env)
const env = {
  get NETLIFY_SITE_ID() {
    return Netlify.env.get("NETLIFY_SITE_ID") ?? "";
  },
  get NETLIFY_TOKEN() {
    return Netlify.env.get("NETLIFY_TOKEN") ?? "";
  },
  get CALENDLY_TOKEN() {
    return Netlify.env.get("CALENDLY_TOKEN") ?? "";
  },
  get CALENDLY_COUPLES_EVENT_TYPE_ID() {
    return Netlify.env.get("CALENDLY_COUPLES_EVENT_TYPE_ID") ?? "";
  },
  get CALENDLY_FAMILY_EVENT_TYPE_ID() {
    return Netlify.env.get("CALENDLY_FAMILY_EVENT_TYPE_ID") ?? "";
  },
  get CALENDLY_FRIENDS_EVENT_TYPE_ID() {
    return Netlify.env.get("CALENDLY_FRIENDS_EVENT_TYPE_ID") ?? "";
  },
  get CALENDLY_INDIVIDUAL_EVENT_TYPE_ID() {
    return Netlify.env.get("CALENDLY_INDIVIDUAL_EVENT_TYPE_ID") ?? "";
  },
};

// Calendly constants
const CALENDLY_URL = "https://api.calendly.com";
const EVENT_TYPE_IDS: Record<EventType, () => string> = {
  couples: () => env.CALENDLY_COUPLES_EVENT_TYPE_ID,
  family: () => env.CALENDLY_FAMILY_EVENT_TYPE_ID,
  friends: () => env.CALENDLY_FRIENDS_EVENT_TYPE_ID,
  individual: () => env.CALENDLY_INDIVIDUAL_EVENT_TYPE_ID,
};
const BOOK_IN_ADVANCE = 30;
const BATCH_SIZE_IN_DAYS = 7;
const MILLISECONDS_IN_ONE_DAY = 24 * 60 * 60 * 1000;

const EventTypeAvailableTimesSchema = z.object({
  collection: z.array(
    z.object({
      invitees_remaining: z.number(),
      scheduling_url: z.string(),
      start_time: z.string(),
      status: z.string(),
    }),
  ),
});

// Logging helper
function createAndLogEvent<T extends Record<string, unknown>>(
  eventName: string,
  data: T,
): BaseLogEvent & T {
  const event = {
    timestamp: new Date().toISOString(),
    event: eventName,
    durationMs: 0,
    ...data,
  };
  console.log(JSON.stringify(event));
  return event;
}

// Date helpers
function getWeekdayPosition(date: Date): number {
  const weekday = date.getUTCDay();
  return weekday === 0 ? 6 : weekday - 1;
}

function addDay(date: Date, n: number = 1): Date {
  return new Date(date.getTime() + n * MILLISECONDS_IN_ONE_DAY);
}

function getSunday(date: Date): Date {
  const sunday = addDay(date, 6 - getWeekdayPosition(date));
  sunday.setUTCHours(23, 59, 59);
  return sunday;
}

// Calendly API
function getEventTypeId(eventType: EventType): string {
  return CALENDLY_URL + "/event_types/" + EVENT_TYPE_IDS[eventType]();
}

async function fetchAvailability(
  eventType: EventType,
  days = BOOK_IN_ADVANCE,
): Promise<AvailableTime[]> {
  const batchCount = Math.ceil(days / BATCH_SIZE_IN_DAYS) + 1;
  const now = new Date();
  const startDate = new Date(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0),
  );

  const fetchPromises = Array.from({ length: batchCount }, (_, i) => {
    const isLast = i === batchCount - 1;
    const batchStartDate = new Date(
      startDate.getTime() +
        MILLISECONDS_IN_ONE_DAY +
        i * BATCH_SIZE_IN_DAYS * MILLISECONDS_IN_ONE_DAY,
    );
    const batchEndDate = isLast
      ? getSunday(batchStartDate)
      : new Date(
          batchStartDate.getTime() +
            MILLISECONDS_IN_ONE_DAY * BATCH_SIZE_IN_DAYS,
        );
    const params = new URLSearchParams();
    params.append("start_time", batchStartDate.toISOString());
    params.append("end_time", batchEndDate.toISOString());
    params.append("event_type", getEventTypeId(eventType));

    return fetch(`${CALENDLY_URL}/event_type_available_times?${params}`, {
      headers: {
        Authorization: `Bearer ${env.CALENDLY_TOKEN}`,
      },
    });
  });

  const responses = await Promise.all(fetchPromises);
  const availableTimes: AvailableTime[] = [];

  for (const response of responses) {
    if (response.status === 200) {
      const responseJson = await response.json();
      const parsedData = EventTypeAvailableTimesSchema.safeParse(responseJson);
      if (parsedData.success) {
        availableTimes.push(
          ...parsedData.data.collection.map((v) => v.start_time),
        );
      } else {
        console.error("Unexpected server answer", parsedData.error);
      }
    }
  }

  return availableTimes;
}

// Cache operations
function getAvailabilityStore() {
  return getStore("availability", {
    siteID: env.NETLIFY_SITE_ID,
    token: env.NETLIFY_TOKEN,
  });
}

async function setCachedAvailability(
  eventType: EventType,
  availableTimes: AvailableTime[],
): Promise<void> {
  const startTime = Date.now();
  const store = getAvailabilityStore();

  try {
    const cacheData: CachedAvailability = {
      availableTimes,
      timestamp: Date.now(),
      fetchedAt: new Date().toISOString(),
    };
    await store.setJSON(eventType, cacheData);

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

// Availability refresh
async function refreshAvailability(
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

async function refreshAllAvailability(): Promise<
  PromiseSettledResult<AvailableTime[]>[]
> {
  const eventTypes: EventType[] = Object.values(EVENT_TYPE);
  return Promise.allSettled(
    eventTypes.map((type) => refreshAvailability(type)),
  );
}

// Main handler
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
