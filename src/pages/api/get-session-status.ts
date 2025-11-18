import type { APIRoute } from "astro";
import { STRIPE_SECRET_KEY } from "astro:env/server";
import Stripe from "stripe";

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2025-10-29.clover",
});

export const GET: APIRoute = async (ctx) => {
  const requestedSessionId = ctx.url.searchParams.get("session_id");
  if (requestedSessionId === null) {
    return new Response(null, { status: 404 });
  }
  const session = await stripe.checkout.sessions.retrieve(requestedSessionId, {
    expand: ["payment_intent"],
  });

  const paymentIntent =
    typeof session.payment_intent === "object" ? session.payment_intent : null;

  return new Response(
    JSON.stringify({
      status: session.status,
      payment_status: session.payment_status,
      payment_intent_id: paymentIntent?.id,
      payment_intent_status: paymentIntent?.status,
    }),
    {
      headers: {
        "Content-Type": "application/json",
      },
    },
  );
};
