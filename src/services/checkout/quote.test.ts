import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AvailableTime } from "@/services/availability/types";
import { COUPLES_PRICE } from "@/services/catalog/couplesPricing";

const mocks = vi.hoisted(() => ({
  getAvailability: vi.fn<(eventType: string) => Promise<AvailableTime[]>>(),
}));

vi.mock("@/services/availability", () => ({
  getAvailability: mocks.getAvailability,
}));

const { quoteBooking } = await import("./quote");

const SLOT = "2026-10-20T12:00:00.000Z";
const COUPLES = {
  eventType: "couples",
  picture: "two_big",
  activityFormat: "splash",
} as const;

beforeEach(() => {
  mocks.getAvailability.mockReset();
});

describe("quoteBooking", () => {
  it("charges the catalog price for an undiscounted slot", async () => {
    mocks.getAvailability.mockResolvedValue([{ time: SLOT }]);

    const result = await quoteBooking({
      selection: COUPLES,
      datetime: SLOT,
      lang: "en",
    });

    expect(result).toMatchObject({
      ok: true,
      quote: {
        amountCents: COUPLES_PRICE.two_big,
        listAmountCents: COUPLES_PRICE.two_big,
        discountPercent: undefined,
        guests: 2,
        datetime: SLOT,
      },
    });
    expect(mocks.getAvailability).toHaveBeenCalledWith("couples");
  });

  it("applies the slot's own discount", async () => {
    mocks.getAvailability.mockResolvedValue([{ time: SLOT, discount: 20 }]);

    const result = await quoteBooking({
      selection: COUPLES,
      datetime: SLOT,
      lang: "en",
    });

    expect(result.ok && result.quote.amountCents).toBe(
      Math.round(COUPLES_PRICE.two_big * 0.8),
    );
    expect(result.ok && result.quote.discountPercent).toBe(20);
  });

  it("matches the slot by instant and uses Calendly's spelling of it", async () => {
    mocks.getAvailability.mockResolvedValue([{ time: SLOT }]);

    const result = await quoteBooking({
      selection: COUPLES,
      datetime: "2026-10-20T14:00:00+02:00",
      lang: "en",
    });

    expect(result.ok && result.quote.datetime).toBe(SLOT);
  });

  it("builds the product name on the server", async () => {
    mocks.getAvailability.mockResolvedValue([{ time: SLOT }]);

    const result = await quoteBooking({
      selection: COUPLES,
      datetime: SLOT,
      lang: "en",
    });

    expect(result.ok && result.quote.productName).toMatch(/\(.*, splash\)$/);
  });

  it.each([
    ["not offered", []],
    ["already booked", [{ time: SLOT, booked: true as const }]],
  ])("rejects a slot that is %s", async (_label, slots) => {
    mocks.getAvailability.mockResolvedValue(slots);

    const result = await quoteBooking({
      selection: COUPLES,
      datetime: SLOT,
      lang: "en",
    });

    expect(result).toMatchObject({ ok: false, reason: "slot_unavailable" });
  });

  it("rejects an invalid selection before looking at availability", async () => {
    const result = await quoteBooking({
      selection: {
        eventType: "friends",
        guests: 40,
        canvases: 6,
        canvasType: "standard",
        activityFormat: "splash",
      },
      datetime: SLOT,
      lang: "en",
    });

    expect(result).toMatchObject({ ok: false, reason: "invalid_selection" });
    expect(mocks.getAvailability).not.toHaveBeenCalled();
  });
});
