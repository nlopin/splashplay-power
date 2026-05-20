import type { Discount } from "@/services/availability/types";

type SlotConfig = { time: string; discount?: Discount };

// MM-DD dates always treated as non-discount (public holidays)
export const NON_DISCOUNT_DATES = new Set<string>([
  "05-25", // Lunes de Pentecostés
  "06-24", // Sant Joan (Cataluña)
  "09-11", // Diada de Catalunya
  "09-24", // La Mercè (Barcelona)
  "10-12", // Día de la Hispanidad
  "12-08", // Inmaculada Concepción
  "12-25", // Navidad
]);

export const WEEKLY_SLOTS: Record<string, SlotConfig[]> = {
  Mon: [{ time: "14:00", discount: 20 }, { time: "16:00", discount: 20 }, { time: "18:00", discount: 10 }, { time: "19:45", discount: 10 }],
  Tue: [{ time: "14:00", discount: 20 }, { time: "16:00", discount: 20 }, { time: "18:00", discount: 10 }, { time: "19:45", discount: 10 }],
  Wed: [{ time: "12:00", discount: 20 }, { time: "14:00", discount: 20 }, { time: "16:00", discount: 20 }, { time: "18:00", discount: 10 }, { time: "19:45", discount: 10 }],
  Thu: [{ time: "14:00", discount: 20 }, { time: "16:00", discount: 20 }],
  Fri: [{ time: "12:00", discount: 10 }, { time: "14:00", discount: 10 }, { time: "16:00" }, { time: "18:00" }, { time: "19:45" }],
  Sat: [{ time: "10:15" }, { time: "12:00" }, { time: "14:00" }, { time: "16:00" }, { time: "18:00" }, { time: "19:45" }],
  Sun: [{ time: "10:15" }, { time: "12:00" }, { time: "14:00" }, { time: "16:00" }, { time: "18:00" }, { time: "19:45" }],
};
