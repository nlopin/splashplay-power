import type { APIRoute } from "astro";
import type { NetlifyLocals } from "@astrojs/netlify";
import * as crypto from "crypto";
import { CALENDLY_WEBHOOK_SECRET_KEY } from "astro:env/server";
import * as z from "zod";

import { sendTelegramMessage, escapeMarkdown } from "@/services/telegram";
import {
  getSessionTitleFromEventComment,
  getTransactionIdFromEventComment,
} from "@/components/booking/eventMessage";
import { formatVisitDateTime } from "@/utils/formatters";
import { triggerAvailabilityRefresh } from "@/services/availability";
import { createEvent, logEvent, updateEvent } from "@/services/logger";
import { getPartner, getPartnerKeyForBooking } from "@/services/partners";
import {
  sendPartnerWebhook,
  type PartnerBookingPayload,
} from "@/services/partners/webhook";

export const prerender = false;

type CalendlyWebhookEventData = {
  status: string;
  // "ack": signature/schema validated, Calendly already got its 200.
  // "completed": background processing (Telegram/refresh/partner-forward) finished.
  phase: "ack" | "completed";
  calendlyEventType: string | undefined;
  guestEmail: string | undefined;
  guestName: string | undefined;
  scheduledTime: string | undefined;
  rescheduled: boolean | undefined;
  canceledBy: string | undefined;
  cancellationReason: string | undefined;
  transactionId: string | null | undefined;
  notificationSent: boolean | undefined;
  partnerForwardStatus: PartnerForwardStatus | undefined;
  partnerKey: string | undefined;
  error: string | undefined;
  startTime: number,
  durationMs: number;
};

// `partnerKey?: undefined` on skipped_no_partner is what keeps `.partnerKey`
// readable across the whole union without narrowing at every log site.
type PartnerForwardResult =
  | { status: "success"; partnerKey: string }
  | { status: "failed"; partnerKey?: string; error: string }
  | { status: "skipped_no_partner"; partnerKey?: undefined }
  | { status: "skipped_unknown_partner"; partnerKey: string };

type PartnerForwardStatus = PartnerForwardResult["status"];

const PARTNER_FORWARD_INTERNAL_ERROR: PartnerForwardResult = {
  status: "failed",
  error: "internal_error",
};

const BaseCalendlyPayload = z.looseObject({
  event: z.string(),
  name: z.string(),
  email: z.string(),
  scheduled_event: z.object({
    uri: z.string(),
    start_time: z.iso.datetime({ offset: true }),
  }),
  rescheduled: z.boolean(),
  questions_and_answers: z.array(
    z.object({
      question: z.string(),
      answer: z.string(),
      position: z.number(),
    }),
  ),
});

const CalendlyWebhookEvent = z.discriminatedUnion("event", [
  z.looseObject({
    event: z.literal("invitee.created"),
    payload: z.looseObject({ ...BaseCalendlyPayload.shape }),
  }),
  z.looseObject({
    event: z.literal("invitee.canceled"),
    payload: z.looseObject({
      ...BaseCalendlyPayload.shape,
      cancellation: z.object({
        reason: z.string().optional(),
        canceled_by: z.string(),
        created_at: z.iso.datetime({ offset: true }),
      }),
    }),
  }),
]);

const JsonEventSchema = z
  .string()
  .transform((str, ctx) => {
    try {
      return JSON.parse(str);
    } catch (e) {
      ctx.addIssue({
        code: "custom",
        message: "Invalid JSON string",
      });
      return z.NEVER;
    }
  })
  .pipe(CalendlyWebhookEvent);


export const POST: APIRoute = async ({ request, locals }) => {
  const baseEventData: CalendlyWebhookEventData = {
    status: "started",
    phase: "ack",
    calendlyEventType: undefined,
    guestEmail: undefined,
    guestName: undefined,
    scheduledTime: undefined,
    rescheduled: undefined,
    canceledBy: undefined,
    cancellationReason: undefined,
    transactionId: undefined,
    notificationSent: undefined,
    partnerForwardStatus: undefined,
    partnerKey: undefined,
    error: undefined,
    startTime: Date.now(),
    durationMs: 0,
  };
  const webhookEvent = createEvent("calendly_webhook", baseEventData);

  const signature = request.headers.get("Calendly-Webhook-Signature");
  if (!signature) {
    logEvent(
      updateEvent(webhookEvent, {
        status: "error",
        error: "Signature not found",
        durationMs: Date.now() - webhookEvent.startTime,
      }),
    );
    return new Response("Webhook Error: Signature not found", { status: 401 });
  }

  const body = await request.text();

  if (!verifyWebhookSignature(body, signature, CALENDLY_WEBHOOK_SECRET_KEY)) {
    logEvent(
      updateEvent(webhookEvent, {
        status: "error",
        error: "Invalid signature",
        durationMs: Date.now() - webhookEvent.startTime,
      }),
    );
    return new Response("Webhook Error: Invalid signature", { status: 401 });
  }

  const parsedEventResult = JsonEventSchema.safeParse(body);
  if (!parsedEventResult.success) {
    logEvent(
      updateEvent(webhookEvent, {
        status: "error",
        error: parsedEventResult.error.issues.map((i) => i.message).join("; "),
        durationMs: Date.now() - webhookEvent.startTime,
      }),
    );
    return new Response("Webhook Error: Unexpected event format", {
      status: 400,
    });
  }
  const event = parsedEventResult.data;

  // Signature + schema are validated — ack Calendly now. Everything past this
  // point (Telegram, availability refresh, partner forward) is a slow, best-effort
  // side effect that must not hold up the response, so it runs after we return,
  // kept alive via Netlify's context.waitUntil.
  logEvent(
    updateEvent(webhookEvent, {
      calendlyEventType: event.event,
      guestEmail: event.payload.email,
      guestName: event.payload.name,
      scheduledTime: event.payload.scheduled_event.start_time,
      status: "acked",
      durationMs: Date.now() - webhookEvent.startTime,
    }),
  );

  const processing = processCalendlyEvent(event, webhookEvent);
  const netlifyContext = (locals as unknown as NetlifyLocals).netlify?.context;
  if (netlifyContext) {
    netlifyContext.waitUntil(processing);
  } else {
    // Not running behind the Netlify function runtime (e.g. a different
    // adapter/host) — fire and forget rather than block the response.
    processing.catch(() => {});
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 });
};

async function processCalendlyEvent(
  event: z.infer<typeof CalendlyWebhookEvent>,
  webhookEvent: CalendlyWebhookEventData & { timestamp: string; event: string }
): Promise<void> {
  updateEvent(webhookEvent, { phase: "completed" });

  try {
    switch (event.event) {
      case "invitee.created":
        const createdResult = await handleInviteeCreated(event);
        updateEvent(webhookEvent, {
          status: overallStatus(createdResult.partnerForward),
          rescheduled: event.payload.rescheduled,
          notificationSent: createdResult.notificationSent,
          partnerForwardStatus: createdResult.partnerForward.status,
          partnerKey: createdResult.partnerForward.partnerKey,
        });
        break;

      case "invitee.canceled":
        const result = await handleInviteeCanceled(event);
        updateEvent(webhookEvent, {
          status: overallStatus(result.partnerForward),
          canceledBy: event.payload.cancellation.canceled_by,
          cancellationReason: event.payload.cancellation.reason,
          transactionId: result.transactionId,
          notificationSent: result.notificationSent,
          partnerForwardStatus: result.partnerForward.status,
          partnerKey: result.partnerForward.partnerKey,
        });
        break;
    }
  } catch (error) {
    updateEvent(webhookEvent, {
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }

  logEvent(updateEvent(webhookEvent, { durationMs: Date.now() - webhookEvent.startTime }));
}

// "failed" is the only partner-forward outcome that should flip the handler's
// own status — skipped_no_partner/skipped_unknown_partner are expected, non-error
// outcomes and shouldn't read as a handler failure in status-based monitoring.
function overallStatus(partnerForward: PartnerForwardResult): string {
  return partnerForward.status === "failed" ? "partner_forward_failed" : "success";
}

/**
 * Verify Calendly webhook signature
 * Calendly uses HMAC SHA256 with format: "t=timestamp,v1=signature"
 */
function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string,
): boolean {
  try {
    // Parse the signature header
    const parts = signature.split(",");
    const timestamp = parts[0]?.replace("t=", "");
    const providedSignature = parts[1]?.replace("v1=", "");

    if (!timestamp || !providedSignature) {
      return false;
    }

    // Create the signed payload string
    const signedPayload = `${timestamp}.${payload}`;

    // Calculate expected signature
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(signedPayload)
      .digest("hex");

    return crypto.timingSafeEqual(
      Buffer.from(providedSignature),
      Buffer.from(expectedSignature),
    );
  } catch {
    return false;
  }
}

function extractEventComment(payload: {
  questions_and_answers: {
    question: string;
    answer: string;
    position: number;
  }[];
}): { transactionId: string; sessionTitle: string } {
  const questionsAndAnswers = payload.questions_and_answers || [];
  const eventComment = questionsAndAnswers.at(0)?.answer || "";
  return {
    transactionId: getTransactionIdFromEventComment(eventComment),
    sessionTitle: getSessionTitleFromEventComment(eventComment),
  };
}

async function handleInviteeCreated({
  payload,
}: z.infer<typeof CalendlyWebhookEvent> & {
  event: "invitee.created";
}): Promise<{
  notificationSent: boolean;
  partnerForward: PartnerForwardResult;
}> {
  const scheduledTime = payload.scheduled_event.start_time;
  const { transactionId, sessionTitle } = extractEventComment(payload);

  const formattedTime = formatVisitDateTime(scheduledTime, "short", "en");

  let message = payload.rescheduled
    ? `↔️ *Calendly event rescheduled*\n`
    : `✅ *Calendly event created*\n`;
  message += `Guest: ${escapeMarkdown(payload.name)}, (${payload.email})\n`;
  message += `Time: ${escapeMarkdown(formattedTime)}\n`;

  try {
    const results = await Promise.allSettled([
      sendTelegramMessage(message),
      triggerAvailabilityRefresh(),
      forwardPartnerEvent({
        event: "booking.created",
        transactionId,
        sessionTitle,
        scheduledTime,
        guestName: payload.name,
      }),
    ]);
    const partnerForward = settledOrDefault(
      results[2],
      PARTNER_FORWARD_INTERNAL_ERROR,
    );
    return { notificationSent: true, partnerForward };
  } catch {
    return {
      notificationSent: false,
      partnerForward: PARTNER_FORWARD_INTERNAL_ERROR,
    };
  }
}

async function handleInviteeCanceled({
  payload,
}: z.infer<typeof CalendlyWebhookEvent> & {
  event: "invitee.canceled";
}): Promise<{
  transactionId: string | null;
  notificationSent: boolean;
  partnerForward: PartnerForwardResult;
}> {
  const { transactionId, sessionTitle } = extractEventComment(payload);

  let message = `‼️ *Event cancelled*\n`;
  message += `Event: ${escapeMarkdown(sessionTitle)}\n`;
  message += `Guest: ${escapeMarkdown(payload.name)} (${payload.email})`;
  message += `\n`;

  if (payload.cancellation.canceled_by) {
    message += `Cancelled by: ${escapeMarkdown(payload.cancellation.canceled_by)}\n`;
  }

  if (payload.cancellation.reason) {
    message += `Reason: ${escapeMarkdown(payload.cancellation.reason)}`;
  }

  if (transactionId) {
    message += `\n💳 *Refund Required*\n`;
    message += `Transaction ID: [${escapeMarkdown(transactionId)}](https://dashboard.stripe.com/acct_1QyrutG3Vb6TnG9U/payments/${transactionId})`;
  } else {
    message += `\n⚠️ No transaction ID found - manual check required`;
  }

  try {
    const results = await Promise.allSettled([
      sendTelegramMessage(message),
      triggerAvailabilityRefresh(),
      forwardPartnerEvent({
        event: "booking.cancelled",
        transactionId,
        sessionTitle,
        scheduledTime: payload.scheduled_event.start_time,
        guestName: payload.name,
      }),
    ]);
    const partnerForward = settledOrDefault(
      results[2],
      PARTNER_FORWARD_INTERNAL_ERROR,
    );

    return {
      transactionId: transactionId || null,
      notificationSent: true,
      partnerForward,
    };
  } catch {
    return {
      transactionId: transactionId || null,
      notificationSent: false,
      partnerForward: PARTNER_FORWARD_INTERNAL_ERROR,
    };
  }
}

function settledOrDefault<T>(result: PromiseSettledResult<T>, fallback: T): T {
  return result.status === "fulfilled" ? result.value : fallback;
}

async function forwardPartnerEvent(params: {
  event: PartnerBookingPayload["event"];
  transactionId: string;
  sessionTitle: string;
  scheduledTime: string;
  guestName: string;
}): Promise<PartnerForwardResult> {
  const partnerKey = await getPartnerKeyForBooking(params.transactionId);
  if (!partnerKey) {
    return { status: "skipped_no_partner" };
  }

  const partner = getPartner(partnerKey);
  if (!partner) {
    return { status: "skipped_unknown_partner", partnerKey };
  }

  const payload: PartnerBookingPayload = {
    event: params.event,
    bookingId: params.transactionId,
    sessionTitle: params.sessionTitle,
    scheduledTime: params.scheduledTime,
    guestName: params.guestName,
    createdAt: new Date().toISOString(),
  };

  const delivery = await sendPartnerWebhook(partner, payload);

  if (!delivery.success) {
    await sendTelegramMessage(
      `⚠️ Partner webhook failed: ${escapeMarkdown(partnerKey)} (${escapeMarkdown(params.event)}) — ${escapeMarkdown(delivery.error)}`,
    ).catch(() => {});
    return { status: "failed", partnerKey, error: delivery.error };
  }

  return { status: "success", partnerKey };
}
