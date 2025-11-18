import type { APIRoute } from "astro";
import Stripe from "stripe";
import { STRIPE_SECRET_KEY } from "astro:env/server";

export const prerender = false;
const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2025-10-29.clover",
});

export const POST: APIRoute = async () => {
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    ui_mode: "custom",
    billing_address_collection: "auto",
    line_items: [
      {
        price_data: {
          product_data: {
            name: "Session",
          },
          currency: "EUR",
          unit_amount: 6000, // 60 eur
        },
        quantity: 1,
      },
    ],
    return_url: `https://splashplay.es/complete?session_id={CHECKOUT_SESSION_ID}`,
  });

  return new Response(JSON.stringify({ clientSecret: session.client_secret }));
};
