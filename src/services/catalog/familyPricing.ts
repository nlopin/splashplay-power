import type { ActivityFormat } from "@/components/booking/eventTypeOptions/ActivityFormatSelector";

export type CanvasType = "standard" | "big";

export const MIN_ADULTS = 1;
export const MIN_KIDS = 0;
export const MAX_TOTAL = 6;

// Big canvas price table: [totalGuests][canvases] → price in cents. Max 2 big
// canvases; 1 guest can only take 1. One guest on one big canvas is charged as
// the 2-person rate (90€), matching the previous min-2 clamp.
export const BIG_CANVAS_PRICES: Record<number, Record<number, number>> = {
  1: { 1: 9000 },
  2: { 1: 9000, 2: 12400 },
  3: { 1: 9600, 2: 13500 },
  4: { 1: 10800, 2: 14400 },
  5: { 1: 12000, 2: 15500 },
  6: { 1: 13200, 2: 16800 },
};

export const BIG_CANVAS_LIMITS: Record<number, { min: number; max: number }> = {
  1: { min: 1, max: 1 },
  2: { min: 1, max: 2 },
  3: { min: 1, max: 2 },
  4: { min: 1, max: 2 },
  5: { min: 1, max: 2 },
  6: { min: 1, max: 2 },
};

// Standard canvas price table: [totalGuests][canvases] → price in cents
export const STANDARD_PRICES: Record<number, Record<number, number>> = {
  1: { 1: 6000 },
  2: { 1: 7500, 2: 9000 },
  3: { 1: 8000, 2: 9500, 3: 12600 },
  4: { 2: 10500, 3: 13200, 4: 14800 },
  5: { 3: 14000, 4: 15500, 5: 17500 },
  6: { 3: 14500, 4: 16000, 5: 18000, 6: 19500 },
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

export function getFamilyCanvasLimits(
  totalGuests: number,
  canvasType: CanvasType = "standard",
): { min: number; max: number } {
  const clampedTotal = Math.max(1, Math.min(totalGuests, MAX_TOTAL));
  return canvasType === "big"
    ? BIG_CANVAS_LIMITS[clampedTotal]
    : CANVAS_LIMITS[clampedTotal];
}

// Exported so a caller building a display label uses the same clamp as the price.
export function clampFamilyCanvases(
  canvases: number,
  totalGuests: number,
  canvasType: CanvasType = "standard",
): number {
  const limits = getFamilyCanvasLimits(totalGuests, canvasType);
  return Math.max(limits.min, Math.min(canvases, limits.max));
}

export function calculateFamilyPrice(
  canvases: number,
  totalGuests: number = 2,
  canvasType: CanvasType = "standard",
): number {
  const clampedTotal = Math.max(1, Math.min(totalGuests, MAX_TOTAL));
  const clampedCanvases = clampFamilyCanvases(canvases, totalGuests, canvasType);

  if (canvasType === "big") {
    return BIG_CANVAS_PRICES[clampedTotal]?.[clampedCanvases] ?? 9000;
  }

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
      ? `${canvases} big ${canvases === 1 ? "canvas" : "canvases"}`
      : `${canvases} ${canvases === 1 ? "canvas" : "canvases"}`;
  return `${adults} ${adults === 1 ? "adult" : "adults"}, ${kids} ${kids === 1 ? "kid" : "kids"}, ${canvasLabel}, ${activityFormat}`;
}
