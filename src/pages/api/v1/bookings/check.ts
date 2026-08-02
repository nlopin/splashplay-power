import type { APIRoute } from "astro";
import { EVENT_TYPE, isEventType } from "@/components/booking/types";
import { getAvailability } from "@/services/availability";
import {
  formatBusinessDate,
  isSameBusinessDate,
} from "@/services/availability/schedule";
import { addDay } from "@/utils/datetime";
import { jsonResponse } from "@/utils/api";

export const prerender = false;

const MAX_DAYS = 30;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const GET: APIRoute = async ({ url }) => {
  const eventTypeParam = url.searchParams.get("eventType");

  if (!eventTypeParam || !isEventType(eventTypeParam)) {
    return jsonResponse(
      { error: "Invalid or missing eventType", eventTypes: Object.values(EVENT_TYPE) },
      400,
    );
  }

  const date = url.searchParams.get("date");

  if (!date || !DATE_RE.test(date)) {
    return jsonResponse({ error: "date must be in YYYY-MM-DD format" }, 400);
  }

  const now = new Date();
  const today = formatBusinessDate(now);
  const maxDate = formatBusinessDate(addDay(now, MAX_DAYS));

  if (date < today || date > maxDate) {
    return jsonResponse(
      { error: `date must be between ${today} and ${maxDate}` },
      400,
    );
  }

  const availableTimes = await getAvailability(eventTypeParam, MAX_DAYS);
  const slots = availableTimes
    .filter(({ time, booked }) => !booked && isSameBusinessDate(time, date))
    .map(({ time }) => ({ time }));

  return jsonResponse({ eventType: eventTypeParam, date, slots });
};
