import * as z from "zod";
import {
  CALENDLY_TOKEN,
  CALENDLY_COUPLES_EVENT_TYPE_ID,
  CALENDLY_FAMILY_EVENT_TYPE_ID,
  CALENDLY_FRIENDS_EVENT_TYPE_ID,
  CALENDLY_INDIVIDUAL_EVENT_TYPE_ID,
} from "astro:env/server";

import type { EventType } from "@/components/booking/types";
import { type ISODatetime } from "@/types";
import { getSunday } from "@/utils/datetime";

const CALENDLY_URL = "https://api.calendly.com";
const EVENT_TYPE_IDS: Record<EventType, string> = {
  couples: CALENDLY_COUPLES_EVENT_TYPE_ID,
  family: CALENDLY_FAMILY_EVENT_TYPE_ID,
  friends: CALENDLY_FRIENDS_EVENT_TYPE_ID,
  individual: CALENDLY_INDIVIDUAL_EVENT_TYPE_ID,
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

let cache: Record<
  EventType,
  {
    data: z.infer<typeof EventTypeAvailableTimesSchema>["collection"];
    timestamp: number;
  } | null
> = {
  couples: null,
  family: null,
  friends: null,
  individual: null,
};

const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

export function resetCache(eventType?: EventType) {
  if (eventType) {
    cache[eventType] = null;
  } else {
    cache = {
      couples: null,
      family: null,
      friends: null,
      individual: null,
    };
  }
}

// requests available times from today + n days, rouded up to get full weeks
export async function getAvailableTime(
  eventType: EventType,
  days = BOOK_IN_ADVANCE,
) {
  const eventCache = cache[eventType];
  if (eventCache && Date.now() - eventCache.timestamp < CACHE_DURATION) {
    console.log(`Cache hit for ${eventType}`);
    return eventCache.data;
  }

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
  const availableTimes: z.infer<
    typeof EventTypeAvailableTimesSchema
  >["collection"] = [];

  for (const response of responses) {
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

  cache[eventType] = {
    data: availableTimes,
    timestamp: Date.now(),
  };

  return availableTimes;
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
