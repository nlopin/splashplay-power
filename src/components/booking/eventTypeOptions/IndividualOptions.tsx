import { useEffect, useRef } from "react";

import { useTranslator } from "@/components/TranslatorContext";
import { formatPrice } from "@/utils/price";

import type { EventTypeOptionsProps } from "./EventTypeOptions";
import { INDIVIDUAL_PRICE } from "@/services/catalog/individualPricing";

export function IndividualOptions({
  onChange,
  showPrice,
  discount,
}: EventTypeOptionsProps) {
  const t = useTranslator();

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Fixed price: notify the parent once, on mount
  useEffect(() => {
    onChangeRef.current({
      amount: INDIVIDUAL_PRICE,
      guests: 1,
      selection: { eventType: "individual" },
    });
  }, []);

  const discountedPrice = discount
    ? Math.round(INDIVIDUAL_PRICE * (1 - discount / 100))
    : INDIVIDUAL_PRICE;

  if (!showPrice) return null;

  return (
    <div className="total-price-row">
      <div className="total-price-label">{t("total_price")}</div>
      <div className="total-price">
        {discount ? (
          <>
            <span className="price-before">
              <span className="price-original">
                {formatPrice(INDIVIDUAL_PRICE)}
              </span>
            </span>
            <span className="price-final">{formatPrice(discountedPrice)}</span>
          </>
        ) : (
          formatPrice(INDIVIDUAL_PRICE)
        )}
      </div>
    </div>
  );
}
