import type { ActivityFormat } from "@/components/booking/eventTypeOptions/ActivityFormatSelector";

export type CanvasType = "standard" | "big";

export const MIN_GUESTS = 1;
export const MAX_GUESTS = 6;

// Big canvas price table: [guests][canvases] → price in cents. Max 2 big canvases;
// 1 guest can only take 1.
export const BIG_CANVAS_PRICES: Record<number, Record<number, number>> = {
  1: { 1: 8500 },
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

// Standard canvas price table: [guests][canvases] → price in cents
// guests 1: canvases 1→6500
// guests 2: canvases 1→7500, 2→9000
// guests 3: canvases 1→8000, 2→9500, 3→12600
// guests 4: canvases 2→10500, 3→13200, 4→14800
// guests 5: canvases 3→14000, 4→15500, 5→17500
// guests 6: canvases 3→14500, 4→16000, 5→18000, 6→19500
export const STANDARD_PRICES: Record<number, Record<number, number>> = {
  1: { 1: 6500 },
  2: { 1: 7500, 2: 9000 },
  3: { 1: 8000, 2: 9500, 3: 12600 },
  4: { 2: 10500, 3: 13200, 4: 14800 },
  5: { 3: 14000, 4: 15500, 5: 17500 },
  6: { 3: 14500, 4: 16000, 5: 18000, 6: 19500 },
};

// Min/max canvases for standard canvas per guests count
export const CANVAS_LIMITS: Record<number, { min: number; max: number }> = {
  1: { min: 1, max: 1 },
  2: { min: 1, max: 2 },
  3: { min: 1, max: 3 },
  4: { min: 2, max: 4 },
  5: { min: 3, max: 5 },
  6: { min: 3, max: 6 },
};

export function getFriendsCanvasLimits(
  guests: number,
  canvasType: CanvasType = "standard",
): { min: number; max: number } {
  const clampedGuests = Math.max(MIN_GUESTS, Math.min(guests, MAX_GUESTS));
  return canvasType === "big"
    ? BIG_CANVAS_LIMITS[clampedGuests]
    : CANVAS_LIMITS[clampedGuests];
}

// Exported so a caller building a display label uses the same clamp as the price.
export function clampFriendsCanvases(
  canvases: number,
  guests: number,
  canvasType: CanvasType = "standard",
): number {
  const limits = getFriendsCanvasLimits(guests, canvasType);
  return Math.max(limits.min, Math.min(canvases, limits.max));
}

export function calculateFriendsPrice(
  canvases: number,
  guests: number = canvases,
  canvasType: CanvasType = "standard",
): number {
  const clampedGuests = Math.max(MIN_GUESTS, Math.min(guests, MAX_GUESTS));
  const clampedCanvases = clampFriendsCanvases(canvases, guests, canvasType);

  if (canvasType === "big") {
    return BIG_CANVAS_PRICES[clampedGuests]?.[clampedCanvases] ?? 8500;
  }

  return STANDARD_PRICES[clampedGuests]?.[clampedCanvases] ?? 6000;
}

export function formatFriendsProductName(
  guests: number,
  canvases: number,
  canvasType: CanvasType,
  activityFormat: ActivityFormat,
): string {
  const canvasLabel =
    canvasType === "big"
      ? `${canvases} big ${canvases === 1 ? "canvas" : "canvases"}`
      : `${canvases} ${canvases === 1 ? "canvas" : "canvases"}`;
  return `${guests} ${guests === 1 ? "guest" : "guests"}, ${canvasLabel}, ${activityFormat}`;
}
