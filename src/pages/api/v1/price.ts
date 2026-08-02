import type { APIRoute } from "astro";
import { EVENT_TYPE, isEventType } from "@/components/booking/types";
import {
  INDIVIDUAL_PRICE,
  COUPLES_DEFAULTS,
  calculateCouplesPrice,
  FAMILY_DEFAULTS,
  calculateFamilyPrice,
  FRIENDS_DEFAULTS,
  calculateFriendsPrice,
} from "@/services/pricing";
import { getScheduleSlot } from "@/services/availability/schedule";
import { jsonResponse } from "@/utils/api";
import type { ISODatetime } from "@/types";

export const prerender = false;

class OptionError extends Error {}

function requireInt(raw: string | null, fallback: number, name: string): number {
  if (raw === null) return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) {
    throw new OptionError(`${name} must be a non-negative integer`);
  }
  return n;
}

function requireEnum<T extends string>(
  raw: string | null,
  fallback: T,
  values: readonly T[],
  name: string,
): T {
  if (raw === null) return fallback;
  if (!values.includes(raw as T)) {
    throw new OptionError(`${name} must be one of: ${values.join(", ")}`);
  }
  return raw as T;
}

export const GET: APIRoute = async ({ url }) => {
  const eventTypeParam = url.searchParams.get("eventType");

  if (!eventTypeParam || !isEventType(eventTypeParam)) {
    return jsonResponse(
      {
        error: "Invalid or missing eventType",
        eventTypes: Object.values(EVENT_TYPE),
      },
      400,
    );
  }
  const eventType = eventTypeParam;

  const datetime = url.searchParams.get("datetime");
  if (!datetime || Number.isNaN(new Date(datetime).getTime())) {
    return jsonResponse(
      { error: "datetime must be a valid ISO datetime" },
      400,
    );
  }

  const slot = getScheduleSlot(datetime as ISODatetime);
  if (!slot) {
    return jsonResponse({ error: "datetime is not a valid schedule slot" }, 400);
  }

  let amount: number;
  let resolvedOptions: Record<string, string | number>;

  try {
    switch (eventType) {
      case "individual": {
        amount = INDIVIDUAL_PRICE;
        resolvedOptions = {};
        break;
      }
      case "couples": {
        const pictureType = requireEnum(
          url.searchParams.get("pictureType"),
          COUPLES_DEFAULTS.pictureType,
          ["one_small", "one_big", "individual"] as const,
          "pictureType",
        );
        const activityFormat = requireEnum(
          url.searchParams.get("activityFormat"),
          COUPLES_DEFAULTS.activityFormat,
          ["splash", "pouring"] as const,
          "activityFormat",
        );
        try {
          amount = calculateCouplesPrice(pictureType, activityFormat);
        } catch (err) {
          throw new OptionError(
            err instanceof Error ? err.message : "invalid options",
          );
        }
        resolvedOptions = { pictureType, activityFormat };
        break;
      }
      case "family": {
        const adults = requireInt(
          url.searchParams.get("adults"),
          FAMILY_DEFAULTS.adults,
          "adults",
        );
        const kids = requireInt(
          url.searchParams.get("kids"),
          FAMILY_DEFAULTS.kids,
          "kids",
        );
        const canvases = requireInt(
          url.searchParams.get("canvases"),
          FAMILY_DEFAULTS.canvases,
          "canvases",
        );
        const canvasType = requireEnum(
          url.searchParams.get("canvasType"),
          FAMILY_DEFAULTS.canvasType,
          ["standard", "big"] as const,
          "canvasType",
        );
        const activityFormat = requireEnum(
          url.searchParams.get("activityFormat"),
          FAMILY_DEFAULTS.activityFormat,
          ["splash", "pouring"] as const,
          "activityFormat",
        );
        if (canvasType === "big" && activityFormat !== "splash") {
          throw new OptionError(
            'canvasType "big" is only available for the "splash" activityFormat',
          );
        }
        amount = calculateFamilyPrice(canvases, adults + kids, canvasType);
        resolvedOptions = { adults, kids, canvases, canvasType, activityFormat };
        break;
      }
      case "friends": {
        const guests = requireInt(
          url.searchParams.get("guests"),
          FRIENDS_DEFAULTS.guests,
          "guests",
        );
        const canvases = requireInt(
          url.searchParams.get("canvases"),
          FRIENDS_DEFAULTS.canvases,
          "canvases",
        );
        const canvasType = requireEnum(
          url.searchParams.get("canvasType"),
          FRIENDS_DEFAULTS.canvasType,
          ["standard", "big"] as const,
          "canvasType",
        );
        const activityFormat = requireEnum(
          url.searchParams.get("activityFormat"),
          FRIENDS_DEFAULTS.activityFormat,
          ["splash", "pouring"] as const,
          "activityFormat",
        );
        if (canvasType === "big" && activityFormat !== "splash") {
          throw new OptionError(
            'canvasType "big" is only available for the "splash" activityFormat',
          );
        }
        amount = calculateFriendsPrice(canvases, guests, canvasType);
        resolvedOptions = { guests, canvases, canvasType, activityFormat };
        break;
      }
    }
  } catch (err) {
    if (err instanceof OptionError) {
      return jsonResponse({ error: err.message }, 400);
    }
    throw err;
  }

  const discount = slot.discount;
  const price = discount ? Math.round(amount * (1 - discount / 100)) : amount;

  return jsonResponse({
    price,
    eventType,
    datetime,
    ...resolvedOptions,
  });
};
