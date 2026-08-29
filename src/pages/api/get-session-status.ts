import type { APIRoute } from "astro";
import { getCheckoutSessionStatus } from "@/services/checkout/status";

export const prerender = false;

export const GET: APIRoute = async (ctx) => {
  const requestedSessionId = ctx.url.searchParams.get("session_id");
  if (requestedSessionId === null) {
    return new Response(null, { status: 404 });
  }

  const status = await getCheckoutSessionStatus(requestedSessionId);

  return new Response(
    JSON.stringify({
      status: status.status,
      payment_status: status.paymentStatus,
      payment_intent_id: status.paymentIntentId,
      payment_intent_status: status.paymentIntentStatus,
    }),
    {
      headers: {
        "Content-Type": "application/json",
      },
    },
  );
};
