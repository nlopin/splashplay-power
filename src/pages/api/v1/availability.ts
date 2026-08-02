import type { APIRoute } from "astro";
import { EVENT_TYPE, isEventType } from "@/components/booking/types";
import { getAvailability } from "@/services/availability";
import { jsonResponse } from "@/utils/api";

export const prerender = false;

const DEFAULT_DAYS = 7;
const MAX_DAYS = 30;

export const GET: APIRoute = async ({ url }) => {
  const eventTypeParam = url.searchParams.get("eventType");

  if (!eventTypeParam || !isEventType(eventTypeParam)) {
    return jsonResponse(
      { error: "Invalid or missing eventType", eventTypes: Object.values(EVENT_TYPE) },
      400,
    );
  }

  const daysParam = url.searchParams.get("days");
  const days = daysParam ? Number(daysParam) : DEFAULT_DAYS;

  if (!Number.isInteger(days) || days < 1 || days > MAX_DAYS) {
    return jsonResponse(
      { error: `days must be an integer between 1 and ${MAX_DAYS}` },
      400,
    );
  }

  const availableTimes = await getAvailability(eventTypeParam, days);
  const slots = availableTimes
    .filter(({ booked }) => !booked)
    .map(({ time }) => ({ time }));

  return jsonResponse({ eventType: eventTypeParam, days, slots });
};
