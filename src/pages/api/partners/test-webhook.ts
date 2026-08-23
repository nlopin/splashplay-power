import type { APIRoute } from "astro";
import * as crypto from "crypto";
import * as z from "zod";
import { getPartner } from "@/services/partners";
import {
  sendPartnerWebhook,
  type PartnerBookingPayload,
} from "@/services/partners/webhook";
import { createAndLogEvent } from "@/services/logger";

export const prerender = false;

const TestWebhookRequestSchema = z.object({
  partnerKey: z.string().min(1),
  bookingId: z.string().min(1).optional(),
  status: z.literal("cancel").optional(),
});

function secretsMatch(provided: string, expected: string): boolean {
  const a = new Uint8Array(crypto.createHash("sha256").update(provided).digest());
  const b = new Uint8Array(crypto.createHash("sha256").update(expected).digest());
  return crypto.timingSafeEqual(a, b);
}

export const POST: APIRoute = async ({ request }) => {
  const startTime = Date.now();
  const body = await request.json().catch(() => null);
  const parsed = TestWebhookRequestSchema.safeParse(body);

  if (!parsed.success) {
    return new Response(
      JSON.stringify({
        error: parsed.error.issues.map((i) => i.message).join("; "),
      }),
      { status: 400 },
    );
  }

  const { partnerKey, bookingId: requestedBookingId, status } = parsed.data;

  if (status === "cancel" && !requestedBookingId) {
    return new Response(
      JSON.stringify({ error: 'bookingId is required when status is "cancel"' }),
      { status: 400 },
    );
  }

  const partner = getPartner(partnerKey);
  const authHeader = request.headers.get("Authorization") ?? "";
  const providedSecret = authHeader.replace(/^Bearer\s+/i, "");

  if (!partner || !providedSecret || !secretsMatch(providedSecret, partner.secret)) {
    createAndLogEvent("partner_test_webhook", {
      status: "unauthorized",
      partnerKey,
      durationMs: Date.now() - startTime,
    });
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
    });
  }

  const event: PartnerBookingPayload["event"] =
    status === "cancel" ? "booking.cancelled" : "booking.created";
  const bookingId = requestedBookingId ?? `test_${crypto.randomUUID()}`;

  const payload: PartnerBookingPayload = {
    event,
    bookingId,
    sessionTitle: "Test booking",
    scheduledTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    guestName: "Test Guest",
    createdAt: new Date().toISOString(),
  };

  const delivery = await sendPartnerWebhook(partner, payload);

  createAndLogEvent("partner_test_webhook", {
    status: delivery.success ? "success" : "delivery_failed",
    partnerKey,
    event,
    bookingId,
    error: delivery.success ? undefined : delivery.error,
    durationMs: Date.now() - startTime,
  });

  return new Response(
    JSON.stringify({
      delivered: delivery.success,
      error: delivery.success ? undefined : delivery.error,
      event,
      bookingId,
    }),
    { status: delivery.success ? 200 : 502 },
  );
};
