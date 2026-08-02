import type { ISODatetime } from "@/types";
import type { AvailableTime } from "@/services/availability/types";

export type SelectedTimeSlot = ISODatetime;

export const EVENT_TYPE = {
  COUPLES: "couples",
  FAMILY: "family",
  FRIENDS: "friends",
  INDIVIDUAL: "individual"
} as const;

export type EventType = (typeof EVENT_TYPE)[keyof typeof EVENT_TYPE];

export function isEventType(value: string): value is EventType {
  return Object.values(EVENT_TYPE).includes(value);
}

export type Availability = AvailableTime[];

// todo: review if needed
export interface PricingData {
  amount: number;
  productName: string;
}
