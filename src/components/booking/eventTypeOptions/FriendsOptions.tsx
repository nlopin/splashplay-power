import { useState, useEffect } from "react";

import { useTranslator } from "@/components/TranslatorContext";
import { formatPrice } from "@/utils/price";

import type { EventTypeOptionsProps } from "./EventTypeOptions";

export interface FriendsFormData {
  guests: number;
}

export function calculateFriendsPrice(guests: number): number {
  const minGuests = 2;

  if (guests < minGuests) {
    guests = minGuests;
  }

  const basePrices = [
    9000, // 2 guests: €90
    12000, // 3 guests: €120
    14000, // 4 guests: €140
    16000, // 5 guests: €160
    18000, // 6 guests: €180
  ];

  if (guests <= 6) {
    return basePrices[guests - minGuests];
  }

  return basePrices[basePrices.length - 1];
}

export function FriendsOptions({ onChange }: EventTypeOptionsProps) {
  const [formData, setFormData] = useState<FriendsFormData>({
    guests: 2,
  });
  const t = useTranslator();

  // Calculate total price and notify parent
  useEffect(() => {
    const totalAmount = calculateFriendsPrice(formData.guests);
    const productName = `${formData.guests} guests`;

    onChange({
      amount: totalAmount,
      productName,
    });
  }, [formData, onChange]);

  const handleInputChange = (value: number) => {
    const clampedValue = Math.max(2, Math.min(value, 6));
    setFormData({ guests: clampedValue });
  };

  const totalPrice = calculateFriendsPrice(formData.guests);

  return (
    <div className="friends-options">
      <div className="options-grid-unified">
        <div className="option-label">{t("friends_guests_count")}</div>
        <button
          type="button"
          className="number-input-btn"
          onClick={() => handleInputChange(formData.guests - 1)}
          disabled={formData.guests <= 2}
        >
          -
        </button>
        <input
          type="number"
          min="2"
          max="6"
          value={formData.guests}
          onChange={(e) => handleInputChange(parseInt(e.target.value) || 2)}
          className="number-input"
        />
        <button
          type="button"
          className="number-input-btn"
          onClick={() => handleInputChange(formData.guests + 1)}
          disabled={formData.guests >= 6}
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
