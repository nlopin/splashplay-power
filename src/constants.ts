import {
  CALENDLY_COUPLES_EVENT_TYPE_ID,
  CALENDLY_FAMILY_EVENT_TYPE_ID,
  CALENDLY_FRIENDS_EVENT_TYPE_ID,
  CALENDLY_INDIVIDUAL_EVENT_TYPE_ID,
} from "astro:env/server";
import type { EventType } from "./components/booking/types";

export const DEFAULT_LOCALE = "es";
export const BUSINESS_TIMEZONE = "Europe/Madrid";

export const EVENT_TYPE_IDS: Record<EventType, string> = {
  couples: CALENDLY_COUPLES_EVENT_TYPE_ID,
  family: CALENDLY_FAMILY_EVENT_TYPE_ID,
  friends: CALENDLY_FRIENDS_EVENT_TYPE_ID,
  individual: CALENDLY_INDIVIDUAL_EVENT_TYPE_ID,
};
