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
import { createEvent, logEvent } from "@/services/logger";

export const prerender = false;
const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2025-10-29.clover",
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
  error: string | undefined;
  durationMs: number;
};

const metadataSchema = z.object({
  eventType: z.enum(Object.values(EVENT_TYPE)),
  sessionTime: z.iso.datetime({ offset: true }),
  sessionTitle: z.string(),
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
    error: undefined,
    durationMs: 0,
  };
  const webhookEvent = createEvent("stripe_webhook", eventData);

  const sig = request.headers.get("stripe-signature");
  if (!sig) {
    webhookEvent.status = "error";
    webhookEvent.error = "Signature not found";
    webhookEvent.durationMs = Date.now() - startTime;
    logEvent(webhookEvent);
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
    webhookEvent.status = "error";
    webhookEvent.error = err instanceof Error ? err.message : "Unknown error";
    webhookEvent.durationMs = Date.now() - startTime;
    logEvent(webhookEvent);
    return new Response(
      `Webhook Error: ${err instanceof Error ? err.message : err}`,
      { status: 400 },
    );
  }

  webhookEvent.stripeEventType = event.type;

  switch (event.type) {
    case "checkout.session.completed":
      const session = await stripe.checkout.sessions.retrieve(
        event.data.object.id,
      );
      const paymentIntentId = getPaymentIntentId(session);

      webhookEvent.sessionId = session.id;
      webhookEvent.paymentIntentId = paymentIntentId;
      webhookEvent.amountTotal = session.amount_total;

      const parsedMetadata = metadataSchema.safeParse(session.metadata);
      const parsedCustomer = customerSchema.safeParse(session.customer_details);

      if (parsedMetadata.success && parsedCustomer.success) {
        webhookEvent.eventType = parsedMetadata.data.eventType;
        webhookEvent.sessionTitle = parsedMetadata.data.sessionTitle;
        webhookEvent.sessionTime = parsedMetadata.data.sessionTime;
        webhookEvent.customerEmail = parsedCustomer.data.email;
        webhookEvent.customerName = parsedCustomer.data.name;

        const calendlyResult = await bookEvent(parsedMetadata.data.eventType, {
          datetime: parsedMetadata.data.sessionTime,
          email: parsedCustomer.data.email,
          name: parsedCustomer.data.name,
          phone: parsedCustomer.data.phone,
          comment: formatEventComment(
            paymentIntentId,
            parsedMetadata.data.sessionTitle,
          ),
        });

        webhookEvent.calendlyBookingSuccess = calendlyResult.success;
        webhookEvent.status = calendlyResult.success
          ? "success"
          : "calendly_booking_failed";

        if (session.amount_total) {
          webhookEvent.notificationSent = await sendPaymentNotification(
            session.amount_total,
            parsedMetadata.data.sessionTitle,
            paymentIntentId,
            calendlyResult,
          );
        }
      } else {
        webhookEvent.status = "parsing_error";
        webhookEvent.error = [
          parsedCustomer.error?.message,
          parsedMetadata.error?.message,
        ]
          .filter(Boolean)
          .join("; ");
      }

      break;
  }

  webhookEvent.durationMs = Date.now() - startTime;
  logEvent(webhookEvent);
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
