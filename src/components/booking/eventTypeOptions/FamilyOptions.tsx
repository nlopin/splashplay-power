import { useState, useEffect, useRef } from "react";

import { useTranslator } from "@/components/TranslatorContext";
import { formatPrice } from "@/utils/price";

import type { EventTypeOptionsProps } from "./EventTypeOptions";

const MIN_ADULTS = 1;
const MIN_KIDS = 0;
const MAX_TOTAL = 6;

export type CanvasType = "standard" | "big";

export interface FamilyFormData {
  adults: number;
  kids: number;
  canvases: number;
  canvasType: CanvasType;
}

// Big canvas price table: indexed by total guests (2–6)
const BIG_CANVAS_PRICES: Record<number, number> = {
  2: 8000,
  3: 9000,
  4: 10000,
  5: 11000,
  6: 12000,
};

// Standard canvas price table: [totalGuests][canvases] → price in cents
const STANDARD_PRICES: Record<number, Record<number, number>> = {
  1: { 1: 6000 },
  2: { 1: 6000, 2: 9000 },
  3: { 1: 6500, 2: 9500, 3: 12000 },
  4: { 2: 10000, 3: 12800, 4: 14000 },
  5: { 3: 13500, 4: 14900, 5: 16000 },
  6: { 3: 14000, 4: 15200, 5: 16500, 6: 18000 },
};

// Min/max canvases for standard canvas per total guests count
const CANVAS_LIMITS: Record<number, { min: number; max: number }> = {
  1: { min: 1, max: 1 },
  2: { min: 1, max: 2 },
  3: { min: 1, max: 3 },
  4: { min: 2, max: 4 },
  5: { min: 3, max: 5 },
  6: { min: 3, max: 6 },
};

export function calculateFamilyPrice(
  canvases: number,
  totalGuests: number = 2,
  canvasType: CanvasType = "standard"
): number {
  if (canvasType === "big") {
    const clamped = Math.max(2, Math.min(totalGuests, MAX_TOTAL));
    return BIG_CANVAS_PRICES[clamped] ?? 8000;
  }
  const clampedTotal = Math.max(1, Math.min(totalGuests, MAX_TOTAL));
  const limits = CANVAS_LIMITS[clampedTotal];
  const clampedCanvases = Math.max(limits.min, Math.min(canvases, limits.max));
  return STANDARD_PRICES[clampedTotal]?.[clampedCanvases] ?? 6000;
}

export function FamilyOptions({ onChange }: EventTypeOptionsProps) {
  const [formData, setFormData] = useState<FamilyFormData>({
    adults: 2,
    kids: 1,
    canvases: 3,
    canvasType: "standard",
  });
  const t = useTranslator();
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Calculate total price and notify parent
  useEffect(() => {
    const totalGuests = formData.adults + formData.kids;
    const totalAmount = calculateFamilyPrice(formData.canvases, totalGuests, formData.canvasType);
    const canvasLabel =
      formData.canvasType === "big"
        ? "big canvas"
        : `${formData.canvases} ${formData.canvases === 1 ? "canvas" : "canvases"}`;
    const productName = `${formData.adults} ${formData.adults === 1 ? "adult" : "adults"}, ${formData.kids} ${formData.kids === 1 ? "kid" : "kids"}, ${canvasLabel}`;

    onChangeRef.current({ amount: totalAmount, productName });
  }, [formData]);

  const handleCanvasTypeChange = (type: CanvasType) => {
    if (type === "big") {
      setFormData((prev) => ({
        ...prev,
        canvasType: "big",
        canvases: 1,
      }));
    } else {
      setFormData((prev) => {
        const total = Math.max(1, Math.min(prev.adults + prev.kids, MAX_TOTAL));
        const limits = CANVAS_LIMITS[total];
        const canvases = Math.max(limits.min, Math.min(total, limits.max));
        return { ...prev, canvasType: "standard", canvases };
      });
    }
  };

  const handleAdultsChange = (value: number) => {
    const adults = Math.max(MIN_ADULTS, value);
    setFormData((prev) => {
      const kids = Math.min(prev.kids, MAX_TOTAL - adults);
      if (prev.canvasType === "big") {
        return { ...prev, adults, kids };
      }
      const total = Math.max(1, Math.min(adults + kids, MAX_TOTAL));
      const limits = CANVAS_LIMITS[total];
      const canvases = Math.max(limits.min, Math.min(total, limits.max));
      return { ...prev, adults, kids, canvases };
    });
  };

  const handleKidsChange = (value: number) => {
    const kids = Math.max(MIN_KIDS, value);
    setFormData((prev) => {
      const adults = Math.max(MIN_ADULTS, Math.min(prev.adults, MAX_TOTAL - kids));
      if (prev.canvasType === "big") {
        return { ...prev, adults, kids };
      }
      const total = Math.max(1, Math.min(adults + kids, MAX_TOTAL));
      const limits = CANVAS_LIMITS[total];
      const canvases = Math.max(limits.min, Math.min(total, limits.max));
      return { ...prev, adults, kids, canvases };
    });
  };

  const handleCanvasesChange = (value: number) => {
    if (formData.canvasType === "big") return;
    const total = Math.max(1, Math.min(formData.adults + formData.kids, MAX_TOTAL));
    const limits = CANVAS_LIMITS[total];
    const canvases = Math.max(limits.min, Math.min(value, limits.max));
    setFormData((prev) => ({ ...prev, canvases }));
  };

  const totalGuests = formData.adults + formData.kids;
  const clampedTotal = Math.max(1, Math.min(totalGuests, MAX_TOTAL));
  const isBig = formData.canvasType === "big";
  const canvasLimits = CANVAS_LIMITS[clampedTotal];
  const totalPrice = calculateFamilyPrice(formData.canvases, clampedTotal, formData.canvasType);

  return (
    <div className="family-options">
      {/* Canvas type selector */}
      <div className="canvas-type-selector">
        <div className="canvas-type-label">{t("friends_canvas_type")}</div>
        <div className="canvas-type-options">
          <label className={`canvas-type-option${!isBig ? " canvas-type-option--selected" : ""}`}>
            <input
              type="radio"
              name="canvasType"
              value="standard"
              checked={!isBig}
              onChange={() => handleCanvasTypeChange("standard")}
            />
            {t("friends_canvas_standard")}
          </label>
          <label className={`canvas-type-option${isBig ? " canvas-type-option--selected" : ""}`}>
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

      <div className="options-grid-unified" style={{ gridTemplateColumns: "max-content max-content minmax(70px, max-content) max-content" }}>
        {/* Adults */}
        <div className="option-label">{t("family_adults_count")}</div>
        <button
          type="button"
          className="number-input-btn"
          onClick={() => handleAdultsChange(formData.adults - 1)}
          disabled={formData.adults <= MIN_ADULTS}
        >
          -
        </button>
        <input
          type="number"
          min={MIN_ADULTS}
          max={MAX_TOTAL - formData.kids}
          value={formData.adults}
          onChange={(e) =>
            handleAdultsChange(parseInt(e.target.value) || MIN_ADULTS)
          }
          className="number-input"
        />
        <button
          type="button"
          className="number-input-btn"
          onClick={() => handleAdultsChange(formData.adults + 1)}
          disabled={formData.adults + formData.kids >= MAX_TOTAL}
        >
          +
        </button>

        {/* Kids */}
        <div className="option-label-with-hint">
          <span className="option-label">{t("family_kids_count")}</span>
          <span className="option-hint">{t("family_kids_age_hint")}</span>
        </div>
        <button
          type="button"
          className="number-input-btn"
          onClick={() => handleKidsChange(formData.kids - 1)}
          disabled={formData.kids <= MIN_KIDS}
        >
          -
        </button>
        <input
          type="number"
          min={MIN_KIDS}
          max={MAX_TOTAL - formData.adults}
          value={formData.kids}
          onChange={(e) =>
            handleKidsChange(parseInt(e.target.value) || MIN_KIDS)
          }
          className="number-input"
        />
        <button
          type="button"
          className="number-input-btn"
          onClick={() => handleKidsChange(formData.kids + 1)}
          disabled={formData.adults + formData.kids >= MAX_TOTAL}
        >
          +
        </button>

        {/* Canvases */}
        <div className={`option-label${isBig ? " option-label--disabled" : ""}`}>
          {t("family_canvas_count")}
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
        <div className="option-label total-price-label">{t("total_price")}</div>
        <div></div>
        <div className="total-price">{formatPrice(totalPrice)}</div>
        <div></div>
      </div>
    </div>
  );
}
