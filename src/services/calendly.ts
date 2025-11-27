import * as z from "zod";
import { CALENDLY_TOKEN } from "astro:env/server";

const CALENDLY_URL = "https://api.calendly.com/";
const BOOK_IN_ADVANCE = 30;
const BATCH_SIZE_IN_DAYS = 7;
const MILLISECONDS_IN_ONE_DAY = 24 * 60 * 60 * 1000;

const EventTypeAvailableTimesSchema = z.looseObject({
  collection: z.array(
    z.object({
      invitees_remaining: z.number(),
      scheduling_url: z.string(),
      start_time: z.iso.datetime(),
      status: z.string(),
    }),
  ),
});

const eventType = "42b4e39b-a004-4d6f-9c76-f15cd494e2c6";

let cache: {
  data: z.infer<typeof EventTypeAvailableTimesSchema>["collection"];
  timestamp: number;
} | null = null;

const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

export function resetCache() {
  cache = null;
}

export async function getAvailableTime(days = BOOK_IN_ADVANCE) {
  if (cache && Date.now() - cache.timestamp < CACHE_DURATION) {
    console.log("Cache hit");
    return cache.data;
  }

  const batchCount = Math.ceil(days / BATCH_SIZE_IN_DAYS);
  const availableTimes: z.infer<typeof EventTypeAvailableTimesSchema>["collection"] = [];
  const now = new Date();
  const startDate = new Date(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0),
  );
  for (let i = 0; i < batchCount; i++) {
    const batchStartDate = new Date(
      startDate.getTime() +
      MILLISECONDS_IN_ONE_DAY +
      i * BATCH_SIZE_IN_DAYS * MILLISECONDS_IN_ONE_DAY,
    );
    const batchEndDate = new Date(
      batchStartDate.getTime() + MILLISECONDS_IN_ONE_DAY * BATCH_SIZE_IN_DAYS,
    );
    const params = new URLSearchParams();
    params.append("start_time", batchStartDate.toISOString());
    params.append("end_time", batchEndDate.toISOString());
    // todo dynamic event type
    params.append(
      "event_type",
      "https://api.calendly.com/event_types/" + eventType,
    );
    const response = await fetch(
      `${CALENDLY_URL}/event_type_available_times?${params}`,
      {
        headers: {
          Authorization: `Bearer ${CALENDLY_TOKEN}`,
        },
      },
    );

    if (response.status === 200) {
      const responseJson = await response.json();
      const parsedData = EventTypeAvailableTimesSchema.safeParse(responseJson);
      if (parsedData.success) {
        availableTimes.push(...parsedData.data.collection);
      } else {
        console.error(
          "Unexpected server answer",
          z.flattenError(parsedData.error),
        );
      }
    }
  }

  cache = {
    data: availableTimes,
    timestamp: Date.now(),
  };

  return availableTimes;
}
