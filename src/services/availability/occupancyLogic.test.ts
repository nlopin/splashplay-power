import { describe, it, expect, vi } from "vitest";
import {
  applyOccupancyToSlots,
  isOccupancyCounts,
  occupancyKey,
  OccupancyStoreError,
  updateSlotCount,
  type OccupancyCasStore,
  type OccupancyCounts,
} from "./occupancyLogic";

const SLOT = "2026-09-28T16:00:00.000Z";

describe("applyOccupancyToSlots", () => {
  it("keeps a Calendly-open empty slot with 6 seats", () => {
    const result = applyOccupancyToSlots([{ time: SLOT }], {});
    expect(result).toEqual([{ time: SLOT, spotsLeft: 6 }]);
  });

  it("leaves a Calendly-closed empty slot booked (private took it)", () => {
    const result = applyOccupancyToSlots(
      [{ time: SLOT, booked: true }],
      {},
    );
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

function memoryStore(initial: OccupancyCounts | null = null) {
  let blob: { counts: OccupancyCounts; etag: string } | null = initial
    ? { counts: { ...initial }, etag: "v0" }
    : null;
  let version = 0;
  const tick = () => new Promise((r) => setTimeout(r, 0));
  const store: OccupancyCasStore & { snapshot(): OccupancyCounts | null } = {
    async read() {
      await tick();
      return blob ? { counts: { ...blob.counts }, etag: blob.etag } : null;
    },
    async write(counts, etag) {
      await tick();
      if (etag === undefined ? blob !== null : blob?.etag !== etag) {
        return false;
      }
      blob = { counts: { ...counts }, etag: `v${++version}` };
      return true;
    },
    snapshot: () => (blob ? { ...blob.counts } : null),
  };
  return store;
}

const reserve = (guests: number) => (taken: number) =>
  taken + guests > 6 ? null : taken + guests;

describe("updateSlotCount", () => {
  const KEY = occupancyKey(SLOT);
  const OTHER = "2026-09-29T16:00:00.000Z";

  it("never oversells under concurrent reservations", async () => {
    const store = memoryStore({ [KEY]: 4, [OTHER]: 3 });
    const results = await Promise.all([
      updateSlotCount(store, KEY, reserve(2)),
      updateSlotCount(store, KEY, reserve(2)),
    ]);
    expect(results.filter((r) => r.written)).toHaveLength(1);
    expect(store.snapshot()).toEqual({ [KEY]: 6, [OTHER]: 3 });
  });

  it("counts every concurrent reservation that fits", async () => {
    const store = memoryStore();
    const results = await Promise.all(
      [1, 1, 1, 1, 1, 1, 1].map((g) =>
        updateSlotCount(store, KEY, reserve(g), 20),
      ),
    );
    expect(results.filter((r) => r.written)).toHaveLength(6);
    expect(store.snapshot()).toEqual({ [KEY]: 6 });
  });

  it("does not write when capacity is exceeded", async () => {
    const store = memoryStore({ [KEY]: 5 });
    const result = await updateSlotCount(store, KEY, reserve(2));
    expect(result).toEqual({ written: false, taken: 5 });
    expect(store.snapshot()).toEqual({ [KEY]: 5 });
  });

  it("removes the key when released to zero, keeping other slots", async () => {
    const store = memoryStore({ [KEY]: 2, [OTHER]: 3 });
    await updateSlotCount(store, KEY, (t) => Math.max(0, t - 2));
    expect(store.snapshot()).toEqual({ [OTHER]: 3 });
  });

  it("propagates read failures instead of treating them as empty", async () => {
    const store = memoryStore({ [OTHER]: 3 });
    store.read = async () => {
      throw new OccupancyStoreError("boom");
    };
    const write = vi.spyOn(store, "write");
    await expect(updateSlotCount(store, KEY, reserve(2))).rejects.toThrow(
      "boom",
    );
    expect(write).not.toHaveBeenCalled();
    expect(store.snapshot()).toEqual({ [OTHER]: 3 });
  });

  it("gives up after bounded retries when it keeps losing the race", async () => {
    const store = memoryStore({ [KEY]: 1 });
    store.write = async () => false;
    await expect(updateSlotCount(store, KEY, reserve(1), 3)).rejects.toThrow(
      OccupancyStoreError,
    );
  });
});

describe("isOccupancyCounts", () => {
  it("rejects corrupt payloads", () => {
    expect(isOccupancyCounts(null)).toBe(false);
    expect(isOccupancyCounts("x")).toBe(false);
    expect(isOccupancyCounts([1, 2])).toBe(false);
    expect(isOccupancyCounts({ a: "1" })).toBe(false);
    expect(isOccupancyCounts({ a: -1 })).toBe(false);
    expect(isOccupancyCounts({ a: Number.NaN })).toBe(false);
    expect(isOccupancyCounts({ a: 2 })).toBe(true);
    expect(isOccupancyCounts({})).toBe(true);
  });
});
