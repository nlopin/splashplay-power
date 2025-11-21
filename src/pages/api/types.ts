import * as z from "zod";

export const CreatePaymentSessionPayloadSchema = z.object({
  amount: z.number(),
  productName: z.string(),
  lang: z.string().optional().default("es"),
  fullName: z.string().optional(),
  email: z.email().optional(),
  phone: z.string().optional(),
});

export const CreatePaymentSessionResponseSchema = z.object({
  clientSecret: z.string(),
});
