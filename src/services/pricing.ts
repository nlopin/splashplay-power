import type { EventType } from "@/components/booking/types";
import type { ActivityFormat } from "@/components/booking/eventTypeOptions/ActivityFormatSelector";

export type { ActivityFormat };
export type CanvasType = "standard" | "big";
export type CouplesPictureType = "one_small" | "one_big" | "individual";

export type PriceOptionSpec =
  | { name: string; type: "enum"; values: readonly string[]; default: string }
  | { name: string; type: "number"; default: number };

// ---- individual ----

export const INDIVIDUAL_PRICE = 6000;

// ---- couples ----

export const COUPLES_PRICES: Record<CouplesPictureType, number> = {
  one_small: 7500,
  one_big: 9000,
  individual: 9000,
};

export const COUPLES_DEFAULTS: {
  pictureType: CouplesPictureType;
  activityFormat: ActivityFormat;
} = {
  pictureType: "one_big",
  activityFormat: "splash",
};

export function calculateCouplesPrice(
  pictureType: CouplesPictureType,
  activityFormat: ActivityFormat = "splash",
): number {
  if (pictureType === "one_big" && activityFormat !== "splash") {
    throw new Error(
      '"one_big" is only available for the "splash" activity format',
    );
  }
  return COUPLES_PRICES[pictureType];
}

// ---- family ----

const FAMILY_MAX_TOTAL = 6;

// Big canvas price table: indexed by total guests (2–6)
const FAMILY_BIG_CANVAS_PRICES: Record<number, number> = {
  2: 9000,
  3: 9500,
  4: 10500,
  5: 11500,
  6: 12500,
};

// Standard canvas price table: [totalGuests][canvases] → price in cents
const FAMILY_STANDARD_PRICES: Record<number, Record<number, number>> = {
  1: { 1: 6000 },
  2: { 1: 7500, 2: 9000 },
  3: { 1: 8000, 2: 9500, 3: 12000 },
  4: { 2: 10500, 3: 12800, 4: 14000 },
  5: { 3: 13500, 4: 14900, 5: 16000 },
  6: { 3: 14500, 4: 15500, 5: 16500, 6: 18000 },
};

// Min/max canvases for standard canvas per total guests count
export const FAMILY_CANVAS_LIMITS: Record<number, { min: number; max: number }> = {
  1: { min: 1, max: 1 },
  2: { min: 1, max: 2 },
  3: { min: 1, max: 3 },
  4: { min: 2, max: 4 },
  5: { min: 3, max: 5 },
  6: { min: 3, max: 6 },
};

export const FAMILY_DEFAULTS = {
  adults: 2,
  kids: 1,
  canvases: 3,
  canvasType: "standard" as CanvasType,
  activityFormat: "splash" as ActivityFormat,
};

export function calculateFamilyPrice(
  canvases: number,
  totalGuests: number = 2,
  canvasType: CanvasType = "standard",
): number {
  if (canvasType === "big") {
    const clamped = Math.max(2, Math.min(totalGuests, FAMILY_MAX_TOTAL));
    return FAMILY_BIG_CANVAS_PRICES[clamped] ?? 8000;
  }
  const clampedTotal = Math.max(1, Math.min(totalGuests, FAMILY_MAX_TOTAL));
  const limits = FAMILY_CANVAS_LIMITS[clampedTotal];
  const clampedCanvases = Math.max(limits.min, Math.min(canvases, limits.max));
  return FAMILY_STANDARD_PRICES[clampedTotal]?.[clampedCanvases] ?? 6000;
}

// ---- friends ----

const FRIENDS_MIN_GUESTS = 1;
const FRIENDS_MAX_GUESTS = 6;

// Big canvas price table: indexed by guests (1–6)
const FRIENDS_BIG_CANVAS_PRICES: Record<number, number> = {
  1: 8500,
  2: 9000,
  3: 9500,
  4: 10500,
  5: 11500,
  6: 12500,
};

// Standard canvas price table: [guests][canvases] → price in cents
const FRIENDS_STANDARD_PRICES: Record<number, Record<number, number>> = {
  1: { 1: 6500 },
  2: { 1: 7500, 2: 9000 },
  3: { 1: 8000, 2: 9500, 3: 12000 },
  4: { 2: 10500, 3: 12800, 4: 14000 },
  5: { 3: 13500, 4: 14900, 5: 16000 },
  6: { 3: 14500, 4: 15500, 5: 16500, 6: 18000 },
};

// Min/max canvases for standard canvas per guests count
export const FRIENDS_CANVAS_LIMITS: Record<number, { min: number; max: number }> = {
  1: { min: 1, max: 1 },
  2: { min: 1, max: 2 },
  3: { min: 1, max: 3 },
  4: { min: 2, max: 4 },
  5: { min: 3, max: 5 },
  6: { min: 3, max: 6 },
};

export const FRIENDS_DEFAULTS = {
  guests: 2,
  canvases: 2,
  canvasType: "standard" as CanvasType,
  activityFormat: "splash" as ActivityFormat,
};

export function calculateFriendsPrice(
  canvases: number,
  guests: number = canvases,
  canvasType: CanvasType = "standard",
): number {
  if (canvasType === "big") {
    const clampedGuests = Math.max(
      FRIENDS_MIN_GUESTS,
      Math.min(guests, FRIENDS_MAX_GUESTS),
    );
    return FRIENDS_BIG_CANVAS_PRICES[clampedGuests] ?? 8000;
  }

  const clampedGuests = Math.max(
    FRIENDS_MIN_GUESTS,
    Math.min(guests, FRIENDS_MAX_GUESTS),
  );
  const limits = FRIENDS_CANVAS_LIMITS[clampedGuests];
  const clampedCanvases = Math.max(limits.min, Math.min(canvases, limits.max));
  return FRIENDS_STANDARD_PRICES[clampedGuests]?.[clampedCanvases] ?? 6000;
}

// ---- throw_paint / customize_clothes ----

const PAINT_MAX_TOTAL = 6;

// Price table indexed by total guests (1–6)
// customize_clothes: individual (1) = €60; throw_paint: individual (1) = €45
const PRICES_THROW_PAINT: Record<number, number> = {
  1: 4500,
  2: 7000,
  3: 10500,
  4: 12000,
  5: 15000,
  6: 18000,
};

const PRICES_CUSTOMIZE_CLOTHES: Record<number, number> = {
  1: 6000,
  2: 7000,
  3: 10500,
  4: 12000,
  5: 15000,
  6: 18000,
};

export const PAINT_DEFAULTS = { adults: 2, kids: 0 };

export function calculatePaintPrice(
  totalGuests: number,
  eventType?: EventType,
): number {
  const clamped = Math.max(1, Math.min(totalGuests, PAINT_MAX_TOTAL));
  const prices =
    eventType === "customize_clothes"
      ? PRICES_CUSTOMIZE_CLOTHES
      : PRICES_THROW_PAINT;
  return prices[clamped];
}

// ---- option schema (used by /api/v1/event-types and /api/v1/price) ----

export const EVENT_TYPE_PRICE_OPTIONS: Record<EventType, PriceOptionSpec[]> = {
  individual: [],
  couples: [
    {
      name: "pictureType",
      type: "enum",
      values: ["one_small", "one_big", "individual"],
      default: COUPLES_DEFAULTS.pictureType,
    },
    {
      name: "activityFormat",
      type: "enum",
      values: ["splash", "pouring"],
      default: COUPLES_DEFAULTS.activityFormat,
    },
  ],
  family: [
    { name: "adults", type: "number", default: FAMILY_DEFAULTS.adults },
    { name: "kids", type: "number", default: FAMILY_DEFAULTS.kids },
    { name: "canvases", type: "number", default: FAMILY_DEFAULTS.canvases },
    {
      name: "canvasType",
      type: "enum",
      values: ["standard", "big"],
      default: FAMILY_DEFAULTS.canvasType,
    },
    {
      name: "activityFormat",
      type: "enum",
      values: ["splash", "pouring"],
      default: FAMILY_DEFAULTS.activityFormat,
    },
  ],
  friends: [
    { name: "guests", type: "number", default: FRIENDS_DEFAULTS.guests },
    { name: "canvases", type: "number", default: FRIENDS_DEFAULTS.canvases },
    {
      name: "canvasType",
      type: "enum",
      values: ["standard", "big"],
      default: FRIENDS_DEFAULTS.canvasType,
    },
    {
      name: "activityFormat",
      type: "enum",
      values: ["splash", "pouring"],
      default: FRIENDS_DEFAULTS.activityFormat,
    },
  ],
  throw_paint: [
    { name: "adults", type: "number", default: PAINT_DEFAULTS.adults },
    { name: "kids", type: "number", default: PAINT_DEFAULTS.kids },
  ],
  customize_clothes: [
    { name: "adults", type: "number", default: PAINT_DEFAULTS.adults },
    { name: "kids", type: "number", default: PAINT_DEFAULTS.kids },
  ],
};
