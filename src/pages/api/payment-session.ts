import type { APIRoute } from "astro";
import { createEmbeddedCheckoutSession } from "@/services/checkout/createCheckoutSession";
import { quoteBooking } from "@/services/checkout/quote";
import { CreatePaymentSessionPayloadSchema } from "./types";
import { EVENT_TYPE } from "@/components/booking/types";
import { getSpotsLeft } from "@/services/availability/occupancy";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => null);
  const parseResult = CreatePaymentSessionPayloadSchema.safeParse(body);

  if (!parseResult.success) {
    return jsonResponse({ error: parseResult.error }, 400);
  }

  const { selection, datetime, lang, partner } = parseResult.data;

  const quoted = await quoteBooking({ selection, datetime, lang });
  if (!quoted.ok) {
    return jsonResponse(
      { error: quoted.reason },
      quoted.reason === "slot_unavailable" ? 409 : 400,
    );
  }
  const { quote } = quoted;

  if (selection.eventType === EVENT_TYPE.OPEN_SESSION) {
    const remaining = await getSpotsLeft(quote.datetime);
    if (remaining < quote.guests) {
      return jsonResponse({ error: "slot_full" }, 409);
    }
  }

  const session = await createEmbeddedCheckoutSession({
    amount: quote.amountCents,
    productName: quote.productName,
    guests: quote.guests,
    canvases: quote.canvases,
    datetime: quote.datetime,
    lang,
    eventType: selection.eventType,
    partner,
    origin: new URL(request.url).origin,
  });

  return jsonResponse({ clientSecret: session.client_secret });
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
