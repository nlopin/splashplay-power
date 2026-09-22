import { NETLIFY_SITE_ID, NETLIFY_TOKEN } from "astro:env/server";
import { getStore } from "@netlify/blobs";
import { OPEN_SESSION_CAPACITY } from "@/services/catalog/openSessionPricing";
import { createAndLogEvent } from "@/services/logger";
import { occupancyKey } from "./occupancyLogic";

const occupancyStore = getStore("open-session-occupancy", {
  siteID: NETLIFY_SITE_ID,
  token: NETLIFY_TOKEN,
});

const COUNTS_KEY = "counts";

function isCounts(value: unknown): value is Record<string, number> {
  if (typeof value !== "object" || value === null) return false;
  return Object.values(value).every((v) => typeof v === "number");
}

export async function getOccupancyCounts(): Promise<Record<string, number>> {
  try {
    const cached = await occupancyStore.get(COUNTS_KEY, { type: "json" });
    if (!isCounts(cached)) return {};
    return cached;
  } catch (error) {
    createAndLogEvent("open_session_occupancy_read", {
      status: "error",
      error: {
        message: error instanceof Error ? error.message : "Unknown error",
      },
    });
    return {};
  }
}

export async function getSpotsLeft(datetime: string): Promise<number> {
  const counts = await getOccupancyCounts();
  const taken = counts[occupancyKey(datetime)] ?? 0;
  return Math.max(0, OPEN_SESSION_CAPACITY - taken);
}

async function setOccupancyCounts(
  counts: Record<string, number>,
): Promise<void> {
  await occupancyStore.setJSON(COUNTS_KEY, counts);
}

export async function reserveOpenSessionSeats(
  datetime: string,
  guests: number,
): Promise<{ ok: true; taken: number } | { ok: false; taken: number }> {
  const key = occupancyKey(datetime);
  const counts = await getOccupancyCounts();
  const taken = counts[key] ?? 0;
  if (taken + guests > OPEN_SESSION_CAPACITY) {
    return { ok: false, taken };
  }
  const next = taken + guests;
  counts[key] = next;
  try {
    await setOccupancyCounts(counts);
    return { ok: true, taken: next };
  } catch (error) {
    createAndLogEvent("open_session_occupancy_write", {
      status: "error",
      error: {
        message: error instanceof Error ? error.message : "Unknown error",
      },
    });
    return { ok: false, taken };
  }
}

export async function releaseOpenSessionSeats(
  datetime: string,
  guests: number,
): Promise<void> {
  const key = occupancyKey(datetime);
  const counts = await getOccupancyCounts();
  const taken = counts[key] ?? 0;
  const next = Math.max(0, taken - guests);
  if (next === 0) {
    delete counts[key];
  } else {
    counts[key] = next;
  }
  try {
    await setOccupancyCounts(counts);
  } catch (error) {
    createAndLogEvent("open_session_occupancy_write", {
      status: "error",
      error: {
        message: error instanceof Error ? error.message : "Unknown error",
      },
    });
  }
}
