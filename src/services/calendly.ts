import * as z from "zod";
import {
  CALENDLY_TOKEN,
  CALENDLY_COUPLES_EVENT_TYPE_ID,
  CALENDLY_FAMILY_EVENT_TYPE_ID,
  CALENDLY_FRIENDS_EVENT_TYPE_ID,
  CALENDLY_INDIVIDUAL_EVENT_TYPE_ID,
  CALENDLY_OPEN_SESSION_EVENT_TYPE_ID,
} from "astro:env/server";

import { type EventType } from "@/components/booking/types";
import { type ISODatetime } from "@/types";
import { getSunday } from "@/utils/datetime";

export type BookEventResult =
  | { success: true }
  | { success: false; error: string };

const CALENDLY_URL = "https://api.calendly.com";
const EVENT_TYPE_IDS: Record<EventType, string> = {
  couples: CALENDLY_COUPLES_EVENT_TYPE_ID,
  family: CALENDLY_FAMILY_EVENT_TYPE_ID,
  friends: CALENDLY_FRIENDS_EVENT_TYPE_ID,
  individual: CALENDLY_INDIVIDUAL_EVENT_TYPE_ID,
  open_session: CALENDLY_OPEN_SESSION_EVENT_TYPE_ID,
};
const BOOK_IN_ADVANCE = 45;
const BATCH_SIZE_IN_DAYS = 7;
const MILLISECONDS_IN_ONE_DAY = 24 * 60 * 60 * 1000;

const EventTypeAvailableTimesSchema = z.looseObject({
  collection: z.array(
    z.object({
      invitees_remaining: z.number(),
      scheduling_url: z.string(),
      start_time: z.iso.datetime({ offset: true }),
      status: z.string(),
    }),
  ),
});

/**
 * Fetch available times from Calendly API
 */
export async function fetchAvailability(
  eventType: EventType,
  days = BOOK_IN_ADVANCE,
): Promise<
  { success: true; availableTimes: ISODatetime[] } | { success: false }
> {
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
  const availableTimes: ISODatetime[] = [];

  try {
    const responses = await Promise.all(fetchPromises);

    for (const response of responses) {
      if (response.status === 200) {
        const responseJson = await response.json();
        const parsedData =
          EventTypeAvailableTimesSchema.safeParse(responseJson);
        if (parsedData.success) {
          availableTimes.push(
            ...parsedData.data.collection.map((v) => v.start_time),
          );
        } else {
          console.error(
            "Unexpected server answer",
            z.flattenError(parsedData.error),
            responseJson,
          );
          return { success: false };
        }
      } else {
        const errorText = await response.text();
        console.error(
          `Calendly API error for ${eventType}: HTTP ${response.status}: ${errorText}`,
        );
        return { success: false };
      }
    }
  } catch (err) {
    console.error(
      `Couldn't fetch available time for event type: ${eventType}`,
      err instanceof Error ? err.message : String(err),
    );
    return { success: false };
  }

  return { success: true, availableTimes };
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
): Promise<BookEventResult> {
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
    const errorText = await response.text();
    console.error(`Error while creating calendly event ${errorText}`);
    return { success: false, error: errorText };
  }

  return { success: true };
}

const PaginationSchema = z.looseObject({
  next_page_token: z.string().nullable().optional(),
});

const CurrentUserSchema = z.looseObject({
  resource: z.looseObject({ current_organization: z.string() }),
});

const ScheduledEventsSchema = z.looseObject({
  collection: z.array(
    z.looseObject({
      uri: z.string(),
      start_time: z.iso.datetime({ offset: true }),
      event_type: z.string(),
    }),
  ),
  pagination: PaginationSchema,
});

const InviteesSchema = z.looseObject({
  collection: z.array(
    z.looseObject({
      uri: z.string(),
      questions_and_answers: z
        .array(z.looseObject({ answer: z.string() }))
        .optional(),
    }),
  ),
  pagination: PaginationSchema,
});

export type ActiveInvitee = {
  startTime: ISODatetime;
  inviteeUri: string;
  // Answer to the first booking question; our checkout puts the
  // "Transaction ID: …" comment there.
  comment: string;
};

async function calendlyGet<T>(url: string, schema: z.ZodType<T>): Promise<T> {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${CALENDLY_TOKEN}` },
  });
  if (response.status !== 200) {
    throw new Error(
      `Calendly API error for ${url}: HTTP ${response.status}: ${await response.text()}`,
    );
  }
  const parsed = schema.safeParse(await response.json());
  if (!parsed.success) {
    throw new Error(
      `Unexpected Calendly response for ${url}: ${parsed.error.message}`,
    );
  }
  return parsed.data;
}

/** Follow `next_page_token` until the collection is exhausted. */
async function calendlyGetAll<T>(
  url: string,
  params: URLSearchParams,
  schema: z.ZodType<{
    collection: T[];
    pagination: { next_page_token?: string | null };
  }>,
): Promise<T[]> {
  const items: T[] = [];
  let pageToken: string | null | undefined;
  do {
    const pageParams = new URLSearchParams(params);
    if (pageToken) pageParams.set("page_token", pageToken);
    const page = await calendlyGet(`${url}?${pageParams}`, schema);
    items.push(...page.collection);
    pageToken = page.pagination.next_page_token;
  } while (pageToken);
  return items;
}

/**
 * Every active invitee of `eventType` events starting in [from, to].
 * Throws on any API or parsing failure: a partial list must never be
 * mistaken for "these are all the bookings".
 */
export async function listActiveInvitees(
  eventType: EventType,
  from: Date,
  to: Date,
): Promise<ActiveInvitee[]> {
  const me = await calendlyGet(`${CALENDLY_URL}/users/me`, CurrentUserSchema);
  const events = await calendlyGetAll(
    `${CALENDLY_URL}/scheduled_events`,
    new URLSearchParams({
      organization: me.resource.current_organization,
      status: "active",
      min_start_time: from.toISOString(),
      max_start_time: to.toISOString(),
      count: "100",
    }),
    ScheduledEventsSchema,
  );

  const invitees: ActiveInvitee[] = [];
  for (const event of events) {
    if (!isCalendlyEventType(event.event_type, eventType)) continue;
    const eventInvitees = await calendlyGetAll(
      `${event.uri}/invitees`,
      new URLSearchParams({ status: "active", count: "100" }),
      InviteesSchema,
    );
    for (const invitee of eventInvitees) {
      invitees.push({
        startTime: event.start_time,
        inviteeUri: invitee.uri,
        comment: invitee.questions_and_answers?.at(0)?.answer ?? "",
      });
    }
  }
  return invitees;
}

/** Whether a Calendly event type URI (as sent in webhooks) is `eventType`. */
export function isCalendlyEventType(
  uri: string,
  eventType: EventType,
): boolean {
  return uri === getEventTypeId(eventType);
}

function getEventTypeId(eventType: EventType): string {
  return CALENDLY_URL + "/event_types/" + EVENT_TYPE_IDS[eventType];
}
