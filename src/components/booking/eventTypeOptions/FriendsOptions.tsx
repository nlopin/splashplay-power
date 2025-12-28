import { useState, useEffect } from "react";

import { useTranslator } from "@/components/TranslatorContext";
import { formatPrice } from "@/utils/price";

import type { EventTypeOptionsProps } from "./EventTypeOptions";

const MIN_COUNT = 1;
const MAX_COUNT = 6;

export interface FriendsFormData {
  guests: number;
  canvases: number;
}

export function calculateFriendsPrice(canvases: number): number {
  if (canvases < MIN_COUNT) {
    canvases = MIN_COUNT;
  }

  const basePrices = [
    6000, // 1 canvas: €60
    9000, // 2 canvases: €90
    12000, // 3 canvases: €120
    14000, // 4 canvases: €140
    16000, // 5 canvases: €160
    18000, // 6 canvases: €180
  ];

  if (canvases <= MAX_COUNT) {
    return basePrices[canvases - MIN_COUNT];
  }

  return basePrices[basePrices.length - 1];
}

export function FriendsOptions({ onChange }: EventTypeOptionsProps) {
  const [formData, setFormData] = useState<FriendsFormData>({
    guests: MIN_COUNT,
    canvases: MIN_COUNT,
  });
  const t = useTranslator();

  // Read canvas query param on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const canvasParam = params.get("canvas");

    if (canvasParam) {
      const canvasValue = parseInt(canvasParam, 10);
      if (
        !isNaN(canvasValue) &&
        canvasValue >= MIN_COUNT &&
        canvasValue <= MAX_COUNT
      ) {
        setFormData((prev) => ({
          ...prev,
          canvases: canvasValue,
          guests: canvasValue,
        }));
      }
    }
  }, []);

  // Calculate total price and notify parent, update URL
  useEffect(() => {
    const totalAmount = calculateFriendsPrice(formData.canvases);
    const productName = `${formData.guests} guests, ${formData.canvases} canvases`;

    onChange({
      amount: totalAmount,
      productName,
    });

    // Update URL with the selected canvas count
    const url = new URL(window.location.href);
    url.searchParams.set("canvas", formData.canvases.toString());
    window.history.replaceState({}, "", url);
  }, [formData, onChange]);

  const handleGuestsChange = (value: number) => {
    const clampedValue = Math.max(MIN_COUNT, Math.min(value, MAX_COUNT));
    const syncCanvases = formData.guests === formData.canvases;

    setFormData({
      guests: clampedValue,
      canvases: syncCanvases ? clampedValue : formData.canvases,
    });
  };

  const handleCanvasesChange = (value: number) => {
    const clampedValue = Math.max(MIN_COUNT, Math.min(value, MAX_COUNT));
    setFormData((prev) => ({ ...prev, canvases: clampedValue }));
  };

  const totalPrice = calculateFriendsPrice(formData.canvases);

  return (
    <div className="friends-options">
      <div className="options-grid-unified">
        <div className="option-label">{t("friends_guests_count")}</div>
        <button
          type="button"
          className="number-input-btn"
          onClick={() => handleGuestsChange(formData.guests - 1)}
          disabled={formData.guests <= MIN_COUNT}
        >
          -
        </button>
        <input
          type="number"
          min={MIN_COUNT}
          max={MAX_COUNT}
          value={formData.guests}
          onChange={(e) =>
            handleGuestsChange(parseInt(e.target.value) || MIN_COUNT)
          }
          className="number-input"
        />
        <button
          type="button"
          className="number-input-btn"
          onClick={() => handleGuestsChange(formData.guests + 1)}
          disabled={formData.guests >= MAX_COUNT}
        >
          +
        </button>

        <div className="option-label">{t("friends_canvases_count")}</div>
        <button
          type="button"
          className="number-input-btn"
          onClick={() => handleCanvasesChange(formData.canvases - 1)}
          disabled={formData.canvases <= MIN_COUNT}
        >
          -
        </button>
        <input
          type="number"
          min={MIN_COUNT}
          max={MAX_COUNT}
          value={formData.canvases}
          onChange={(e) =>
            handleCanvasesChange(parseInt(e.target.value) || MIN_COUNT)
          }
          className="number-input"
        />
        <button
          type="button"
          className="number-input-btn"
          onClick={() => handleCanvasesChange(formData.canvases + 1)}
          disabled={formData.canvases >= MAX_COUNT}
        >
          +
        </button>

        <div className="option-label total-price-label">{t("total_price")}</div>
        <div></div>
        <div className="total-price">{formatPrice(totalPrice)}</div>
        <div></div>
      </div>
    </div>
  );
}
