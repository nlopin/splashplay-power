import type { ActivityFormat } from "@/components/booking/eventTypeOptions/ActivityFormatSelector";

export type CanvasType = "standard" | "big";

export const MIN_ADULTS = 1;
export const MIN_KIDS = 0;
export const MAX_TOTAL = 6;

// Big canvas price table: indexed by total guests (2–6)
export const BIG_CANVAS_PRICES: Record<number, number> = {
  2: 9000,
  3: 9500,
  4: 10500,
  5: 11500,
  6: 12500,
};

// Standard canvas price table: [totalGuests][canvases] → price in cents
export const STANDARD_PRICES: Record<number, Record<number, number>> = {
  1: { 1: 6000 },
  2: { 1: 7500, 2: 9000 },
  3: { 1: 8000, 2: 9500, 3: 12000 },
  4: { 2: 10500, 3: 12800, 4: 14000 },
  5: { 3: 13500, 4: 14900, 5: 16000 },
  6: { 3: 14500, 4: 15500, 5: 16500, 6: 18000 },
};

// Min/max canvases for standard canvas per total guests count
export const CANVAS_LIMITS: Record<number, { min: number; max: number }> = {
  1: { min: 1, max: 1 },
  2: { min: 1, max: 2 },
  3: { min: 1, max: 3 },
  4: { min: 2, max: 4 },
  5: { min: 3, max: 5 },
  6: { min: 3, max: 6 },
};

// Exported so a caller building a display label uses the same clamp as the price.
export function clampFamilyCanvases(canvases: number, totalGuests: number): number {
  const clampedTotal = Math.max(1, Math.min(totalGuests, MAX_TOTAL));
  const limits = CANVAS_LIMITS[clampedTotal];
  return Math.max(limits.min, Math.min(canvases, limits.max));
}

export function calculateFamilyPrice(
  canvases: number,
  totalGuests: number = 2,
  canvasType: CanvasType = "standard",
): number {
  if (canvasType === "big") {
    const clamped = Math.max(2, Math.min(totalGuests, MAX_TOTAL));
    return BIG_CANVAS_PRICES[clamped] ?? 8000;
  }
  const clampedTotal = Math.max(1, Math.min(totalGuests, MAX_TOTAL));
  const clampedCanvases = clampFamilyCanvases(canvases, totalGuests);
  return STANDARD_PRICES[clampedTotal]?.[clampedCanvases] ?? 6000;
}

export function formatFamilyProductName(
  adults: number,
  kids: number,
  canvases: number,
  canvasType: CanvasType,
  activityFormat: ActivityFormat,
): string {
  const canvasLabel =
    canvasType === "big"
      ? "big canvas"
      : `${canvases} ${canvases === 1 ? "canvas" : "canvases"}`;
  return `${adults} ${adults === 1 ? "adult" : "adults"}, ${kids} ${kids === 1 ? "kid" : "kids"}, ${canvasLabel}, ${activityFormat}`;
}
