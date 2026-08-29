import type { APIRoute } from "astro";
import { createEmbeddedCheckoutSession } from "@/services/checkout/createCheckoutSession";
import { CreatePaymentSessionPayloadSchema } from "./types";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json();
  const parseResult = CreatePaymentSessionPayloadSchema.safeParse(body);

  if (!parseResult.success) {
    return new Response(JSON.stringify({ error: parseResult.error }), {
      status: 400,
    });
  }

  const { amount, productName, guests, datetime, lang, eventType, partner } =
    parseResult.data;
  const origin = new URL(request.url).origin;

  const session = await createEmbeddedCheckoutSession({
    amount,
    productName,
    guests,
    datetime,
    lang,
    eventType,
    partner,
    origin,
  });

  return new Response(
    JSON.stringify({
      clientSecret: session.client_secret,
    }),
  );
};
