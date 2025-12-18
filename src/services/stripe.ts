import type Stripe from "stripe";

export function getPaymentIntentId(session: Stripe.Checkout.Session): string {
  if (session.payment_intent === null) {
    return "";
  }

  if (typeof session.payment_intent === "object") {
    return session.payment_intent.id;
  }

  return session.payment_intent;
}
