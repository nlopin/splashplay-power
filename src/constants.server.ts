import type { Discount } from "@/services/availability/types";

type SlotConfig = { time: string; discount?: Discount };

// DD-MM dates always treated as non-discount (public holidays)
export const HOLIDAYS = new Set<string>([
  "25-05", // Lunes de Pentecostés
  "24-06", // Sant Joan (Cataluña)
  "11-09", // Diada de Catalunya
  "24-09", // La Mercè (Barcelona)
  "12-10", // Día de la Hispanidad
  "08-12", // Inmaculada Concepción
  "25-12", // Navidad
]);

export const WEEKLY_SLOTS: Record<string, SlotConfig[]> = {
  Mon: [
    { time: "14:00", discount: 20 },
    { time: "16:00", discount: 20 },
    { time: "18:00", discount: 10 },
    { time: "19:45", discount: 10 },
  ],
  Tue: [
    { time: "14:00", discount: 20 },
    { time: "16:00", discount: 20 },
    { time: "18:00", discount: 10 },
    { time: "19:45", discount: 10 },
  ],
  Wed: [
    { time: "12:00", discount: 20 },
    { time: "14:00", discount: 20 },
    { time: "16:00", discount: 20 },
    { time: "18:00", discount: 10 },
    { time: "19:45", discount: 10 },
  ],
  Thu: [
    { time: "12:00", discount: 20 },
    { time: "14:00", discount: 20 },
    { time: "16:00", discount: 20 },
    { time: "18:00", discount: 10 },
    { time: "19:45", discount: 10 },
  ],
  Fri: [
    { time: "12:00", discount: 10 },
    { time: "14:00", discount: 10 },
    { time: "16:00" },
    { time: "18:00" },
    { time: "19:45" },
  ],
  Sat: [
    { time: "10:15" },
    { time: "12:00" },
    { time: "14:00" },
    { time: "16:00" },
    { time: "18:00" },
    { time: "19:45" },
  ],
  Sun: [
    { time: "10:15" },
    { time: "12:00" },
    { time: "14:00" },
    { time: "16:00" },
    { time: "18:00" },
    { time: "19:45" },
  ],
};
