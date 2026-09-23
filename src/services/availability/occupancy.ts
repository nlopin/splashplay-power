import { NETLIFY_SITE_ID, NETLIFY_TOKEN } from "astro:env/server";
import { getStore } from "@netlify/blobs";
import { OPEN_SESSION_CAPACITY } from "@/services/catalog/openSessionPricing";
import { createAndLogEvent } from "@/services/logger";
import {
  countsFromLedger,
  dropHold,
  holdSeats,
  isOccupancyLedger,
  occupancyKey,
  OccupancyStoreError,
  seatsTaken,
  updateSlotHolds,
  type OccupancyCasStore,
  type OccupancyLedger,
} from "./occupancyLogic";

export { OccupancyStoreError } from "./occupancyLogic";

const occupancyStore = getStore("open-session-occupancy", {
  siteID: NETLIFY_SITE_ID,
  token: NETLIFY_TOKEN,
});

const LEDGER_KEY = "ledger";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

/**
 * Strict read used by every write path. Returns null only when the blob does
 * not exist yet; throws OccupancyStoreError on transport errors, corrupt data
 * or a missing ETag, so callers can never mistake a failed read for "empty".
 */
async function readLedgerStrict(): Promise<{
  ledger: OccupancyLedger;
  etag: string | undefined;
} | null> {
  let result;
  try {
    result = await occupancyStore.getWithMetadata(LEDGER_KEY, {
      type: "json",
      consistency: "strong",
    });
  } catch (error) {
    throw new OccupancyStoreError(
      `Failed to read occupancy ledger: ${errorMessage(error)}`,
      { cause: error },
    );
  }
  if (result === null) return null;
  if (!isOccupancyLedger(result.data)) {
    throw new OccupancyStoreError("Occupancy ledger blob is corrupt");
  }
  if (!result.etag) {
    throw new OccupancyStoreError("Occupancy ledger blob has no ETag");
  }
  return { ledger: result.data, etag: result.etag };
}

const casStore: OccupancyCasStore = {
  read: readLedgerStrict,
  async write(ledger, etag) {
    try {
      const result = await occupancyStore.setJSON(
        LEDGER_KEY,
        ledger,
        etag === undefined ? { onlyIfNew: true } : { onlyIfMatch: etag },
      );
      return result.modified;
    } catch (error) {
      throw new OccupancyStoreError(
        `Failed to write occupancy ledger: ${errorMessage(error)}`,
        { cause: error },
      );
    }
  },
};

function logOccupancyError(
  event: "open_session_occupancy_read" | "open_session_occupancy_write",
  error: unknown,
) {
  createAndLogEvent(event, {
    status: "error",
    error: { message: errorMessage(error) },
  });
}

/**
 * Display-only read (calendar). Degrades to `{}` on failure so the calendar
 * still renders; capacity is enforced by getSpotsLeft (payment gate, fails
 * closed) and reserveOpenSessionSeats (atomic, fails closed). Never use the
 * result of this function as the basis for a write.
 */
export async function getOccupancyCounts(): Promise<Record<string, number>> {
  try {
    return countsFromLedger((await readLedgerStrict())?.ledger ?? {});
  } catch (error) {
    logOccupancyError("open_session_occupancy_read", error);
    return {};
  }
}

/**
 * Pre-payment capacity gate. Fails closed: returns 0 when the ledger cannot be
 * read, so we never take money for a slot whose occupancy is unknown.
 */
export async function getSpotsLeft(datetime: string): Promise<number> {
  try {
    const ledger = (await readLedgerStrict())?.ledger ?? {};
    const taken = seatsTaken(ledger[occupancyKey(datetime)] ?? {});
    return Math.max(0, OPEN_SESSION_CAPACITY - taken);
  } catch (error) {
    logOccupancyError("open_session_occupancy_read", error);
    return 0;
  }
}

/**
 * Atomically reserve seats for a booking (ETag compare-and-swap with bounded
 * retries). Idempotent per `bookingKey`: reserving again for a booking that
 * already holds seats on this slot succeeds without counting them twice.
 * Returns `{ ok: false }` only when the slot is genuinely full. Throws
 * OccupancyStoreError when the store cannot be read/written or the update
 * keeps losing the race: the booking outcome is unknown and must not be
 * treated as either success or "full".
 */
export async function reserveOpenSessionSeats(
  datetime: string,
  bookingKey: string,
  guests: number,
): Promise<{ ok: true; taken: number } | { ok: false; taken: number }> {
  if (!Number.isInteger(guests) || guests <= 0) {
    throw new OccupancyStoreError(`Invalid guest count: ${guests}`);
  }
  if (!bookingKey) {
    throw new OccupancyStoreError("Missing booking key");
  }
  try {
    const { written, holds } = await updateSlotHolds(
      casStore,
      occupancyKey(datetime),
      holdSeats(bookingKey, guests, OPEN_SESSION_CAPACITY),
    );
    const taken = seatsTaken(holds);
    return written ? { ok: true, taken } : { ok: false, taken };
  } catch (error) {
    logOccupancyError("open_session_occupancy_write", error);
    throw error;
  }
}

/**
 * Atomically release a booking's seats. Idempotent: releasing a booking that
 * holds nothing on this slot is a no-op. Throws OccupancyStoreError when the
 * store cannot be read/written; the ledger is then left untouched, i.e. the
 * seats stay held (fail closed: undersell rather than oversell).
 */
export async function releaseOpenSessionSeats(
  datetime: string,
  bookingKey: string,
): Promise<void> {
  try {
    await updateSlotHolds(
      casStore,
      occupancyKey(datetime),
      dropHold(bookingKey),
    );
  } catch (error) {
    logOccupancyError("open_session_occupancy_write", error);
    throw error;
  }
}
