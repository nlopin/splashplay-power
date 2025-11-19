import type { APIRoute } from "astro";
import Stripe from "stripe";
import { STRIPE_SECRET_KEY } from "astro:env/server";
import * as z from "zod"

export const prerender = false;
const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2025-10-29.clover",
});

const requestPayloadSchema = z.object({
  amount: z.number(),
  productName: z.string(),
});

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json();
  const parseResult = requestPayloadSchema.safeParse(body);

  if (!parseResult.success) {
    return new Response(JSON.stringify({ error: parseResult.error }), {
      status: 400,
    });
  }

  const { amount, productName } = parseResult.data;
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    ui_mode: "custom",
    billing_address_collection: "auto",
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
    return_url: `https://splashplay.es/complete?session_id={CHECKOUT_SESSION_ID}`,
  });

  return new Response(JSON.stringify({ clientSecret: session.client_secret }));
};
