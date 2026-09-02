import { useState, useEffect, useRef } from "react";

import { useTranslator } from "@/components/TranslatorContext";
import { formatPrice } from "@/utils/price";

import type { EventTypeOptionsProps } from "./EventTypeOptions";
import {
  ActivityFormatSelector,
  type ActivityFormat,
} from "./ActivityFormatSelector";
import {
  MIN_ADULTS,
  MIN_KIDS,
  MAX_TOTAL,
  getFamilyCanvasLimits,
  clampFamilyCanvases,
  calculateFamilyPrice,
  formatFamilyProductName,
  type CanvasType,
} from "@/services/catalog/familyPricing";

export type { CanvasType } from "@/services/catalog/familyPricing";
export type { ActivityFormat } from "./ActivityFormatSelector";

export interface FamilyFormData {
  adults: number;
  kids: number;
  canvases: number;
  canvasType: CanvasType;
  activityFormat: ActivityFormat;
}

export function FamilyOptions({
  onChange,
  showPrice,
  discount,
}: EventTypeOptionsProps) {
  const [formData, setFormData] = useState<FamilyFormData>({
    adults: 2,
    kids: 1,
    canvases: 3,
    canvasType: "standard",
    activityFormat: "splash",
  });
  const t = useTranslator();
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Calculate total price and notify parent
  useEffect(() => {
    const totalGuests = formData.adults + formData.kids;
    const totalAmount = calculateFamilyPrice(
      formData.canvases,
      totalGuests,
      formData.canvasType,
    );
    const productName = formatFamilyProductName(
      formData.adults,
      formData.kids,
      formData.canvases,
      formData.canvasType,
      formData.activityFormat,
    );

    onChangeRef.current({
      amount: totalAmount,
      productName,
      guests: totalGuests,
    });
  }, [formData]);

  const handleActivityFormatChange = (format: ActivityFormat) => {
    if (format === "pouring") {
      setFormData((prev) => {
        if (prev.canvasType === "big") {
          const total = Math.max(
            1,
            Math.min(prev.adults + prev.kids, MAX_TOTAL),
          );
          const canvases = clampFamilyCanvases(total, total, "standard");
          return {
            ...prev,
            activityFormat: "pouring",
            canvasType: "standard",
            canvases,
          };
        }
        return { ...prev, activityFormat: "pouring" };
      });
      return;
    }
    setFormData((prev) => ({ ...prev, activityFormat: "splash" }));
  };

  const handleCanvasTypeChange = (type: CanvasType) => {
    if (type === "big") {
      setFormData((prev) => {
        const total = Math.max(1, Math.min(prev.adults + prev.kids, MAX_TOTAL));
        return {
          ...prev,
          canvasType: "big",
          canvases: clampFamilyCanvases(1, total, "big"),
        };
      });
    } else {
      setFormData((prev) => {
        const total = Math.max(1, Math.min(prev.adults + prev.kids, MAX_TOTAL));
        const canvases = clampFamilyCanvases(total, total, "standard");
        return { ...prev, canvasType: "standard", canvases };
      });
    }
  };

  const handleAdultsChange = (value: number) => {
    const adults = Math.max(MIN_ADULTS, value);
    setFormData((prev) => {
      const kids = Math.min(prev.kids, MAX_TOTAL - adults);
      const total = Math.max(1, Math.min(adults + kids, MAX_TOTAL));
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
    });
  };

  const handleKidsChange = (value: number) => {
    const kids = Math.max(MIN_KIDS, value);
    setFormData((prev) => {
      const adults = Math.max(
        MIN_ADULTS,
        Math.min(prev.adults, MAX_TOTAL - kids),
      );
      const total = Math.max(1, Math.min(adults + kids, MAX_TOTAL));
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
    });
  };

  const handleCanvasesChange = (value: number) => {
    const total = Math.max(
      1,
      Math.min(formData.adults + formData.kids, MAX_TOTAL),
    );
    const canvases = clampFamilyCanvases(value, total, formData.canvasType);
    setFormData((prev) => ({ ...prev, canvases }));
  };

  const totalGuests = formData.adults + formData.kids;
  const clampedTotal = Math.max(1, Math.min(totalGuests, MAX_TOTAL));
  const isSplash = formData.activityFormat === "splash";
  const isBig = formData.canvasType === "big";
  const canvasLimits = getFamilyCanvasLimits(
    clampedTotal,
    formData.canvasType,
  );
  const totalPrice = calculateFamilyPrice(
    formData.canvases,
    clampedTotal,
    formData.canvasType,
  );

  return (
    <div className="family-options">
      <ActivityFormatSelector
        value={formData.activityFormat}
        onChange={handleActivityFormatChange}
      />

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
          {isSplash && (
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
          )}
        </div>
      </div>

      <div
        className="options-grid-unified"
        style={{
          gridTemplateColumns:
            "max-content max-content minmax(70px, max-content) max-content",
        }}
      >
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
        <div className="option-label">{t("family_canvas_count")}</div>
        <button
          type="button"
          className="number-input-btn"
          onClick={() => handleCanvasesChange(formData.canvases - 1)}
          disabled={formData.canvases <= canvasLimits.min}
        >
          -
        </button>
        <input
          type="number"
          min={canvasLimits.min}
          max={canvasLimits.max}
          value={formData.canvases}
          onChange={(e) =>
            handleCanvasesChange(parseInt(e.target.value) || canvasLimits.min)
          }
          className="number-input"
        />
        <button
          type="button"
          className="number-input-btn"
          onClick={() => handleCanvasesChange(formData.canvases + 1)}
          disabled={formData.canvases >= canvasLimits.max}
        >
          +
        </button>
      </div>

      {showPrice && (
        <div className="total-price-row">
          <div className="total-price-label">{t("total_price")}</div>
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
        </div>
      )}
    </div>
  );
}
