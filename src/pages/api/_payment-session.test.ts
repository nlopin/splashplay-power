import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";
import { COUPLES_PRICE } from "@/services/catalog/couplesPricing";

const mocks = vi.hoisted(() => ({
  getAvailability: vi.fn(),
  getSpotsLeft: vi.fn(),
  createEmbeddedCheckoutSession: vi.fn(),
}));

vi.mock("@/services/availability", () => ({
  getAvailability: mocks.getAvailability,
}));
vi.mock("@/services/availability/occupancy", () => ({
  getSpotsLeft: mocks.getSpotsLeft,
}));
vi.mock("@/services/checkout/createCheckoutSession", () => ({
  createEmbeddedCheckoutSession: mocks.createEmbeddedCheckoutSession,
}));

const { POST } = await import("./payment-session");

const SLOT = "2026-10-20T16:00:00.000Z";

function post(body: unknown): Promise<Response> {
  const request = new Request("https://splashplay.es/api/payment-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  return POST({ request } as APIContext) as Promise<Response>;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getAvailability.mockResolvedValue([{ time: SLOT }]);
  mocks.getSpotsLeft.mockResolvedValue(6);
  mocks.createEmbeddedCheckoutSession.mockResolvedValue({
    client_secret: "cs_test_secret",
  });
});

describe("POST /api/payment-session", () => {
  it("charges the catalog price, ignoring any client-sent amount and name", async () => {
    const res = await post({
      amount: 50,
      productName: "Anything I like",
      selection: {
        eventType: "couples",
        picture: "two_big",
        activityFormat: "splash",
      },
      datetime: SLOT,
      lang: "es",
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      clientSecret: "cs_test_secret",
      amountCents: COUPLES_PRICE.two_big,
    });
    expect(mocks.createEmbeddedCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: COUPLES_PRICE.two_big,
        eventType: "couples",
        guests: 2,
        datetime: SLOT,
      }),
    );
    const { productName } =
      mocks.createEmbeddedCheckoutSession.mock.calls[0][0];
    expect(productName).not.toContain("Anything I like");
  });

  it("applies the discount of the slot from server availability", async () => {
    mocks.getAvailability.mockResolvedValue([{ time: SLOT, discount: 15 }]);

    await post({
      selection: { eventType: "individual" },
      datetime: SLOT,
    });

    expect(mocks.createEmbeddedCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({ amount: Math.round(6000 * 0.85) }),
    );
  });

  it("rejects the old amount-based payload", async () => {
    const res = await post({
      amount: 50,
      productName: "x",
      guests: 2,
      eventType: "couples",
      datetime: SLOT,
    });

    expect(res.status).toBe(400);
    expect(mocks.createEmbeddedCheckoutSession).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON with 400", async () => {
    const res = await post("{not json");
    expect(res.status).toBe(400);
  });

  it("refuses a time that isn't an open slot", async () => {
    mocks.getAvailability.mockResolvedValue([{ time: SLOT, booked: true }]);

    const res = await post({
      selection: { eventType: "individual" },
      datetime: SLOT,
    });

    expect(res.status).toBe(409);
    expect(mocks.createEmbeddedCheckoutSession).not.toHaveBeenCalled();
  });

  it("refuses an open session without enough seats left", async () => {
    mocks.getSpotsLeft.mockResolvedValue(1);

    const res = await post({
      selection: {
        eventType: "open_session",
        openCart: { solo: 0, pair_shared: 1, pair_two: 0 },
      },
      datetime: SLOT,
    });

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "slot_full" });
    expect(mocks.createEmbeddedCheckoutSession).not.toHaveBeenCalled();
  });
});
