import { NETLIFY_SITE_ID, NETLIFY_TOKEN } from "astro:env/server";
import { getStore } from "@netlify/blobs";
import { createAndLogEvent } from "@/services/logger";

type PartnerBooking = {
  partnerKey: string;
  price?: number;
  guests?: number;
  createdAt?: string;
};

// Retention window for partner-booking metadata (no name/email — just the
// Stripe transaction id, partner key, price and guest count). Kept only for
// as long as needed to reconcile partner referral payouts; see the privacy
// policy ("Netlify" / retention sections), which quotes this same number.
export const PARTNER_BOOKING_RETENTION_DAYS = 365;

const partnerBookingsStore = getStore("partner-bookings", {
  siteID: NETLIFY_SITE_ID,
  token: NETLIFY_TOKEN,
});

function isPartnerBooking(value: unknown): value is PartnerBooking {
  return (
    typeof value === "object" &&
    value !== null &&
    "partnerKey" in value &&
    typeof value["partnerKey"] === "string"
  );
}

export async function storePartnerBooking(
  transactionId: string,
  booking: PartnerBooking,
): Promise<boolean> {
  const startTime = Date.now();
  const logEventBase = {
    transactionId,
    partnerKey: booking.partnerKey,
  };

  if (!transactionId) {
    createAndLogEvent("partner_booking_write", {
      ...logEventBase,
      status: "skipped_empty_transaction_id",
      durationMs: Date.now() - startTime,
    });
    return false;
  }

  try {
    await partnerBookingsStore.setJSON(transactionId, {
      ...booking,
      createdAt: new Date().toISOString(),
    });
    createAndLogEvent("partner_booking_write", {
      ...logEventBase,
      status: "success",
      durationMs: Date.now() - startTime,
    });
    return true;
  } catch (error) {
    createAndLogEvent("partner_booking_write", {
      ...logEventBase,
      status: "error",
      error: {
        message: error instanceof Error ? error.message : "Unknown error",
      },
      durationMs: Date.now() - startTime,
    });
    return false;
  }
}

export async function getPartnerBookingForTransaction(
  transactionId: string,
): Promise<PartnerBooking | null> {
  const startTime = Date.now();

  if (!transactionId) {
    createAndLogEvent("partner_booking_read", {
      status: "skipped_empty_transaction_id",
      transactionId,
      durationMs: Date.now() - startTime,
    });
    return null;
  }

  try {
    const stored = await partnerBookingsStore.get(transactionId, {
      type: "json",
    });
    if (!stored || !isPartnerBooking(stored)) {
      createAndLogEvent("partner_booking_read", {
        status: "miss",
        transactionId,
        durationMs: Date.now() - startTime,
      });
      return null;
    }

    createAndLogEvent("partner_booking_read", {
      status: "hit",
      transactionId,
      partnerKey: stored.partnerKey,
      durationMs: Date.now() - startTime,
    });
    return stored;
  } catch (error) {
    createAndLogEvent("partner_booking_read", {
      status: "error",
      transactionId,
      error: {
        message: error instanceof Error ? error.message : "Unknown error",
      },
      durationMs: Date.now() - startTime,
    });
    return null;
  }
}

export async function cleanupExpiredPartnerBookings(retentionDaysCount: number = PARTNER_BOOKING_RETENTION_DAYS): Promise<{
  scanned: number;
  deleted: number;
  errors: number;
}> {
  const startTime = Date.now();
  const cutoff =
    Date.now() - retentionDaysCount * 24 * 60 * 60 * 1000;

  let scanned = 0;
  let deleted = 0;
  let errors = 0;

  try {
    for await (const page of partnerBookingsStore.list({ paginate: true })) {
      for (const { key } of page.blobs) {
        scanned++;
        try {
          const stored = await partnerBookingsStore.get(key, {
            type: "json",
          });
          const createdAtMs =
            stored && isPartnerBooking(stored) && stored.createdAt
              ? Date.parse(stored.createdAt)
              : NaN;
          const isExpired = Number.isNaN(createdAtMs) || createdAtMs < cutoff;

          if (isExpired) {
            await partnerBookingsStore.delete(key);
            deleted++;
          }
        } catch (error) {
          errors++;
          createAndLogEvent("partner_booking_cleanup_entry_error", {
            key,
            error: {
              message:
                error instanceof Error ? error.message : "Unknown error",
            },
          });
        }
      }
    }
  } catch (error) {
    errors++;
    createAndLogEvent("partner_booking_cleanup_list_error", {
      error: {
        message: error instanceof Error ? error.message : "Unknown error",
      },
    });
  }

  createAndLogEvent("partner_booking_cleanup", {
    status: "done",
    scanned,
    deleted,
    errors,
    retentionDays: PARTNER_BOOKING_RETENTION_DAYS,
    durationMs: Date.now() - startTime,
  });

  return { scanned, deleted, errors };
}
