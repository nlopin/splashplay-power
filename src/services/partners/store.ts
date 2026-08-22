import { NETLIFY_SITE_ID, NETLIFY_TOKEN } from "astro:env/server";
import { getStore } from "@netlify/blobs";
import { createAndLogEvent } from "@/services/logger";

type PartnerBooking = {
  partnerKey: string;
};

const partnerBookingsStore = getStore("partner-bookings", {
  siteID: NETLIFY_SITE_ID,
  token: NETLIFY_TOKEN,
});

function isPartnerBooking(value: unknown): value is PartnerBooking {
  return (
    typeof value === "object" &&
    value !== null &&
    'partnerKey' in value &&
    typeof value['partnerKey'] === "string"
  );
}

export async function storePartnerBooking(
  transactionId: string,
  partnerKey: string,
): Promise<boolean> {
  const startTime = Date.now();
  const logEventBase = {
    transactionId,
    partnerKey,
  }

  if (!transactionId) {
    createAndLogEvent("partner_booking_write", {
      ...logEventBase,
      status: "skipped_empty_transaction_id",
      durationMs: Date.now() - startTime,
    });
    return false;
  }

  try {
    await partnerBookingsStore.setJSON(transactionId, { partnerKey });
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

export async function getPartnerKeyForBooking(
  transactionId: string,
): Promise<string | null> {
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
    return stored.partnerKey;
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
