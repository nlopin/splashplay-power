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

export type OccupancyCounts = Record<string, number>;

export class OccupancyStoreError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "OccupancyStoreError";
  }
}

export function isOccupancyCounts(value: unknown): value is OccupancyCounts {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  return Object.values(value).every(
    (v) => typeof v === "number" && Number.isFinite(v) && v >= 0,
  );
}

/**
 * Minimal compare-and-swap view of the counts blob.
 * - `read` returns `null` only when the blob genuinely does not exist yet.
 *   It must throw on transport errors and on corrupt data.
 * - `write` with `etag` undefined must only create (fail if the key exists);
 *   with an etag it must only replace that exact version. Returns false on a
 *   precondition failure (somebody else wrote first).
 */
export interface OccupancyCasStore {
  read(): Promise<{ counts: OccupancyCounts; etag: string | undefined } | null>;
  write(counts: OccupancyCounts, etag: string | undefined): Promise<boolean>;
}

export const OCCUPANCY_MAX_ATTEMPTS = 8;

/**
 * Optimistic-concurrency update of a single slot's count. `decide` sees the
 * freshly read value and returns the new value, or `null` to abort without
 * writing. The capacity check therefore runs against the exact version that
 * the conditional write is pinned to, so two concurrent writers cannot both
 * pass it. Throws OccupancyStoreError on read failure or when every attempt
 * lost the race.
 */
export async function updateSlotCount(
  store: OccupancyCasStore,
  key: string,
  decide: (taken: number) => number | null,
  maxAttempts = OCCUPANCY_MAX_ATTEMPTS,
): Promise<{ written: boolean; taken: number }> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const current = await store.read();
    const counts: OccupancyCounts = { ...(current?.counts ?? {}) };
    const taken = counts[key] ?? 0;
    const next = decide(taken);
    if (next === null) return { written: false, taken };
    if (next === taken) return { written: true, taken };
    if (next <= 0) {
      delete counts[key];
    } else {
      counts[key] = next;
    }
    if (await store.write(counts, current?.etag)) {
      return { written: true, taken: Math.max(0, next) };
    }
  }
  throw new OccupancyStoreError(
    `Occupancy update for ${key} lost the write race ${maxAttempts} times`,
  );
}
