import type { APIRoute } from "astro";
import { createEmbeddedCheckoutSession } from "@/services/checkout/createCheckoutSession";
import { CreatePaymentSessionPayloadSchema } from "./types";
import { EVENT_TYPE } from "@/components/booking/types";
import { getPriceCents } from "@/services/catalog/pricing";
import {
  cartFromTicketAndGuests,
  isOpenSessionTicket,
  isValidOpenSessionCart,
  openSessionPeople,
} from "@/services/catalog/openSessionPricing";
import { getSpotsLeft } from "@/services/availability/occupancy";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json();
  const parseResult = CreatePaymentSessionPayloadSchema.safeParse(body);

  if (!parseResult.success) {
    return new Response(JSON.stringify({ error: parseResult.error }), {
      status: 400,
    });
  }

  let { amount, productName, guests, datetime, lang, eventType, partner } =
    parseResult.data;
  const { openTicket, openCart: rawCart } = parseResult.data;
  const origin = new URL(request.url).origin;

  if (eventType === EVENT_TYPE.OPEN_SESSION) {
    const cart =
      rawCart ??
      (isOpenSessionTicket(openTicket)
        ? cartFromTicketAndGuests(openTicket, guests)
        : null);
    if (!cart || !isValidOpenSessionCart(cart)) {
      return new Response(
        JSON.stringify({ error: "open session cart is invalid" }),
        { status: 400 },
      );
    }
    if (openSessionPeople(cart) !== guests) {
      return new Response(
        JSON.stringify({ error: "guests do not match ticket" }),
        { status: 400 },
      );
    }
    amount = getPriceCents(eventType, { guests, openCart: cart });
    const remaining = await getSpotsLeft(datetime);
    if (remaining < guests) {
      return new Response(JSON.stringify({ error: "slot_full" }), {
        status: 409,
      });
    }
  }

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
