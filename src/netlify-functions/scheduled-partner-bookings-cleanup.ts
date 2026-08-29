/**
 * Netlify Scheduled Function: Partner Bookings Cleanup
 *
 * Deletes partner-booking metadata (transaction id, partner key, price,
 * guest count — no name/email) older than the retention window declared in
 * the privacy policy. This is the enforcement side of that policy: without
 * it, entries in the Netlify Blobs "partner-bookings" store would live
 * indefinitely.
 *
 * This file is the entry point for the scheduled function.
 * It imports from the main source code and the build script
 * transforms astro:env/server imports to Netlify.env.get() calls.
 *
 * Build with: pnpm run build:functions
 */
import type { Config } from "@netlify/functions";
import { cleanupExpiredPartnerBookings } from "@/services/partners/store";

export default async () => {
  const startTime = Date.now();

  try {
    const result = await cleanupExpiredPartnerBookings();

    return new Response(
      JSON.stringify({
        message: "Partner bookings cleanup completed",
        ...result,
        durationMs: Date.now() - startTime,
      }),
      {
        status: result.errors > 0 ? 500 : 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        event: "scheduled_partner_bookings_cleanup",
        status: "error",
        error: {
          message: error instanceof Error ? error.message : "Unknown error",
          stack: error instanceof Error ? error.stack : undefined,
        },
        durationMs: Date.now() - startTime,
      }),
    );

    return new Response(
      JSON.stringify({
        message: "Partner bookings cleanup failed",
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
};

export const config: Config = {
  schedule: "@daily",
};
