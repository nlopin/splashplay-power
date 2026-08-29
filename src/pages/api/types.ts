import { EVENT_TYPE } from "@/components/booking/types";
import { DEFAULT_LOCALE } from "@/constants";
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
});

export const CreatePaymentSessionResponseSchema = z.object({
  clientSecret: z.string(),
});
