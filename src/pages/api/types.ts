import { EVENT_TYPE } from "@/components/booking/types";
import * as z from "zod";

export const CreatePaymentSessionPayloadSchema = z.object({
  amount: z.number(),
  productName: z.string(),
  datetime: z.iso.datetime(),
  eventType: z.enum(Object.values(EVENT_TYPE)),
  lang: z.enum(["es", "ca", "en"]).optional().default("es"),
  fullName: z.string().optional(),
  email: z.email().optional(),
  phone: z.string().optional(),
});

export const CreatePaymentSessionResponseSchema = z.object({
  clientSecret: z.string(),
});
