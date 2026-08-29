import Stripe from "stripe";
import { STRIPE_SECRET_KEY } from "astro:env/server";
import { isKnownPartner } from "@/services/partners";
import type { EventType } from "@/components/booking/types";
import type { Language } from "@/utils/i18n";
import { getBookingPath } from "@/services/catalog/experiences";

export const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2026-07-29.preview",
});

export type CheckoutSessionInput = {
  amount: number;
  productName: string;
  guests: number;
  datetime: string;
  lang: Language;
  eventType: EventType;
  partner?: string | null;
  origin: string;
};

function getKnownPartner(maybePartner: string | undefined | null): string | null {
  if (!maybePartner) return null;

  if (!isKnownPartner(maybePartner)) {
    console.debug(`Unknown partner key, ignoring: ${maybePartner}`);
    return null;
  }

  return maybePartner;
}

function baseSessionParams(
  input: CheckoutSessionInput,
): Stripe.Checkout.SessionCreateParams {
  const partner = getKnownPartner(input.partner);
  return {
    mode: "payment",
    allow_promotion_codes: true,
    locale: input.lang === "ca" ? "es" : input.lang, // catalan is not supported
    phone_number_collection: { enabled: true },
    name_collection: {
      individual: {
        enabled: true,
        optional: false,
      },
    },
    metadata: {
      eventType: input.eventType,
      sessionTime: input.datetime,
      sessionTitle: input.productName,
      guests: String(input.guests),
      // Omitted entirely (not sent as null) when there's no partner — the MCP
      // checkout tool never has one, and most website bookings don't either.
      ...(partner ? { partner } : {}),
    },
    customer_creation: "always",
    line_items: [
      {
        price_data: {
          product_data: {
            name: input.productName,
          },
          currency: "EUR",
          unit_amount: input.amount,
        },
        quantity: 1,
      },
    ],
  };
}

/** Embedded Checkout Session, rendered in-page by the on-site booking widget. */
export async function createEmbeddedCheckoutSession(
  input: CheckoutSessionInput,
): Promise<Stripe.Checkout.Session> {
  return stripe.checkout.sessions.create({
    ...baseSessionParams(input),
    ui_mode: "embedded_page",
    return_url: `${input.origin}/${input.lang}/complete?session_id={CHECKOUT_SESSION_ID}`,
  });
}

/** Hosted Checkout Session — for clients that can't embed an iframe (e.g. the MCP checkout tool); redirects out and back. */
export async function createHostedCheckoutSession(
  input: CheckoutSessionInput,
): Promise<Stripe.Checkout.Session> {
  return stripe.checkout.sessions.create({
    ...baseSessionParams(input),
    success_url: `${input.origin}/${input.lang}/complete?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${input.origin}/${input.lang}/${getBookingPath(input.eventType)}`,
  });
}
