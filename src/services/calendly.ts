import * as z from "zod";
import { CALENDLY_TOKEN } from "astro:env/server";

const CALENDLY_URL = "https://api.calendly.com/";
const BOOK_IN_ADVANCE = 30;
const BATCH_SIZE_IN_DAYS = 7;
const MILLISECONDS_IN_ONE_DAY = 24 * 60 * 60 * 1000;

const EventTypeAvailableTimesSchema = z.looseObject({
  collection: z.array(
    z.object({
      invitees_remaining: 1,
      scheduling_url:
        "https://calendly.com/splashplay-studio/friends-painting-experience/2025-10-27T11:00:00+00:00",
      start_time: z.iso.datetime(),
      status: z.string(),
    }),
  ),
});

const eventType = "0b5a2e63-1554-4634-8c1d-65f8ce36fa74";

async function getAvailableTime(days = BOOK_IN_ADVANCE) {
  const batchCount = Math.ceil(days / BATCH_SIZE_IN_DAYS);
  const availableTimes = [];
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

  return availableTimes;
}
