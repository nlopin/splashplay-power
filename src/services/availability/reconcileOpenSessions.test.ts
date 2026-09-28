import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OccupancyLedger } from "./occupancyLogic";

const mocks = vi.hoisted(() => ({
  listActiveInvitees: vi.fn(),
  guestsForTransaction: vi.fn(),
  sendTelegramMessage: vi.fn(),
  ledger: {} as OccupancyLedger,
  written: null as OccupancyLedger | null,
}));

vi.mock("@/services/calendly", () => ({
  listActiveInvitees: mocks.listActiveInvitees,
}));
vi.mock("./openSessionBookings", () => ({
  bookingKeyFor: ({
    transactionId,
    inviteeUri,
  }: {
    transactionId: string;
    inviteeUri: string;
  }) => transactionId || inviteeUri,
  guestsForTransaction: mocks.guestsForTransaction,
}));
vi.mock("./occupancy", () => ({
  readOpenSessionLedger: async () => mocks.ledger,
  updateOpenSessionLedger: async <T>(
    decide: (ledger: OccupancyLedger) => {
      next: OccupancyLedger | null;
      result: T;
    },
  ) => {
    const { next, result } = decide(mocks.ledger);
    if (next) mocks.written = next;
    return result;
  },
}));
vi.mock("@/services/telegram", () => ({
  escapeMarkdown: (text: string) => text,
  sendTelegramMessage: mocks.sendTelegramMessage,
}));

const { reconcileOpenSessionSeats } = await import("./reconcileOpenSessions");

const NOW = Date.parse("2026-09-23T10:00:00.000Z");
const SLOT = "2026-10-03T09:00:00.000Z";
const invitee = (id: string, comment: string) => ({
  startTime: SLOT,
  inviteeUri: `https://api.calendly.com/invitees/${id}`,
  comment,
});

describe("reconcileOpenSessionSeats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.ledger = {};
    mocks.written = null;
    mocks.sendTelegramMessage.mockResolvedValue(true);
    mocks.guestsForTransaction.mockResolvedValue(2);
  });

  it("changes nothing when Calendly can't be read", async () => {
    mocks.ledger = { [SLOT]: { pi_a: { guests: 2, at: 0 } } };
    mocks.listActiveInvitees.mockRejectedValue(new Error("HTTP 500"));

    await expect(reconcileOpenSessionSeats(NOW)).rejects.toThrow("HTTP 500");
    expect(mocks.written).toBeNull();
    expect(mocks.sendTelegramMessage).not.toHaveBeenCalled();
  });

  it("looks up headcounts only for bookings the ledger is missing", async () => {
    mocks.ledger = { [SLOT]: { pi_a: { guests: 2, at: 0 } } };
    mocks.listActiveInvitees.mockResolvedValue([
      invitee("1", "Open session\nTransaction ID: pi_a"),
      invitee("2", "Open session\nTransaction ID: pi_b"),
    ]);

    const summary = await reconcileOpenSessionSeats(NOW);

    expect(mocks.guestsForTransaction).toHaveBeenCalledTimes(1);
    expect(mocks.guestsForTransaction).toHaveBeenCalledWith("pi_b");
    expect(mocks.written).toEqual({
      [SLOT]: { pi_a: { guests: 2, at: 0 }, pi_b: { guests: 2, at: NOW } },
    });
    expect(summary.changes).toHaveLength(1);
    expect(mocks.sendTelegramMessage).toHaveBeenCalledWith(
      expect.stringContaining("added pi_b (2 people)"),
    );
  });

  it("stays quiet when nothing needs fixing", async () => {
    mocks.ledger = { [SLOT]: { pi_a: { guests: 2, at: 0 } } };
    mocks.listActiveInvitees.mockResolvedValue([
      invitee("1", "Transaction ID: pi_a"),
    ]);

    await reconcileOpenSessionSeats(NOW);

    expect(mocks.written).toBeNull();
    expect(mocks.sendTelegramMessage).not.toHaveBeenCalled();
  });
});
