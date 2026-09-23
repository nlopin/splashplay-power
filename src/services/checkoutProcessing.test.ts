import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createMemoryBlobStore,
  type MemoryBlobStore,
} from "./testing/memoryBlobs";

const blobs = vi.hoisted(() => ({ store: null as MemoryBlobStore | null }));

vi.mock("astro:env/server", () => ({
  NETLIFY_SITE_ID: "site",
  NETLIFY_TOKEN: "token",
}));
vi.mock("@netlify/blobs", () => ({
  getStore: () =>
    new Proxy(
      {},
      {
        get: (_target, prop: keyof MemoryBlobStore) => blobs.store![prop],
      },
    ),
}));

const {
  claimCheckoutSession,
  markCheckoutSessionDone,
  releaseCheckoutSessionClaim,
} = await import("./checkoutProcessing");

const KEY = "checkout-session/cs_1";
const LEASE_MS = 5 * 60 * 1000;

describe("checkoutProcessing", () => {
  beforeEach(() => {
    blobs.store = createMemoryBlobStore();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("claims an unseen session", async () => {
    await expect(claimCheckoutSession("cs_1")).resolves.toEqual({
      status: "claimed",
    });
    expect(blobs.store!.peek(KEY)).toMatchObject({ state: "processing" });
  });

  it("lets only one of two concurrent deliveries claim", async () => {
    const results = await Promise.all([
      claimCheckoutSession("cs_1"),
      claimCheckoutSession("cs_1"),
    ]);

    expect(results.map((r) => r.status).sort()).toEqual([
      "claimed",
      "in_flight",
    ]);
  });

  it("reports done after the session was marked done", async () => {
    await claimCheckoutSession("cs_1");
    await markCheckoutSessionDone("cs_1");

    await expect(claimCheckoutSession("cs_1")).resolves.toEqual({
      status: "done",
    });
  });

  it("allows a new claim after the previous one was released", async () => {
    await claimCheckoutSession("cs_1");
    await releaseCheckoutSessionClaim("cs_1");

    await expect(claimCheckoutSession("cs_1")).resolves.toEqual({
      status: "claimed",
    });
  });

  it("does not take over a fresh processing claim", async () => {
    vi.useFakeTimers();
    await claimCheckoutSession("cs_1");
    vi.advanceTimersByTime(LEASE_MS - 1000);

    await expect(claimCheckoutSession("cs_1")).resolves.toEqual({
      status: "in_flight",
    });
  });

  it("takes over a processing claim older than the lease", async () => {
    vi.useFakeTimers();
    await claimCheckoutSession("cs_1");
    vi.advanceTimersByTime(LEASE_MS + 1000);

    await expect(claimCheckoutSession("cs_1")).resolves.toEqual({
      status: "claimed",
    });
  });

  it("lets only one of two concurrent retries take over a stale claim", async () => {
    vi.useFakeTimers();
    await claimCheckoutSession("cs_1");
    vi.advanceTimersByTime(LEASE_MS + 1000);

    const results = await Promise.all([
      claimCheckoutSession("cs_1"),
      claimCheckoutSession("cs_1"),
    ]);

    expect(results.map((r) => r.status).sort()).toEqual([
      "claimed",
      "in_flight",
    ]);
  });

  it("treats an unreadable record as an abandoned claim", async () => {
    await blobs.store!.setJSON(KEY, { garbage: true });

    await expect(claimCheckoutSession("cs_1")).resolves.toEqual({
      status: "claimed",
    });
  });

  it("throws when the store fails", async () => {
    blobs.store!.failNextCall();

    await expect(claimCheckoutSession("cs_1")).rejects.toThrow(
      "blob store unavailable",
    );
  });
});
