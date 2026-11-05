import type { PricingData } from "../types";
import type { ActivityFormat } from "./ActivityFormatSelector";
import {
  COUPLES_PRICE,
  type CouplesPicture,
} from "@/services/catalog/couplesPricing";
import {
  MAX_TOTAL,
  MIN_ADULTS,
  MIN_KIDS,
  calculateFamilyPrice,
  clampFamilyCanvases,
  type CanvasType,
} from "@/services/catalog/familyPricing";
import {
  MAX_GUESTS,
  MIN_GUESTS,
  calculateFriendsPrice,
  clampFriendsCanvases,
} from "@/services/catalog/friendsPricing";
import {
  OPEN_SESSION_TICKETS,
  clampOpenSessionCart,
  openSessionAmountCents,
  openSessionPeople,
  type OpenSessionCart,
} from "@/services/catalog/openSessionPricing";

// Pure state transitions behind the booking option widgets. The widgets'
// click handlers and the WebMCP `set_booking_options` tool both go through
// these, so an agent gets exactly the clamping a person gets.

export type OptionsPatch = {
  activityFormat?: ActivityFormat;
  picture?: CouplesPicture;
  canvasType?: CanvasType;
  canvases?: number;
  guests?: number;
  adults?: number;
  kids?: number;
  solo?: number;
  pair_shared?: number;
  pair_two?: number;
};

// A requested value the rules didn't allow, and what was set instead.
export type Adjustment = {
  field: keyof OptionsPatch;
  requested: string | number;
  actual: string | number;
};

export type OptionsApplyResult = { data: PricingData; adjusted: Adjustment[] };

export interface OptionsHandle {
  apply(patch: OptionsPatch): OptionsApplyResult;
}

function adjustments<S extends object>(
  patch: OptionsPatch,
  next: S,
  fields: (keyof OptionsPatch & keyof S)[],
): Adjustment[] {
  return fields.flatMap((field) => {
    const requested = patch[field];
    const actual = next[field] as unknown as string | number;
    return requested !== undefined && requested !== actual
      ? [{ field, requested, actual }]
      : [];
  });
}

// --- Family ---------------------------------------------------------------

export interface FamilyFormData {
  adults: number;
  kids: number;
  canvases: number;
  canvasType: CanvasType;
  activityFormat: ActivityFormat;
}

function familyTotal(adults: number, kids: number): number {
  return Math.max(1, Math.min(adults + kids, MAX_TOTAL));
}

export function familySetActivityFormat(
  prev: FamilyFormData,
  format: ActivityFormat,
): FamilyFormData {
  if (format === "pouring") {
    if (prev.canvasType === "big") {
      const total = familyTotal(prev.adults, prev.kids);
      return {
        ...prev,
        activityFormat: "pouring",
        canvasType: "standard",
        canvases: clampFamilyCanvases(total, total, "standard"),
      };
    }
    return { ...prev, activityFormat: "pouring" };
  }
  return { ...prev, activityFormat: "splash" };
}

export function familySetCanvasType(
  prev: FamilyFormData,
  type: CanvasType,
): FamilyFormData {
  const total = familyTotal(prev.adults, prev.kids);
  if (type === "big") {
    return {
      ...prev,
      canvasType: "big",
      canvases: clampFamilyCanvases(1, total, "big"),
    };
  }
  return {
    ...prev,
    canvasType: "standard",
    canvases: clampFamilyCanvases(total, total, "standard"),
  };
}

function familyWithPeople(
  prev: FamilyFormData,
  adults: number,
  kids: number,
): FamilyFormData {
  const total = familyTotal(adults, kids);
  if (prev.canvasType === "big") {
    return {
      ...prev,
      adults,
      kids,
      canvases: clampFamilyCanvases(prev.canvases, total, "big"),
    };
  }
  const canvases = clampFamilyCanvases(total, total, "standard");
  return { ...prev, adults, kids, canvases };
}

export function familySetAdults(
  prev: FamilyFormData,
  value: number,
): FamilyFormData {
  const adults = Math.max(MIN_ADULTS, value);
  const kids = Math.min(prev.kids, MAX_TOTAL - adults);
  return familyWithPeople(prev, adults, kids);
}

export function familySetKids(
  prev: FamilyFormData,
  value: number,
): FamilyFormData {
  const kids = Math.max(MIN_KIDS, value);
  const adults = Math.max(MIN_ADULTS, Math.min(prev.adults, MAX_TOTAL - kids));
  return familyWithPeople(prev, adults, kids);
}

export function familySetCanvases(
  prev: FamilyFormData,
  value: number,
): FamilyFormData {
  const total = familyTotal(prev.adults, prev.kids);
  return {
    ...prev,
    canvases: clampFamilyCanvases(value, total, prev.canvasType),
  };
}

export function familyPricingData(formData: FamilyFormData): PricingData {
  const totalGuests = formData.adults + formData.kids;
  return {
    amount: calculateFamilyPrice(
      formData.canvases,
      totalGuests,
      formData.canvasType,
    ),
    guests: totalGuests,
    selection: {
      eventType: "family",
      adults: formData.adults,
      kids: formData.kids,
      canvases: formData.canvases,
      canvasType: formData.canvasType,
      activityFormat: formData.activityFormat,
    },
  };
}

export function applyFamilyPatch(
  prev: FamilyFormData,
  patch: OptionsPatch,
): { next: FamilyFormData; adjusted: Adjustment[] } {
  let next = prev;
  if (patch.activityFormat) {
    next = familySetActivityFormat(next, patch.activityFormat);
  }
  // Big canvases only exist with Splash; the widget hides the option.
  if (
    patch.canvasType &&
    !(patch.canvasType === "big" && next.activityFormat === "pouring")
  ) {
    next = familySetCanvasType(next, patch.canvasType);
  }
  if (patch.adults !== undefined) next = familySetAdults(next, patch.adults);
  if (patch.kids !== undefined) next = familySetKids(next, patch.kids);
  if (patch.canvases !== undefined) {
    next = familySetCanvases(next, patch.canvases);
  }
  return {
    next,
    adjusted: adjustments(patch, next, [
      "activityFormat",
      "canvasType",
      "adults",
      "kids",
      "canvases",
    ]),
  };
}

// --- Friends --------------------------------------------------------------

export interface FriendsFormData {
  guests: number;
  canvases: number;
  canvasType: CanvasType;
  activityFormat: ActivityFormat;
}

export function friendsSetActivityFormat(
  prev: FriendsFormData,
  format: ActivityFormat,
): FriendsFormData {
  if (format === "pouring") {
    if (prev.canvasType === "big") {
      const guests = Math.max(MIN_GUESTS, prev.guests);
      return {
        ...prev,
        activityFormat: "pouring",
        canvasType: "standard",
        canvases: clampFriendsCanvases(guests, guests, "standard"),
      };
    }
    return { ...prev, activityFormat: "pouring" };
  }
  return { ...prev, activityFormat: "splash" };
}

export function friendsSetCanvasType(
  prev: FriendsFormData,
  type: CanvasType,
): FriendsFormData {
  const guests = Math.max(MIN_GUESTS, prev.guests);
  if (type === "big") {
    return {
      ...prev,
      canvasType: "big",
      canvases: clampFriendsCanvases(1, guests, "big"),
      guests,
    };
  }
  // Switching to standard: canvases equal to guests (clamped to limits)
  return {
    ...prev,
    canvasType: "standard",
    guests,
    canvases: clampFriendsCanvases(guests, guests, "standard"),
  };
}

export function friendsSetGuests(
  prev: FriendsFormData,
  value: number,
): FriendsFormData {
  const guests = Math.max(MIN_GUESTS, Math.min(value, MAX_GUESTS));
  if (prev.canvasType === "big") {
    return {
      ...prev,
      guests,
      canvases: clampFriendsCanvases(prev.canvases, guests, "big"),
    };
  }
  // Default canvases to match guests count, clamped to allowed range
  return {
    ...prev,
    guests,
    canvases: clampFriendsCanvases(guests, guests, "standard"),
  };
}

export function friendsSetCanvases(
  prev: FriendsFormData,
  value: number,
): FriendsFormData {
  return {
    ...prev,
    canvases: clampFriendsCanvases(value, prev.guests, prev.canvasType),
  };
}

export function friendsPricingData(formData: FriendsFormData): PricingData {
  return {
    amount: calculateFriendsPrice(
      formData.canvases,
      formData.guests,
      formData.canvasType,
    ),
    guests: formData.guests,
    selection: {
      eventType: "friends",
      guests: formData.guests,
      canvases: formData.canvases,
      canvasType: formData.canvasType,
      activityFormat: formData.activityFormat,
    },
  };
}

export function applyFriendsPatch(
  prev: FriendsFormData,
  patch: OptionsPatch,
): { next: FriendsFormData; adjusted: Adjustment[] } {
  let next = prev;
  if (patch.activityFormat) {
    next = friendsSetActivityFormat(next, patch.activityFormat);
  }
  if (
    patch.canvasType &&
    !(patch.canvasType === "big" && next.activityFormat === "pouring")
  ) {
    next = friendsSetCanvasType(next, patch.canvasType);
  }
  if (patch.guests !== undefined) next = friendsSetGuests(next, patch.guests);
  if (patch.canvases !== undefined) {
    next = friendsSetCanvases(next, patch.canvases);
  }
  return {
    next,
    adjusted: adjustments(patch, next, [
      "activityFormat",
      "canvasType",
      "guests",
      "canvases",
    ]),
  };
}

// --- Couples --------------------------------------------------------------

export const DEFAULT_SPLASH_PICTURE: CouplesPicture = "one_big";
export const DEFAULT_POURING_PICTURE: CouplesPicture = "individual";

export function isSplashOnlyPicture(value: CouplesPicture): boolean {
  return value === "one_big" || value === "two_big";
}

export type CouplesFormState = {
  picture: CouplesPicture;
  activityFormat: ActivityFormat;
  // Splash picture to restore when switching back from Pouring.
  savedSplashPicture: CouplesPicture;
};

export function couplesSetPicture(
  prev: CouplesFormState,
  picture: CouplesPicture,
): CouplesFormState {
  return {
    ...prev,
    picture,
    savedSplashPicture:
      prev.activityFormat === "splash" ? picture : prev.savedSplashPicture,
  };
}

export function couplesSetActivityFormat(
  prev: CouplesFormState,
  format: ActivityFormat,
): CouplesFormState {
  if (format === prev.activityFormat) return prev;
  if (format === "pouring") {
    return {
      picture: DEFAULT_POURING_PICTURE,
      activityFormat: "pouring",
      savedSplashPicture: prev.picture,
    };
  }
  return {
    ...prev,
    activityFormat: "splash",
    picture: prev.savedSplashPicture,
  };
}

export function couplesPricingData(state: CouplesFormState): PricingData {
  return {
    amount: COUPLES_PRICE[state.picture],
    guests: 2,
    selection: {
      eventType: "couples",
      picture: state.picture,
      activityFormat: state.activityFormat,
    },
  };
}

export function applyCouplesPatch(
  prev: CouplesFormState,
  patch: OptionsPatch,
): { next: CouplesFormState; adjusted: Adjustment[] } {
  let next = prev;
  if (patch.activityFormat) {
    next = couplesSetActivityFormat(next, patch.activityFormat);
  }
  if (patch.picture) {
    if (
      isSplashOnlyPicture(patch.picture) &&
      next.activityFormat === "pouring"
    ) {
      // Splash-only canvas: switch to Splash unless Pouring was asked for.
      if (!patch.activityFormat) {
        next = couplesSetPicture(
          couplesSetActivityFormat(next, "splash"),
          patch.picture,
        );
      }
    } else {
      next = couplesSetPicture(next, patch.picture);
    }
  }
  return {
    next,
    adjusted: adjustments(patch, next, ["activityFormat", "picture"]),
  };
}

// --- Open session ---------------------------------------------------------

export function openSessionPricingData(cart: OpenSessionCart): PricingData {
  return {
    amount: openSessionAmountCents(cart),
    guests: openSessionPeople(cart),
    selection: { eventType: "open_session", openCart: cart },
  };
}

export function applyOpenSessionPatch(
  prev: OpenSessionCart,
  patch: OptionsPatch,
  spotsLeft?: number | null,
): { next: OpenSessionCart; adjusted: Adjustment[] } {
  const requested = { ...prev };
  for (const ticket of OPEN_SESSION_TICKETS) {
    const quantity = patch[ticket];
    if (quantity !== undefined) requested[ticket] = quantity;
  }
  const next = clampOpenSessionCart(requested, spotsLeft);
  return {
    next,
    adjusted: adjustments(patch, next, [...OPEN_SESSION_TICKETS]),
  };
}
