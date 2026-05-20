import type { Discount } from "@/services/availability/types";

type SlotConfig = { time: string; discount?: Discount };

export const WEEKLY_SLOTS: Record<string, SlotConfig[]> = {
  Mon: [{ time: "14:00", discount: 20 }, { time: "16:00", discount: 20 }, { time: "18:00", discount: 10 }, { time: "19:45", discount: 10 }],
  Tue: [{ time: "14:00", discount: 20 }, { time: "16:00", discount: 20 }, { time: "18:00", discount: 10 }, { time: "19:45", discount: 10 }],
  Wed: [{ time: "12:00", discount: 20 }, { time: "14:00", discount: 20 }, { time: "16:00", discount: 20 }, { time: "18:00", discount: 10 }, { time: "19:45", discount: 10 }],
  Thu: [{ time: "14:00", discount: 20 }, { time: "16:00", discount: 20 }],
  Fri: [{ time: "12:00", discount: 10 }, { time: "14:00", discount: 10 }, { time: "16:00" }, { time: "18:00" }, { time: "19:45" }],
  Sat: [{ time: "10:15" }, { time: "12:00" }, { time: "14:00" }, { time: "16:00" }, { time: "18:00" }, { time: "19:45" }],
  Sun: [{ time: "10:15" }, { time: "12:00" }, { time: "14:00" }, { time: "16:00" }, { time: "18:00" }, { time: "19:45" }],
};
