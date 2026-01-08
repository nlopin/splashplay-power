import type { APIRoute } from "astro";
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
import { createEvent, logEvent } from "@/services/logger";

export const prerender = false;

type CalendlyWebhookEventData = {
  status: string;
  calendlyEventType: string | undefined;
  guestEmail: string | undefined;
  guestName: string | undefined;
  scheduledTime: string | undefined;
  rescheduled: boolean | undefined;
  canceledBy: string | undefined;
  cancellationReason: string | undefined;
  transactionId: string | null | undefined;
  notificationSent: boolean | undefined;
  error: string | undefined;
  durationMs: number;
};

const BaseCalendlyPayload = z.looseObject({
  event: z.string(),
  name: z.string(),
  email: z.string(),
  scheduled_event: z.object({
    uri: z.string(),
    start_time: z.iso.datetime(),
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
        created_at: z.iso.datetime(),
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

export const POST: APIRoute = async ({ request }) => {
  const startTime = Date.now();
  const eventData: CalendlyWebhookEventData = {
    status: "started",
    calendlyEventType: undefined,
    guestEmail: undefined,
    guestName: undefined,
    scheduledTime: undefined,
    rescheduled: undefined,
    canceledBy: undefined,
    cancellationReason: undefined,
    transactionId: undefined,
    notificationSent: undefined,
    error: undefined,
    durationMs: 0,
  };
  const webhookEvent = createEvent("calendly_webhook", eventData);

  const signature = request.headers.get("Calendly-Webhook-Signature");
  if (!signature) {
    webhookEvent.status = "error";
    webhookEvent.error = "Signature not found";
    webhookEvent.durationMs = Date.now() - startTime;
    logEvent(webhookEvent);
    return new Response("Webhook Error: Signature not found", { status: 401 });
  }

  const body = await request.text();

  if (!verifyWebhookSignature(body, signature, CALENDLY_WEBHOOK_SECRET_KEY)) {
    webhookEvent.status = "error";
    webhookEvent.error = "Invalid signature";
    webhookEvent.durationMs = Date.now() - startTime;
    logEvent(webhookEvent);
    return new Response("Webhook Error: Invalid signature", { status: 401 });
  }

  const parsedEventResult = JsonEventSchema.safeParse(body);
  if (!parsedEventResult.success) {
    webhookEvent.status = "error";
    webhookEvent.error = parsedEventResult.error.issues
      .map((i) => i.message)
      .join("; ");
    webhookEvent.durationMs = Date.now() - startTime;
    logEvent(webhookEvent);
    return new Response("Webhook Error: Unexpected event format", {
      status: 400,
    });
  }
  const event = parsedEventResult.data;

  webhookEvent.calendlyEventType = event.event;
  webhookEvent.guestEmail = event.payload.email;
  webhookEvent.guestName = event.payload.name;
  webhookEvent.scheduledTime = event.payload.scheduled_event.start_time;

  try {
    switch (event.event) {
      case "invitee.created":
        webhookEvent.rescheduled = event.payload.rescheduled;
        webhookEvent.notificationSent = await handleInviteeCreated(event);
        webhookEvent.status = "success";
        break;

      case "invitee.canceled":
        const result = await handleInviteeCanceled(event);
        webhookEvent.canceledBy = event.payload.cancellation.canceled_by;
        webhookEvent.cancellationReason = event.payload.cancellation.reason;
        webhookEvent.transactionId = result.transactionId;
        webhookEvent.notificationSent = result.notificationSent;
        webhookEvent.status = "success";
        break;
    }
  } catch (error) {
    webhookEvent.status = "error";
    webhookEvent.error =
      error instanceof Error ? error.message : "Unknown error";
    webhookEvent.durationMs = Date.now() - startTime;
    logEvent(webhookEvent);
    return new Response(JSON.stringify({ received: true }), { status: 200 });
  }

  webhookEvent.durationMs = Date.now() - startTime;
  logEvent(webhookEvent);
  return new Response(JSON.stringify({ received: true }), { status: 200 });
};

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

async function handleInviteeCreated({
  payload,
}: z.infer<typeof CalendlyWebhookEvent> & {
  event: "invitee.created";
}): Promise<boolean> {
  const scheduledTime = payload.scheduled_event.start_time;

  const formattedTime = formatVisitDateTime(scheduledTime, "short", "en");

  let message = payload.rescheduled
    ? `↔️ *Calendly event rescheduled*\n`
    : `✅ *Calendly event created*\n`;
  message += `Guest: ${escapeMarkdown(payload.name)}, (${payload.email})\n`;
  message += `Time: ${escapeMarkdown(formattedTime)}\n`;

  try {
    await sendTelegramMessage(message);
    triggerAvailabilityRefresh();
    return true;
  } catch {
    return false;
  }
}

async function handleInviteeCanceled({
  payload,
}: z.infer<typeof CalendlyWebhookEvent> & {
  event: "invitee.canceled";
}): Promise<{ transactionId: string | null; notificationSent: boolean }> {
  const questionsAndAnswers = payload.questions_and_answers || [];
  const eventComment = questionsAndAnswers.at(0)?.answer || "";
  const transactionId = getTransactionIdFromEventComment(eventComment);
  const sessionTitle = getSessionTitleFromEventComment(eventComment);

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
    await sendTelegramMessage(message);
    triggerAvailabilityRefresh();
    return { transactionId, notificationSent: true };
  } catch {
    return { transactionId, notificationSent: false };
  }
}
