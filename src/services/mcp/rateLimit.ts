import { NETLIFY_SITE_ID, NETLIFY_TOKEN } from "astro:env/server";
import { getStore } from "@netlify/blobs";
import { createAndLogEvent } from "@/services/logger";

const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 30;

const rateLimitStore = getStore("mcp-rate-limit", {
  siteID: NETLIFY_SITE_ID,
  token: NETLIFY_TOKEN,
});

type RateLimitEntry = { count: number; windowStart: number };

function isRateLimitEntry(value: unknown): value is RateLimitEntry {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as RateLimitEntry).count === "number" &&
    typeof (value as RateLimitEntry).windowStart === "number"
  );
}

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterMs: number };

// Fixed-window per-IP limit; no auth (any agent can call this endpoint), so
// this is the only abuse guard. Fails open on a Blobs error.
export async function checkRateLimit(clientIp: string): Promise<RateLimitResult> {
  const startTime = Date.now();
  const key = clientIp || "unknown";

  try {
    const now = Date.now();
    const existing = await rateLimitStore.get(key, { type: "json" });
    const entry = isRateLimitEntry(existing) ? existing : null;

    if (!entry || now - entry.windowStart >= WINDOW_MS) {
      await rateLimitStore.setJSON(key, { count: 1, windowStart: now });
      createAndLogEvent("mcp_rate_limit", {
        clientIp: key,
        status: "new_window",
        durationMs: Date.now() - startTime,
      });
      return { allowed: true };
    }

    if (entry.count >= MAX_REQUESTS_PER_WINDOW) {
      createAndLogEvent("mcp_rate_limit", {
        clientIp: key,
        status: "blocked",
        count: entry.count,
        durationMs: Date.now() - startTime,
      });
      return {
        allowed: false,
        retryAfterMs: WINDOW_MS - (now - entry.windowStart),
      };
    }

    await rateLimitStore.setJSON(key, {
      count: entry.count + 1,
      windowStart: entry.windowStart,
    });
    return { allowed: true };
  } catch (error) {
    createAndLogEvent("mcp_rate_limit", {
      clientIp: key,
      status: "error",
      error: {
        message: error instanceof Error ? error.message : "Unknown error",
      },
      durationMs: Date.now() - startTime,
    });
    return { allowed: true };
  }
}
