/**
 * Netlify Scheduled Function: Open Session Seats Reconcile
 *
 * Rebuilds the open-session seat ledger from Calendly's active invitees.
 * The Calendly webhook keeps the ledger up to date as bookings change; this
 * catches anything a missed or failed webhook left wrong, and drops slots
 * that already started.
 *
 * This file is the entry point for the scheduled function.
 * It imports from the main source code and the build script
 * transforms astro:env/server imports to Netlify.env.get() calls.
 *
 * Build with: pnpm run build:functions
 */
import type { Config } from "@netlify/functions";
import { reconcileOpenSessionSeats } from "@/services/availability/reconcileOpenSessions";
import { createAndLogEvent } from "@/services/logger";

export default async () => {
  const startTime = Date.now();

  try {
    const summary = await reconcileOpenSessionSeats();

    createAndLogEvent("open_session_seats_reconcile", {
      status: "success",
      invitees: summary.invitees,
      added: summary.changes.filter((c) => c.kind === "added").length,
      removed: summary.changes.filter((c) => c.kind === "removed").length,
      overbookedSlots: summary.overbookedSlots.length,
      durationMs: Date.now() - startTime,
    });

    return new Response(JSON.stringify(summary), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    createAndLogEvent("open_session_seats_reconcile", {
      status: "error",
      error: {
        message: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      },
      durationMs: Date.now() - startTime,
    });

    return new Response(
      JSON.stringify({
        message: "Open session seats reconcile failed",
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
  schedule: "@hourly",
};
