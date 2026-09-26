import { EVENT_TYPE } from "@/components/booking/types";
import { getTransactionIdFromEventComment } from "@/components/booking/eventMessage";
import { OPEN_SESSION_CAPACITY } from "@/services/catalog/openSessionPricing";
import { listActiveInvitees } from "@/services/calendly";
import { escapeMarkdown, sendTelegramMessage } from "@/services/telegram";
import { formatVisitDateTime } from "@/utils/formatters";
import { readOpenSessionLedger, updateOpenSessionLedger } from "./occupancy";
import {
  occupancyKey,
  reconcileLedger,
  seatsTaken,
  type CalendlyBooking,
  type ReconcileChange,
} from "./occupancyLogic";
import { bookingKeyFor, guestsForTransaction } from "./openSessionBookings";

/**
 * Safety net for the Calendly webhook: rebuilds the open-session seat
 * ledger from Calendly's active invitees, so a missed or failed webhook
 * can't leave seats wrong for long.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
// Longer than how far ahead customers can book.
const WINDOW_DAYS = 60;
// Our checkout reserves seats before creating the Calendly booking; don't
// remove a hold whose booking may still be on its way.
const MIN_HOLD_AGE_MS = 15 * 60 * 1000;

export type ReconcileSummary = {
  invitees: number;
  changes: ReconcileChange[];
  overbookedSlots: string[];
};

/**
 * Throws when Calendly or the seat store can't be read/written; in that
 * case nothing was changed.
 */
export async function reconcileOpenSessionSeats(
  now = Date.now(),
): Promise<ReconcileSummary> {
  const windowEnd = now + WINDOW_DAYS * DAY_MS;
  const invitees = await listActiveInvitees(
    EVENT_TYPE.OPEN_SESSION,
    new Date(now),
    new Date(windowEnd),
  );

  const bookings: (CalendlyBooking & { transactionId: string })[] =
    invitees.map((invitee) => {
      const transactionId = getTransactionIdFromEventComment(invitee.comment);
      return {
        slot: occupancyKey(invitee.startTime),
        key: bookingKeyFor({ ...invitee, transactionId }),
        transactionId,
      };
    });

  // Headcounts come from Stripe, which can't be called inside the atomic
  // update, so look them up first for bookings the ledger doesn't know.
  const ledger = await readOpenSessionLedger();
  const guests = new Map<string, number>();
  for (const booking of bookings) {
    if (!booking.transactionId || ledger[booking.slot]?.[booking.key]) continue;
    const known = await guestsForTransaction(booking.transactionId);
    if (known !== null) guests.set(booking.key, known);
  }

  const { changes, overbookedSlots } = await updateOpenSessionLedger(
    (current) => {
      const { next, changes } = reconcileLedger(current, bookings, {
        now,
        windowEnd,
        minHoldAgeMs: MIN_HOLD_AGE_MS,
        guestsFor: (key) => guests.get(key),
      });
      const overbookedSlots = Object.entries(next ?? current)
        .filter(([, holds]) => seatsTaken(holds) > OPEN_SESSION_CAPACITY)
        .map(([slot]) => slot);
      return { next, result: { changes, overbookedSlots } };
    },
  );

  if (changes.length > 0 || overbookedSlots.length > 0) {
    await sendTelegramMessage(formatReport(changes, overbookedSlots)).catch(
      () => {},
    );
  }

  return { invitees: invitees.length, changes, overbookedSlots };
}

function formatReport(
  changes: ReconcileChange[],
  overbookedSlots: string[],
): string {
  const time = (slot: string) =>
    escapeMarkdown(formatVisitDateTime(slot, "short", "en"));
  const people = (n: number) => (n === 1 ? "1 person" : `${n} people`);

  const lines = ["🔄 *Open session seats corrected from Calendly*"];
  for (const change of changes) {
    const key = escapeMarkdown(change.key);
    if (change.kind === "added") {
      const note = change.guestsAssumed ? ", assumed, please check" : "";
      lines.push(
        `+ ${time(change.slot)}: added ${key} (${people(change.guests)}${note})`,
      );
    } else {
      lines.push(
        `− ${time(change.slot)}: removed ${key} (${people(change.guests)})`,
      );
    }
  }
  for (const slot of overbookedSlots) {
    lines.push(`⚠️ ${time(slot)}: overbooked`);
  }
  return lines.join("\n");
}
