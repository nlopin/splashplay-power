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
import { bookEvent } from "@/services/calendly";
import { formatEventComment } from "@/components/booking/eventMessage";
import { EVENT_TYPE } from "@/components/booking/types";

export const prerender = false;
const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2025-10-29.clover",
});

const metadataSchema = z.object({
  eventType: z.enum(Object.values(EVENT_TYPE)),
  sessionTime: z.iso.datetime(),
  sessionTitle: z.string(),
});

const customerSchema = z.object({
  email: z.email(),
  name: z.string(),
  phone: z.string(),
});

export const POST: APIRoute = async ({ request }) => {
  const sig = request.headers.get("stripe-signature");
  if (!sig) {
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
    return new Response(
      `Webhook Error: ${err instanceof Error ? err.message : err}`,
      { status: 400 },
    );
  }

  switch (event.type) {
    case "checkout.session.completed":
      // Retrieve the full session from API, webhook payload may not include all fields
      const session = await stripe.checkout.sessions.retrieve(
        event.data.object.id,
      );
      const paymentIntentId = getPaymentIntentId(session);

      const parsedMetadata = metadataSchema.safeParse(session.metadata);
      const parsedCustomer = customerSchema.safeParse(session.customer_details);

      // Book Calendly event
      if (parsedMetadata.success && parsedCustomer.success) {
        if (session.amount_total) {
          await sendPaymentNotification(
            session.amount_total,
            parsedMetadata.data.sessionTitle,
            paymentIntentId,
          );
        }

        const isOk = await bookEvent(parsedMetadata.data.eventType, {
          datetime: parsedMetadata.data.sessionTime,
          email: parsedCustomer.data.email,
          name: parsedCustomer.data.name,
          phone: parsedCustomer.data.phone,
          comment: formatEventComment(
            paymentIntentId,
            parsedMetadata.data.sessionTitle,
          ),
        });

        if (!isOk) {
          console.error("Failed to book Calendly event", session.id);
        }
      } else {
        console.error(
          "event parsing error",
          parsedCustomer.error?.message,
          parsedMetadata.error?.message,
        );
      }

      break;
  }
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

// Send payment notification (sticker + message)
async function sendPaymentNotification(
  amount: number,
  sessionTitle: string,
  transactionId: string,
): Promise<void> {
  try {
    await sendTelegramSticker(
      PAYMENT_SUCCESS_STICKERS[
        Math.floor(Math.random() * PAYMENT_SUCCESS_STICKERS.length)
      ],
    );
    await sendTelegramMessage(
      formatPaymentSuccessMessage(amount, sessionTitle, transactionId),
    );
  } catch (error) {
    console.error("Failed to send payment notification:", error);
  }
}

export function formatPaymentSuccessMessage(
  amount: number,
  sessionTitle: string,
  transactionId: string,
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

  return message;
}
