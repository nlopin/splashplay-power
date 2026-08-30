import type { ActivityFormat } from "@/components/booking/eventTypeOptions/ActivityFormatSelector";

export type CanvasType = "standard" | "big";

export const MIN_GUESTS = 1;
export const MAX_GUESTS = 6;

// Big canvas price table: indexed by guests (1–6)
export const BIG_CANVAS_PRICES: Record<number, number> = {
  1: 8500,
  2: 9000,
  3: 9600,
  4: 10800,
  5: 12000,
  6: 13200,
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

// Exported so a caller building a display label uses the same clamp as the price.
export function clampFriendsCanvases(canvases: number, guests: number): number {
  const clampedGuests = Math.max(MIN_GUESTS, Math.min(guests, MAX_GUESTS));
  const limits = CANVAS_LIMITS[clampedGuests];
  return Math.max(limits.min, Math.min(canvases, limits.max));
}

export function calculateFriendsPrice(
  canvases: number,
  guests: number = canvases,
  canvasType: CanvasType = "standard",
): number {
  if (canvasType === "big") {
    const clampedGuests = Math.max(MIN_GUESTS, Math.min(guests, MAX_GUESTS));
    return BIG_CANVAS_PRICES[clampedGuests] ?? 8000;
  }

  // Standard canvas
  const clampedGuests = Math.max(MIN_GUESTS, Math.min(guests, MAX_GUESTS));
  const clampedCanvases = clampFriendsCanvases(canvases, guests);
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
      ? "big canvas"
      : `${canvases} ${canvases === 1 ? "canvas" : "canvases"}`;
  return `${guests} ${guests === 1 ? "guest" : "guests"}, ${canvasLabel}, ${activityFormat}`;
}
