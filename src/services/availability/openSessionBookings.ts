import { stripe } from "@/services/checkout/stripeClient";
import { OPEN_SESSION_CAPACITY } from "@/services/catalog/openSessionPricing";
import { escapeMarkdown, sendTelegramMessage } from "@/services/telegram";
import { formatVisitDateTime } from "@/utils/formatters";
import {
  getOpenSessionHold,
  recordOpenSessionSeats,
  releaseOpenSessionSeats,
} from "./occupancy";

/**
 * Keeps the open-session seat ledger in line with Calendly after the
 * booking was made: cancellations, reschedules and bookings created
 * directly in Calendly. Seats bought through our checkout are reserved by
 * the Stripe webhook before the Calendly booking exists, so for those the
 * `invitee.created` event finds the hold already in place.
 */

export type InviteeRef = {
  startTime: string;
  // Stripe payment intent id from the Calendly comment; "" when the booking
  // did not come from our checkout.
  transactionId: string;
  inviteeUri: string;
};

export type SeatSyncResult =
  | { status: "already_held" }
  | {
      status: "recorded";
      guests: number;
      taken: number;
      guestsSource: "stripe" | "assumed";
    }
  | { status: "released" }
  | { status: "error"; error: string };

/**
 * Our checkout keys holds by payment intent; bookings made in Calendly
 * directly have no transaction id, so their invitee URI is the key.
 */
export function bookingKeyFor({ transactionId, inviteeUri }: InviteeRef) {
  return transactionId || inviteeUri;
}

export async function syncInviteeCreated(
  invitee: InviteeRef,
): Promise<SeatSyncResult> {
  const key = bookingKeyFor(invitee);
  try {
    if (await getOpenSessionHold(invitee.startTime, key)) {
      return { status: "already_held" };
    }

    const knownGuests = invitee.transactionId
      ? await guestsForTransaction(invitee.transactionId)
      : null;
    const guests = knownGuests ?? 1;
    const { taken } = await recordOpenSessionSeats(
      invitee.startTime,
      key,
      guests,
    );

    const warnings: string[] = [];
    if (knownGuests === null) {
      warnings.push(
        invitee.transactionId
          ? `Couldn't find the headcount for ${escapeMarkdown(invitee.transactionId)}, counted as 1 person. Please check.`
          : `Booked outside our checkout, counted as 1 person. Please check the headcount.`,
      );
    }
    if (taken > OPEN_SESSION_CAPACITY) {
      warnings.push(
        `Overbooked: ${taken} people for ${OPEN_SESSION_CAPACITY} seats.`,
      );
    }
    if (warnings.length > 0) {
      await alert(invitee.startTime, warnings);
    }

    return {
      status: "recorded",
      guests,
      taken,
      guestsSource: knownGuests === null ? "assumed" : "stripe",
    };
  } catch (error) {
    return failed(invitee.startTime, "record", error);
  }
}

export async function syncInviteeCanceled(
  invitee: InviteeRef,
): Promise<SeatSyncResult> {
  try {
    await releaseOpenSessionSeats(invitee.startTime, bookingKeyFor(invitee));
    return { status: "released" };
  } catch (error) {
    return failed(invitee.startTime, "release", error);
  }
}

/**
 * People count stored in the checkout session metadata. `transactionId` is
 * a payment intent id, or a checkout session id when the checkout had no
 * payment intent (see the Stripe webhook). Null when it can't be found.
 */
export async function guestsForTransaction(
  transactionId: string,
): Promise<number | null> {
  try {
    const session = transactionId.startsWith("cs_")
      ? await stripe.checkout.sessions.retrieve(transactionId)
      : (
          await stripe.checkout.sessions.list({
            payment_intent: transactionId,
            limit: 1,
          })
        ).data[0];
    const guests = Number(session?.metadata?.guests);
    return Number.isInteger(guests) && guests > 0 ? guests : null;
  } catch {
    return null;
  }
}

async function failed(
  startTime: string,
  action: "record" | "release",
  error: unknown,
): Promise<SeatSyncResult> {
  const message = error instanceof Error ? error.message : "Unknown error";
  await alert(startTime, [
    `Couldn't ${action} seats: ${escapeMarkdown(message)}. Seat count may be wrong.`,
  ]);
  return { status: "error", error: message };
}

async function alert(startTime: string, lines: string[]): Promise<void> {
  const time = formatVisitDateTime(startTime, "short", "en");
  await sendTelegramMessage(
    `⚠️ *Open session seats*\nTime: ${escapeMarkdown(time)}\n${lines.join("\n")}`,
  ).catch(() => {});
}
