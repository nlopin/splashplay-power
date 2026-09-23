import { describe, it, expect, vi } from "vitest";
import {
  applyOccupancyToSlots,
  countsFromLedger,
  dropHold,
  holdSeats,
  isOccupancyLedger,
  occupancyKey,
  OccupancyStoreError,
  updateSlotHolds,
  type OccupancyCasStore,
  type OccupancyLedger,
} from "./occupancyLogic";

const SLOT = "2026-09-28T16:00:00.000Z";

describe("applyOccupancyToSlots", () => {
  it("keeps a Calendly-open empty slot with 6 seats", () => {
    const result = applyOccupancyToSlots([{ time: SLOT }], {});
    expect(result).toEqual([{ time: SLOT, spotsLeft: 6 }]);
  });

  it("leaves a Calendly-closed empty slot booked (private took it)", () => {
    const result = applyOccupancyToSlots([{ time: SLOT, booked: true }], {});
    expect(result).toEqual([{ time: SLOT, booked: true, spotsLeft: 0 }]);
  });

  it("reopens a Calendly-closed slot when people already joined", () => {
    const result = applyOccupancyToSlots([{ time: SLOT, booked: true }], {
      [occupancyKey(SLOT)]: 2,
    });
    expect(result).toEqual([{ time: SLOT, spotsLeft: 4 }]);
  });

  it("counts couple tickets as two people", () => {
    const result = applyOccupancyToSlots([{ time: SLOT }], {
      [occupancyKey(SLOT)]: 5,
    });
    expect(result).toEqual([{ time: SLOT, spotsLeft: 1 }]);
  });

  it("marks the slot booked at 6 people", () => {
    const result = applyOccupancyToSlots([{ time: SLOT }], {
      [occupancyKey(SLOT)]: 6,
    });
    expect(result).toEqual([{ time: SLOT, booked: true, spotsLeft: 0 }]);
  });
});

function memoryStore(initial: OccupancyLedger | null = null) {
  const clone = (ledger: OccupancyLedger): OccupancyLedger =>
    structuredClone(ledger);
  let blob: { ledger: OccupancyLedger; etag: string } | null = initial
    ? { ledger: clone(initial), etag: "v0" }
    : null;
  let version = 0;
  const tick = () => new Promise((r) => setTimeout(r, 0));
  const store: OccupancyCasStore & { snapshot(): OccupancyLedger | null } = {
    async read() {
      await tick();
      return blob ? { ledger: clone(blob.ledger), etag: blob.etag } : null;
    },
    async write(ledger, etag) {
      await tick();
      if (etag === undefined ? blob !== null : blob?.etag !== etag) {
        return false;
      }
      blob = { ledger: clone(ledger), etag: `v${++version}` };
      return true;
    },
    snapshot: () => (blob ? clone(blob.ledger) : null),
  };
  return store;
}

const AT = 1_700_000_000_000;
const hold = (guests: number) => ({ guests, at: AT });
const reserve = (key: string, guests: number) => holdSeats(key, guests, 6, AT);

describe("updateSlotHolds", () => {
  const KEY = occupancyKey(SLOT);
  const OTHER = "2026-09-29T16:00:00.000Z";

  it("never oversells under concurrent reservations", async () => {
    const store = memoryStore({
      [KEY]: { pi_a: hold(4) },
      [OTHER]: { pi_z: hold(3) },
    });
    const results = await Promise.all([
      updateSlotHolds(store, KEY, reserve("pi_b", 2)),
      updateSlotHolds(store, KEY, reserve("pi_c", 2)),
    ]);
    expect(results.filter((r) => r.written)).toHaveLength(1);
    expect(countsFromLedger(store.snapshot()!)).toEqual({
      [KEY]: 6,
      [OTHER]: 3,
    });
  });

  it("counts every concurrent reservation that fits", async () => {
    const store = memoryStore();
    const results = await Promise.all(
      ["a", "b", "c", "d", "e", "f", "g"].map((id) =>
        updateSlotHolds(store, KEY, reserve(`pi_${id}`, 1), 20),
      ),
    );
    expect(results.filter((r) => r.written)).toHaveLength(6);
    expect(countsFromLedger(store.snapshot()!)).toEqual({ [KEY]: 6 });
  });

  it("does not write when capacity is exceeded", async () => {
    const store = memoryStore({ [KEY]: { pi_a: hold(5) } });
    const result = await updateSlotHolds(store, KEY, reserve("pi_b", 2));
    expect(result).toEqual({ written: false, holds: { pi_a: hold(5) } });
    expect(store.snapshot()).toEqual({ [KEY]: { pi_a: hold(5) } });
  });

  it("does not count the same booking twice", async () => {
    const store = memoryStore({ [KEY]: { pi_a: hold(2) } });
    const write = vi.spyOn(store, "write");
    const result = await updateSlotHolds(store, KEY, reserve("pi_a", 2));
    expect(result.written).toBe(true);
    expect(write).not.toHaveBeenCalled();
    expect(store.snapshot()).toEqual({ [KEY]: { pi_a: hold(2) } });
  });

  it("re-reserving a held booking succeeds even when the slot is full", async () => {
    const store = memoryStore({ [KEY]: { pi_a: hold(2), pi_b: hold(4) } });
    const result = await updateSlotHolds(store, KEY, reserve("pi_a", 2));
    expect(result.written).toBe(true);
  });

  it("releases only the given booking, keeping other slots", async () => {
    const store = memoryStore({
      [KEY]: { pi_a: hold(2), pi_b: hold(1) },
      [OTHER]: { pi_z: hold(3) },
    });
    await updateSlotHolds(store, KEY, dropHold("pi_a"));
    expect(store.snapshot()).toEqual({
      [KEY]: { pi_b: hold(1) },
      [OTHER]: { pi_z: hold(3) },
    });
  });

  it("removes the slot when its last booking is released", async () => {
    const store = memoryStore({
      [KEY]: { pi_a: hold(2) },
      [OTHER]: { pi_z: hold(3) },
    });
    await updateSlotHolds(store, KEY, dropHold("pi_a"));
    expect(store.snapshot()).toEqual({ [OTHER]: { pi_z: hold(3) } });
  });

  it("releasing twice is a no-op", async () => {
    const store = memoryStore({ [KEY]: { pi_a: hold(2), pi_b: hold(1) } });
    await updateSlotHolds(store, KEY, dropHold("pi_a"));
    const write = vi.spyOn(store, "write");
    await updateSlotHolds(store, KEY, dropHold("pi_a"));
    expect(write).not.toHaveBeenCalled();
    expect(store.snapshot()).toEqual({ [KEY]: { pi_b: hold(1) } });
  });

  it("propagates read failures instead of treating them as empty", async () => {
    const store = memoryStore({ [OTHER]: { pi_z: hold(3) } });
    store.read = async () => {
      throw new OccupancyStoreError("boom");
    };
    const write = vi.spyOn(store, "write");
    await expect(
      updateSlotHolds(store, KEY, reserve("pi_a", 2)),
    ).rejects.toThrow("boom");
    expect(write).not.toHaveBeenCalled();
    expect(store.snapshot()).toEqual({ [OTHER]: { pi_z: hold(3) } });
  });

  it("gives up after bounded retries when it keeps losing the race", async () => {
    const store = memoryStore({ [KEY]: { pi_a: hold(1) } });
    store.write = async () => false;
    await expect(
      updateSlotHolds(store, KEY, reserve("pi_b", 1), 3),
    ).rejects.toThrow(OccupancyStoreError);
  });
});

describe("countsFromLedger", () => {
  it("sums people per slot", () => {
    expect(
      countsFromLedger({
        [SLOT]: { pi_a: hold(2), pi_b: hold(1) },
        "2026-09-29T16:00:00.000Z": { pi_c: hold(4) },
      }),
    ).toEqual({ [SLOT]: 3, "2026-09-29T16:00:00.000Z": 4 });
  });
});

describe("isOccupancyLedger", () => {
  it("rejects corrupt payloads", () => {
    expect(isOccupancyLedger(null)).toBe(false);
    expect(isOccupancyLedger("x")).toBe(false);
    expect(isOccupancyLedger([1, 2])).toBe(false);
    expect(isOccupancyLedger({ [SLOT]: 2 })).toBe(false);
    expect(isOccupancyLedger({ [SLOT]: { pi_a: 2 } })).toBe(false);
    expect(isOccupancyLedger({ [SLOT]: { pi_a: { guests: 0, at: AT } } })).toBe(
      false,
    );
    expect(
      isOccupancyLedger({ [SLOT]: { pi_a: { guests: 1.5, at: AT } } }),
    ).toBe(false);
    expect(isOccupancyLedger({ [SLOT]: { pi_a: { guests: 2 } } })).toBe(false);
    expect(isOccupancyLedger({ [SLOT]: { pi_a: hold(2) } })).toBe(true);
    expect(isOccupancyLedger({ [SLOT]: {} })).toBe(true);
    expect(isOccupancyLedger({})).toBe(true);
  });
});
