import { useState, useEffect, useRef } from "react";

import { useTranslator } from "@/components/TranslatorContext";
import { formatPrice } from "@/utils/price";

import type { EventTypeOptionsProps } from "./EventTypeOptions";
import {
  ActivityFormatSelector,
  type ActivityFormat,
} from "./ActivityFormatSelector";
import {
  MIN_GUESTS,
  MAX_GUESTS,
  CANVAS_LIMITS,
  calculateFriendsPrice,
  formatFriendsProductName,
  type CanvasType,
} from "@/services/catalog/friendsPricing";

export type { CanvasType } from "@/services/catalog/friendsPricing";

export interface FriendsFormData {
  guests: number;
  canvases: number;
  canvasType: CanvasType;
  activityFormat: ActivityFormat;
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
    activityFormat: "splash",
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
    const productName = formatFriendsProductName(
      formData.guests,
      formData.canvases,
      formData.canvasType,
      formData.activityFormat,
    );

    onChangeRef.current({
      amount: totalAmount,
      productName,
      guests: formData.guests,
    });

    try {
      const url = new URL(window.location.href);
      url.searchParams.set("canvas", formData.canvases.toString());
      window.history.replaceState({}, "", url);
    } catch {
      // replaceState may be throttled by the browser; ignore
    }
  }, [formData]);

  const handleActivityFormatChange = (format: ActivityFormat) => {
    if (format === "pouring") {
      setFormData((prev) => {
        if (prev.canvasType === "big") {
          const guests = Math.max(MIN_GUESTS, prev.guests);
          const limits = CANVAS_LIMITS[guests];
          const canvases = Math.max(limits.min, Math.min(guests, limits.max));
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

  const isSplash = formData.activityFormat === "splash";
  const isBig = formData.canvasType === "big";
  const canvasLimits = CANVAS_LIMITS[formData.guests];

  return (
    <div className="friends-options">
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
