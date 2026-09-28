import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createMemoryBlobStore,
  type MemoryBlobStore,
} from "@/services/testing/memoryBlobs";

const mocks = vi.hoisted(() => ({
  blobStore: null as MemoryBlobStore | null,
  constructEvent: vi.fn(),
  retrieveSession: vi.fn(),
  bookEvent: vi.fn(),
  reserveOpenSessionSeats: vi.fn(),
  releaseOpenSessionSeats: vi.fn(),
  sendTelegramMessage: vi.fn(),
  sendTelegramSticker: vi.fn(),
}));

vi.mock("astro:env/server", () => ({
  STRIPE_SECRET_KEY: "sk_test",
  STRIPE_WEBHOOK_SECRET_KEY: "whsec_test",
  NETLIFY_SITE_ID: "site",
  NETLIFY_TOKEN: "token",
}));
vi.mock("@netlify/blobs", () => ({
  getStore: () =>
    new Proxy(
      {},
      {
        get: (_target, prop: keyof MemoryBlobStore) => mocks.blobStore![prop],
      },
    ),
}));
vi.mock("stripe", () => ({
  Stripe: class {
    webhooks = { constructEvent: mocks.constructEvent };
    checkout = { sessions: { retrieve: mocks.retrieveSession } };
  },
}));
vi.mock("@/services/calendly", () => ({ bookEvent: mocks.bookEvent }));
vi.mock("@/services/availability/occupancy", () => ({
  reserveOpenSessionSeats: mocks.reserveOpenSessionSeats,
  releaseOpenSessionSeats: mocks.releaseOpenSessionSeats,
}));
vi.mock("@/services/telegram", () => ({
  escapeMarkdown: (text: string) => text,
  sendTelegramMessage: mocks.sendTelegramMessage,
  sendTelegramSticker: mocks.sendTelegramSticker,
}));
vi.mock("@/services/partners", () => ({
  storePartnerBooking: vi.fn(async () => true),
}));

const { POST, formatPaymentSuccessMessage } = await import("./stripe-webhook");

const SESSION_ID = "cs_test_1";
const PROCESSING_KEY = `checkout-session/${SESSION_ID}`;

function checkoutSession(metadata: Record<string, string> = {}) {
  return {
    id: SESSION_ID,
    payment_intent: "pi_1",
    amount_total: 9000,
    metadata: {
      eventType: "open_session",
      sessionTime: "2026-10-03T11:00:00+02:00",
      sessionTitle: "Open session",
      guests: "2",
      ...metadata,
    },
    customer_details: {
      email: "guest@example.com",
      name: "Guest",
      phone: "600000000",
    },
  };
}

function deliver() {
  const request = new Request("http://localhost/api/stripe-webhook", {
    method: "POST",
    headers: { "stripe-signature": "t=1,v1=sig" },
    body: "{}",
  });
  return POST({ request } as Parameters<typeof POST>[0]) as Promise<Response>;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

describe("stripe-webhook checkout.session.completed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    mocks.blobStore = createMemoryBlobStore();
    mocks.constructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: { object: { id: SESSION_ID } },
    });
    mocks.retrieveSession.mockResolvedValue(checkoutSession());
    mocks.reserveOpenSessionSeats.mockResolvedValue({ ok: true });
    mocks.releaseOpenSessionSeats.mockResolvedValue(undefined);
    mocks.bookEvent.mockResolvedValue({ success: true });
    mocks.sendTelegramMessage.mockResolvedValue(undefined);
    mocks.sendTelegramSticker.mockResolvedValue(undefined);
  });

  it("reserves seats, books and marks the session done", async () => {
    const response = await deliver();

    expect(response.status).toBe(200);
    expect(mocks.reserveOpenSessionSeats).toHaveBeenCalledWith(
      "2026-10-03T11:00:00+02:00",
      "pi_1",
      2,
    );
    expect(mocks.bookEvent).toHaveBeenCalledTimes(1);
    expect(mocks.releaseOpenSessionSeats).not.toHaveBeenCalled();
    expect(mocks.blobStore!.peek(PROCESSING_KEY)).toMatchObject({
      state: "done",
    });
  });

  it("ignores a duplicate delivered after success", async () => {
    await deliver();
    const duplicate = await deliver();

    expect(duplicate.status).toBe(200);
    expect(mocks.reserveOpenSessionSeats).toHaveBeenCalledTimes(1);
    expect(mocks.bookEvent).toHaveBeenCalledTimes(1);
    expect(mocks.sendTelegramMessage).toHaveBeenCalledTimes(1);
  });

  it("rejects a duplicate that arrives while the first is in flight", async () => {
    const calendly = deferred<{ success: true }>();
    mocks.bookEvent.mockReturnValueOnce(calendly.promise);

    const first = deliver();
    await vi.waitFor(() => expect(mocks.bookEvent).toHaveBeenCalled());
    const duplicate = await deliver();
    calendly.resolve({ success: true });

    expect(duplicate.status).toBe(409);
    expect((await first).status).toBe(200);
    expect(mocks.reserveOpenSessionSeats).toHaveBeenCalledTimes(1);
    expect(mocks.bookEvent).toHaveBeenCalledTimes(1);
  });

  it("asks Stripe to retry when reserving seats throws, and the retry books", async () => {
    mocks.reserveOpenSessionSeats.mockRejectedValueOnce(
      new Error("store down"),
    );

    const failed = await deliver();
    expect(failed.status).toBe(500);
    expect(mocks.bookEvent).not.toHaveBeenCalled();
    expect(mocks.releaseOpenSessionSeats).not.toHaveBeenCalled();
    expect(mocks.blobStore!.peek(PROCESSING_KEY)).toBeNull();

    const retry = await deliver();
    expect(retry.status).toBe(200);
    expect(mocks.bookEvent).toHaveBeenCalledTimes(1);
    expect(mocks.blobStore!.peek(PROCESSING_KEY)).toMatchObject({
      state: "done",
    });
  });

  it("releases seats and asks Stripe to retry when Calendly throws", async () => {
    mocks.bookEvent.mockRejectedValueOnce(new Error("calendly timeout"));

    const response = await deliver();

    expect(response.status).toBe(500);
    expect(mocks.releaseOpenSessionSeats).toHaveBeenCalledWith(
      "2026-10-03T11:00:00+02:00",
      "pi_1",
    );
    expect(mocks.blobStore!.peek(PROCESSING_KEY)).toBeNull();
  });

  it("marks done instead of retrying when seats can't be released", async () => {
    mocks.bookEvent.mockRejectedValueOnce(new Error("calendly timeout"));
    mocks.releaseOpenSessionSeats.mockRejectedValueOnce(
      new Error("store down"),
    );

    const response = await deliver();
    const retry = await deliver();

    expect(response.status).toBe(200);
    expect(retry.status).toBe(200);
    expect(mocks.reserveOpenSessionSeats).toHaveBeenCalledTimes(1);
    expect(mocks.blobStore!.peek(PROCESSING_KEY)).toMatchObject({
      state: "done",
    });
  });

  it("releases seats and the claim when Calendly reports a failure", async () => {
    mocks.bookEvent.mockResolvedValueOnce({
      success: false,
      error: "slot unavailable",
    });

    const response = await deliver();

    expect(response.status).toBe(200);
    expect(mocks.releaseOpenSessionSeats).toHaveBeenCalledTimes(1);
    expect(mocks.sendTelegramMessage).toHaveBeenCalledTimes(1);
    expect(mocks.blobStore!.peek(PROCESSING_KEY)).toBeNull();
  });

  it("keys the seat hold by checkout session when there is no payment intent", async () => {
    mocks.retrieveSession.mockResolvedValueOnce({
      ...checkoutSession(),
      payment_intent: null,
    });

    await deliver();

    expect(mocks.reserveOpenSessionSeats).toHaveBeenCalledWith(
      "2026-10-03T11:00:00+02:00",
      SESSION_ID,
      2,
    );
  });

  it("notifies about a booking fully covered by a voucher", async () => {
    mocks.retrieveSession.mockResolvedValueOnce({
      ...checkoutSession(),
      payment_intent: null,
      amount_total: 0,
    });

    const response = await deliver();

    expect(response.status).toBe(200);
    expect(mocks.bookEvent).toHaveBeenCalledTimes(1);
    expect(mocks.sendTelegramMessage).toHaveBeenCalledTimes(1);
    expect(mocks.sendTelegramMessage).toHaveBeenCalledWith(
      expect.stringContaining("Gift Card Booking"),
    );
  });

  it("does not book a full session", async () => {
    mocks.reserveOpenSessionSeats.mockResolvedValueOnce({
      ok: false,
      taken: 6,
    });

    const response = await deliver();

    expect(response.status).toBe(200);
    expect(mocks.bookEvent).not.toHaveBeenCalled();
    expect(mocks.releaseOpenSessionSeats).not.toHaveBeenCalled();
    expect(mocks.sendTelegramMessage).toHaveBeenCalledTimes(1);
  });

  it("fails closed when the checkout processing store is unavailable", async () => {
    mocks.blobStore!.failNextCall();

    const response = await deliver();

    expect(response.status).toBe(500);
    expect(mocks.retrieveSession).not.toHaveBeenCalled();
    expect(mocks.reserveOpenSessionSeats).not.toHaveBeenCalled();
  });

  it("marks a session with unparseable metadata done without booking", async () => {
    mocks.retrieveSession.mockResolvedValue(
      checkoutSession({ eventType: "unknown" }),
    );

    const response = await deliver();

    expect(response.status).toBe(200);
    expect(mocks.bookEvent).not.toHaveBeenCalled();
    expect(mocks.blobStore!.peek(PROCESSING_KEY)).toMatchObject({
      state: "done",
    });
  });

  it("books other event types without touching seats", async () => {
    mocks.retrieveSession.mockResolvedValue(
      checkoutSession({ eventType: "couples" }),
    );

    const response = await deliver();
    await deliver();

    expect(response.status).toBe(200);
    expect(mocks.reserveOpenSessionSeats).not.toHaveBeenCalled();
    expect(mocks.bookEvent).toHaveBeenCalledTimes(1);
  });
});

describe("formatPaymentSuccessMessage", () => {
  it("reports a paid booking as a payment", () => {
    const message = formatPaymentSuccessMessage(9000, "Open session", "pi_1", {
      success: true,
    });

    expect(message).toContain("New Payment Received");
    expect(message).toContain("90.00 €");
    expect(message).toContain("Payment Successful");
  });

  it("reports a zero-amount booking as a gift card booking", () => {
    const message = formatPaymentSuccessMessage(0, "Open session", "", {
      success: true,
    });

    expect(message).toContain("New Gift Card Booking");
    expect(message).toContain("no payment required");
    expect(message).not.toContain("Transaction ID");
    expect(message).not.toContain("Payment Received");
  });
});
