import { type ISODatetime } from "@/types";

export type Discount = 10 | 20;

export type AvailableTime = { time: ISODatetime; discount?: Discount; booked?: true };
