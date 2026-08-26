import { Stripe } from "stripe";
import type { APIRoute } from "astro";
import * as z from "zod";
import { STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET_KEY } from "astro:env/server";

import {
  escapeMarkdown,
  sendTelegramMessage,
  sendTelegramSticker,
} from "@/services/telegram";
import { getPaymentIntentId } from "@/services/stripe";
import { bookEvent, type BookEventResult } from "@/services/calendly";
import { formatEventComment } from "@/components/booking/eventMessage";
import { EVENT_TYPE } from "@/components/booking/types";
import { createEvent, logEvent, updateEvent } from "@/services/logger";
import { storePartnerBooking } from "@/services/partners";

export const prerender = false;
const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2026-07-29.preview",
});

type StripeWebhookEventData = {
  status: string;
  stripeEventType: string | undefined;
  sessionId: string | undefined;
  paymentIntentId: string | undefined;
  amountTotal: number | null | undefined;
  eventType: string | undefined;
  sessionTitle: string | undefined;
  sessionTime: string | undefined;
  customerEmail: string | undefined;
  customerName: string | undefined;
  calendlyBookingSuccess: boolean | undefined;
  notificationSent: boolean | undefined;
  partnerKey: string | undefined;
  partnerStored: boolean | undefined;
  error: string | undefined;
  durationMs: number;
};

const metadataSchema = z.object({
  eventType: z.enum(Object.values(EVENT_TYPE)),
  sessionTime: z.iso.datetime({ offset: true }),
  sessionTitle: z.string(),
  guests: z.coerce.number().int().positive(),
  partner: z.string().optional(),
});

const customerSchema = z.object({
  email: z.email(),
  name: z.string(),
  phone: z.string(),
});

export const POST: APIRoute = async ({ request }) => {
  const startTime = Date.now();
  const eventData: StripeWebhookEventData = {
    status: "started",
    stripeEventType: undefined,
    sessionId: undefined,
    paymentIntentId: undefined,
    amountTotal: undefined,
    eventType: undefined,
    sessionTitle: undefined,
    sessionTime: undefined,
    customerEmail: undefined,
    customerName: undefined,
    calendlyBookingSuccess: undefined,
    notificationSent: undefined,
    partnerKey: undefined,
    partnerStored: undefined,
    error: undefined,
    durationMs: 0,
  };
  const webhookEvent = createEvent("stripe_webhook", eventData);

  const sig = request.headers.get("stripe-signature");
  if (!sig) {
    logEvent(
      updateEvent(webhookEvent, {
        status: "error",
        error: "Signature not found",
        durationMs: Date.now() - startTime,
      }),
    );
    return new Response("Webhook Error: Signature not found", { status: 400 });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      await request.text(),
      sig,
      STRIPE_WEBHOOK_SECRET_KEY,
    );
  } catch (err) {
    logEvent(
      updateEvent(webhookEvent, {
        status: "error",
        error: err instanceof Error ? err.message : "Unknown error",
        durationMs: Date.now() - startTime,
      }),
    );
    return new Response(
      `Webhook Error: ${err instanceof Error ? err.message : err}`,
      { status: 400 },
    );
  }

  updateEvent(webhookEvent, { stripeEventType: event.type });

  switch (event.type) {
    case "checkout.session.completed":
      const session = await stripe.checkout.sessions.retrieve(
        event.data.object.id,
      );
      const paymentIntentId = getPaymentIntentId(session);

      updateEvent(webhookEvent, {
        sessionId: session.id,
        paymentIntentId,
        amountTotal: session.amount_total,
      });

      const parsedMetadata = metadataSchema.safeParse(session.metadata);
      const parsedCustomer = customerSchema.safeParse(session.customer_details);

      if (parsedMetadata.success && parsedCustomer.success) {
        updateEvent(webhookEvent, {
          eventType: parsedMetadata.data.eventType,
          sessionTitle: parsedMetadata.data.sessionTitle,
          sessionTime: parsedMetadata.data.sessionTime,
          customerEmail: parsedCustomer.data.email,
          customerName: parsedCustomer.data.name,
        });

        // store puchase via partner before creating a booking to guarantee it will be read in Calendly webhook
        if (parsedMetadata.data.partner) {
          const isPartnerStored = await storePartnerBooking(paymentIntentId, {
            partnerKey: parsedMetadata.data.partner,
            price: session.amount_total ?? 0,
            guests: parsedMetadata.data.guests,
          });

          updateEvent(webhookEvent, {
            partnerKey: parsedMetadata.data.partner,
            partnerStored: isPartnerStored,
          });
        }

        const calendlyResult = await bookEvent(parsedMetadata.data.eventType, {
          datetime: parsedMetadata.data.sessionTime,
          email: parsedCustomer.data.email,
          name: parsedCustomer.data.name,
          phone: parsedCustomer.data.phone.startsWith("+")
            ? parsedCustomer.data.phone
            : `+34${parsedCustomer.data.phone}`,
          comment: formatEventComment(
            paymentIntentId,
            parsedMetadata.data.sessionTitle,
          ),
        });

        updateEvent(webhookEvent, {
          calendlyBookingSuccess: calendlyResult.success,
          status: calendlyResult.success
            ? "success"
            : "calendly_booking_failed",
        });

        if (session.amount_total) {
          updateEvent(webhookEvent, {
            notificationSent: await sendPaymentNotification(
              session.amount_total,
              parsedMetadata.data.sessionTitle,
              paymentIntentId,
              calendlyResult,
            ),
          });
        }
      } else {
        updateEvent(webhookEvent, {
          status: "parsing_error",
          error: [parsedCustomer.error?.message, parsedMetadata.error?.message]
            .filter(Boolean)
            .join("; "),
        });
      }

      break;
  }

  logEvent(updateEvent(webhookEvent, { durationMs: Date.now() - startTime }));
  return new Response(JSON.stringify({ received: true }), { status: 200 });
};

const PAYMENT_SUCCESS_STICKERS: Readonly<Array<string>> = [
  "CAACAgIAAxkBAAMFaTNYePmlrNHkc5VM5tMuZZB7lRwAAlYBAAIOJwwFKG2zp5BXJ8g2BA",
  "CAACAgEAAxkBAAMQaUBWHNOqbDTPOFtMrSdZbTBTNvsAAi4BAAL9CpAE1mHiF4Wfccc2BA",
  "CAACAgEAAxkBAAMRaUBWJJYhXAK78_prVRkYPCyzQdYAAp4BAAL9CpAEd56LO1ffyT42BA",
  "CAACAgIAAxkBAAMSaUBWMsmrBcnypdu4h5CbSGSNrWcAAn4dAAKhFnlLR--GTeP0ubM2BA",
  "CAACAgIAAxkBAAMTaUBWOGm8qbSmioO7ZFSb26jftBYAAoMZAALn7QhIKibTwGhK8LU2BA",
  "CAACAgIAAxkBAAMUaUBWRhR35087lhro3fsDcP5l7ggAAmcBAAIOJwwFTwf4IYEgPNY2BA",
  "CAACAgQAAxkBAAMVaUBWZF9PXxzGQwLoKu2jOsX6ZK4AAkoCAAK3Vj8AAcIlLY_0JKpKNgQ",
  "CAACAgIAAxkBAAMWaUBWcnoQ-J064y3ukjVsxL33ICkAAuAcAAI9OhFIRLpeZp_sx6k2BA",
  "CAACAgIAAxkBAAMXaUBWkw1wvVrqRL_3d1jST4GaZH8AAlwBAAI9DegEAAEyy_vxsi0ENgQ",
  "CAACAgIAAxkBAAMYaUBWmNaUqt9hQqksac_SF3HKRUcAAl0BAAI9DegEKNM9H_ZQfmU2BA",
];

async function sendPaymentNotification(
  amount: number,
  sessionTitle: string,
  transactionId: string,
  calendlyResult: BookEventResult,
): Promise<boolean> {
  try {
    await sendTelegramSticker(
      PAYMENT_SUCCESS_STICKERS[
        Math.floor(Math.random() * PAYMENT_SUCCESS_STICKERS.length)
      ],
    );
    await sendTelegramMessage(
      formatPaymentSuccessMessage(
        amount,
        sessionTitle,
        transactionId,
        calendlyResult,
      ),
    );
    return true;
  } catch {
    return false;
  }
}

export function formatPaymentSuccessMessage(
  amount: number,
  sessionTitle: string,
  transactionId: string,
  calendlyResult: BookEventResult,
): string {
  const formattedAmount = (amount / 100).toFixed(2);

  let message = `💰 *New Payment Received!*\n\n`;
  message += `Amount: *${formattedAmount} €*\n`;

  if (sessionTitle) {
    message += `Event: ${escapeMarkdown(sessionTitle)}\n`;
  }

  if (transactionId) {
    message += `Transaction ID: [${escapeMarkdown(transactionId)}](https://dashboard.stripe.com/acct_1QyrutG3Vb6TnG9U/payments/${transactionId})\n`;
  }

  message += `\nStatus: ✅ Payment Successful`;

  if (calendlyResult.success) {
    message += `\nBooking: ✅ Calendly event created`;
  } else {
    message += `\nBooking: ❌ Calendly booking failed`;
    if (calendlyResult.error) {
      message += `\nReason: ${escapeMarkdown(calendlyResult.error)}`;
    }
  }

  return message;
}
