import { useState, useEffect, useRef } from "react";

import { useTranslator } from "@/components/TranslatorContext";
import { formatPrice } from "@/utils/price";

import type { EventTypeOptionsProps } from "./EventTypeOptions";

const MIN_GUESTS = 1;
const MAX_GUESTS = 6;

export type CanvasType = "standard" | "big";

export interface FriendsFormData {
  guests: number;
  canvases: number;
  canvasType: CanvasType;
}

// Big canvas price table: indexed by guests (1–6)
const BIG_CANVAS_PRICES: Record<number, number> = {
  1: 8500,
  2: 9000,
  3: 9500,
  4: 10500,
  5: 11500,
  6: 12500,
};

// Standard canvas price table: [guests][canvases] → price in cents
// guests 1: canvases 1→6000
// guests 2: canvases 1→7500, 2→9000
// guests 3: canvases 1→8000, 2→9500, 3→12000
// guests 4: canvases 2→10500, 3→12800, 4→14000
// guests 5: canvases 3→13500, 4→14900, 5→16000
// guests 6: canvases 3→14500, 4→15500, 5→16500, 6→18000
const STANDARD_PRICES: Record<number, Record<number, number>> = {
  1: { 1: 6500 },
  2: { 1: 7500, 2: 9000 },
  3: { 1: 8000, 2: 9500, 3: 12000 },
  4: { 2: 10500, 3: 12800, 4: 14000 },
  5: { 3: 13500, 4: 14900, 5: 16000 },
  6: { 3: 14500, 4: 15500, 5: 16500, 6: 18000 },
};

// Min/max canvases for standard canvas per guests count
const CANVAS_LIMITS: Record<number, { min: number; max: number }> = {
  1: { min: 1, max: 1 },
  2: { min: 1, max: 2 },
  3: { min: 1, max: 3 },
  4: { min: 2, max: 4 },
  5: { min: 3, max: 5 },
  6: { min: 3, max: 6 },
};

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
  const limits = CANVAS_LIMITS[clampedGuests];
  const clampedCanvases = Math.max(limits.min, Math.min(canvases, limits.max));
  return STANDARD_PRICES[clampedGuests]?.[clampedCanvases] ?? 6000;
}

export function FriendsOptions({
  onChange,
  showPrice,
  discount,
}: EventTypeOptionsProps) {
  const [formData, setFormData] = useState<FriendsFormData>({
    guests: 2,
    canvases: 2,
    canvasType: "standard",
  });
  const t = useTranslator();
  const onChangeRef = useRef(onChange);
  // Keep ref in sync with latest onChange without triggering effects
  onChangeRef.current = onChange;

  // Read canvas query param on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const canvasParam = params.get("canvas");

    if (canvasParam) {
      const canvasValue = parseInt(canvasParam, 10);
      if (
        !isNaN(canvasValue) &&
        canvasValue >= 1 &&
        canvasValue <= MAX_GUESTS
      ) {
        const guests = Math.max(MIN_GUESTS, Math.min(canvasValue, MAX_GUESTS));
        setFormData((prev) => ({
          ...prev,
          canvases: canvasValue,
          guests,
        }));
      }
    }
  }, []);

  // Notify parent on change
  useEffect(() => {
    const totalAmount = calculateFriendsPrice(
      formData.canvases,
      formData.guests,
      formData.canvasType,
    );
    const canvasLabel =
      formData.canvasType === "big"
        ? "big canvas"
        : `${formData.canvases} ${formData.canvases === 1 ? "canvas" : "canvases"}`;
    const productName = `${formData.guests} ${formData.guests === 1 ? "guest" : "guests"}, ${canvasLabel}`;

    onChangeRef.current({ amount: totalAmount, productName });

    try {
      const url = new URL(window.location.href);
      url.searchParams.set("canvas", formData.canvases.toString());
      window.history.replaceState({}, "", url);
    } catch {
      // replaceState may be throttled by the browser; ignore
    }
  }, [formData]);

  const handleCanvasTypeChange = (type: CanvasType) => {
    if (type === "big") {
      setFormData((prev) => ({
        ...prev,
        canvasType: "big",
        canvases: 1,
        guests: Math.max(MIN_GUESTS, prev.guests),
      }));
    } else {
      // Switching to standard: set canvases equal to guests (clamped to limits)
      setFormData((prev) => {
        const guests = Math.max(MIN_GUESTS, prev.guests);
        const limits = CANVAS_LIMITS[guests];
        const canvases = Math.max(limits.min, Math.min(guests, limits.max));
        return { ...prev, canvasType: "standard", guests, canvases };
      });
    }
  };

  const handleGuestsChange = (value: number) => {
    const guests = Math.max(MIN_GUESTS, Math.min(value, MAX_GUESTS));

    if (formData.canvasType === "big") {
      setFormData((prev) => ({ ...prev, guests }));
    } else {
      const limits = CANVAS_LIMITS[guests];
      // Default canvases to match guests count, clamped to allowed range
      const canvases = Math.max(limits.min, Math.min(guests, limits.max));
      setFormData((prev) => ({ ...prev, guests, canvases }));
    }
  };

  const handleCanvasesChange = (value: number) => {
    if (formData.canvasType === "big") return;
    const limits = CANVAS_LIMITS[formData.guests];
    const canvases = Math.max(limits.min, Math.min(value, limits.max));
    setFormData((prev) => ({ ...prev, canvases }));
  };

  const totalPrice = calculateFriendsPrice(
    formData.canvases,
    formData.guests,
    formData.canvasType,
  );

  const isBig = formData.canvasType === "big";
  const canvasLimits = CANVAS_LIMITS[formData.guests];

  return (
    <div className="friends-options">
      {/* Canvas type selector */}
      <div className="canvas-type-selector">
        <div className="canvas-type-label">{t("friends_canvas_type")}</div>
        <div className="canvas-type-options">
          <label
            className={`canvas-type-option${!isBig ? " canvas-type-option--selected" : ""}`}
          >
            <input
              type="radio"
              name="canvasType"
              value="standard"
              checked={!isBig}
              onChange={() => handleCanvasTypeChange("standard")}
            />
            {t("friends_canvas_standard")}
          </label>
          <label
            className={`canvas-type-option${isBig ? " canvas-type-option--selected" : ""}`}
          >
            <input
              type="radio"
              name="canvasType"
              value="big"
              checked={isBig}
              onChange={() => handleCanvasTypeChange("big")}
            />
            {t("friends_canvas_big")}
          </label>
        </div>
      </div>

      <div
        className="options-grid-unified"
        style={{
          gridTemplateColumns:
            "max-content max-content minmax(70px, max-content) max-content",
        }}
      >
        {/* Guests */}
        <div className="option-label-with-hint">
          <span className="option-label">{t("friends_guests_count")}</span>
          <span className="option-hint">{t("friends_guests_age_hint")}</span>
        </div>
        <button
          type="button"
          className="number-input-btn"
          onClick={() => handleGuestsChange(formData.guests - 1)}
          disabled={formData.guests <= MIN_GUESTS}
        >
          -
        </button>
        <input
          type="number"
          min={MIN_GUESTS}
          max={MAX_GUESTS}
          value={formData.guests}
          onChange={(e) =>
            handleGuestsChange(parseInt(e.target.value) || MIN_GUESTS)
          }
          className="number-input"
        />
        <button
          type="button"
          className="number-input-btn"
          onClick={() => handleGuestsChange(formData.guests + 1)}
          disabled={formData.guests >= MAX_GUESTS}
        >
          +
        </button>

        {/* Canvases */}
        <div
          className={`option-label${isBig ? " option-label--disabled" : ""}`}
        >
          {t("friends_canvases_count")}
        </div>
        <button
          type="button"
          className="number-input-btn"
          onClick={() => handleCanvasesChange(formData.canvases - 1)}
          disabled={isBig || formData.canvases <= canvasLimits.min}
        >
          -
        </button>
        <input
          type="number"
          min={isBig ? 1 : canvasLimits.min}
          max={isBig ? 1 : canvasLimits.max}
          value={formData.canvases}
          onChange={(e) =>
            handleCanvasesChange(parseInt(e.target.value) || canvasLimits.min)
          }
          className={`number-input${isBig ? " number-input--disabled" : ""}`}
          disabled={isBig}
        />
        <button
          type="button"
          className="number-input-btn"
          onClick={() => handleCanvasesChange(formData.canvases + 1)}
          disabled={isBig || formData.canvases >= canvasLimits.max}
        >
          +
        </button>

        {/* Total price */}
        {showPrice && (
          <>
            <div className="option-label total-price-label">
              {t("total_price")}
            </div>
            <div></div>
            <div className="total-price">
              {discount ? (
                <>
                  <span className="price-before">
                    <span className="price-original">
                      {formatPrice(totalPrice)}
                    </span>
                  </span>
                  <span className="price-final">
                    {formatPrice(Math.round(totalPrice * (1 - discount / 100)))}
                  </span>
                </>
              ) : (
                formatPrice(totalPrice)
              )}
            </div>
            <div></div>
          </>
        )}
      </div>
    </div>
  );
}
