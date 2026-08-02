import type { APIRoute } from "astro";
import { EVENT_TYPE, type EventType } from "@/components/booking/types";
import { EVENT_TYPE_PRICE_OPTIONS } from "@/services/pricing";
import { getPageTranslations } from "@/utils/i18n";
import { jsonResponse } from "@/utils/api";

export const prerender = false;

const LABEL_KEY_BY_EVENT_TYPE: Record<EventType, string> = {
  individual: "individual_session",
  couples: "creative_date",
  family: "family_session",
  friends: "friends_session",
  throw_paint: "throw_paint_session",
  customize_clothes: "customize_clothes_session",
};

export const GET: APIRoute = async ({ url }) => {
  const lang = url.searchParams.get("lang") ?? undefined;
  const translations = getPageTranslations(lang, "book") as Record<
    string,
    string
  >;

  const eventTypes = Object.values(EVENT_TYPE).map((key) => ({
    key,
    label: translations[LABEL_KEY_BY_EVENT_TYPE[key]],
    options: EVENT_TYPE_PRICE_OPTIONS[key],
  }));

  return jsonResponse({ eventTypes });
};
