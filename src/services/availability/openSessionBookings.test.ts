import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getOpenSessionHold: vi.fn(),
  recordOpenSessionSeats: vi.fn(),
  releaseOpenSessionSeats: vi.fn(),
  listSessions: vi.fn(),
  retrieveSession: vi.fn(),
  sendTelegramMessage: vi.fn(),
}));

vi.mock("./occupancy", () => ({
  getOpenSessionHold: mocks.getOpenSessionHold,
  recordOpenSessionSeats: mocks.recordOpenSessionSeats,
  releaseOpenSessionSeats: mocks.releaseOpenSessionSeats,
}));
vi.mock("@/services/checkout/stripeClient", () => ({
  stripe: {
    checkout: {
      sessions: { list: mocks.listSessions, retrieve: mocks.retrieveSession },
    },
  },
}));
vi.mock("@/services/telegram", () => ({
  escapeMarkdown: (text: string) => text,
  sendTelegramMessage: mocks.sendTelegramMessage,
}));

const { syncInviteeCanceled, syncInviteeCreated } =
  await import("./openSessionBookings");

const SLOT = "2026-10-03T11:00:00+02:00";
const INVITEE = "https://api.calendly.com/scheduled_events/e1/invitees/i1";
const ours = { startTime: SLOT, transactionId: "pi_1", inviteeUri: INVITEE };
const external = { startTime: SLOT, transactionId: "", inviteeUri: INVITEE };

describe("syncInviteeCreated", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getOpenSessionHold.mockResolvedValue(null);
    mocks.recordOpenSessionSeats.mockResolvedValue({ taken: 2 });
    mocks.listSessions.mockResolvedValue({
      data: [{ metadata: { guests: "2" } }],
    });
    mocks.sendTelegramMessage.mockResolvedValue(true);
  });

  it("leaves a booking from our checkout alone", async () => {
    mocks.getOpenSessionHold.mockResolvedValue({ guests: 2, at: 1 });

    expect(await syncInviteeCreated(ours)).toEqual({
      status: "already_held",
    });
    expect(mocks.getOpenSessionHold).toHaveBeenCalledWith(SLOT, "pi_1");
    expect(mocks.recordOpenSessionSeats).not.toHaveBeenCalled();
    expect(mocks.listSessions).not.toHaveBeenCalled();
    expect(mocks.sendTelegramMessage).not.toHaveBeenCalled();
  });

  it("records a rescheduled booking with its headcount from Stripe", async () => {
    expect(await syncInviteeCreated(ours)).toEqual({
      status: "recorded",
      guests: 2,
      taken: 2,
      guestsSource: "stripe",
    });
    expect(mocks.listSessions).toHaveBeenCalledWith({
      payment_intent: "pi_1",
      limit: 1,
    });
    expect(mocks.recordOpenSessionSeats).toHaveBeenCalledWith(SLOT, "pi_1", 2);
    expect(mocks.sendTelegramMessage).not.toHaveBeenCalled();
  });

  it("looks up checkout-session keys directly", async () => {
    mocks.retrieveSession.mockResolvedValue({ metadata: { guests: "3" } });

    await syncInviteeCreated({ ...ours, transactionId: "cs_1" });

    expect(mocks.retrieveSession).toHaveBeenCalledWith("cs_1");
    expect(mocks.recordOpenSessionSeats).toHaveBeenCalledWith(SLOT, "cs_1", 3);
  });

  it("counts a booking made in Calendly as 1 person and alerts", async () => {
    mocks.recordOpenSessionSeats.mockResolvedValue({ taken: 1 });

    expect(await syncInviteeCreated(external)).toMatchObject({
      status: "recorded",
      guests: 1,
      guestsSource: "assumed",
    });
    expect(mocks.recordOpenSessionSeats).toHaveBeenCalledWith(SLOT, INVITEE, 1);
    expect(mocks.listSessions).not.toHaveBeenCalled();
    expect(mocks.sendTelegramMessage).toHaveBeenCalledWith(
      expect.stringContaining("Booked outside our checkout"),
    );
  });

  it("falls back to 1 person when Stripe has no headcount", async () => {
    mocks.listSessions.mockRejectedValue(new Error("stripe down"));

    expect(await syncInviteeCreated(ours)).toMatchObject({
      guests: 1,
      guestsSource: "assumed",
    });
    expect(mocks.sendTelegramMessage).toHaveBeenCalledWith(
      expect.stringContaining("Couldn't find the headcount for pi_1"),
    );
  });

  it("records an overbooked slot and alerts", async () => {
    mocks.recordOpenSessionSeats.mockResolvedValue({ taken: 7 });

    expect(await syncInviteeCreated(ours)).toMatchObject({
      status: "recorded",
      taken: 7,
    });
    expect(mocks.sendTelegramMessage).toHaveBeenCalledWith(
      expect.stringContaining("Overbooked: 7 people for 6 seats"),
    );
  });

  it("reports and alerts when the store fails", async () => {
    mocks.getOpenSessionHold.mockRejectedValue(new Error("store down"));

    expect(await syncInviteeCreated(ours)).toEqual({
      status: "error",
      error: "store down",
    });
    expect(mocks.recordOpenSessionSeats).not.toHaveBeenCalled();
    expect(mocks.sendTelegramMessage).toHaveBeenCalledWith(
      expect.stringContaining("Couldn't record seats"),
    );
  });
});

describe("syncInviteeCanceled", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.releaseOpenSessionSeats.mockResolvedValue(undefined);
    mocks.sendTelegramMessage.mockResolvedValue(true);
  });

  it("releases the booking's seats by transaction id", async () => {
    expect(await syncInviteeCanceled(ours)).toEqual({ status: "released" });
    expect(mocks.releaseOpenSessionSeats).toHaveBeenCalledWith(SLOT, "pi_1");
  });

  it("releases a Calendly-made booking by invitee URI", async () => {
    await syncInviteeCanceled(external);
    expect(mocks.releaseOpenSessionSeats).toHaveBeenCalledWith(SLOT, INVITEE);
  });

  it("reports and alerts when the store fails", async () => {
    mocks.releaseOpenSessionSeats.mockRejectedValue(new Error("store down"));

    expect(await syncInviteeCanceled(ours)).toEqual({
      status: "error",
      error: "store down",
    });
    expect(mocks.sendTelegramMessage).toHaveBeenCalledWith(
      expect.stringContaining("Couldn't release seats"),
    );
  });
});
