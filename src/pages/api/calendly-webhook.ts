import type { APIRoute } from "astro";
import * as crypto from "crypto";
import { CALENDLY_WEBHOOK_SECRET_KEY } from "astro:env/server";
import * as z from "zod";

import { sendTelegramMessage, escapeMarkdown } from "@/services/telegram";
import {
  getSessionTitleFromEventComment,
  getTransactionIdFromEventComment,
} from "@/components/booking/eventMessage";
import type { ISODatetime } from "@/types";
import { formatVisitDateTime } from "@/utils/formatters";

export const prerender = false;

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
  const signature = request.headers.get("Calendly-Webhook-Signature");
  if (!signature) {
    return new Response("Webhook Error: Signature not found", { status: 401 });
  }

  const body = await request.text();

  if (!verifyWebhookSignature(body, signature, CALENDLY_WEBHOOK_SECRET_KEY)) {
    return new Response("Webhook Error: Invalid signature", { status: 401 });
  }

  const parsedEventResult = JsonEventSchema.safeParse(body);
  if (!parsedEventResult.success) {
    console.error(parsedEventResult.error.issues);
    return new Response("Webhook Error: Unexpected event format", {
      status: 400,
    });
  }
  const event = parsedEventResult.data;

  try {
    switch (event.event) {
      case "invitee.created":
        await handleInviteeCreated(event);
        break;

      case "invitee.canceled":
        await handleInviteeCanceled(event);
        break;

      default:
        console.log(`Unhandled event type: ${JSON.stringify(event)}`);
    }
  } catch (error) {
    console.error("Error processing webhook:", error);
    return new Response(JSON.stringify({ received: true }), { status: 200 });
  }

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
  } catch (error) {
    console.error("Error verifying signature:", error);
    return false;
  }
}

async function handleInviteeCreated({
  payload,
}: z.infer<typeof CalendlyWebhookEvent> & {
  event: "invitee.created";
}): Promise<void> {
  const scheduledTime = payload.scheduled_event.start_time;

  const formattedTime = formatVisitDateTime(scheduledTime, "short", "en");

  let message = payload.rescheduled
    ? `↔️ *Calendly event rescheduled*\n`
    : `✅ *Calendly event created*\n`;
  message += `Guest: ${escapeMarkdown(payload.name)}, (${payload.email})\n`;
  message += `Time: ${escapeMarkdown(formattedTime)}\n`;

  await sendTelegramMessage(message);
}

async function handleInviteeCanceled({
  payload,
}: z.infer<typeof CalendlyWebhookEvent> & {
  event: "invitee.canceled";
}): Promise<void> {
  const questionsAndAnswers = payload.questions_and_answers || [];
  const eventComment = questionsAndAnswers.at(0)?.answer || "";
  const transactionId = getTransactionIdFromEventComment(eventComment);
  const sessionTitle = getSessionTitleFromEventComment(eventComment);

  // Compose message
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

  await sendTelegramMessage(message);
}
