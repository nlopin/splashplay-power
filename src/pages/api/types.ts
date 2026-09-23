import { EVENT_TYPE } from "@/components/booking/types";
import { DEFAULT_LOCALE } from "@/constants";
import {
  OPEN_SESSION_CAPACITY,
  OPEN_SESSION_TICKETS,
  openSessionPeople,
} from "@/services/catalog/openSessionPricing";
import * as z from "zod";

export const CreatePaymentSessionPayloadSchema = z.object({
  amount: z.number(),
  productName: z.string(),
  guests: z.number().int().positive(),
  datetime: z.iso.datetime({ offset: true }),
  eventType: z.enum(Object.values(EVENT_TYPE)),
  lang: z.enum(["es", "ca", "en", "fr"]).optional().default(DEFAULT_LOCALE),
  fullName: z.string().optional(),
  email: z.email().optional(),
  phone: z.string().optional(),
  // lookup key, validated against allowlist server-side
  partner: z.string().optional(),
  openTicket: z.enum(OPEN_SESSION_TICKETS).optional(),
  openCart: z
    .object({
      solo: z.number().int().min(0),
      pair_shared: z.number().int().min(0),
      pair_two: z.number().int().min(0),
    })
    .refine(
      (cart) => {
        const people = openSessionPeople(cart);
        return people >= 1 && people <= OPEN_SESSION_CAPACITY;
      },
      {
        message: `open session cart must hold 1-${OPEN_SESSION_CAPACITY} people`,
      },
    )
    .optional(),
});

export const CreatePaymentSessionResponseSchema = z.object({
  clientSecret: z.string(),
});
