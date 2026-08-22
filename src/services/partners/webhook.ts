import * as crypto from "crypto";
import type { Partner } from "./registry";

const DELIVERY_TIMEOUT_MS = 5000;

export type PartnerBookingPayload = {
  event: "booking.created" | "booking.cancelled";
  // Our internal transactionId (Stripe payment intent id) — named bookingId
  // on the wire since partners shouldn't need to know it's a Stripe id.
  bookingId: string;
  sessionTitle: string;
  scheduledTime: string;
  guestName: string;
  createdAt: string;
};

export type PartnerWebhookDeliveryResult =
  | { success: true }
  | { success: false; error: string };

// Same t=<unix seconds>,v1=<hex hmac-sha256> shape Calendly uses to sign requests to us.
export function signPartnerPayload(body: string, secret: string): string {
  const timestamp = Math.floor(Date.now() / 1000);
  const signedPayload = `${timestamp}.${body}`;
  const signature = crypto
    .createHmac("sha256", secret)
    .update(signedPayload)
    .digest("hex");

  return `t=${timestamp},v1=${signature}`;
}

export async function sendPartnerWebhook(
  partner: Partner,
  payload: PartnerBookingPayload,
): Promise<PartnerWebhookDeliveryResult> {
  const body = JSON.stringify(payload);
  const signature = signPartnerPayload(body, partner.secret);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);

  try {
    const response = await fetch(partner.webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Partner-Webhook-Signature": signature,
      },
      body,
      signal: controller.signal,
    });

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}`,
      };
    }

    return { success: true };
  } catch (error) {
    const isAbort = error instanceof Error && error.name === "AbortError";
    return {
      success: false,
      error: isAbort
        ? "Timed out"
        : error instanceof Error
          ? error.message
          : "Unknown error",
    };
  } finally {
    clearTimeout(timeout);
  }
}
