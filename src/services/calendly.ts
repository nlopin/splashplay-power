import * as z from "zod";
import {
  CALENDLY_TOKEN,
  CALENDLY_COUPLES_EVENT_TYPE_ID,
  CALENDLY_FAMILY_EVENT_TYPE_ID,
  CALENDLY_FRIENDS_EVENT_TYPE_ID,
  CALENDLY_INDIVIDUAL_EVENT_TYPE_ID,
  CALENDLY_THROW_PAINT_EVENT_TYPE_ID,
  CALENDLY_CUSTOMIZE_CLOTHES_EVENT_TYPE_ID,
} from "astro:env/server";

import { type EventType } from "@/components/booking/types";
import { type ISODatetime } from "@/types";
import { getSunday } from "@/utils/datetime";

const CALENDLY_URL = "https://api.calendly.com";
const EVENT_TYPE_IDS: Record<EventType, string> = {
  couples: CALENDLY_COUPLES_EVENT_TYPE_ID,
  family: CALENDLY_FAMILY_EVENT_TYPE_ID,
  friends: CALENDLY_FRIENDS_EVENT_TYPE_ID,
  individual: CALENDLY_INDIVIDUAL_EVENT_TYPE_ID,
  throw_paint: CALENDLY_THROW_PAINT_EVENT_TYPE_ID,
  customize_clothes: CALENDLY_CUSTOMIZE_CLOTHES_EVENT_TYPE_ID,
};
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

/**
 * Fetch available times from Calendly API.
 *
 * All-or-nothing: if any batch returns a non-200 status or fails schema
 * validation, this throws. Callers must NOT persist partial results, because
 * doing so previously silently overwrote the cache with gaps (e.g. the first
 * week missing after a single 429 from Calendly).
 */
export async function fetchAvailability(
  eventType: EventType,
  days = BOOK_IN_ADVANCE,
): Promise<ISODatetime[]> {
  const batchCount = Math.ceil(days / BATCH_SIZE_IN_DAYS) + 1; // we need +1 to get the rest of the last week
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
        Authorization: `Bearer ${CALENDLY_TOKEN}`,
      },
    });
  });

  const responses = await Promise.all(fetchPromises);
  const availableTimes: ISODatetime[] = [];

  for (let i = 0; i < responses.length; i++) {
    const response = responses[i];

    if (response.status !== 200) {
      const body = await safeReadText(response);
      throw new Error(
        `Calendly availability fetch failed for "${eventType}" batch ${i}: ` +
          `status=${response.status} body=${body.slice(0, 200)}`,
      );
    }

    const responseJson = await response.json();
    const parsedData = EventTypeAvailableTimesSchema.safeParse(responseJson);

    if (!parsedData.success) {
      throw new Error(
        `Calendly availability response parse failed for "${eventType}" batch ${i}: ` +
          JSON.stringify(z.flattenError(parsedData.error)).slice(0, 300),
      );
    }

    availableTimes.push(
      ...parsedData.data.collection.map((v) => v.start_time),
    );
  }

  return availableTimes;
}

async function safeReadText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "<unreadable body>";
  }
}

export async function bookEvent(
  eventType: EventType,
  {
    datetime,
    name,
    phone,
    email,
    comment = "",
  }: {
    datetime: ISODatetime;
    name: string;
    phone: string;
    email: string;
    comment?: string;
  },
): Promise<boolean> {
  const body = JSON.stringify({
    event_type: getEventTypeId(eventType),
    start_time: datetime,
    location: {
      kind: "physical",
      location: "Carrer del Concili de Trento, 7, Barcelona",
    },
    invitee: {
      name,
      email,
      timezone: "Europe/Madrid",
      text_reminder_number: phone,
    },
    questions_and_answers: [
      {
        question: "Comment",
        answer: comment,
        // comment must always be the first question in the calendly question form
        position: 0,
      },
    ],
  });

  const response = await fetch(`${CALENDLY_URL}/invitees`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${CALENDLY_TOKEN}`,
      "Content-Type": "application/json",
    },
    body,
  });

  if (response.status !== 201) {
    console.error(
      `Error while creating calendly event ${await response.text()}`,
    );
    return false;
  }

  return true;
}

function getEventTypeId(eventType: EventType): string {
  return CALENDLY_URL + "/event_types/" + EVENT_TYPE_IDS[eventType];
}
