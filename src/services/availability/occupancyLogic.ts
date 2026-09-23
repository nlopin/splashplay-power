import { OPEN_SESSION_CAPACITY } from "@/services/catalog/openSessionPricing";
import type { AvailableTime } from "./types";

export function occupancyKey(datetime: string): string {
  return new Date(datetime).toISOString();
}

/**
 * Overlay people-count occupancy onto Calendly-derived slots.
 *
 * Couple tickets are 1 Calendly invitee but 2 people, so remaining seats
 * cannot come from invitees_remaining. If someone already joined the open
 * session (taken > 0) and seats remain, keep selling even when Calendly
 * stopped listing the time (typical after the first invitee occupies the
 * host calendar).
 */
export function applyOccupancyToSlots(
  slots: AvailableTime[],
  occupancy: Record<string, number>,
  capacity = OPEN_SESSION_CAPACITY,
): AvailableTime[] {
  return slots
    .map((slot) => {
      const taken = occupancy[occupancyKey(slot.time)] ?? 0;
      const spotsLeft = Math.max(0, capacity - taken);

      if (taken > 0 && spotsLeft > 0) {
        return { time: slot.time, spotsLeft };
      }
      if (spotsLeft <= 0) {
        return { time: slot.time, booked: true as const, spotsLeft: 0 };
      }
      if (slot.booked) {
        return { ...slot, spotsLeft: 0 };
      }
      return { ...slot, spotsLeft };
    })
    .sort((a, b) => a.time.localeCompare(b.time));
}

/** One booking's hold on a slot. `at` is when the hold was first recorded. */
export type SeatHold = { guests: number; at: number };

/** Holds on a single slot, keyed by booking (Stripe payment intent id). */
export type SlotHolds = Record<string, SeatHold>;

/** Every slot's holds, keyed by occupancyKey(datetime). */
export type OccupancyLedger = Record<string, SlotHolds>;

export class OccupancyStoreError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "OccupancyStoreError";
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSeatHold(value: unknown): value is SeatHold {
  return (
    isPlainObject(value) &&
    Number.isInteger(value.guests) &&
    (value.guests as number) > 0 &&
    typeof value.at === "number" &&
    Number.isFinite(value.at)
  );
}

export function isOccupancyLedger(value: unknown): value is OccupancyLedger {
  return (
    isPlainObject(value) &&
    Object.values(value).every(
      (holds) => isPlainObject(holds) && Object.values(holds).every(isSeatHold),
    )
  );
}

export function seatsTaken(holds: SlotHolds): number {
  return Object.values(holds).reduce((sum, hold) => sum + hold.guests, 0);
}

/** People per slot, the shape the calendar and payment gate work with. */
export function countsFromLedger(
  ledger: OccupancyLedger,
): Record<string, number> {
  return Object.fromEntries(
    Object.entries(ledger).map(([slot, holds]) => [slot, seatsTaken(holds)]),
  );
}

/**
 * Minimal compare-and-swap view of the ledger blob.
 * - `read` returns `null` only when the blob genuinely does not exist yet.
 *   It must throw on transport errors and on corrupt data.
 * - `write` with `etag` undefined must only create (fail if the key exists);
 *   with an etag it must only replace that exact version. Returns false on a
 *   precondition failure (somebody else wrote first).
 */
export interface OccupancyCasStore {
  read(): Promise<{ ledger: OccupancyLedger; etag: string | undefined } | null>;
  write(ledger: OccupancyLedger, etag: string | undefined): Promise<boolean>;
}

export const OCCUPANCY_MAX_ATTEMPTS = 8;

/**
 * Optimistic-concurrency update of a single slot's holds. `decide` sees the
 * freshly read holds and returns the new holds, the same object to leave
 * them unchanged, or `null` to refuse. The decision therefore runs against
 * the exact version that the conditional write is pinned to, so two
 * concurrent writers cannot both pass a capacity check. Throws
 * OccupancyStoreError on read failure or when every attempt lost the race.
 */
export async function updateSlotHolds(
  store: OccupancyCasStore,
  slot: string,
  decide: (holds: SlotHolds) => SlotHolds | null,
  maxAttempts = OCCUPANCY_MAX_ATTEMPTS,
): Promise<{ written: boolean; holds: SlotHolds }> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const current = await store.read();
    const ledger: OccupancyLedger = { ...(current?.ledger ?? {}) };
    const holds = ledger[slot] ?? {};
    const next = decide(holds);
    if (next === null) return { written: false, holds };
    if (next === holds) return { written: true, holds };
    if (Object.keys(next).length === 0) {
      delete ledger[slot];
    } else {
      ledger[slot] = next;
    }
    if (await store.write(ledger, current?.etag)) {
      return { written: true, holds: next };
    }
  }
  throw new OccupancyStoreError(
    `Occupancy update for ${slot} lost the write race ${maxAttempts} times`,
  );
}

/**
 * Hold `guests` seats for `bookingKey`. Idempotent: if the booking already
 * holds seats on this slot they are kept as they are. Refuses (null) when
 * the new hold would exceed capacity.
 */
export function holdSeats(
  bookingKey: string,
  guests: number,
  capacity = OPEN_SESSION_CAPACITY,
  now = Date.now(),
): (holds: SlotHolds) => SlotHolds | null {
  return (holds) => {
    if (holds[bookingKey]) return holds;
    if (seatsTaken(holds) + guests > capacity) return null;
    return { ...holds, [bookingKey]: { guests, at: now } };
  };
}

/** Drop `bookingKey`'s hold. Idempotent: a missing hold is left alone. */
export function dropHold(bookingKey: string): (holds: SlotHolds) => SlotHolds {
  return (holds) => {
    if (!holds[bookingKey]) return holds;
    const { [bookingKey]: _dropped, ...rest } = holds;
    return rest;
  };
}
