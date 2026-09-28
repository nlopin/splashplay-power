import { NETLIFY_SITE_ID, NETLIFY_TOKEN } from "astro:env/server";
import { getStore } from "@netlify/blobs";

/**
 * Processing state of Stripe checkout sessions: an idempotency guard for
 * `checkout.session.completed` webhooks.
 *
 * Stripe may deliver the same event more than once (e.g. after our handler
 * timed out waiting on Calendly). Each checkout session gets one record:
 *
 *   - absent       -> nobody has processed it yet (or a previous attempt failed
 *                     and released its claim, so it is retryable)
 *   - "processing" -> an attempt holds the claim right now
 *   - "done"       -> processed; further deliveries are no-ops
 *
 * Claims are taken with set-if-absent (`onlyIfNew`) so two concurrent
 * deliveries can never both win. A "processing" claim older than
 * CLAIM_LEASE_MS is treated as abandoned (the function was killed before it
 * could release or complete) and can be taken over with compare-and-swap
 * (`onlyIfMatch`), so a crashed attempt doesn't block Stripe retries forever.
 *
 * All store errors are thrown: callers must fail closed (respond non-2xx so
 * Stripe retries) instead of processing without a claim.
 */

// Well above the Netlify function timeout, well below Stripe's retry backoff.
const CLAIM_LEASE_MS = 5 * 60 * 1000;

const processingStore = getStore({
  name: "checkout-processing",
  siteID: NETLIFY_SITE_ID,
  token: NETLIFY_TOKEN,
  consistency: "strong",
});

type CheckoutRecord =
  | { state: "processing"; startedAt: number }
  | { state: "done"; completedAt: number };


/**
 * - "claimed":   this caller now holds the exclusive claim and must process
 *                the session, then call markCheckoutSessionDone (success or
 *                final failure) or releaseCheckoutSessionClaim (retryable
 *                failure, after rolling back its side effects).
 * - "done":      the session was already processed; the delivery is a
 *                duplicate and must be ignored.
 * - "in_flight": another attempt holds a live (non-stale) claim; don't touch
 *                the session, let the sender retry later.
 */
export type ClaimResult =
  { status: "claimed" } | { status: "done" } | { status: "in_flight" };

function getRecordKey(checkoutSessionId: string): string {
  return `checkout-session/${checkoutSessionId}`;
}

function isCheckoutRecord(value: unknown): value is CheckoutRecord {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    (record.state === "processing" && typeof record.startedAt === "number") ||
    (record.state === "done" && typeof record.completedAt === "number")
  );
}

function createProcessingRecord(): CheckoutRecord {
  return { state: "processing", startedAt: Date.now() };
}

/**
 * Tries to take the exclusive processing claim for a checkout session.
 * Throws if the store can't be read or written.
 */
export async function claimCheckoutSession(
  checkoutSessionId: string,
): Promise<ClaimResult> {
  const key = getRecordKey(checkoutSessionId);

  const created = await processingStore.setJSON(key, createProcessingRecord(), {
    onlyIfNew: true,
  });
  if (created.modified) return { status: "claimed" };

  const existing = await processingStore.getWithMetadata(key, { type: "json" });
  if (existing === null) {
    // Released between our write and read; try once more to claim.
    const retried = await processingStore.setJSON(key, createProcessingRecord(), {
      onlyIfNew: true,
    });
    return retried.modified ? { status: "claimed" } : { status: "in_flight" };
  }

  const record: unknown = existing.data;
  if (isCheckoutRecord(record) && record.state === "done") {
    return { status: "done" };
  }

  // Unreadable records are treated as abandoned claims.
  const isStale =
    !isCheckoutRecord(record) ||
    record.state !== "processing" ||
    Date.now() - record.startedAt > CLAIM_LEASE_MS;
  if (isStale && existing.etag) {
    const takenOver = await processingStore.setJSON(key, createProcessingRecord(), {
      onlyIfMatch: existing.etag,
    });
    if (takenOver.modified) return { status: "claimed" };
  }

  return { status: "in_flight" };
}

/** Marks the checkout session as fully processed. Throws on store errors. */
export async function markCheckoutSessionDone(
  checkoutSessionId: string,
): Promise<void> {
  const record: CheckoutRecord = { state: "done", completedAt: Date.now() };
  await processingStore.setJSON(getRecordKey(checkoutSessionId), record);
}

/**
 * Drops the claim so a later Stripe retry can process the session again.
 * Only call this after any side effects of the attempt (e.g. seat
 * reservations) have been rolled back. Throws on store errors.
 */
export async function releaseCheckoutSessionClaim(
  checkoutSessionId: string,
): Promise<void> {
  await processingStore.delete(getRecordKey(checkoutSessionId));
}
