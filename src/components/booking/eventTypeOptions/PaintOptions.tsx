import { useState, useEffect, useRef } from "react";

import { useTranslator } from "@/components/TranslatorContext";
import { formatPrice } from "@/utils/price";

import type { EventTypeOptionsProps } from "./EventTypeOptions";
import type { EventType } from "../types";

const MIN_ADULTS = 0;
const MIN_KIDS = 0;
const MAX_TOTAL = 6;

export interface PaintFormData {
  adults: number;
  kids: number;
}

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

export function calculatePaintPrice(
  totalGuests: number,
  eventType?: EventType,
): number {
  const clamped = Math.max(1, Math.min(totalGuests, MAX_TOTAL));
  const prices =
    eventType === "customize_clothes"
      ? PRICES_CUSTOMIZE_CLOTHES
      : PRICES_THROW_PAINT;
  return prices[clamped];
}

const KIDS_AGE_HINT_BY_EVENT: Record<EventType, string> = {
  throw_paint: "throw_paint_kids_age_hint",
  customize_clothes: "customize_clothes_kids_age_hint",
  couples: "throw_paint_kids_age_hint", // not used for PaintOptions
  family: "throw_paint_kids_age_hint",
  friends: "throw_paint_kids_age_hint",
  individual: "throw_paint_kids_age_hint",
};

export function PaintOptions({
  eventType,
  onChange,
  showPrice,
  discount,
}: EventTypeOptionsProps) {
  const [formData, setFormData] = useState<PaintFormData>({
    adults: 2,
    kids: 0,
  });
  const t = useTranslator();
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const totalGuests = formData.adults + formData.kids;
    const totalAmount =
      totalGuests === 0 ? 0 : calculatePaintPrice(totalGuests, eventType);
    const productName = `${formData.adults} ${formData.adults === 1 ? "adult" : "adults"}, ${formData.kids} ${formData.kids === 1 ? "kid" : "kids"}`;

    onChangeRef.current({ amount: totalAmount, productName });
  }, [formData]);

  const handleAdultsChange = (value: number) => {
    const adults = Math.max(MIN_ADULTS, value);
    setFormData((prev) => {
      const kids = Math.min(prev.kids, MAX_TOTAL - adults);
      return { adults, kids };
    });
  };

  const handleKidsChange = (value: number) => {
    const kids = Math.max(MIN_KIDS, value);
    setFormData((prev) => {
      const adults = Math.max(
        MIN_ADULTS,
        Math.min(prev.adults, MAX_TOTAL - kids),
      );
      return { adults, kids };
    });
  };

  const totalGuests = formData.adults + formData.kids;
  const totalPrice =
    totalGuests === 0 ? 0 : calculatePaintPrice(totalGuests, eventType);

  return (
    <div className="paint-options">
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
          <span className="option-hint">
            {t(KIDS_AGE_HINT_BY_EVENT[eventType])}
          </span>
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
