import { describe, it, expect } from "vitest";
import { applyOccupancyToSlots, occupancyKey } from "./occupancyLogic";

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
