import { EVENT_TYPE, type EventType } from "@/components/booking/types";

export type GuestBounds = { min: number; max: number };

// Manually mirrors the MIN/MAX constants in the booking widget
// (src/components/booking/eventTypeOptions/*.tsx) — not derived from them.
export const GUEST_BOUNDS: Record<EventType, GuestBounds> = {
  [EVENT_TYPE.COUPLES]: { min: 2, max: 2 }, // CouplesOptions always books for a pair
  [EVENT_TYPE.FAMILY]: { min: 1, max: 6 },
  [EVENT_TYPE.FRIENDS]: { min: 1, max: 6 },
  [EVENT_TYPE.INDIVIDUAL]: { min: 1, max: 1 },
};

// Minutes. Sourced from the "<strong>X h</strong> | ..." details shown on the
// marketing pages (home.activity_1_details in the locale files — the default
// Splash/Pouring format). Individual sessions have no published duration;
// 60 is a conservative placeholder pending real content.
export const DURATION_MINUTES: Record<EventType, number> = {
  [EVENT_TYPE.COUPLES]: 90,
  [EVENT_TYPE.FAMILY]: 90,
  [EVENT_TYPE.FRIENDS]: 90,
  [EVENT_TYPE.INDIVIDUAL]: 60,
};
