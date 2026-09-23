import { NETLIFY_SITE_ID, NETLIFY_TOKEN } from "astro:env/server";
import { getStore } from "@netlify/blobs";
import { OPEN_SESSION_CAPACITY } from "@/services/catalog/openSessionPricing";
import { createAndLogEvent } from "@/services/logger";
import {
  isOccupancyCounts,
  occupancyKey,
  OccupancyStoreError,
  updateSlotCount,
  type OccupancyCasStore,
  type OccupancyCounts,
} from "./occupancyLogic";

export { OccupancyStoreError } from "./occupancyLogic";

const occupancyStore = getStore("open-session-occupancy", {
  siteID: NETLIFY_SITE_ID,
  token: NETLIFY_TOKEN,
});

const COUNTS_KEY = "counts";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

/**
 * Strict read used by every write path. Returns null only when the blob does
 * not exist yet; throws OccupancyStoreError on transport errors, corrupt data
 * or a missing ETag, so callers can never mistake a failed read for "empty".
 */
async function readCountsStrict(): Promise<{
  counts: OccupancyCounts;
  etag: string | undefined;
} | null> {
  let result;
  try {
    result = await occupancyStore.getWithMetadata(COUNTS_KEY, {
      type: "json",
      consistency: "strong",
    });
  } catch (error) {
    throw new OccupancyStoreError(
      `Failed to read occupancy counts: ${errorMessage(error)}`,
      { cause: error },
    );
  }
  if (result === null) return null;
  if (!isOccupancyCounts(result.data)) {
    throw new OccupancyStoreError("Occupancy counts blob is corrupt");
  }
  if (!result.etag) {
    throw new OccupancyStoreError("Occupancy counts blob has no ETag");
  }
  return { counts: result.data, etag: result.etag };
}

const casStore: OccupancyCasStore = {
  read: readCountsStrict,
  async write(counts, etag) {
    try {
      const result = await occupancyStore.setJSON(
        COUNTS_KEY,
        counts,
        etag === undefined ? { onlyIfNew: true } : { onlyIfMatch: etag },
      );
      return result.modified;
    } catch (error) {
      throw new OccupancyStoreError(
        `Failed to write occupancy counts: ${errorMessage(error)}`,
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
    return (await readCountsStrict())?.counts ?? {};
  } catch (error) {
    logOccupancyError("open_session_occupancy_read", error);
    return {};
  }
}

/**
 * Pre-payment capacity gate. Fails closed: returns 0 when counts cannot be
 * read, so we never take money for a slot whose occupancy is unknown.
 */
export async function getSpotsLeft(datetime: string): Promise<number> {
  try {
    const counts = (await readCountsStrict())?.counts ?? {};
    const taken = counts[occupancyKey(datetime)] ?? 0;
    return Math.max(0, OPEN_SESSION_CAPACITY - taken);
  } catch (error) {
    logOccupancyError("open_session_occupancy_read", error);
    return 0;
  }
}

/**
 * Atomically reserve seats (ETag compare-and-swap with bounded retries).
 * Returns `{ ok: false }` only when the slot is genuinely full. Throws
 * OccupancyStoreError when the store cannot be read/written or the update
 * keeps losing the race: the booking outcome is unknown and must not be
 * treated as either success or "full".
 */
export async function reserveOpenSessionSeats(
  datetime: string,
  guests: number,
): Promise<{ ok: true; taken: number } | { ok: false; taken: number }> {
  if (!Number.isInteger(guests) || guests <= 0) {
    throw new OccupancyStoreError(`Invalid guest count: ${guests}`);
  }
  try {
    const { written, taken } = await updateSlotCount(
      casStore,
      occupancyKey(datetime),
      (current) =>
        current + guests > OPEN_SESSION_CAPACITY ? null : current + guests,
    );
    return written ? { ok: true, taken } : { ok: false, taken };
  } catch (error) {
    logOccupancyError("open_session_occupancy_write", error);
    throw error;
  }
}

/**
 * Atomically release seats. Never throws (it runs on a cleanup path); on any
 * store failure it leaves the stored counts untouched, i.e. seats stay held
 * (fail closed: undersell rather than oversell) and the error is logged.
 */
export async function releaseOpenSessionSeats(
  datetime: string,
  guests: number,
): Promise<void> {
  try {
    await updateSlotCount(casStore, occupancyKey(datetime), (current) =>
      Math.max(0, current - guests),
    );
  } catch (error) {
    logOccupancyError("open_session_occupancy_write", error);
  }
}
