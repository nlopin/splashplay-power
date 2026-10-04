import type { ISODatetime } from "@/types";
import type { AvailableTime } from "@/services/availability/types";
import type { BookingSelection } from "@/services/catalog/bookingSelection";

export type SelectedTimeSlot = ISODatetime;

export const EVENT_TYPE = {
  COUPLES: "couples",
  FAMILY: "family",
  FRIENDS: "friends",
  INDIVIDUAL: "individual",
  OPEN_SESSION: "open_session",
} as const;

export type EventType = (typeof EVENT_TYPE)[keyof typeof EVENT_TYPE];

export function isEventType(value: string): value is EventType {
  return Object.values(EVENT_TYPE).includes(value);
}

export type Availability = AvailableTime[];

// `amount` is for display only; the server prices `selection` itself.
export interface PricingData {
  amount: number;
  guests: number;
  selection: BookingSelection;
}
