import { DEFAULT_LOCALE } from "@/constants";
import { BookingSelectionSchema } from "@/services/catalog/bookingSelection";
import * as z from "zod";

// No amount or product name: the server prices the selection itself.
export const CreatePaymentSessionPayloadSchema = z.object({
  selection: BookingSelectionSchema,
  datetime: z.iso.datetime({ offset: true }),
  lang: z.enum(["es", "ca", "en", "fr"]).optional().default(DEFAULT_LOCALE),
  // lookup key, validated against allowlist server-side
  partner: z.string().optional(),
});

export const CreatePaymentSessionResponseSchema = z.object({
  clientSecret: z.string(),
  amountCents: z.number().int().nonnegative(),
});
