import { stripe } from "./createCheckoutSession";

export type CheckoutSessionStatus = {
  status: string | null;
  paymentStatus: string;
  paymentIntentId: string | undefined;
  paymentIntentStatus: string | undefined;
};

/** Shared by GET /api/get-session-status and the get_booking_status MCP tool. */
export async function getCheckoutSessionStatus(
  sessionId: string,
): Promise<CheckoutSessionStatus> {
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["payment_intent"],
  });

  const paymentIntent =
    typeof session.payment_intent === "object" ? session.payment_intent : null;

  return {
    status: session.status,
    paymentStatus: session.payment_status,
    paymentIntentId: paymentIntent?.id,
    paymentIntentStatus: paymentIntent?.status,
  };
}
