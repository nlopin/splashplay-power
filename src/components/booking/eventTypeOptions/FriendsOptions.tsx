import { useState, useEffect, useImperativeHandle, useRef } from "react";

import { useTranslator } from "@/components/TranslatorContext";
import { formatPrice } from "@/utils/price";

import type { EventTypeOptionsProps } from "./EventTypeOptions";
import {
  ActivityFormatSelector,
  type ActivityFormat,
} from "./ActivityFormatSelector";
import {
  applyFriendsPatch,
  friendsPricingData,
  friendsSetActivityFormat,
  friendsSetCanvases,
  friendsSetCanvasType,
  friendsSetGuests,
  type FriendsFormData,
} from "./formState";
import {
  MIN_GUESTS,
  MAX_GUESTS,
  getFriendsCanvasLimits,
  calculateFriendsPrice,
  type CanvasType,
} from "@/services/catalog/friendsPricing";

export type { CanvasType } from "@/services/catalog/friendsPricing";
export type { FriendsFormData } from "./formState";

export function FriendsOptions({
  onChange,
  showPrice,
  discount,
  ref,
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
    onChangeRef.current(friendsPricingData(formData));

    try {
      const url = new URL(window.location.href);
      url.searchParams.set("canvas", formData.canvases.toString());
      window.history.replaceState({}, "", url);
    } catch {
      // replaceState may be throttled by the browser; ignore
    }
  }, [formData]);

  // Lets the WebMCP set_booking_options tool change options like a click.
  useImperativeHandle(ref, () => ({
    apply(patch) {
      const { next, adjusted } = applyFriendsPatch(formData, patch);
      setFormData(next);
      return { data: friendsPricingData(next), adjusted };
    },
  }));

  const handleActivityFormatChange = (format: ActivityFormat) => {
    setFormData((prev) => friendsSetActivityFormat(prev, format));
  };

  const handleCanvasTypeChange = (type: CanvasType) => {
    setFormData((prev) => friendsSetCanvasType(prev, type));
  };

  const handleGuestsChange = (value: number) => {
    setFormData((prev) => friendsSetGuests(prev, value));
  };

  const handleCanvasesChange = (value: number) => {
    setFormData((prev) => friendsSetCanvases(prev, value));
  };

  const totalPrice = calculateFriendsPrice(
    formData.canvases,
    formData.guests,
    formData.canvasType,
  );

  const isSplash = formData.activityFormat === "splash";
  const isBig = formData.canvasType === "big";
  const canvasLimits = getFriendsCanvasLimits(
    formData.guests,
    formData.canvasType,
  );

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
        <div className="option-label">{t("friends_canvases_count")}</div>
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
