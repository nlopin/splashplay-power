import type { APIRoute } from "astro";
import Stripe from "stripe";
import { STRIPE_SECRET_KEY } from "astro:env/server";
import { CreatePaymentSessionPayloadSchema } from "./types";

export const prerender = false;
const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2025-10-29.clover",
});

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json();
  const parseResult = CreatePaymentSessionPayloadSchema.safeParse(body);

  if (!parseResult.success) {
    return new Response(JSON.stringify({ error: parseResult.error }), {
      status: 400,
    });
  }

  const { amount, productName, datetime, lang, eventType } = parseResult.data;
  const origin = new URL(request.url).origin;
  const returnUrl = `${origin}/${lang}/complete?session_id={CHECKOUT_SESSION_ID}`;

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    ui_mode: "embedded",
    allow_promotion_codes: true,
    locale: lang === "ca" ? "es" : lang, // catalan is not supported
    phone_number_collection: { enabled: true },
    name_collection: {
      individual: {
        enabled: true,
        optional: false,
      },
    },
    metadata: {
      eventType,
      sessionTime: datetime,
      sessionTitle: productName,
    },
    customer_creation: "always",
    line_items: [
      {
        price_data: {
          product_data: {
            name: productName,
          },
          currency: "EUR",
          unit_amount: amount,
        },
        quantity: 1,
      },
    ],
    return_url: returnUrl,
  });

  return new Response(
    JSON.stringify({
      clientSecret: session.client_secret,
    }),
  );
};
