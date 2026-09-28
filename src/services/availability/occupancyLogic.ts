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
 * Optimistic-concurrency update of the whole ledger. `decide` sees the
 * freshly read ledger and returns the ledger to write (`next`, or null to
 * leave it unchanged) plus a result for the caller. The decision therefore
 * runs against the exact version the conditional write is pinned to.
 * Throws OccupancyStoreError on read failure or when every attempt lost the
 * race.
 */
export async function updateLedger<T>(
  store: OccupancyCasStore,
  decide: (ledger: OccupancyLedger) => {
    next: OccupancyLedger | null;
    result: T;
  },
  maxAttempts = OCCUPANCY_MAX_ATTEMPTS,
): Promise<T> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const current = await store.read();
    const { next, result } = decide(current?.ledger ?? {});
    if (next === null) return result;
    if (await store.write(next, current?.etag)) return result;
  }
  throw new OccupancyStoreError(
    `Occupancy ledger update lost the write race ${maxAttempts} times`,
  );
}

/**
 * Update a single slot's holds. `decide` sees the slot's current holds and
 * returns the new holds, the same object to leave them unchanged, or `null`
 * to refuse; two concurrent writers cannot both pass a capacity check.
 */
export async function updateSlotHolds(
  store: OccupancyCasStore,
  slot: string,
  decide: (holds: SlotHolds) => SlotHolds | null,
  maxAttempts = OCCUPANCY_MAX_ATTEMPTS,
): Promise<{ written: boolean; holds: SlotHolds }> {
  return updateLedger<{ written: boolean; holds: SlotHolds }>(
    store,
    (ledger) => {
      const holds = ledger[slot] ?? {};
      const next = decide(holds);
      if (next === null)
        return { next: null, result: { written: false, holds } };
      if (next === holds)
        return { next: null, result: { written: true, holds } };
      const updated = { ...ledger };
      if (Object.keys(next).length === 0) {
        delete updated[slot];
      } else {
        updated[slot] = next;
      }
      return { next: updated, result: { written: true, holds: next } };
    },
    maxAttempts,
  );
}

/**
 * Hold `guests` seats for `bookingKey`. Idempotent: if the booking already
 * holds seats on this slot they are kept as they are. With
 * `enforceCapacity`, refuses (null) when the new hold would exceed
 * OPEN_SESSION_CAPACITY; without it, records the hold regardless (for
 * bookings Calendly has already accepted).
 */
export function holdSeats(
  bookingKey: string,
  guests: number,
  {
    enforceCapacity,
    now = Date.now(),
  }: { enforceCapacity: boolean; now?: number },
): (holds: SlotHolds) => SlotHolds | null {
  return (holds) => {
    if (holds[bookingKey]) return holds;
    if (enforceCapacity && seatsTaken(holds) + guests > OPEN_SESSION_CAPACITY) {
      return null;
    }
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

/** An active Calendly invitee of an open session, as a ledger key. */
export type CalendlyBooking = { slot: string; key: string };

export type ReconcileChange =
  | {
      kind: "added";
      slot: string;
      key: string;
      guests: number;
      guestsAssumed: boolean;
    }
  | { kind: "removed"; slot: string; key: string; guests: number };

/**
 * Bring the ledger in line with Calendly's active invitees for slots
 * starting in [now, windowEnd]:
 * - a hold with no active invitee is removed, unless it is younger than
 *   `minHoldAgeMs` (our checkout reserves seats before the Calendly booking
 *   exists, so a fresh hold may not have its invitee yet);
 * - an invitee with no hold is added, with `guestsFor(key)` people or 1 when
 *   unknown.
 * Slots that already started are dropped; slots after windowEnd are kept
 * as they are. `next` is null when nothing changed.
 */
export function reconcileLedger(
  ledger: OccupancyLedger,
  bookings: CalendlyBooking[],
  {
    now,
    windowEnd,
    minHoldAgeMs,
    guestsFor,
  }: {
    now: number;
    windowEnd: number;
    minHoldAgeMs: number;
    guestsFor: (key: string) => number | undefined;
  },
): { next: OccupancyLedger | null; changes: ReconcileChange[] } {
  const active = new Map<string, Set<string>>();
  for (const { slot, key } of bookings) {
    if (!active.has(slot)) active.set(slot, new Set());
    active.get(slot)!.add(key);
  }

  const next: OccupancyLedger = {};
  const changes: ReconcileChange[] = [];
  let dirty = false;

  for (const [slot, holds] of Object.entries(ledger)) {
    const start = Date.parse(slot);
    if (start < now) {
      dirty = true;
      continue;
    }
    if (start > windowEnd) {
      next[slot] = holds;
      continue;
    }
    const keys = active.get(slot) ?? new Set<string>();
    const kept: SlotHolds = {};
    for (const [key, hold] of Object.entries(holds)) {
      if (keys.has(key) || now - hold.at < minHoldAgeMs) {
        kept[key] = hold;
      } else {
        changes.push({ kind: "removed", slot, key, guests: hold.guests });
      }
    }
    if (Object.keys(kept).length > 0) next[slot] = kept;
  }

  for (const [slot, keys] of active) {
    for (const key of keys) {
      if (next[slot]?.[key]) continue;
      const known = guestsFor(key);
      const guests = known ?? 1;
      next[slot] = { ...next[slot], [key]: { guests, at: now } };
      changes.push({
        kind: "added",
        slot,
        key,
        guests,
        guestsAssumed: known === undefined,
      });
    }
  }

  return { next: dirty || changes.length > 0 ? next : null, changes };
}
